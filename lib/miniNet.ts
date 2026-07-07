// A deliberately tiny, dependency-free multilayer perceptron for the
// property pricing model (lib/pricingModel.ts). No ML framework: this is
// ~150 lines of plain matrix math so every step (forward pass, backprop,
// gradient update) is auditable in this one file — CLAUDE.md rules out
// black-box models, and pulling in e.g. TensorFlow.js would both violate
// that and fight Vercel's serverless runtime (native bindings, cold-start
// weight). Two small hidden layers is intentionally the ceiling here; this
// is sized for a few dozen input features and tens of thousands of training
// rows, not a general-purpose deep net.

export type MiniNetJSON = {
  layerSizes: number[]
  weights: number[][][] // per layer: [outUnits][inUnits]
  biases: number[][]    // per layer: [outUnits]
  featureMeans: number[]
  featureStds: number[]
  targetMean: number
  targetStd: number
}

function randInit(fanIn: number, fanOut: number, rng: () => number): number {
  // He initialization, tanh-friendly variant — keeps activations from
  // saturating at this network's small width/depth.
  const scale = Math.sqrt(2 / fanIn)
  return (rng() * 2 - 1) * scale
}

// Mulberry32 — small deterministic PRNG so a training run is reproducible
// from its logged seed (see pricing_model_runs.seed).
export function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tanh(x: number): number { return Math.tanh(x) }
function tanhDeriv(a: number): number { return 1 - a * a } // a = tanh(z) already

export class MiniNet {
  layerSizes: number[] // [input, hidden1, hidden2, ..., output=1]
  weights: number[][][]
  biases: number[][]
  featureMeans: number[]
  featureStds: number[]
  targetMean = 0
  targetStd = 1

  constructor(inputSize: number, hiddenSizes: number[], seed = 42) {
    const rng = mulberry32(seed)
    this.layerSizes = [inputSize, ...hiddenSizes, 1]
    this.weights = []
    this.biases = []
    for (let l = 1; l < this.layerSizes.length; l++) {
      const fanIn = this.layerSizes[l - 1]
      const fanOut = this.layerSizes[l]
      const W: number[][] = Array.from({ length: fanOut }, () =>
        Array.from({ length: fanIn }, () => randInit(fanIn, fanOut, rng)))
      const b = new Array(fanOut).fill(0)
      this.weights.push(W)
      this.biases.push(b)
    }
    this.featureMeans = new Array(inputSize).fill(0)
    this.featureStds = new Array(inputSize).fill(1)
  }

  setNormalization(means: number[], stds: number[], targetMean: number, targetStd: number) {
    this.featureMeans = means
    this.featureStds = stds.map(s => (s < 1e-6 ? 1 : s))
    this.targetMean = targetMean
    this.targetStd = targetStd || 1
  }

  normalizeInput(x: number[]): number[] {
    return x.map((v, i) => (v - this.featureMeans[i]) / this.featureStds[i])
  }

  // Returns per-layer activations (a[0] = normalized input) for use in both
  // predict() and backward().
  private forwardPass(xNorm: number[]): { activations: number[][]; zs: number[][] } {
    const activations: number[][] = [xNorm]
    const zs: number[][] = []
    let a = xNorm
    for (let l = 0; l < this.weights.length; l++) {
      const W = this.weights[l], b = this.biases[l]
      const isOutput = l === this.weights.length - 1
      const z = W.map((row, j) => row.reduce((s, w, k) => s + w * a[k], 0) + b[j])
      const aNext = isOutput ? z.slice() : z.map(tanh)
      zs.push(z)
      activations.push(aNext)
      a = aNext
    }
    return { activations, zs }
  }

  // Predicts in the model's original target units (e.g. euros/sqm), undoing
  // the z-score normalization applied at training time.
  predict(x: number[]): number {
    const { activations } = this.forwardPass(this.normalizeInput(x))
    const outNorm = activations[activations.length - 1][0]
    return outNorm * this.targetStd + this.targetMean
  }

  // One mini-batch gradient step. `weights` lets weakly-labeled rows (agent
  // estimates) count for less than real closed sales in the loss — the
  // concrete mechanism for "reinforced by agent feedback, but grounded more
  // in real prices than opinions."
  private step(batchX: number[][], batchYNorm: number[], batchW: number[], lr: number, l2: number) {
    const nLayers = this.weights.length
    const gradW: number[][][] = this.weights.map(W => W.map(row => row.map(() => 0)))
    const gradB: number[][] = this.biases.map(b => b.map(() => 0))
    let totalWeight = 0

    for (let n = 0; n < batchX.length; n++) {
      const xNorm = this.normalizeInput(batchX[n])
      const { activations, zs } = this.forwardPass(xNorm)
      const sw = batchW[n]
      totalWeight += sw

      const yHatNorm = activations[activations.length - 1][0]
      let dz: number[] = [(yHatNorm - batchYNorm[n]) * sw] // dL/dz for output layer (identity activation)

      for (let l = nLayers - 1; l >= 0; l--) {
        const aPrev = activations[l]
        const W = this.weights[l]
        for (let j = 0; j < W.length; j++) {
          for (let k = 0; k < W[j].length; k++) {
            gradW[l][j][k] += dz[j] * aPrev[k]
          }
          gradB[l][j] += dz[j]
        }
        if (l > 0) {
          const aCurr = activations[l] // = tanh(z) for hidden layers
          const dzPrev = new Array(this.layerSizes[l - 1]).fill(0)
          for (let k = 0; k < dzPrev.length; k++) {
            let sum = 0
            for (let j = 0; j < W.length; j++) sum += W[j][k] * dz[j]
            dzPrev[k] = sum * tanhDeriv(aCurr[k])
          }
          dz = dzPrev
        }
      }
    }

    const denom = Math.max(totalWeight, 1e-6)
    for (let l = 0; l < nLayers; l++) {
      for (let j = 0; j < this.weights[l].length; j++) {
        for (let k = 0; k < this.weights[l][j].length; k++) {
          const g = gradW[l][j][k] / denom + l2 * this.weights[l][j][k]
          this.weights[l][j][k] -= lr * g
        }
        this.biases[l][j] -= lr * (gradB[l][j] / denom)
      }
    }
  }

  // Fixed-step mini-batch training (not epoch-based) so cost scales with
  // `steps`, not dataset size — keeps a retrain bounded well within a
  // serverless function's execution limit even with tens of thousands of
  // registry rows. rng is passed in so the caller's seed also controls
  // minibatch sampling, making a run fully reproducible.
  train(X: number[][], yNorm: number[], sampleWeights: number[], opts: { steps: number; batchSize: number; lr: number; l2: number; seed: number }) {
    const rng = mulberry32(opts.seed + 1)
    const n = X.length
    for (let step = 0; step < opts.steps; step++) {
      const batchX: number[][] = []
      const batchY: number[] = []
      const batchW: number[] = []
      for (let i = 0; i < opts.batchSize; i++) {
        const idx = Math.floor(rng() * n)
        batchX.push(X[idx]); batchY.push(yNorm[idx]); batchW.push(sampleWeights[idx])
      }
      this.step(batchX, batchY, batchW, opts.lr, opts.l2)
    }
  }

  // Perturbation-based feature attribution: for each input, swap it out for
  // the training-set mean (i.e. "a neutral property") and measure how much
  // the prediction moves. Cheap, honest, and fully explainable — not
  // SHAP/LIME-exact, but every number here is directly traceable to a
  // forward-pass difference, matching CLAUDE.md's "an agent should be able
  // to see why a price was suggested."
  featureContributions(x: number[]): number[] {
    const basePred = this.predict(x)
    return x.map((_, i) => {
      const neutral = x.slice()
      neutral[i] = this.featureMeans[i]
      const neutralPred = this.predict(neutral)
      return basePred - neutralPred
    })
  }

  toJSON(): MiniNetJSON {
    return {
      layerSizes: this.layerSizes, weights: this.weights, biases: this.biases,
      featureMeans: this.featureMeans, featureStds: this.featureStds,
      targetMean: this.targetMean, targetStd: this.targetStd,
    }
  }

  static fromJSON(json: MiniNetJSON): MiniNet {
    const [inputSize, ...rest] = json.layerSizes
    const hiddenSizes = rest.slice(0, -1)
    const net = new MiniNet(inputSize, hiddenSizes)
    net.weights = json.weights
    net.biases = json.biases
    net.featureMeans = json.featureMeans
    net.featureStds = json.featureStds
    net.targetMean = json.targetMean
    net.targetStd = json.targetStd
    return net
  }
}

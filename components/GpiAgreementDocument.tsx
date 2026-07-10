// Renders KWAC's "Exclusive Representation Agreement — Lease/Rent" filled
// with a GPI client + unit's data. Shared by the agent's authenticated
// preview (app/gpi/agreement/[unitId]) and the public token-based view an
// emailed landlord opens (app/gpi/agreement/view/[token]) — same document,
// two different ways of getting the data to it.
//
// Legal boilerplate text is transcribed from the agency's own PDF template
// as closely as possible (only obvious OCR run-together spacing cleaned
// up) — this is a template for a real contract, not a paraphrase.
import type { CSSProperties, ReactNode } from 'react'

const RED = '#CC2229'
const BORDER = '#111'

export type GpiAgreementData = {
  full_name: string
  father_name: string | null
  address: string | null
  tin_number: string | null
  id_passport_number: string | null
  agent_full_name: string | null
  unit: {
    expected_rent: number | null
    address: string | null
    project: string | null
    unit_name: string | null
    description: string | null
    notices: string | null
    exclusive_agreement_date: string | null
    exclusive_agreement_duration_months: number | null
  }
}

function fmtDate(iso: string | null): { d: string; m: string; y: string } {
  const date = iso ? new Date(iso) : new Date()
  return { d: String(date.getDate()).padStart(2, '0'), m: String(date.getMonth() + 1).padStart(2, '0'), y: String(date.getFullYear()) }
}
function addMonths(iso: string | null, months: number | null) {
  if (!iso || !months) return null
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
function eur(n: number | null) {
  if (n == null) return '—'
  return `€${n.toLocaleString('el-GR')}`
}
function Blank({ children, min = 90 }: { children: ReactNode; min?: number }) {
  return <span style={{ display: 'inline-block', minWidth: min, borderBottom: '1px solid #999', padding: '0 4px', fontWeight: 600 }}>{children || ' '}</span>
}

export default function GpiAgreementDocument({ data }: { data: GpiAgreementData }) {
  const signDate = fmtDate(data.unit.exclusive_agreement_date)
  const expiryIso = addMonths(data.unit.exclusive_agreement_date, data.unit.exclusive_agreement_duration_months)
  const expiry = fmtDate(expiryIso)
  const propertyAddress = [data.unit.project, data.unit.unit_name, data.unit.address].filter(Boolean).join(' — ') || '—'
  const rentTotalWithVat = data.unit.expected_rent != null ? data.unit.expected_rent * 1.24 : null

  const s = {
    page: { maxWidth: '210mm', margin: '0 auto', background: '#fff', color: '#222', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", fontSize: 12.5, lineHeight: 1.6 } as const,
    section: { padding: '0 18mm' } as const,
    clause: { marginBottom: 10, textAlign: 'justify' as const },
  }

  return (
    <div style={s.page}>
      <style>{`
        @page { size: A4; margin: 14mm 0; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* Header */}
      <div style={{ ...s.section, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '14mm', marginBottom: 18 }}>
        <img src="https://www.kwac.gr/images/logow.png" alt="KW Athens Center" style={{ height: 44, filter: 'none' }} />
        <div style={{ textAlign: 'right', fontSize: 11, color: '#444', lineHeight: 1.7 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: RED, marginBottom: 2 }}>EXCLUSIVE LEASING AGREEMENT</div>
          <div style={{ fontWeight: 700 }}>KW ATHENS CENTER PC</div>
          <div>REAL ESTATE BROKERAGE</div>
          <div>10 Vasilissis Sofias Ave., 106 74, Syntagma Athens, Greece</div>
          <div>Phone: (0030) 211 013 1911</div>
          <div>T.I.N: 801085328, P.E.S.: D&apos; ATHINON G.E.MI.: 1487242030000</div>
          <div>www.kwac.gr, info@kwac.gr</div>
        </div>
      </div>

      <div style={s.section}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>BROKERAGE CONTRACT</div>
        <div style={{ marginBottom: 16 }}>Athens <Blank min={30}>{signDate.d}</Blank> / <Blank min={30}>{signDate.m}</Blank> / <Blank min={50}>{signDate.y}</Blank></div>

        <div style={{ background: RED, color: '#fff', fontWeight: 700, fontSize: 12, padding: '5px 10px', marginBottom: 0, letterSpacing: .5 }}>ASSIGNOR INFORMATION</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={td}>Full Name: <b>{data.full_name}</b></td>
              <td style={td}>Father Name: <b>{data.father_name || '—'}</b></td>
            </tr>
            <tr>
              <td style={td}>Address of Residence: <b>{data.address || '—'}</b></td>
              <td style={td}>TIN: <b>{data.tin_number || '—'}</b></td>
            </tr>
            <tr><td style={tdFull} colSpan={2}>Rent/Lease at: <b>{eur(data.unit.expected_rent)}/month</b></td></tr>
            <tr><td style={tdFull} colSpan={2}>Property Address: <b>{propertyAddress}</b></td></tr>
            <tr><td style={tdFull} colSpan={2}>Description: <b>{data.unit.description || '—'}</b></td></tr>
            <tr><td style={tdFull} colSpan={2}>Notices: <b>{data.unit.notices || '—'}</b></td></tr>
          </tbody>
        </table>

        <div style={{ color: RED, fontWeight: 700, fontSize: 12.5, marginBottom: 10, letterSpacing: .5 }}>COLLABORATION TERMS</div>

        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li style={s.clause}>I, the undersigned <Blank min={220}>{data.full_name}</Blank>, declare that I am the sole owner/co-owner, I represent the rest of the co-owners of the aforementioned property and assign <b>exclusively</b> to the real estate agency KWAC, an office of the real estate brokerage to KW ATHENS CENTER PC intermediate for RENT/LEASE of the property to any interested party in lieu of the price mentioned above.</li>
          <li style={s.clause}>I declare that the property for rent is not subject to seizure, judicial escrow, compulsory management or claim (legal defects), is free from any right of a third party in general, and has no actual defects and I declare that there is no contract that lead to any obligation to divest in exchange and that my and my franchisees titles of ownership, that I am obliged to present when I may be asked, are in full legal order. I declare that the aforementioned property will be maintained in the above legal and factual situation until the definitive purchase agreement, or a definitive exchange contract. In case of legal or actual defects or debts connected to the property, I will be obligated to settle them until the date set for the signing of the definitive purchase agreement, or the definitive exchange contract.</li>
          <li style={s.clause}>In case of a pre-agreement, a definitive contract, an exchange employment contract, or a leasing contract, after the intercession of <Blank min={140}>{data.agent_full_name}</Blank>, I personally undertake the obligation to pay a commission fee equal to 1 monthly rent of the final price of the leasing property, plus 24% VAT (Value Added Tax) total <Blank min={110}>{eur(rentTotalWithVat)}</Blank>. In case of renting the property I personally undertake the obligation to pay a commission fee of 1 month, total payment plus 24% VAT. The aforementioned fee is considered by me to be fair, reasonable and accordinate to the mediation and negotiating services required for the contract in question, therefore I expressly declare that there is no reason to reduce it.</li>
          <li style={s.clause}>I unconditionally accept that this exclusive representation agreement will be valid for <Blank min={40}>{data.unit.exclusive_agreement_duration_months ?? '—'}</Blank> months and is irrevocable during this time period, from the signature date of the present agreement to <Blank min={30}>{expiryIso ? expiry.d : '—'}</Blank> / <Blank min={30}>{expiryIso ? expiry.m : '—'}</Blank> / <Blank min={50}>{expiryIso ? expiry.y : '—'}</Blank>. Additionally, I consent that if the present agreement expires, without the lease of the property with the intermediation of KWAC, the present agreement will continue to be valid as a non-exclusive representation agreement. KWAC will still have the right to show the property to potential tenants, and, in case of a pre-agreement or a definitive contract lease agreement, after KWAC mediation, I undertake the obligation to pay the brokerage fee agreed therein, plus 24% VAT (Value Added Tax). Referring to the duration that the present exclusive representation agreement will be valid and irrevocable, I agree to be extended, for a period of time equal to any period that a broker&apos;s mediation activity is being hindered, due to inability to show the property to third parties.</li>
          <li style={s.clause}>
            a) The aforementioned brokerage fee, both myself and any physical people or legal entities that may act on my behalf, we promise and undertake the obligation to pay in full, upon signing the definitive lease, and if a pre-agreement is signed, at the signing thereof.<br />
            b) There is no reason to reduce the agreed brokerage fee.<br />
            c) I acknowledge that the real estate brokerage, KWAC, may also act on behalf of the counterparty and in that case should be paid from both the contracting parties.
          </li>
        </ol>
      </div>

      {/* Page 2 */}
      <div style={{ ...s.section, breakBefore: 'page', paddingTop: '14mm' }}>
        <ol start={6} style={{ paddingLeft: 18, margin: 0 }}>
          <li style={s.clause}>I declare that I acknowledge, while this agreement is in effect, I don&apos;t have the right to rent the aforementioned property myself or to assign to another / other brokers the right to mediate for rent thereof and that I hereby expressly waive the right described above.</li>
          <li style={s.clause}>I ALLOW the broker, KW KWAC, to place an advertising sign on my property. The costs of promotion and advertising of my property shall be borne entirely by the broker.</li>
          <li style={s.clause}>It is agreed by the parties to this agreement that the Court of First Instance of Athens is competent to resolve any dispute/conflict(s) of interest that may arise from the interpretation or implementation of the present agreement.</li>
          <li style={s.clause}>The present agreement may be denounced by me, only in writing, with a letter that should be handed to KW KWAC, within five (5) days from the signature date of the present agreement, otherwise my denouncement will be considered as invalid.</li>
          <li style={s.clause}>The company KW ATHENS CENTER PC complies with the General Data Protection Regulation (GDPR) and applies to the EU legal framework. In accordance with the provisions of the Regulation (EU) 2016/679 of the European Parliament and the Council of 27 April 2016, with the present agreement inform you that any personal data you have submitted/shared with KW ATHENS CENTER PC are collected, processed and archived exclusively for fulfilling the purpose of our collaboration. There is no intention for your personal information to be shared with any third party, except for statutory or contractual requirements derived from the Real Estate process of your interest. The obtained information will be stored within the company&apos;s database for a determined time period depending on the following lease/rent. Hereby, by undersigning the present agreement, I, the undersigned assignor, consent to KW ATHENS CENTER PC Privacy Policy.</li>
          <li style={s.clause}>This Agreement may only be modified in writing. Based on the above, this agreement was drafted, and after it was read, is signed by all the contracting parties, as follows. Every contracting party is provided with an identical copy of it.</li>
        </ol>

        <div style={{ fontWeight: 700, textAlign: 'center', margin: '28px 0 22px', letterSpacing: 1 }}>CONTRACTING PARTIES</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderTop: '1px solid #444', paddingTop: 6, fontWeight: 700 }}>ASSIGNOR</div>
            <div style={{ fontSize: 10.5, color: '#666', marginTop: 10 }}>National I.D.: <b>{data.id_passport_number || '—'}</b></div>
            <div style={{ fontSize: 10.5, color: '#666' }}>T.I.N.: <b>{data.tin_number || '—'}</b></div>
          </div>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderTop: '1px solid #444', paddingTop: 6, fontWeight: 700 }}>AGENT</div>
            <div style={{ fontSize: 10.5, color: '#666', marginTop: 10 }}>{data.agent_full_name || 'KW Athens Center'}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: '#666' }}>ATHENS</div>
      </div>
    </div>
  )
}

const td: CSSProperties = { border: `1px solid ${BORDER}22`, padding: '7px 10px', width: '50%' }
const tdFull: CSSProperties = { border: `1px solid ${BORDER}22`, padding: '7px 10px' }

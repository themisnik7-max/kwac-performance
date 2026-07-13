import { describe, it, expect } from 'vitest'
import { parseLeadEmail } from '../gmailLeads'

// Fixture reconstructed from the real lead-notification email/reveal-page
// screenshots the parser was designed against (2026-07-13) — #2446707,
// Βερανζέρου 34, the exact quoted client message, and the klhsh.netlify.app
// reveal link both as a button href and as the plain-text fallback these
// templates print underneath it.
const HTML_BODY = `
  <div>Έχετε νέα εκδήλωση ενδιαφέροντος!</div>
  <div>Ένας νέος πελάτης ενδιαφέρεται για το παρακάτω ακίνητο:</div>
  <div>#2446707</div>
  <div>Διαμέρισμα 40.8 τ.μ. προς Ενοικίαση</div>
  <div>Βερανζέρου 34</div>
  <div>€500</div>
  <div>ΜΗΝΥΜΑ ΠΕΛΑΤΗ</div>
  <blockquote>«ΕΠΙΚΟΙΝΩΝΗΣΤΕ ΜΑΖΙ ΤΗΣ, ΕΝΔΙΑΦΕΡΕΤΑΙ ΓΙΑ ΤΟ ΣΥΓΚΕΚΡΙΜΕΝΟ ΑΚΙΝΗΤΟ & ΘΑ ΗΘΕΛΕ ΠΛΗΡΟΦΟΡΙΕΣ.»</blockquote>
  <a href="https://klhsh.netlify.app/?id=f36bcf01-2dbc-410d-bd61-68b571614ca3">Δείτε τα στοιχεία επικοινωνίας</a>
  <div>Αν το κουμπί δεν δουλέψει: https://klhsh.netlify.app/?id=f36bcf01-2dbc-410d-bd61-68b571614ca3</div>
`
const BODY_TEXT = HTML_BODY.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('parseLeadEmail', () => {
  it('extracts the property code, client message, and reveal link from the confirmed real example', () => {
    const result = parseLeadEmail({
      id: 'msg1', subject: 'Έχετε νέα εκδήλωση ενδιαφέροντος!', bodyText: BODY_TEXT, bodyHtml: HTML_BODY,
    })
    expect(result.propertyCode).toBe('2446707')
    expect(result.message).toBe('ΕΠΙΚΟΙΝΩΝΗΣΤΕ ΜΑΖΙ ΤΗΣ, ΕΝΔΙΑΦΕΡΕΤΑΙ ΓΙΑ ΤΟ ΣΥΓΚΕΚΡΙΜΕΝΟ ΑΚΙΝΗΤΟ & ΘΑ ΗΘΕΛΕ ΠΛΗΡΟΦΟΡΙΕΣ.')
    expect(result.revealUrl).toBe('https://klhsh.netlify.app/?id=f36bcf01-2dbc-410d-bd61-68b571614ca3')
  })

  it('falls back to the plain-text fallback URL when there is no HTML part', () => {
    const result = parseLeadEmail({ id: 'msg2', subject: '', bodyText: BODY_TEXT, bodyHtml: '' })
    expect(result.propertyCode).toBe('2446707')
    expect(result.revealUrl).toBe('https://klhsh.netlify.app/?id=f36bcf01-2dbc-410d-bd61-68b571614ca3')
  })

  it('ignores unsubscribe/tracking links in favor of the real reveal link', () => {
    const html = HTML_BODY + `<a href="https://example.com/unsubscribe?x=1">Unsubscribe</a>`
    const result = parseLeadEmail({ id: 'msg3', subject: '', bodyText: BODY_TEXT, bodyHtml: html })
    expect(result.revealUrl).toBe('https://klhsh.netlify.app/?id=f36bcf01-2dbc-410d-bd61-68b571614ca3')
  })

  it('returns nulls gracefully when nothing matches instead of throwing', () => {
    const result = parseLeadEmail({ id: 'msg4', subject: 'Unrelated email', bodyText: 'Hello, just checking in.', bodyHtml: '' })
    expect(result.propertyCode).toBeNull()
    expect(result.message).toBeNull()
    expect(result.revealUrl).toBeNull()
  })
})

// Parses a "new expression of interest" portal notification email (the
// pattern confirmed live: Spitogatos/xe.gr-style — see ARCHITECTURE.md's
// Gmail-leads section) into what's reliably extractable: the listing code,
// the client's quoted message, and the reveal link the agent still has to
// click themselves (see lib/googleContacts.ts's comment on why this app
// never auto-visits that link). Name/phone/email are deliberately NOT
// parsed here — they live on the third-party reveal page, not the email.
import type { GmailLeadMessage } from './googleContacts'

export type ParsedLead = {
  propertyCode: string | null
  message: string | null
  revealUrl: string | null
}

// "#2446707" near "ακίνητο" in the confirmed example — anchored loosely
// (just "a # followed by 5-10 digits") since the exact surrounding wording
// isn't guaranteed to be identical across portals/templates.
const CODE_RE = /#\s*(\d{5,10})/

// The client's message is quoted in guillemets in the confirmed example:
// «ΕΠΙΚΟΙΝΩΝΗΣΤΕ ΜΑΖΙ ΤΗΣ...». Falls back to curly/straight double quotes
// in case a different portal's template uses those instead.
const QUOTE_RE = /[«"“]([^»"”]{3,500})[»"”]/

const REVEAL_LINK_TEXT_HINTS = ['στοιχεία επικοινωνίας', 'δείτε', 'επικοινωνία']

function extractHrefCandidates(html: string): string[] {
  const out: string[] = []
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(m[1])
  return out
}

function looksLikeTrackingOrUnsubscribe(url: string): boolean {
  return /unsubscribe|list-manage|utm_|\/track\b|mailto:/i.test(url)
}

// Prefers an <a href> whose link text hints at "see contact details" (most
// reliable when HTML is available); falls back to the plain-text fallback
// URL these templates print for clients whose mail app won't render the
// button (visible in the confirmed example: "Αν το κουμπί δεν δουλέψει: ...").
function extractRevealUrl(bodyHtml: string, bodyText: string): string | null {
  if (bodyHtml) {
    const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    const candidates: string[] = []
    while ((m = re.exec(bodyHtml))) {
      const href = m[1]
      const text = m[2].replace(/<[^>]+>/g, '').toLowerCase()
      if (looksLikeTrackingOrUnsubscribe(href)) continue
      if (REVEAL_LINK_TEXT_HINTS.some(hint => text.includes(hint))) return href
      candidates.push(href)
    }
    if (candidates.length) return candidates[0]
  }
  const urls = bodyText.match(/https?:\/\/[^\s)]+/g) || []
  const clean = urls.filter(u => !looksLikeTrackingOrUnsubscribe(u))
  return clean[0] || urls[0] || null
}

export function parseLeadEmail(msg: GmailLeadMessage): ParsedLead {
  const codeMatch = msg.bodyText.match(CODE_RE) || msg.subject.match(CODE_RE)
  const quoteMatch = msg.bodyText.match(QUOTE_RE)
  return {
    propertyCode: codeMatch ? codeMatch[1] : null,
    message: quoteMatch ? quoteMatch[1].trim() : null,
    revealUrl: extractRevealUrl(msg.bodyHtml, msg.bodyText),
  }
}

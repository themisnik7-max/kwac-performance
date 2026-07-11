// app/api/register/route.ts
// Self-registration: corporate email only → creates Supabase auth user + agents record

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // admin key needed to create auth users
)

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
  return initials || '??'
}

export async function POST(req: NextRequest) {
  // Pre-auth, public, and (per this audit) previously the only route in the
  // app with neither a session nor any rate limit — unlimited signup
  // attempts / email-existence enumeration via the 409 branch below. Keyed
  // on IP since there's no caller identity yet.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const withinRate = await checkRateLimit(sb, `register:${ip}`, 3600, 5)
  if (!withinRate) return NextResponse.json({ error: 'Πολλές προσπάθειες εγγραφής — δοκίμασε ξανά αργότερα.' }, { status: 429 })

  const body = await req.json()
  const email = (body.email ?? '').trim()
  const password = body.password
  const full_name = (body.full_name ?? '').trim()
  const phone = body.phone

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Συμπλήρωσε email, κωδικό και ονοματεπώνυμο.' }, { status: 400 })
  }

  // 1. Find which agency owns this email domain
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return NextResponse.json({ error: 'Μη έγκυρο email.' }, { status: 400 })

  const { data: agency } = await sb
    .from('agencies')
    .select('id, name, allowed_email_domain, require_approval')
    .ilike('allowed_email_domain', domain)
    .single()

  if (!agency) {
    return NextResponse.json({
      error: `Το email @${domain} δεν είναι εταιρικό email. Επικοινώνησε με τον διαχειριστή.`
    }, { status: 403 })
  }

  // 2. Check if agent already exists
  const { data: existing } = await sb
    .from('agents')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Υπάρχει ήδη λογαριασμός με αυτό το email.' }, { status: 409 })
  }

  // 3. Create Supabase auth user
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true, // auto-confirm for corporate emails
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Σφάλμα δημιουργίας χρήστη.' }, { status: 500 })
  }

  // 4. Insert agent record. Agencies with require_approval=true get created
  // inactive — getAuthedAgent (lib/auth.ts) rejects inactive agents on every
  // API route, so this is real enforcement, not just a UI flag. A CEO/Admin
  // must approve via /api/agents/pending before the account can do anything.
  const pendingApproval = agency.require_approval === true
  const { error: agentError } = await sb.from('agents').insert({
    id:         authData.user.id, // match auth.users.id
    email:      email.toLowerCase(),
    full_name,
    initials:   initialsFrom(full_name),
    phone:      phone || null,
    role:       'agent',
    agency_id:  agency.id,
    is_active:  !pendingApproval,
    joined_at:  new Date().toISOString(),
  })

  if (agentError) {
    // Rollback: delete the auth user we just created
    await sb.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: agentError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    pending_approval: pendingApproval,
    message: pendingApproval
      ? `Ο λογαριασμός σου δημιουργήθηκε και περιμένει έγκριση από τον διαχειριστή. Θα ενημερωθείς όταν ενεργοποιηθεί.`
      : `Καλωσήρθες στο KWAC OS, ${full_name.split(' ')[0]}! Συνδέσου τώρα.`,
    agency_name: agency.name,
  })
}

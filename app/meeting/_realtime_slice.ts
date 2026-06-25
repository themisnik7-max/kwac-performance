// SLICE: replace fetchComments polling with Supabase Realtime
// In app/meeting/page.tsx, replace the useEffect that calls fetchComments()
// on a timer with this subscription.
//
// Required import: import { RealtimeChannel } from '@supabase/supabase-js'

/*
useEffect(() => {
  if (!selected) return

  fetchComments(selected.id)
  fetchValuation(selected.id)

  const channel: RealtimeChannel = sb
    .channel(`meeting-comments:${selected.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_comments', filter: `property_id=eq.${selected.id}` },
      () => { fetchComments(selected.id) }
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meeting_valuations', filter: `property_id=eq.${selected.id}` },
      () => { fetchValuation(selected.id) }
    )
    .subscribe()

  return () => { sb.removeChannel(channel) }
}, [selected?.id])
*/

// NOTE: @supabase/supabase-js communicates via PostgREST (HTTPS), not direct pg TCP.
// PostgREST manages its own connection pool internally.
// Connection exhaustion only occurs if you add a direct pg driver (pg, Prisma, Drizzle).
// If you ever do, use the Supavisor pooler port 6543, not 5432.

export {}
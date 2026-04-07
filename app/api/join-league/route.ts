import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  code: z.string().min(1).max(8),
  tournamentId: z.string().uuid(),
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { code, tournamentId } = parsed.data
  const supabase = createServiceClient()

  // Find league
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
  if (league.tournament_id !== tournamentId) {
    return NextResponse.json({ error: 'League not for this tournament' }, { status: 400 })
  }

  // Check not already a member
  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', userId)
    .single()

  if (existing) return NextResponse.json({ error: 'Already in this league' }, { status: 400 })

  // Check capacity
  const { count } = await supabase
    .from('league_members')
    .select('id', { count: 'exact' })
    .eq('league_id', league.id)

  if ((count ?? 0) >= league.max_players) {
    return NextResponse.json({ error: 'League is full' }, { status: 400 })
  }

  // Join league
  await supabase.from('league_members').insert({
    league_id: league.id,
    user_id: userId,
  })

  // Create chips row
  await supabase.from('chips').insert({
    league_id: league.id,
    user_id: userId,
    tournament_id: tournamentId,
  })

  return NextResponse.json({ league })
}

// Fantasy Flagstick — Picks API
// All picks mutations go through here (server-side service client bypasses RLS)
// Browser client has anon key only — no Clerk JWT — so direct Supabase calls are blocked.

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const upsertSchema = z.object({
  leagueId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  round: z.number().int().min(1).max(4),
  holeNumber: z.number().int().min(1).max(18),
  playerId: z.string().uuid(),
  pricePaid: z.number(),
  isPostman: z.boolean(),
})

// POST — upsert a single pick, return all picks for that round
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { leagueId, tournamentId, round, holeNumber, playerId, pricePaid, isPostman } = parsed.data
  const supabase = createServiceClient()

  // Refuse to modify a locked pick
  const { data: existingPick } = await supabase
    .from('picks')
    .select('id, is_locked')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('round', round)
    .eq('hole_number', holeNumber)
    .maybeSingle()

  if (existingPick?.is_locked) {
    return NextResponse.json({ error: 'Cannot modify a locked pick' }, { status: 409 })
  }

  const { error } = await supabase.from('picks').upsert(
    {
      league_id: leagueId,
      user_id: userId,
      tournament_id: tournamentId,
      round,
      hole_number: holeNumber,
      player_id: playerId,
      price_paid: pricePaid,
      is_postman: isPostman,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'league_id,user_id,round,hole_number' }
  )

  if (error) {
    console.error('Pick upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return all picks for the round so the client can sync state
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('round', round)

  return NextResponse.json({ picks: picks ?? [] })
}

// DELETE — remove a single pick by hole number
export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const round = searchParams.get('round')
  const holeNumber = searchParams.get('holeNumber')

  if (!leagueId || !round || !holeNumber) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createServiceClient()

  // Refuse to delete a locked pick
  const { data: pick } = await supabase
    .from('picks')
    .select('id, is_locked')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('round', parseInt(round, 10))
    .eq('hole_number', parseInt(holeNumber, 10))
    .maybeSingle()

  if (pick?.is_locked) {
    return NextResponse.json({ error: 'Cannot remove a locked pick' }, { status: 409 })
  }

  await supabase
    .from('picks')
    .delete()
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('round', parseInt(round, 10))
    .eq('hole_number', parseInt(holeNumber, 10))

  // Return updated picks for the round
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('round', parseInt(round, 10))

  return NextResponse.json({ picks: picks ?? [] })
}

// GET — fetch all picks for a round
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const round = searchParams.get('round')

  if (!leagueId || !round) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .eq('round', parseInt(round, 10))

  return NextResponse.json({ picks: picks ?? [] })
}

// Fantasy Flagstick — Chips API
// Chip mutations via service client (browser client blocked by RLS)

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sponsorship'),
    chipsId: z.string().uuid(),
    round: z.number().int().min(1).max(4),
  }),
  z.object({
    action: z.literal('sponsorship_toggle'),
    chipsId: z.string().uuid(),
    round: z.number().int().min(1).max(4),
    leagueId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('postman'),
    chipsId: z.string().uuid(),
    round: z.number().int().min(1).max(4),
    playerId: z.string().uuid(),
  }),
])

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const supabase = createServiceClient()

  // Verify this chips row belongs to the current user
  const { data: chips } = await supabase
    .from('chips')
    .select('id, user_id')
    .eq('id', parsed.data.chipsId)
    .single()

  if (!chips || chips.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (parsed.data.action === 'sponsorship') {
    const { error } = await supabase
      .from('chips')
      .update({ sponsorship_used: true, sponsorship_round: parsed.data.round })
      .eq('id', parsed.data.chipsId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (parsed.data.action === 'sponsorship_toggle') {
    // Reject if any pick is locked for this round (chip state frozen)
    const { data: lockedPick } = await supabase
      .from('picks')
      .select('id')
      .eq('league_id', parsed.data.leagueId)
      .eq('user_id', userId)
      .eq('round', parsed.data.round)
      .eq('is_locked', true)
      .limit(1)
      .maybeSingle()

    if (lockedPick) {
      return NextResponse.json({ error: 'Locked in' }, { status: 409 })
    }

    // Get current sponsorship state
    const { data: currentChips } = await supabase
      .from('chips')
      .select('sponsorship_used, sponsorship_round')
      .eq('id', parsed.data.chipsId)
      .single()

    if (!currentChips) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Guard: can't toggle if already used for a different round
    if (currentChips.sponsorship_used && currentChips.sponsorship_round !== parsed.data.round) {
      return NextResponse.json({ error: 'Already used for another round' }, { status: 409 })
    }

    const isActive = currentChips.sponsorship_used && currentChips.sponsorship_round === parsed.data.round

    // Guard deactivation: if team value exceeds standard budget, can't turn Sponsor off
    if (isActive) {
      const BASE_BUDGET = 180
      const { data: roundPicks } = await supabase
        .from('picks')
        .select('price_paid')
        .eq('league_id', parsed.data.leagueId)
        .eq('user_id', userId)
        .eq('round', parsed.data.round)

      const spent = (roundPicks ?? []).reduce((sum, p) => sum + (p.price_paid ?? 0), 0)
      if (spent > BASE_BUDGET) {
        return NextResponse.json(
          { error: 'over_budget', message: 'Your team value exceeds the standard budget. Remove or swap players first before deactivating Sponsor.' },
          { status: 409 }
        )
      }
    }

    const update = isActive
      ? { sponsorship_used: false, sponsorship_round: null as number | null }
      : { sponsorship_used: true, sponsorship_round: parsed.data.round as number | null }

    const { error } = await supabase
      .from('chips')
      .update(update)
      .eq('id', parsed.data.chipsId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, sponsorship_used: update.sponsorship_used, sponsorship_round: update.sponsorship_round })
  }

  if (parsed.data.action === 'postman') {
    const col = `postman_r${parsed.data.round}_player_id`
    const { error } = await supabase
      .from('chips')
      .update({ [col]: parsed.data.playerId })
      .eq('id', parsed.data.chipsId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

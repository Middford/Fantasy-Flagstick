// Fantasy Flagstick — Member Team API
// Returns locked picks for a given member in a league+round.
// Unlocked picks are never returned, even to the requesting user's own team
// when viewed from another user's perspective (they use the Picks screen for that).
// Auth: caller must be a member of the league.

import { auth, clerkClient } from '@clerk/nextjs/server'

function clerkDisplayName(user: { firstName?: string | null; lastName?: string | null; emailAddresses?: { emailAddress: string }[] }): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (full) return full
  const email = user.emailAddresses?.[0]?.emailAddress
  if (email) return email.split('@')[0]
  return 'Player'
}
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const targetUserId = searchParams.get('userId')
  const round = searchParams.get('round')

  if (!leagueId || !targetUserId || !round) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const roundNum = parseInt(round, 10)

  // Verify caller is a member of this league
  const { data: callerMembership } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .single()

  if (!callerMembership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch target member's display name
  const { data: targetMember } = await supabase
    .from('league_members')
    .select('display_name, user_id')
    .eq('league_id', leagueId)
    .eq('user_id', targetUserId)
    .single()

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Fetch LOCKED picks only — server-side filter, never exposes unlocked picks
  const { data: picks } = await supabase
    .from('picks')
    .select('hole_number, player_id, price_paid, score_vs_par, is_postman, players(name, name_full, current_price)')
    .eq('league_id', leagueId)
    .eq('user_id', targetUserId)
    .eq('round', roundNum)
    .eq('is_locked', true)
    .order('hole_number')

  return NextResponse.json({
    displayName: await (async () => {
      if (targetMember.display_name) return targetMember.display_name
      try {
        const clerk = await clerkClient()
        const u = await clerk.users.getUser(targetUserId)
        const name = clerkDisplayName(u)
        await supabase.from('league_members').update({ display_name: name }).eq('league_id', leagueId).eq('user_id', targetUserId).is('display_name', null)
        return name
      } catch { return 'Player' }
    })(),
    picks: (picks ?? []).map((p) => ({
      holeNumber: p.hole_number,
      playerId: p.player_id,
      playerName: (p.players as { name_full?: string; name?: string } | null)?.name_full
        ?? (p.players as { name?: string } | null)?.name
        ?? 'Unknown',
      pricePaid: p.price_paid,
      scoreVsPar: p.score_vs_par,
      isPostman: p.is_postman ?? false,
    })),
  })
}

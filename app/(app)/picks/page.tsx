import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import PickScreen from '@/components/picks/PickScreen'

export default async function PicksPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = await createServerSupabaseClient()

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[#8ab89a]">No active tournament right now.</p>
        <p className="text-[#5a7a65] text-sm mt-1">Masters Round 1 begins Thursday 10 April at 14:00 BST.</p>
      </div>
    )
  }

  // Get holes
  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('number')

  // Get players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('status', 'active')
    .order('current_price', { ascending: false })

  // Get user's primary league
  const { data: membership } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (!membership) {
    // Auto-join global league
    const { data: globalLeague } = await supabase
      .from('leagues')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('type', 'global')
      .single()

    if (globalLeague) {
      await supabase.from('league_members').insert({
        league_id: globalLeague.id,
        user_id: userId,
      })
      await supabase.from('chips').insert({
        league_id: globalLeague.id,
        user_id: userId,
        tournament_id: tournament.id,
      })
    }
  }

  const leagueId = membership?.league_id ?? null

  // Get existing picks
  const { data: picks } = leagueId
    ? await supabase
        .from('picks')
        .select('*')
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .eq('round', tournament.current_round)
    : { data: [] }

  // Get chips
  const { data: chips } = leagueId
    ? await supabase
        .from('chips')
        .select('*')
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .eq('tournament_id', tournament.id)
        .single()
    : { data: null }

  if (!leagueId || !holes || !players) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[#8ab89a]">Setting up your league...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#c9a227]">Your Picks</h1>
            <p className="text-[#8ab89a] text-xs">
              Round {tournament.current_round} · {tournament.course_short}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#8ab89a]">
              {(picks ?? []).length}/18 holes picked
            </div>
          </div>
        </div>
      </header>

      <PickScreen
        userId={userId}
        leagueId={leagueId}
        tournamentId={tournament.id}
        round={tournament.current_round}
        initialHoles={holes}
        initialPlayers={players}
        initialPicks={picks ?? []}
        initialChips={chips ?? null}
      />
    </div>
  )
}

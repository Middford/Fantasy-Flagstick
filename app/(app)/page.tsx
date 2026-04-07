import { auth, currentUser } from '@clerk/nextjs/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import LivePill from '@/components/ui/LivePill'
import DramaFeed from '@/components/leaderboard/DramaFeed'
import BeatTheBookieTab from '@/components/leaderboard/BeatTheBookieTab'

async function getActiveTournament(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()
  return data
}

async function getUserLeague(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  tournamentId: string
) {
  const { data: membership } = await supabase
    .from('league_members')
    .select('league_id, display_name, leagues(id, name, code, type)')
    .eq('user_id', userId)
    .eq('leagues.tournament_id', tournamentId)
    .limit(1)
    .single()
  return membership
}

async function getUserStats(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  tournamentId: string,
  round: number,
  leagueId: string | null
) {
  if (!leagueId) return null
  const { data } = await supabase
    .from('picks')
    .select('score_vs_par, is_postman, is_locked')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .eq('round', round)
    .eq('league_id', leagueId)
  return data
}

export default async function HomePage() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const supabase = await createServerSupabaseClient()
  const tournament = await getActiveTournament(supabase)

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <h1 className="text-2xl font-bold text-[#c9a227] mb-2">Fantasy Flagstick</h1>
        <p className="text-[#8ab89a]">No active tournament. Masters Round 1 begins Thursday 10 April at 14:00 BST.</p>
      </div>
    )
  }

  const membership = await getUserLeague(supabase, userId, tournament.id)
  const leagueId = (membership?.leagues as { id: string } | null)?.id ?? null
  const picks = leagueId
    ? await getUserStats(supabase, userId, tournament.id, tournament.current_round, leagueId)
    : null

  const confirmedPicks = picks?.filter((p) => p.score_vs_par !== null) ?? []
  const totalScore = confirmedPicks.reduce((sum, p) => {
    const score = p.score_vs_par ?? 0
    return sum + (p.is_postman ? score * 2 : score)
  }, 0)
  const holesCompleted = confirmedPicks.length
  const scoreDisplay = totalScore === 0 ? 'E' : totalScore > 0 ? `+${totalScore}` : `${totalScore}`
  const displayName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? 'You'

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#c9a227]">Fantasy Flagstick</h1>
          <LivePill round={tournament.current_round} />
        </div>
        <p className="text-[#8ab89a] text-xs mt-0.5">
          {tournament.name} · {tournament.course_short} · Round {tournament.current_round}
        </p>
      </header>

      {/* Hero stats */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <p className="text-[#8ab89a] text-sm mb-3">Your Round {tournament.current_round}</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-2xl font-score font-bold text-white">{scoreDisplay}</div>
            <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Score</div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-2xl font-score font-bold text-white">{holesCompleted}</div>
            <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Holes</div>
          </div>
          <div className="bg-[#1a3d2b] rounded-xl p-3 text-center">
            <div className="text-2xl font-score font-bold text-[#c9a227]">
              {leagueId ? '—' : '—'}
            </div>
            <div className="text-[10px] text-[#8ab89a] uppercase tracking-wide mt-0.5">Position</div>
          </div>
        </div>
      </div>

      {/* Tabs: Drama Feed | Beat the Bookie */}
      <BeatTheBookieTab
        tournamentId={tournament.id}
        round={tournament.current_round}
        displayName={displayName}
        leagueId={leagueId}
      />
    </div>
  )
}

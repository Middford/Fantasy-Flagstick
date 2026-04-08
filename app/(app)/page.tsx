import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import LivePill from '@/components/ui/LivePill'
import BeatTheBookieTab from '@/components/leaderboard/BeatTheBookieTab'

async function getActiveTournament() {
  const db = createServiceClient()
  const { data } = await db
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()
  return data
}


export default async function HomePage() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const tournament = await getActiveTournament()

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <h1 className="text-2xl font-bold text-[#c9a227] mb-2">Fantasy Flagstick</h1>
        <p className="text-[#8ab89a]">No active tournament. Masters Round 1 begins Thursday 10 April at 14:00 BST.</p>
      </div>
    )
  }

  // Get user's primary league for this tournament — two-step to avoid unreliable PostgREST join filter
  const svc = createServiceClient()
  const { data: membership } = await svc
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  // Verify the league belongs to the active tournament
  let leagueId: string | null = null
  if (membership?.league_id) {
    const { data: league } = await svc
      .from('leagues')
      .select('id')
      .eq('id', membership.league_id)
      .eq('tournament_id', tournament.id)
      .single()
    leagueId = league?.id ?? null
  }

  const picks = leagueId
    ? await (async () => {
        const { data } = await svc
          .from('picks')
          .select('score_vs_par, is_postman, is_locked')
          .eq('user_id', userId)
          .eq('tournament_id', tournament.id)
          .eq('round', tournament.current_round)
          .eq('league_id', leagueId)
        return data
      })()
    : null
  const { data: holes } = await svc
    .from('holes')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('number')

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
        <div className="grid grid-cols-3 items-center">
          {/* Left: Masters logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/masters-logo.jpg" alt="The Masters" className="h-12 w-auto rounded" />
          {/* Centre: FF wordmark */}
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ff-logo.png" alt="F" className="h-20 w-20 object-cover" style={{ objectPosition: 'left 30%' }} />
            <span className="text-[#c9a227] font-bold text-lg leading-none -ml-8">antasy Flagstick</span>
          </div>
          {/* Right: Live pill */}
          <div className="flex justify-end">
            <LivePill round={tournament.current_round} />
          </div>
        </div>
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

      {/* Tabs: Leaderboard | Bookie | Course */}
      <BeatTheBookieTab
        tournamentId={tournament.id}
        round={tournament.current_round}
        displayName={displayName}
        leagueId={leagueId}
        userId={userId}
        holes={holes ?? []}
      />
    </div>
  )
}

import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import LivePill from '@/components/ui/LivePill'
import HomeSync from '@/components/ui/HomeSync'
import BeatTheBookieTab from '@/components/leaderboard/BeatTheBookieTab'

function positionLabel(pos: number, tied: boolean): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = pos % 100
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]
  return `${tied ? 'T' : ''}${pos}${suffix}`
}

export default async function HomePage() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const svc = createServiceClient()

  const { data: tournament } = await svc
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <h1 className="text-2xl font-bold text-[#c9a227] mb-2">Fantasy Flagstick</h1>
        <p className="text-[#8ab89a]">No active tournament. Masters Round 1 begins Thursday 10 April at 14:00 BST.</p>
      </div>
    )
  }

  // Get user's primary league for this tournament — two-step to avoid unreliable PostgREST join filter
  const { data: membership } = await svc
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

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

  // Fetch user picks + league-wide data in parallel
  const [
    { data: myPicksRaw },
    { data: holes },
    { data: allLeaguePicks },
    { data: leagueMembers },
    { data: leagueChips },
  ] = await Promise.all([
    svc
      .from('picks')
      .select('score_vs_par, is_postman, player_id')
      .eq('user_id', userId)
      .eq('tournament_id', tournament.id)
      .eq('round', tournament.current_round)
      .eq('league_id', leagueId ?? ''),
    svc
      .from('holes')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('number'),
    leagueId
      ? svc
          .from('picks')
          .select('user_id, player_id, score_vs_par')
          .eq('league_id', leagueId)
          .eq('round', tournament.current_round)
          .not('score_vs_par', 'is', null)
      : Promise.resolve({ data: null }),
    leagueId
      ? svc.from('league_members').select('user_id').eq('league_id', leagueId)
      : Promise.resolve({ data: null }),
    leagueId
      ? svc
          .from('chips')
          .select('user_id, postman_r1_player_id, postman_r2_player_id, postman_r3_player_id, postman_r4_player_id')
          .eq('league_id', leagueId)
      : Promise.resolve({ data: null }),
  ])

  // User's own score this round
  const confirmedPicks = (myPicksRaw ?? []).filter((p) => p.score_vs_par !== null)
  const myScore = confirmedPicks.reduce((sum, p) => {
    const score = p.score_vs_par ?? 0
    return sum + (p.is_postman ? score * 2 : score)
  }, 0)
  const holesCompleted = confirmedPicks.length
  const scoreDisplay = myScore === 0 ? 'E' : myScore > 0 ? `+${myScore}` : `${myScore}`

  // Position calculation
  let positionDisplay = '—'
  if (leagueId && leagueMembers?.length) {
    const postmanCol = `postman_r${tournament.current_round}_player_id` as
      | 'postman_r1_player_id' | 'postman_r2_player_id'
      | 'postman_r3_player_id' | 'postman_r4_player_id'

    const postmanMap = new Map<string, string | null>()
    leagueChips?.forEach((c) => postmanMap.set(c.user_id, c[postmanCol] ?? null))

    const memberScores = new Map<string, number>()
    leagueMembers.forEach((m) => memberScores.set(m.user_id, 0))
    allLeaguePicks?.forEach((pick) => {
      if (!memberScores.has(pick.user_id)) return
      const base = pick.score_vs_par ?? 0
      const isPostman = postmanMap.get(pick.user_id) === pick.player_id
      const score = isPostman ? base * 2 : base
      memberScores.set(pick.user_id, (memberScores.get(pick.user_id) ?? 0) + score)
    })

    const sorted = [...memberScores.entries()].sort((a, b) => a[1] - b[1])
    const myRoundScore = memberScores.get(userId) ?? 0
    const myIdx = sorted.findIndex(([uid]) => uid === userId)

    if (myIdx !== -1) {
      const tied = sorted.filter(([, s]) => s === myRoundScore).length > 1
      const pos = sorted.findIndex(([, s]) => s === myRoundScore) + 1
      positionDisplay = positionLabel(pos, tied)
    }
  }

  const displayName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? 'You'

  return (
    <div className="flex flex-col">
      {/* Live sync — keeps score/position fresh every 30s */}
      <HomeSync />

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
            <div className="text-2xl font-score font-bold text-[#c9a227] text-lg">
              {positionDisplay}
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

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { dataGolf } from '@/lib/datagolf/client'
import PickScreen from '@/components/picks/PickScreen'
import RoundTabs from '@/components/picks/RoundTabs'
import ShareButton from '@/components/ui/ShareButton'

// Convert DataGolf "H:MM" time string (Augusta EDT, UTC-4) to BST display
function formatEdtToBst(timeStr: string | undefined): string | null {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  // EDT is UTC-4, BST is UTC+1, so BST = EDT + 5 hours
  const bstH = (h + 5) % 24
  return `${String(bstH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Service client for public data (tournaments, holes, players) — bypasses RLS
  const db = createServiceClient()
  // Auth client for user-specific data (picks, chips, league membership)
  const supabase = await createServerSupabaseClient()

  // Get active tournament
  const { data: tournament } = await db
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

  // Check if cut has been made (any player with status='cut') — determines whether to show next round tab
  const { data: cutCheck } = await db
    .from('players')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('status', 'cut')
    .limit(1)

  const cutMade = (cutCheck?.length ?? 0) > 0
  const availableRounds = Array.from(
    { length: tournament.current_round },
    (_, i) => i + 1
  )
  if (cutMade && tournament.current_round < 4) {
    availableRounds.push(tournament.current_round + 1)
  }
  const filteredRounds = availableRounds.filter((r) => r >= 1 && r <= 4)

  // Resolve selected round from URL param (default to current_round)
  const { round: roundParam } = await searchParams
  const requestedRound = roundParam ? parseInt(roundParam, 10) : tournament.current_round
  const selectedRound = filteredRounds.includes(requestedRound)
    ? requestedRound
    : tournament.current_round

  // Get holes
  const { data: holes } = await db
    .from('holes')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('number')

  // Fetch ALL players (active + cut + withdrawn) so HoleGrid can display names
  // for picks referencing cut players (R1/R2 picks after the cut).
  // PlayerList filters to active-only internally.
  const [{ data: players }, { data: roundInProgressCheck }] = await Promise.all([
    db
      .from('players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('current_price', { ascending: false }),
    db
      .from('players')
      .select('holes_completed')
      .eq('tournament_id', tournament.id)
      .eq('status', 'active')
      .gt('holes_completed', 0)
      .lt('holes_completed', 18)
      .limit(1),
  ])
  const isLive = (roundInProgressCheck?.length ?? 0) > 0

  // Get user's primary league
  const { data: membership } = await db
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  let leagueId: string | null = membership?.league_id ?? null

  if (!leagueId) {
    // Auto-join global league — use service client so this works even if JWT template isn't configured
    const { data: globalLeague } = await db
      .from('leagues')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('type', 'global')
      .single()

    if (globalLeague) {
      await db.from('league_members').insert({
        league_id: globalLeague.id,
        user_id: userId,
      })
      await db.from('chips').insert({
        league_id: globalLeague.id,
        user_id: userId,
        tournament_id: tournament.id,
      })
      leagueId = globalLeague.id
    }
  }

  // Get existing picks for selected round
  const { data: picks } = leagueId
    ? await db
        .from('picks')
        .select('*')
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .eq('round', selectedRound)
    : { data: [] }

  // Get chips
  const { data: chips } = leagueId
    ? await db
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

  // Fetch tee times from DataGolf (cached 5 min by Next.js fetch)
  // Plain object (not Map) so it's serialisable for the client component
  const teeTimes: Record<string, { r1: string | null; r2: string | null; r3: string | null; r4: string | null }> = {}
  try {
    const fieldData = await dataGolf.getFieldUpdates()
    for (const fp of fieldData.field) {
      // DataGolf name format: "Last, First" → normalise to "First Last" for lookup
      const parts = fp.player_name.replace(/,/g, '').split(' ').filter(Boolean)
      const normalised =
        parts.length >= 2
          ? `${parts[parts.length - 1]} ${parts.slice(0, parts.length - 1).join(' ')}`
          : fp.player_name
      teeTimes[normalised.toLowerCase()] = {
        r1: formatEdtToBst(fp.r1_teetime),
        r2: formatEdtToBst(fp.r2_teetime),
        r3: formatEdtToBst(fp.r3_teetime),
        r4: formatEdtToBst(fp.r4_teetime),
      }
    }
  } catch {
    // Tee times are best-effort — don't block picks if DataGolf is down
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#c9a227]">Your Picks</h1>
            <p className="text-[#8ab89a] text-xs">
              Round {selectedRound} · {tournament.course_short}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#8ab89a]">
              {(picks ?? []).length}/18 holes picked
            </div>
            <ShareButton
              url={`/share/${userId}/${selectedRound}`}
              title={`My R${selectedRound} picks — Fantasy Flagstick`}
            />
          </div>
        </div>
      </header>

      {/* Round tabs — only show if more than one round available */}
      {filteredRounds.length > 1 && (
        <Suspense>
          <RoundTabs
            currentRound={tournament.current_round}
            selectedRound={selectedRound}
            availableRounds={filteredRounds}
            isLive={isLive}
          />
        </Suspense>
      )}

      <PickScreen
        userId={userId}
        leagueId={leagueId}
        tournamentId={tournament.id}
        round={selectedRound}
        currentRound={tournament.current_round}
        initialHoles={holes}
        initialPlayers={players}
        initialPicks={picks ?? []}
        initialChips={chips ?? null}
        teeTimes={teeTimes}
      />
    </div>
  )
}

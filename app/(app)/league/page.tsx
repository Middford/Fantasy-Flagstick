import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import CreateJoinLeague from '@/components/leaderboard/CreateJoinLeague'
import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'

export default async function LeaguePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = await createServerSupabaseClient()
  const db = createServiceClient()

  const { data: tournament } = await db
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
          <h1 className="text-lg font-bold text-[#c9a227]">League</h1>
        </header>
        <div className="px-4 py-8 text-center">
          <p className="text-[#8ab89a]">No active tournament.</p>
        </div>
      </div>
    )
  }

  // Get all leagues the user belongs to for this tournament
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, leagues(id, name, code, type, tournament_id)')
    .eq('user_id', userId)

  type LeagueRow = { id: string; name: string; code: string; type: string; tournament_id: string }

  const leagues = (memberships ?? [])
    .map((m) => m.leagues as unknown as LeagueRow | null)
    .filter((l): l is LeagueRow => l?.tournament_id === tournament.id)

  // Fetch member counts for all leagues in one query
  const memberCountMap = new Map<string, number>()
  if (leagues.length > 0) {
    const { data: memberRows } = await db
      .from('league_members')
      .select('league_id')
      .in('league_id', leagues.map((l) => l.id))

    memberRows?.forEach((r) => {
      memberCountMap.set(r.league_id, (memberCountMap.get(r.league_id) ?? 0) + 1)
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a1a10]">
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <h1 className="text-lg font-bold text-[#c9a227]">League</h1>
        <p className="text-[#8ab89a] text-xs">
          {tournament.name} · Round {tournament.current_round}
        </p>
      </header>

      {leagues.length > 0 && (
        <div className="flex flex-col divide-y divide-[#1a3d2b]">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/league/${league.id}`}
              className="flex items-center gap-3 px-4 py-4 active:bg-[#1a3d2b] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{league.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-[#8ab89a]">Code: {league.code}</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-[#5a7a65]">
                    <Users size={10} />
                    {memberCountMap.get(league.id) ?? 1}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#5a7a65] flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <div className={`${leagues.length > 0 ? 'border-t border-[#1a3d2b]' : ''}`}>
        <CreateJoinLeague tournamentId={tournament.id} userId={userId} />
      </div>
    </div>
  )
}

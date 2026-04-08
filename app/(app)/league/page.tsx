import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import CreateJoinLeague from '@/components/leaderboard/CreateJoinLeague'
import Link from 'next/link'
import { ChevronRight, Users, Trophy } from 'lucide-react'

export default async function LeaguePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Use service client for all reads — SELECT policy is open (RLS: using true),
  // userId is verified by Clerk auth() above. Avoids Clerk JWT template dependency.
  const db = createServiceClient()

  const { data: tournament } = await db
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a1a10]">
        <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
          <h1 className="text-lg font-bold text-[#c9a227]">League</h1>
        </header>
        <div className="px-4 py-8 text-center">
          <p className="text-[#8ab89a]">No active tournament.</p>
        </div>
      </div>
    )
  }

  const { data: memberships } = await db
    .from('league_members')
    .select('league_id, leagues(id, name, code, type, tournament_id)')
    .eq('user_id', userId)

  type LeagueRow = { id: string; name: string; code: string; type: string; tournament_id: string }

  const leagues = (memberships ?? [])
    .map((m) => m.leagues as unknown as LeagueRow | null)
    .filter((l): l is LeagueRow => l?.tournament_id === tournament.id)

  // Member counts for all leagues in one query
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

      {/* My Leagues */}
      <section className="flex-1 pb-4">
        <div className="px-4 pt-5 pb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#8ab89a] uppercase tracking-widest">My Leagues</h2>
          {leagues.length > 0 && (
            <span className="text-[10px] text-[#5a7a65]">{leagues.length} {leagues.length === 1 ? 'league' : 'leagues'}</span>
          )}
        </div>

        {leagues.length === 0 ? (
          <div className="mx-4 rounded-2xl border border-dashed border-[#2d5c3f] bg-[#0f2518] px-5 py-6 text-center">
            <Trophy size={28} className="mx-auto mb-3 text-[#2d5c3f]" />
            <p className="text-sm font-semibold text-[#8ab89a]">No leagues yet</p>
            <p className="text-xs text-[#5a7a65] mt-1">Create a league or join one with an invite code below</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#1a3d2b] border-y border-[#1a3d2b]">
            {leagues.map((league) => {
              const count = memberCountMap.get(league.id) ?? 1
              return (
                <Link
                  key={league.id}
                  href={`/league/${league.id}`}
                  className="flex items-center gap-3 px-4 py-4 active:bg-[#1a3d2b] transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a3d2b] flex-shrink-0">
                    <Trophy size={16} className="text-[#c9a227]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{league.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-[#8ab89a] font-mono tracking-wider">{league.code}</span>
                      <span className="flex items-center gap-1 text-[10px] text-[#5a7a65]">
                        <Users size={10} />
                        {count} {count === 1 ? 'player' : 'players'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#5a7a65] flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Create / Join */}
      <div className="border-t border-[#1a3d2b]">
        <CreateJoinLeague tournamentId={tournament.id} userId={userId} />
      </div>
    </div>
  )
}

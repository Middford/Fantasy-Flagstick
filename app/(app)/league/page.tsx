import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import LeagueLeaderboard from '@/components/leaderboard/LeagueLeaderboard'
import CreateJoinLeague from '@/components/leaderboard/CreateJoinLeague'

export default async function LeaguePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = await createServerSupabaseClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[#8ab89a]">No active tournament.</p>
      </div>
    )
  }

  // Get all user's leagues
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, display_name, leagues(id, name, code, type, tournament_id)')
    .eq('user_id', userId)

  const leagues = memberships
    ?.filter((m) => {
      const league = m.leagues as { tournament_id?: string } | null
      return league?.tournament_id === tournament.id
    })
    .map((m) => m.leagues)
    .filter(Boolean) ?? []

  if (leagues.length === 0) {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
          <h1 className="text-lg font-bold text-[#c9a227]">League</h1>
        </header>
        <CreateJoinLeague tournamentId={tournament.id} userId={userId} />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <h1 className="text-lg font-bold text-[#c9a227]">League</h1>
        <p className="text-[#8ab89a] text-xs">{tournament.name} · Round {tournament.current_round}</p>
      </header>
      <LeagueLeaderboard
        leagues={leagues as unknown as { id: string; name: string; code: string; type: string }[]}
        tournamentId={tournament.id}
        round={tournament.current_round}
        userId={userId}
      />
      <div className="p-4 border-t border-[#1a3d2b]">
        <CreateJoinLeague tournamentId={tournament.id} userId={userId} />
      </div>
    </div>
  )
}

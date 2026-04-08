import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import LeagueLeaderboard from '@/components/leaderboard/LeagueLeaderboard'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { leagueId } = await params
  const db = createServiceClient()
  const supabase = await createServerSupabaseClient()

  const [{ data: tournament }, { data: league }] = await Promise.all([
    db.from('tournaments').select('*').eq('active', true).single(),
    db.from('leagues').select('id, name, code, type, tournament_id').eq('id', leagueId).single(),
  ])

  if (!tournament || !league) notFound()

  // Verify user is a member — use RLS-backed client so this can't be spoofed
  const { data: membership } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .single()

  if (!membership) redirect('/league')

  return (
    <div className="flex flex-col min-h-screen bg-[#0a1a10]">
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <Link
          href="/league"
          className="flex items-center gap-1 text-[#8ab89a] text-xs mb-1 active:opacity-60"
        >
          <ArrowLeft size={12} /> All leagues
        </Link>
        <h1 className="text-lg font-bold text-[#c9a227]">{league.name}</h1>
        <p className="text-[#8ab89a] text-xs">
          Code: {league.code} · {tournament.name} · Round {tournament.current_round}
        </p>
      </header>

      <LeagueLeaderboard
        leagues={[league as { id: string; name: string; code: string; type: string }]}
        tournamentId={tournament.id}
        round={tournament.current_round}
        userId={userId}
      />
    </div>
  )
}

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function MatchplayPage() {
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

  // Get user's active match plays
  const { data: matches } = await supabase
    .from('match_play')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('tournament_id', tournament.id)
    .eq('round', tournament.current_round)

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <h1 className="text-lg font-bold text-[#c9a227]">Match Play</h1>
        <p className="text-[#8ab89a] text-xs">Round {tournament.current_round}</p>
      </header>

      {!matches?.length ? (
        <div className="px-4 py-8 text-center">
          <div className="text-4xl mb-3">⚔️</div>
          <h2 className="text-lg font-bold text-white mb-2">No Match Play Active</h2>
          <p className="text-sm text-[#8ab89a]">
            Your league commissioner can assign match play pairings.
            You use your same league picks — no separate picks needed.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#1a3d2b]">
          {matches.map((match) => {
            const isP1 = match.player1_id === userId
            const myHoles = isP1 ? match.player1_holes_won : match.player2_holes_won
            const theirHoles = isP1 ? match.player2_holes_won : match.player1_holes_won
            const halved = match.holes_halved

            let statusText = ''
            if (match.status === 'in_progress') {
              if (myHoles > theirHoles) statusText = `You lead ${myHoles - theirHoles} Up`
              else if (theirHoles > myHoles) statusText = `${theirHoles - myHoles} Down`
              else statusText = 'All Square'
            } else if (match.status === 'player1_won') {
              statusText = isP1 ? 'You won!' : 'Opponent won'
            } else if (match.status === 'player2_won') {
              statusText = isP1 ? 'Opponent won' : 'You won!'
            } else {
              statusText = 'Match Halved'
            }

            return (
              <div key={match.id} className="px-4 py-4">
                <div className="bg-[#1a3d2b] rounded-xl p-4">
                  <p className="text-xs text-[#8ab89a] mb-2">Round {match.round} Match</p>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-score font-bold text-white">{myHoles}</div>
                      <div className="text-xs text-[#c9a227]">You</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-[#8ab89a]">Halved</div>
                      <div className="text-lg font-score text-[#5a7a65]">{halved}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-score font-bold text-white">{theirHoles}</div>
                      <div className="text-xs text-[#8ab89a]">Opponent</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`text-sm font-bold
                      ${match.status === 'in_progress' ? 'text-[#c9a227]' : 'text-white'}`}>
                      {statusText}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

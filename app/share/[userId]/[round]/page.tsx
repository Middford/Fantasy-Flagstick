import { createServiceClient } from '@/lib/supabase/server'
import ShareCard from '@/components/share/ShareCard'

interface Props {
  params: Promise<{ userId: string; round: string }>
}

export default async function SharePage({ params }: Props) {
  const { userId, round: roundStr } = await params
  const round = parseInt(roundStr, 10)

  const supabase = createServiceClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('active', true)
    .single()

  if (!tournament) return <div>Tournament not found</div>

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // Get picks with player data
  const { data: picks } = await supabase
    .from('picks')
    .select('*, players(name, name_full)')
    .eq('user_id', userId)
    .eq('tournament_id', tournament.id)
    .eq('round', round)
    .order('hole_number')

  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('number')

  return (
    <div className="min-h-screen bg-[#0a1a10] flex flex-col items-center justify-start p-4">
      <ShareCard
        displayName={profile?.display_name ?? 'Player'}
        tournamentName={tournament.name}
        round={round}
        picks={picks ?? []}
        holes={holes ?? []}
        userId={userId}
      />
    </div>
  )
}

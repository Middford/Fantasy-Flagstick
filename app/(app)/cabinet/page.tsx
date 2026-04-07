import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const MAJOR_TROPHIES = [
  { id: 'green_jacket', name: 'Green Jacket', detail: 'Masters Global Winner', emoji: '🟢' },
  { id: 'claret_jug', name: 'Claret Jug', detail: 'The Open Global Winner', emoji: '⚗️' },
  { id: 'us_open', name: 'US Open Trophy', detail: 'US Open Global Winner', emoji: '🔵' },
  { id: 'wanamaker', name: 'Wanamaker Trophy', detail: 'PGA Championship Global Winner', emoji: '🏺' },
  { id: 'grand_slam', name: 'Grand Slam', detail: 'Win all four majors', emoji: '👑' },
]

export default async function CabinetPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = await createServerSupabaseClient()

  const { data: trophies } = await supabase
    .from('trophies')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const earnedTypes = new Set(trophies?.map((t) => t.type) ?? [])
  const leagueTrophies = trophies?.filter((t) => t.type === 'league') ?? []

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <h1 className="text-lg font-bold text-[#c9a227]">Trophy Cabinet</h1>
      </header>

      {/* Profile header */}
      <div className="px-4 py-4 border-b border-[#1a3d2b] flex items-center gap-4">
        <div className="text-4xl">{profile?.avatar_emoji ?? '🏌️'}</div>
        <div>
          <p className="font-bold text-white">{profile?.display_name ?? 'Player'}</p>
          <p className="text-sm text-[#8ab89a]">
            {profile?.total_majors_played ?? 0} majors played
          </p>
        </div>
      </div>

      {/* Major trophies */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <h2 className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
          Major Titles
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {MAJOR_TROPHIES.map((trophy) => {
            const earned = earnedTypes.has(trophy.id)
            return (
              <div
                key={trophy.id}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border
                  ${earned
                    ? 'border-[#c9a227] bg-[#1a3d2b]'
                    : 'border-[#1a3d2b] bg-[#0a1a10] opacity-30'}`}
              >
                <span className="text-2xl">{trophy.emoji}</span>
                <span className="text-[9px] text-center text-[#8ab89a] leading-tight">
                  {trophy.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* League trophies */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
          League Trophies ({leagueTrophies.length})
        </h2>
        {leagueTrophies.length === 0 ? (
          <p className="text-sm text-[#5a7a65]">
            Win your league to earn a trophy. Masters Round 1 is Thursday.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {leagueTrophies.map((trophy) => (
              <div
                key={trophy.id}
                className="bg-[#1a3d2b] border border-[#c9a227] rounded-xl p-3"
              >
                <div className="text-2xl mb-1">🏆</div>
                <p className="text-xs font-bold text-[#c9a227]">{trophy.name}</p>
                <p className="text-[10px] text-[#8ab89a] mt-0.5">{trophy.detail}</p>
                <p className="text-[10px] text-[#5a7a65] mt-1">{trophy.year}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

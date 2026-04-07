import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UserButton } from '@clerk/nextjs'

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const supabase = await createServerSupabaseClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const { data: trophies } = await supabase
    .from('trophies')
    .select('id')
    .eq('user_id', userId)

  const displayName =
    profile?.display_name ??
    user?.firstName ??
    user?.emailAddresses?.[0]?.emailAddress ??
    'Player'

  const SEASONS = [
    { key: 'masters', name: 'Masters', emoji: '🟢' },
    { key: 'pga', name: 'PGA', emoji: '🏺' },
    { key: 'usopen', name: 'US Open', emoji: '🔵' },
    { key: 'open', name: 'The Open', emoji: '⚗️' },
  ]

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a1a10] border-b border-[#1a3d2b] px-4 py-3">
        <h1 className="text-lg font-bold text-[#c9a227]">Profile</h1>
      </header>

      {/* Profile card */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <div className="flex items-center gap-4">
          <div className="text-5xl">{profile?.avatar_emoji ?? '🏌️'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{displayName}</h2>
            <p className="text-sm text-[#8ab89a]">
              {profile?.total_majors_played ?? 0} majors · {trophies?.length ?? 0} trophies
            </p>
          </div>
          <UserButton
            appearance={{
              variables: { colorPrimary: '#c9a227' },
            }}
          />
        </div>
      </div>

      {/* 2026 Season */}
      <div className="px-4 py-4 border-b border-[#1a3d2b]">
        <h2 className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
          2026 Season
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {SEASONS.map((s) => (
            <div key={s.key} className="bg-[#1a3d2b] rounded-xl p-3 text-center">
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="text-sm font-score font-bold text-white">—</div>
              <div className="text-[9px] text-[#8ab89a] mt-0.5">{s.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next major countdown */}
      <div className="px-4 py-4">
        <div className="bg-[#1a3d2b] rounded-xl p-4 text-center border border-[#2d5c3f]">
          <p className="text-[#8ab89a] text-sm">Masters Round 1</p>
          <p className="text-2xl font-bold text-[#c9a227] mt-1">Thursday 10 April</p>
          <p className="text-[#8ab89a] text-sm mt-0.5">14:00 BST · Augusta National</p>
        </div>
      </div>
    </div>
  )
}

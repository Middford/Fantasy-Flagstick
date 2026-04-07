import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UserButton } from '@clerk/nextjs'
import ProfileTabs from '@/components/profile/ProfileTabs'

const MAJOR_TROPHIES = [
  { id: 'green_jacket', name: 'Green Jacket', detail: 'Masters Global Winner', emoji: '🟢' },
  { id: 'claret_jug', name: 'Claret Jug', detail: 'The Open Global Winner', emoji: '⚗️' },
  { id: 'us_open', name: 'US Open Trophy', detail: 'US Open Global Winner', emoji: '🔵' },
  { id: 'wanamaker', name: 'Wanamaker Trophy', detail: 'PGA Championship Global Winner', emoji: '🏺' },
  { id: 'grand_slam', name: 'Grand Slam', detail: 'Win all four majors', emoji: '👑' },
]

const SEASONS = [
  { key: 'masters', name: 'Masters', emoji: '🟢' },
  { key: 'pga', name: 'PGA', emoji: '🏺' },
  { key: 'usopen', name: 'US Open', emoji: '🔵' },
  { key: 'open', name: 'The Open', emoji: '⚗️' },
]

export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const supabase = await createServerSupabaseClient()

  const [{ data: profile }, { data: trophies }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('trophies').select('*').eq('user_id', userId).order('earned_at', { ascending: false }),
  ])

  const displayName =
    profile?.display_name ??
    user?.firstName ??
    user?.emailAddresses?.[0]?.emailAddress ??
    'Player'

  const earnedTypes = (trophies ?? []).map((t) => t.type)
  const leagueTrophies = (trophies ?? []).filter((t) => t.type === 'league')

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
          <UserButton appearance={{ variables: { colorPrimary: '#c9a227' } }} />
        </div>
      </div>

      <ProfileTabs
        seasons={SEASONS}
        majorTrophies={MAJOR_TROPHIES}
        earnedTypes={earnedTypes}
        leagueTrophies={leagueTrophies}
        majorsPlayed={profile?.total_majors_played ?? 0}
      />
    </div>
  )
}

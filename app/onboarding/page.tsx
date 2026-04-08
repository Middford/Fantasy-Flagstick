import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

async function saveDisplayName(formData: FormData) {
  'use server'
  const displayName = (formData.get('displayName') as string | null)?.trim()
  if (!displayName) return

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const db = createServiceClient()

  // Update all league_members rows for this user
  await db
    .from('league_members')
    .update({ display_name: displayName })
    .eq('user_id', userId)

  // Upsert profiles.display_name too (in case profile row exists)
  await db
    .from('profiles')
    .upsert({ id: userId, display_name: displayName }, { onConflict: 'id' })

  redirect('/')
}

export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-[#0a1a10] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#c9a227] font-serif">Fantasy Flagstick</h1>
          <p className="text-[#8ab89a] mt-1 text-sm">One last thing before you pick your team</p>
        </div>

        <div className="bg-[#1a3d2b] rounded-2xl p-6 border border-[#2d5c3f]">
          <h2 className="text-lg font-bold text-white mb-1">What&apos;s your name?</h2>
          <p className="text-[#8ab89a] text-sm mb-5">
            This is how you&apos;ll appear on the leaderboard to other players.
          </p>

          <form action={saveDisplayName} className="flex flex-col gap-4">
            <div>
              <label htmlFor="displayName" className="block text-xs font-semibold text-[#8ab89a] uppercase tracking-wide mb-1.5">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                minLength={2}
                maxLength={32}
                placeholder="e.g. David Middleton"
                autoFocus
                className="w-full bg-[#0a1a10] border border-[#2d5c3f] rounded-xl px-4 py-3 text-white placeholder-[#5a7a65] text-sm focus:outline-none focus:border-[#c9a227] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#c9a227] text-[#0a1a10] font-bold py-3 rounded-xl text-sm active:scale-95 transition-all"
            >
              Let&apos;s go →
            </button>
          </form>
        </div>

        <p className="text-[10px] text-[#5a7a65] text-center mt-4">
          You can change this later in your profile.
        </p>
      </div>
    </div>
  )
}

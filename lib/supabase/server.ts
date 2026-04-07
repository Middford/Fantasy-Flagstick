import { createServerClient } from '@supabase/ssr'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

// Server-side Supabase client — attaches Clerk JWT so RLS uses Clerk user ID
// Using 'any' generic to avoid Supabase type inference issues; use type imports from ./types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createServerSupabaseClient(): Promise<ReturnType<typeof createServerClient<any>>> {
  const cookieStore = await cookies()
  const { getToken } = await auth()
  const clerkToken = await getToken({ template: 'supabase' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
      global: {
        headers: clerkToken
          ? { Authorization: `Bearer ${clerkToken}` }
          : {},
      },
    }
  )
}

// Service role client — bypasses RLS, for server-side cron jobs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceClient(): ReturnType<typeof createServerClient<any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

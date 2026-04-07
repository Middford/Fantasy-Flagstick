import { createBrowserClient } from '@supabase/ssr'

// Untyped client — use imported types (Tournament, Player, etc.) for type safety
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

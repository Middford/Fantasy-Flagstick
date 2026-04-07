'use client'

import { useEffect } from 'react'

const SYNC_INTERVAL = 30_000 // 30 seconds
const SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET

// Triggers score sync from the client every 30 seconds during active tournament.
// Replaces Vercel Cron (which requires Pro plan for <1 day intervals).
export function useScoreSync(active: boolean) {
  useEffect(() => {
    if (!active) return

    async function sync() {
      try {
        await fetch(`/api/sync-scores?secret=${SECRET}`)
      } catch {
        // Silent fail — scores will catch up on next interval
      }
    }

    // Sync immediately on mount, then every 30s
    sync()
    const interval = setInterval(sync, SYNC_INTERVAL)
    return () => clearInterval(interval)
  }, [active])
}

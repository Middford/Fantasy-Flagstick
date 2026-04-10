'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useScoreSync } from '@/hooks/useScoreSync'

// Keeps the home page score/position data live:
// - triggers score sync every 30s (same as picks tab)
// - calls router.refresh() every 30s so server component re-fetches latest DB state
export default function HomeSync() {
  useScoreSync(true)
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(interval)
  }, [router])

  return null
}

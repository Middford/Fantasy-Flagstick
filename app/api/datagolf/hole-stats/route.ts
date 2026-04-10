import { NextResponse } from 'next/server'
import { dataGolf } from '@/lib/datagolf/client'

interface HoleStat {
  hole: number
  avg: number | null
  birdie_pct: number | null
  par_pct: number | null
  bogey_pct: number | null
}

// Returns { holes: [{ hole, avg, birdie_pct, par_pct, bogey_pct }] }
// Combines morning and afternoon waves by averaging
// Cache: 5 min
export async function GET() {
  try {
    const data = await dataGolf.getLiveHoleStats().catch(() => null)

    if (!data || !data.courses || data.courses.length === 0) {
      return NextResponse.json(
        { holes: [] },
        { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
      )
    }

    // Use the first course, latest round with data
    const course = data.courses[0]
    if (!course.rounds || course.rounds.length === 0) {
      return NextResponse.json(
        { holes: [] },
        { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
      )
    }

    // Find the round with the most hole data
    const latestRound = course.rounds.reduce((best, r) =>
      (r.holes?.length ?? 0) >= (best.holes?.length ?? 0) ? r : best
    )

    const holes: HoleStat[] = (latestRound.holes ?? []).map((h) => {
      const morning = h.morning_wave
      const afternoon = h.afternoon_wave

      // Average the two waves — fall back to whichever wave has data
      const avg = avgTwo(morning?.avg, afternoon?.avg)
      const birdie_pct = avgTwo(morning?.birdie_pct, afternoon?.birdie_pct)
      const par_pct = avgTwo(morning?.par_pct, afternoon?.par_pct)
      const bogey_pct = avgTwo(morning?.bogey_pct, afternoon?.bogey_pct)

      return { hole: h.hole, avg, birdie_pct, par_pct, bogey_pct }
    })

    return NextResponse.json(
      { holes },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
    )
  } catch {
    return NextResponse.json({ holes: [] }, { status: 200 })
  }
}

function avgTwo(a: number | undefined, b: number | undefined): number | null {
  if (a != null && b != null) return (a + b) / 2
  if (a != null) return a
  if (b != null) return b
  return null
}

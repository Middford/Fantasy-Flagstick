import { NextResponse } from 'next/server'
import { dataGolf } from '@/lib/datagolf/client'

// Returns [{ dg_id, win_pct }] — in-play if live, pre-tournament if not
// Cache: 2 min (in-play) — Next.js revalidate is set on the fetch inside the client
export async function GET() {
  try {
    // Try in-play first — if event is live, this has real probabilities
    const inPlay = await dataGolf.getInPlayPredictions().catch(() => null)

    if (inPlay && inPlay.data && inPlay.data.length > 0) {
      const result = inPlay.data
        .filter((p) => p.win != null)
        .map((p) => ({ dg_id: String(p.dg_id), win_pct: p.win ?? 0 }))

      return NextResponse.json(
        { source: 'in-play', event_name: inPlay.event_name, players: result },
        { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=30' } }
      )
    }

    // Fall back to pre-tournament
    const preTournament = await dataGolf.getPreTournamentPredictions().catch(() => null)

    if (preTournament && Array.isArray(preTournament.baseline) && preTournament.baseline.length > 0) {
      const result = preTournament.baseline
        .filter((p) => p.win != null)
        .map((p) => ({ dg_id: String(p.dg_id), win_pct: p.win ?? 0 }))

      return NextResponse.json(
        { source: 'pre-tournament', event_name: preTournament.event_name, players: result },
        { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=300' } }
      )
    }

    return NextResponse.json(
      { source: 'none', players: [] },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=30' } }
    )
  } catch {
    return NextResponse.json({ source: 'error', players: [] }, { status: 200 })
  }
}

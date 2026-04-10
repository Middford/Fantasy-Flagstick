import { NextResponse } from 'next/server'
import { dataGolf } from '@/lib/datagolf/client'

// Returns [{ dg_id, proj_points_total }]
// Cache: 5 min
export async function GET() {
  try {
    const data = await dataGolf.getFantasyProjections().catch(() => null)

    if (!data || !data.projections || data.projections.length === 0) {
      return NextResponse.json(
        { players: [] },
        { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
      )
    }

    const players = data.projections.map((p) => ({
      dg_id: String(p.dg_id),
      proj_points_total: p.proj_points_total ?? null,
    }))

    return NextResponse.json(
      { players },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
    )
  } catch {
    return NextResponse.json({ players: [] }, { status: 200 })
  }
}

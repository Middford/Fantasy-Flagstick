import { NextResponse } from 'next/server'
import { dataGolf } from '@/lib/datagolf/client'

// Returns [{ dg_id, player_name, sg_total }] for live SG column on leaderboard
// Cache: 2 min
export async function GET() {
  try {
    const data = await dataGolf.getLiveTournamentStats(
      'sg_putt,sg_arg,sg_app,sg_ott,sg_t2g',
      'event_cumulative',
      'value',
      'pga'
    ).catch(() => null)

    if (!data) {
      return NextResponse.json(
        { players: [] },
        { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=30' } }
      )
    }

    const entries = data.live_stats ?? data.data ?? []
    const players = entries.map((p) => {
      // DG format is "Surname, Firstname" — convert to "Firstname Surname"
      const dgName = p.player_name ?? ''
      const commaIdx = dgName.indexOf(',')
      const normalizedName = commaIdx > -1
        ? `${dgName.slice(commaIdx + 1).trim()} ${dgName.slice(0, commaIdx).trim()}`
        : dgName

      // sg_total is not always returned; sum components if available
      const sg_putt = p.sg_putt ?? null
      const sg_arg = p.sg_arg ?? null
      const sg_app = p.sg_app ?? null
      const sg_ott = p.sg_ott ?? null
      const parts = [sg_putt, sg_arg, sg_app, sg_ott].filter((v): v is number => v !== null)
      const sg_total = parts.length > 0 ? parts.reduce((s, v) => s + v, 0) : null

      return {
        dg_id: String(p.dg_id),
        player_name: normalizedName,
        sg_total,
      }
    })

    return NextResponse.json(
      { players },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=30' } }
    )
  } catch {
    return NextResponse.json({ players: [] }, { status: 200 })
  }
}

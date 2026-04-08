import { NextResponse } from 'next/server'
import { getScoreboard } from '@/lib/espn/client'

export interface MastersEntry {
  position: string   // "1", "T2", "CUT", "WD"
  name: string
  total: string      // "E", "-5", "+2", "CUT"
  thru: string       // "F", "14", "-"
  status: 'active' | 'cut' | 'wd' | 'dq'
}

function parseScoreNum(score: string): number | null {
  if (!score) return null
  const s = score.trim().toUpperCase()
  if (s === 'E') return 0
  if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF') return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function scoreStatus(score: string): MastersEntry['status'] {
  const s = (score ?? '').trim().toUpperCase()
  if (s === 'CUT' || s === 'MDF') return 'cut'
  if (s === 'WD') return 'wd'
  if (s === 'DQ') return 'dq'
  return 'active'
}

export async function GET() {
  try {
    const scoreboard = await getScoreboard()
    const mastersEvent = scoreboard.events.find(
      (e) => e.name.toLowerCase().includes('masters') || e.name.toLowerCase().includes('augusta')
    )

    if (!mastersEvent?.competitions?.[0]?.competitors) {
      return NextResponse.json({ entries: [], eventName: null, status: 'pre' })
    }

    const competitors = mastersEvent.competitions[0].competitors
    const eventName = mastersEvent.name
    const eventStatus = mastersEvent.status?.type?.state ?? 'pre'

    // Parse competitors — ESPN returns them sorted by position
    const raw = competitors.map((c) => {
      const scoreStr = c.score ?? 'E'
      const status = scoreStatus(scoreStr)
      const scoreNum = parseScoreNum(scoreStr)

      // Count holes completed in current round from linescores
      const completedHoles = (c.linescores ?? []).filter(
        (ls) => ls.value && ls.value !== 'F' && ls.value !== '-' && ls.value !== '--'
      ).length
      const thru = completedHoles === 18 ? 'F' : completedHoles > 0 ? `${completedHoles}` : '-'

      return {
        name: c.athlete?.displayName ?? c.athlete?.fullName ?? 'Unknown',
        total: scoreStr,
        scoreNum,
        thru,
        status,
      }
    })

    // Separate active from cut/wd
    const active = raw.filter((r) => r.status === 'active')
    const cut = raw.filter((r) => r.status !== 'active')

    // Assign positions with tie handling for active players
    const entries: MastersEntry[] = []
    let pos = 1
    for (let i = 0; i < active.length; i++) {
      if (i > 0 && active[i].scoreNum !== active[i - 1].scoreNum) {
        pos = i + 1
      }
      const tied = active.filter((a) => a.scoreNum === active[i].scoreNum).length > 1
      entries.push({
        position: tied ? `T${pos}` : `${pos}`,
        name: active[i].name,
        total: active[i].total,
        thru: active[i].thru,
        status: active[i].status,
      })
    }

    // Append cut/wd players
    cut.forEach((c) => {
      entries.push({
        position: c.status === 'cut' ? 'CUT' : c.status === 'wd' ? 'WD' : 'DQ',
        name: c.name,
        total: c.total,
        thru: 'F',
        status: c.status,
      })
    })

    return NextResponse.json({ entries, eventName, status: eventStatus }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ entries: [], eventName: null, status: 'pre' })
  }
}

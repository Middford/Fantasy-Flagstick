// ESPN Public API — Live Scoring (PRIMARY source)
// No API key required. Poll every 30 seconds during active tournament.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga'

export interface EspnCompetitor {
  id: string
  displayName: string
  shortDisplayName: string
  status: {
    displayValue: string
    thru: number | null
    today: number
    period: number
  }
  statistics: Array<{
    name: string
    displayValue: string
    value: number
  }>
  linescores?: Array<{
    period: number      // hole number
    value: string       // score on hole
    type: string
  }>
}

export interface EspnScoreboard {
  events: Array<{
    id: string
    name: string
    status: {
      type: {
        name: string    // 'STATUS_IN_PROGRESS' | 'STATUS_FINAL' | 'STATUS_SCHEDULED'
        state: string   // 'pre' | 'in' | 'post'
      }
    }
    competitions: Array<{
      competitors: EspnCompetitor[]
    }>
  }>
}

export interface EspnLeaderboard {
  tournament: {
    id: string
    name: string
    round: number
    status: string
  }
  competitors: EspnCompetitor[]
}

/** Get current PGA Tour scoreboard */
export async function getScoreboard(): Promise<EspnScoreboard> {
  const res = await fetch(`${ESPN_BASE}/scoreboard`, {
    next: { revalidate: 0 },  // Never cache — always fresh
  })
  if (!res.ok) throw new Error(`ESPN scoreboard error: ${res.status}`)
  return res.json()
}

/** Get leaderboard for specific event */
export async function getLeaderboard(eventId: string): Promise<EspnLeaderboard> {
  const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`ESPN leaderboard error: ${res.status}`)
  return res.json()
}

/**
 * Parse ESPN competitor linescores into hole-by-hole data
 * Returns map of hole_number → {score, score_vs_par, is_water}
 */
export function parseHoleScores(
  competitor: EspnCompetitor,
  holePars: Record<number, number>
): Map<number, { score: number; score_vs_par: number; is_water: boolean }> {
  const result = new Map()

  if (!competitor.linescores) return result

  competitor.linescores.forEach((ls) => {
    const holeNum = ls.period
    const par = holePars[holeNum]
    if (!par) return

    const scoreStr = ls.value
    // ESPN uses 'F' for finished, numeric strings for scores
    if (scoreStr === 'F' || scoreStr === '-') return

    const score = parseInt(scoreStr, 10)
    if (isNaN(score)) return

    result.set(holeNum, {
      score,
      score_vs_par: score - par,
      is_water: false,  // ESPN doesn't provide water hazard info; inferred separately
    })
  })

  return result
}

/** Get the active Masters event ID from ESPN scoreboard */
export async function getMastersEventId(): Promise<string | null> {
  const scoreboard = await getScoreboard()
  const masters = scoreboard.events.find(
    (e) => e.name.toLowerCase().includes('masters')
  )
  return masters?.id ?? null
}

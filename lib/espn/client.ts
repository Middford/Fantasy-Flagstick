// ESPN Public API — Live Scoring (PRIMARY source)
// No API key required. Poll every 30 seconds during active tournament.

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga'
// The leaderboard endpoint with player status (Missed Cut / Scheduled / In Progress)
// lives on a different subdomain from the main scoreboard
const ESPN_WEB_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/golf'

// Per-hole score nested inside a round entry
export interface EspnHoleScore {
  period: number          // hole number (1–18)
  value?: number          // raw strokes (4.0)
  displayValue?: string   // '4'
  scoreType?: { displayValue?: string }  // 'E', '-1', '+1'
}

// Round-level linescore entry — each competitor has one per round
export interface EspnRoundLinescore {
  period: number                  // round number (1–4)
  value?: number                  // round total strokes
  displayValue?: string           // '+2', '-5', etc.
  linescores?: EspnHoleScore[]    // per-hole data (only populated for started rounds)
}

export interface EspnCompetitor {
  id: string
  athlete: {
    fullName: string
    displayName: string   // "Scottie Scheffler"
    shortName: string     // "S. Scheffler"
  }
  score: string           // "E", "+3", "-2" — overall tournament vs par
  linescores?: EspnRoundLinescore[]
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

// Leaderboard competitor has a status field not present on scoreboard competitors
export interface EspnLeaderboardCompetitor extends EspnCompetitor {
  status?: {
    type?: {
      description?: string  // "Missed Cut" | "In Progress" | "Scheduled" | "Complete"
    }
  }
}

export interface EspnLeaderboard {
  events: Array<{
    competitions: Array<{
      competitors: EspnLeaderboardCompetitor[]
    }>
  }>
}

/** Get current PGA Tour scoreboard */
export async function getScoreboard(): Promise<EspnScoreboard> {
  const res = await fetch(`${ESPN_BASE}/scoreboard`, {
    next: { revalidate: 0 },  // Never cache — always fresh
  })
  if (!res.ok) throw new Error(`ESPN scoreboard error: ${res.status}`)
  return res.json()
}

/**
 * Get leaderboard with player status (Missed Cut / In Progress / Scheduled).
 * Uses the ESPN web API which includes status on each competitor — the main
 * scoreboard endpoint does NOT include this field.
 */
export async function getLeaderboard(eventId: string): Promise<EspnLeaderboard> {
  const res = await fetch(`${ESPN_WEB_BASE}/leaderboard?event=${eventId}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`ESPN leaderboard error: ${res.status}`)
  return res.json()
}

/**
 * Parse ESPN competitor linescores into hole-by-hole data for a specific round.
 * ESPN structure: competitor.linescores[i] = round entry (period = round number)
 *                 competitor.linescores[i].linescores[j] = hole entry (period = hole number)
 * Returns map of hole_number → {score, score_vs_par, is_water}
 */
export function parseHoleScores(
  competitor: EspnCompetitor,
  holePars: Record<number, number>,
  currentRound = 1
): Map<number, { score: number; score_vs_par: number; is_water: boolean }> {
  const result = new Map()

  if (!competitor.linescores) return result

  // Find the round entry for the current round
  const roundEntry = competitor.linescores.find((ls) => ls.period === currentRound)
  if (!roundEntry?.linescores?.length) return result

  // Iterate per-hole data inside the round entry
  roundEntry.linescores.forEach((hole) => {
    const holeNum = hole.period  // hole number 1–18
    const par = holePars[holeNum]
    if (!par) return

    // Use displayValue (string like '4') — value is a float (4.0)
    const scoreStr = hole.displayValue ?? (hole.value != null ? String(Math.round(hole.value)) : undefined)
    if (!scoreStr || scoreStr === '-' || scoreStr === '--' || scoreStr === 'F') return

    const score = parseInt(scoreStr, 10)
    if (isNaN(score)) return

    result.set(holeNum, {
      score,
      score_vs_par: score - par,
      is_water: false,
    })
  })

  return result
}

/**
 * Count how many holes a competitor has completed in the current round.
 * Looks at the nested per-hole linescores inside the active round entry.
 */
export function countHolesCompleted(competitor: EspnCompetitor, currentRound = 1): number {
  if (!competitor.linescores) return 0
  const roundEntry = competitor.linescores.find((ls) => ls.period === currentRound)
  if (!roundEntry?.linescores?.length) return 0
  // Count holes with an actual numeric score
  return roundEntry.linescores.filter((h) => {
    const v = h.displayValue ?? (h.value != null ? String(Math.round(h.value)) : undefined)
    return v && v !== '-' && v !== '--' && v !== 'F' && !isNaN(parseInt(v, 10))
  }).length
}

/** Get the active Masters event ID from ESPN scoreboard */
export async function getMastersEventId(): Promise<string | null> {
  const scoreboard = await getScoreboard()
  const masters = scoreboard.events.find(
    (e) => e.name.toLowerCase().includes('masters')
  )
  return masters?.id ?? null
}

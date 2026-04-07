// Fantasy Flagstick — Live Masters outright odds via The Odds API
// Requires ODDS_API_KEY env var (free tier: the-odds-api.com)

import { NextResponse } from 'next/server'

const ODDS_API_KEY = process.env.ODDS_API_KEY
const SPORT = 'golf_masters_tournament_winner'
const REGIONS = 'uk'
const MARKETS = 'outrights'

export interface OddsPlayer {
  name: string
  price: number        // decimal odds e.g. 12.0
  fractional: string   // e.g. "11/1"
  bookmaker: string
}

function decimalToFractional(decimal: number): string {
  const numerator = Math.round((decimal - 1) * 100)
  const denominator = 100
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(numerator, denominator)
  return `${numerator / g}/${denominator / g}`
}

export async function GET() {
  if (!ODDS_API_KEY) {
    return NextResponse.json({ error: 'ODDS_API_KEY not configured' }, { status: 503 })
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?apiKey=${ODDS_API_KEY}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=decimal`
    const res = await fetch(url, { next: { revalidate: 300 } }) // cache 5 mins

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Odds API error: ${text}` }, { status: res.status })
    }

    const data = await res.json()

    // Aggregate: best (lowest) price per player across all bookmakers
    const playerMap = new Map<string, { price: number; bookmaker: string }>()

    for (const event of data) {
      for (const bookmaker of event.bookmakers ?? []) {
        for (const market of bookmaker.markets ?? []) {
          if (market.key !== 'outrights') continue
          for (const outcome of market.outcomes ?? []) {
            const name: string = outcome.name
            const price: number = outcome.price
            const existing = playerMap.get(name)
            // Keep the best (highest) price for the player
            if (!existing || price > existing.price) {
              playerMap.set(name, { price, bookmaker: bookmaker.title })
            }
          }
        }
      }
    }

    const players: OddsPlayer[] = Array.from(playerMap.entries())
      .map(([name, { price, bookmaker }]) => ({
        name,
        price,
        fractional: decimalToFractional(price),
        bookmaker,
      }))
      .sort((a, b) => a.price - b.price) // shortest price first

    return NextResponse.json({ players, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

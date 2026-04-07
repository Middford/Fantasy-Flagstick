// Fantasy Flagstick — Live Masters outright odds via DataGolf API
// Uses DATAGOLF_API_KEY env var

import { NextResponse } from 'next/server'

const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY

// UK-relevant bookmakers to show (in display preference order)
const UK_BOOKS = ['bet365', 'skybet', 'williamhill', 'unibet', 'betway', 'pinnacle']

const BOOK_LABELS: Record<string, string> = {
  bet365:      'Bet365',
  skybet:      'Sky Bet',
  williamhill: 'William Hill',
  unibet:      'Unibet',
  betway:      'Betway',
  pinnacle:    'Pinnacle',
}

export interface OddsPlayer {
  name: string
  bestOdds: string        // fractional e.g. "11/1"
  bestOddsDecimal: number
  bestBook: string
  books: { name: string; fractional: string; decimal: number }[]
}

function decimalToFractional(decimal: number): string {
  const n = Math.round((decimal - 1) * 100)
  const d = 100
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const g = gcd(n, d)
  return `${n / g}/${d / g}`
}

function formatName(raw: string): string {
  // DataGolf format: "Last, First" → "First Last"
  const parts = raw.split(', ')
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw
}

export async function GET() {
  if (!DATAGOLF_API_KEY) {
    return NextResponse.json({ error: 'DATAGOLF_API_KEY not configured' }, { status: 503 })
  }

  try {
    const url = `https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=decimal&file_format=json&key=${DATAGOLF_API_KEY}`
    const res = await fetch(url, { next: { revalidate: 300 } }) // cache 5 mins

    if (!res.ok) {
      return NextResponse.json({ error: `DataGolf error: ${res.status}` }, { status: res.status })
    }

    const data = await res.json()

    const players: OddsPlayer[] = (data.odds ?? [])
      .map((entry: Record<string, unknown>) => {
        const books = UK_BOOKS
          .filter((b) => typeof entry[b] === 'number')
          .map((b) => ({
            name: BOOK_LABELS[b] ?? b,
            decimal: entry[b] as number,
            fractional: decimalToFractional(entry[b] as number),
          }))
          .sort((a, b) => b.decimal - a.decimal) // best price first

        if (books.length === 0) return null

        const best = books[0]
        return {
          name: formatName(entry.player_name as string),
          bestOdds: best.fractional,
          bestOddsDecimal: best.decimal,
          bestBook: best.name,
          books,
        }
      })
      .filter(Boolean)
      .sort((a: OddsPlayer, b: OddsPlayer) => a.bestOddsDecimal - b.bestOddsDecimal)

    return NextResponse.json({
      players,
      eventName: data.event_name,
      updatedAt: data.last_updated,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

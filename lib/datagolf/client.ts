import { z } from 'zod'

const BASE_URL = 'https://feeds.datagolf.com'
const API_KEY = process.env.DATAGOLF_API_KEY!

// ============================================================
// Zod schemas for DataGolf API responses
// ============================================================

const PlayerSchema = z.object({
  dg_id: z.number(),
  player_name: z.string(),
  country: z.string().optional(),
  amateur: z.number().optional(),
})

const FieldUpdateSchema = z.object({
  event_name: z.string(),
  field: z.array(
    z.object({
      dg_id: z.number(),
      player_name: z.string(),
      country: z.string().optional(),
      r1_teetime: z.string().optional(),
      r2_teetime: z.string().optional(),
    })
  ),
})

const PreTournamentPredSchema = z.object({
  event_name: z.string(),
  last_updated: z.string(),
  baseline: z.record(
    z.object({
      player_name: z.string(),
      dg_id: z.number(),
      win: z.number().optional(),
      top_5: z.number().optional(),
      top_10: z.number().optional(),
      make_cut: z.number().optional(),
    })
  ),
})

const InPlayPredSchema = z.object({
  event_name: z.string(),
  last_updated: z.string(),
  data: z.array(
    z.object({
      player_name: z.string(),
      dg_id: z.number(),
      current_pos: z.string().optional(),
      round: z.number().optional(),
      thru: z.number().optional(),
      today: z.number().optional(),
      total: z.number().optional(),
      win: z.number().optional(),
      make_cut: z.number().optional(),
    })
  ),
})

const OutrightsSchema = z.object({
  event_name: z.string(),
  last_updated: z.string(),
  data: z.array(
    z.object({
      player_name: z.string(),
      dg_id: z.number(),
      win: z.number().optional(),
      top_5: z.number().optional(),
      top_10: z.number().optional(),
      make_cut: z.number().optional(),
    })
  ),
})

export type FieldUpdate = z.infer<typeof FieldUpdateSchema>
export type PreTournamentPred = z.infer<typeof PreTournamentPredSchema>
export type InPlayPred = z.infer<typeof InPlayPredSchema>
export type Outrights = z.infer<typeof OutrightsSchema>

// ============================================================
// API Client
// ============================================================

async function fetchDataGolf<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set('key', API_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 }, // Cache for 5 minutes
  })

  if (!res.ok) {
    throw new Error(`DataGolf API error ${res.status} on ${endpoint}`)
  }

  return res.json() as T
}

export const dataGolf = {
  /** Player field and tee times for current tournament */
  getFieldUpdates(): Promise<FieldUpdate> {
    return fetchDataGolf('field-updates')
  },

  /** Pre-tournament win probabilities (base pricing input) */
  getPreTournamentPredictions(tour = 'pga'): Promise<PreTournamentPred> {
    return fetchDataGolf('preds/pre-tournament', { tour, odds_format: 'decimal' })
  },

  /** Live in-play win probabilities (Beat the Bookie + dynamic pricing) */
  getInPlayPredictions(tour = 'pga'): Promise<InPlayPred> {
    return fetchDataGolf('preds/in-play', { tour, odds_format: 'decimal' })
  },

  /** Bookmaker outright odds from 11 books (Beat the Bookie calculation) */
  getOutrights(market = 'win', tour = 'pga'): Promise<Outrights> {
    return fetchDataGolf('betting-tools/outrights', { market, tour, odds_format: 'decimal' })
  },
}

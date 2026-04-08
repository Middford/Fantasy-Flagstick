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
  baseline: z.record(z.string(),
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

// Skill ratings — rolling strokes-gained skill estimates per player
const SkillRatingsEntrySchema = z.object({
  player_name: z.string(),
  dg_id: z.number(),
  sg_putt: z.number().optional(),
  sg_arg: z.number().optional(),
  sg_app: z.number().optional(),
  sg_ott: z.number().optional(),
  sg_t2g: z.number().optional(),
  sg_total: z.number().optional(),
}).passthrough()

const SkillRatingsSchema = z.object({
  last_updated: z.string().optional(),
  players: z.array(SkillRatingsEntrySchema),
})

// Live tournament stats — SG splits for the current event
const LiveTournamentStatsEntrySchema = z.object({
  player_name: z.string(),
  dg_id: z.number(),
  sg_putt: z.number().optional().nullable(),
  sg_arg: z.number().optional().nullable(),
  sg_app: z.number().optional().nullable(),
  sg_ott: z.number().optional().nullable(),
  sg_t2g: z.number().optional().nullable(),
  sg_total: z.number().optional().nullable(),
}).passthrough()

const LiveTournamentStatsSchema = z.object({
  event_name: z.string().optional(),
  stat: z.string().optional(),
  round: z.string().optional(),
  last_updated: z.string().optional(),
  data: z.array(LiveTournamentStatsEntrySchema),
})

// Historical event list
const HistoricalEventSchema = z.object({
  event_id: z.string(),
  event_name: z.string(),
  calendar_year: z.number().optional(),
  season: z.number().optional(),
})

const HistoricalEventListSchema = z.object({
  tour: z.string().optional(),
  events: z.array(HistoricalEventSchema),
})

// Historical rounds — round-by-round scoring + SG splits
const HistoricalRoundEntrySchema = z.object({
  player_name: z.string(),
  dg_id: z.number(),
  round_num: z.number().optional(),
  score: z.number().optional().nullable(),
  sg_putt: z.number().optional().nullable(),
  sg_arg: z.number().optional().nullable(),
  sg_app: z.number().optional().nullable(),
  sg_ott: z.number().optional().nullable(),
  sg_t2g: z.number().optional().nullable(),
  fin_text: z.string().optional().nullable(),
  start_hole: z.number().optional(),
  teetime: z.string().optional().nullable(),
}).passthrough()

const HistoricalRoundsSchema = z.object({
  tour: z.string().optional(),
  event_id: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  event_name: z.string().optional(),
  data: z.array(HistoricalRoundEntrySchema),
})

export type FieldUpdate = z.infer<typeof FieldUpdateSchema>
export type PreTournamentPred = z.infer<typeof PreTournamentPredSchema>
export type InPlayPred = z.infer<typeof InPlayPredSchema>
export type Outrights = z.infer<typeof OutrightsSchema>
export type SkillRatings = z.infer<typeof SkillRatingsSchema>
export type LiveTournamentStats = z.infer<typeof LiveTournamentStatsSchema>
export type LiveTournamentStatsEntry = z.infer<typeof LiveTournamentStatsEntrySchema>
export type HistoricalEventList = z.infer<typeof HistoricalEventListSchema>
export type HistoricalRounds = z.infer<typeof HistoricalRoundsSchema>
export type HistoricalRoundEntry = z.infer<typeof HistoricalRoundEntrySchema>

// ============================================================
// API Client
// ============================================================

async function fetchDataGolf<T>(
  endpoint: string,
  params: Record<string, string> = {},
  revalidate = 300
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set('key', API_KEY)
  url.searchParams.set('file_format', 'json')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    next: { revalidate },
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

  /**
   * Rolling strokes-gained skill ratings per player.
   * display='value' returns SG values; 'rank' returns ranking positions.
   * Cache: 5 minutes (updates weekly).
   */
  getSkillRatings(display: 'value' | 'rank' = 'value'): Promise<SkillRatings> {
    return fetchDataGolf('preds/skill-ratings', { display }, 300)
  },

  /**
   * Live strokes-gained and traditional stats for the current tournament.
   * stats: comma-separated list of: sg_putt, sg_arg, sg_app, sg_ott, sg_t2g, sg_total, etc.
   * round: event_cumulative | event_avg | 1 | 2 | 3 | 4
   * display: value | rank
   * Cache: 5 minutes.
   */
  getLiveTournamentStats(
    stats = 'sg_putt,sg_arg,sg_app,sg_ott,sg_t2g',
    round = 'event_cumulative',
    display: 'value' | 'rank' = 'value',
    tour = 'pga'
  ): Promise<LiveTournamentStats> {
    return fetchDataGolf('preds/live-tournament-stats', { stats, round, display, tour }, 300)
  },

  /**
   * List of all historical events for a tour (used to discover event IDs).
   * Cache: 24 hours.
   */
  getHistoricalEventList(tour = 'pga'): Promise<HistoricalEventList> {
    return fetchDataGolf('historical-raw-data/event-list', { tour }, 86400)
  },

  /**
   * Round-by-round scoring and strokes-gained splits for a specific event+year.
   * event_id: e.g. 'masters', 'the_open', 'us_open', 'pga_championship'
   * year: 1983–2026
   * Cache: 24 hours for past years (data never changes), 5 min for current year.
   */
  getHistoricalRounds(tour: string, eventId: string, year: number): Promise<HistoricalRounds> {
    const currentYear = new Date().getFullYear()
    const revalidate = year < currentYear ? 86400 : 300
    return fetchDataGolf('historical-raw-data/rounds', { tour, event_id: eventId, year: String(year) }, revalidate)
  },
}

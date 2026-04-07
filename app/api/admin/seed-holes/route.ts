// Fantasy Flagstick — Admin: Seed Augusta National hole data
// Upserts all 18 holes with names, par, yards, and stats
// Protected by ADMIN_SECRET header

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_SECRET = process.env.ADMIN_SECRET

const AUGUSTA_HOLES = [
  { number: 1,  name: 'Tea Olive',         par: 4, yards: 445, water_hazard: false, difficulty_rank: 8,  birdie_pct: 22, bogey_pct: 18, eagle_pct: 0 },
  { number: 2,  name: 'Pink Dogwood',      par: 5, yards: 575, water_hazard: false, difficulty_rank: 12, birdie_pct: 38, bogey_pct: 12, eagle_pct: 3 },
  { number: 3,  name: 'Flowering Peach',   par: 4, yards: 350, water_hazard: false, difficulty_rank: 16, birdie_pct: 28, bogey_pct: 14, eagle_pct: 0 },
  { number: 4,  name: 'Flowering Crab Apple', par: 3, yards: 240, water_hazard: false, difficulty_rank: 2, birdie_pct: 14, bogey_pct: 26, eagle_pct: 0 },
  { number: 5,  name: 'Magnolia',          par: 4, yards: 495, water_hazard: false, difficulty_rank: 4,  birdie_pct: 18, bogey_pct: 22, eagle_pct: 0 },
  { number: 6,  name: 'Juniper',           par: 3, yards: 180, water_hazard: false, difficulty_rank: 10, birdie_pct: 20, bogey_pct: 20, eagle_pct: 1 },
  { number: 7,  name: 'Pampas',            par: 4, yards: 450, water_hazard: false, difficulty_rank: 14, birdie_pct: 24, bogey_pct: 16, eagle_pct: 0 },
  { number: 8,  name: 'Yellow Jasmine',    par: 5, yards: 570, water_hazard: false, difficulty_rank: 9,  birdie_pct: 34, bogey_pct: 14, eagle_pct: 2 },
  { number: 9,  name: 'Carolina Cherry',   par: 4, yards: 460, water_hazard: false, difficulty_rank: 6,  birdie_pct: 20, bogey_pct: 20, eagle_pct: 0 },
  { number: 10, name: 'Camellia',          par: 4, yards: 495, water_hazard: false, difficulty_rank: 3,  birdie_pct: 18, bogey_pct: 24, eagle_pct: 0 },
  { number: 11, name: 'White Dogwood',     par: 4, yards: 505, water_hazard: true,  difficulty_rank: 1,  birdie_pct: 14, bogey_pct: 28, eagle_pct: 0 },
  { number: 12, name: 'Golden Bell',       par: 3, yards: 155, water_hazard: true,  difficulty_rank: 5,  birdie_pct: 18, bogey_pct: 24, eagle_pct: 1 },
  { number: 13, name: 'Azalea',            par: 5, yards: 510, water_hazard: true,  difficulty_rank: 13, birdie_pct: 40, bogey_pct: 10, eagle_pct: 5 },
  { number: 14, name: 'Chinese Fir',       par: 4, yards: 440, water_hazard: false, difficulty_rank: 11, birdie_pct: 20, bogey_pct: 18, eagle_pct: 0 },
  { number: 15, name: 'Firethorn',         par: 5, yards: 550, water_hazard: true,  difficulty_rank: 15, birdie_pct: 42, bogey_pct: 10, eagle_pct: 6 },
  { number: 16, name: 'Redbud',            par: 3, yards: 170, water_hazard: true,  difficulty_rank: 7,  birdie_pct: 22, bogey_pct: 20, eagle_pct: 2 },
  { number: 17, name: 'Nandina',           par: 4, yards: 440, water_hazard: false, difficulty_rank: 17, birdie_pct: 24, bogey_pct: 16, eagle_pct: 0 },
  { number: 18, name: 'Holly',             par: 4, yards: 465, water_hazard: false, difficulty_rank: 18, birdie_pct: 22, bogey_pct: 18, eagle_pct: 0 },
]

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('active', true)
    .single()

  if (!tournament) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 })
  }

  let upserted = 0
  const errors: string[] = []

  for (const hole of AUGUSTA_HOLES) {
    const { error } = await supabase
      .from('holes')
      .upsert(
        {
          tournament_id: tournament.id,
          number: hole.number,
          name: hole.name,
          par: hole.par,
          yards: hole.yards,
          water_hazard: hole.water_hazard,
          difficulty_rank: hole.difficulty_rank,
          birdie_pct: hole.birdie_pct,
          bogey_pct: hole.bogey_pct,
          eagle_pct: hole.eagle_pct,
        },
        { onConflict: 'tournament_id,number' }
      )

    if (error) errors.push(`Hole ${hole.number}: ${error.message}`)
    else upserted++
  }

  return NextResponse.json({
    ok: true,
    tournament: tournament.name,
    upserted,
    errors: errors.slice(0, 10),
  })
}

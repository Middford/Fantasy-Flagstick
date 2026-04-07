// Fantasy Flagstick — Admin: Sync ESPN athlete IDs onto player records
// Matches by name from the 2026 Masters ESPN scoreboard (event 401811941)
// Protected by ADMIN_SECRET header

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_SECRET = process.env.ADMIN_SECRET

// All 91 Masters 2026 competitors — ESPN athlete ID → display name
const ESPN_FIELD: Array<{ id: string; name: string }> = [
  { id: '9478',    name: 'Scottie Scheffler' },
  { id: '3470',    name: 'Rory McIlroy' },
  { id: '9780',    name: 'Jon Rahm' },
  { id: '10140',   name: 'Xander Schauffele' },
  { id: '10592',   name: 'Collin Morikawa' },
  { id: '4364873', name: 'Viktor Hovland' },
  { id: '5539',    name: 'Tommy Fleetwood' },
  { id: '4375972', name: 'Ludvig Åberg' },
  { id: '5467',    name: 'Jordan Spieth' },
  { id: '10046',   name: 'Bryson DeChambeau' },
  { id: '6007',    name: 'Patrick Cantlay' },
  { id: '5860',    name: 'Hideki Matsuyama' },
  { id: '4848',    name: 'Justin Thomas' },
  { id: '6798',    name: 'Brooks Koepka' },
  { id: '4425906', name: 'Cameron Young' },
  { id: '9037',    name: 'Matt Fitzpatrick' },
  { id: '4419142', name: 'Akshay Bhatia' },
  { id: '1680',    name: 'Jason Day' },
  { id: '9131',    name: 'Cameron Smith' },
  { id: '4587',    name: 'Shane Lowry' },
  { id: '5553',    name: 'Tyrrell Hatton' },
  { id: '11253',   name: 'Rasmus Højgaard' },
  { id: '11250',   name: 'Nicolai Højgaard' },
  { id: '569',     name: 'Justin Rose' },
  { id: '9938',    name: 'Sam Burns' },
  { id: '4513',    name: 'Keegan Bradley' },
  { id: '3448',    name: 'Dustin Johnson' },
  { id: '5579',    name: 'Patrick Reed' },
  { id: '5409',    name: 'Russell Henley' },
  { id: '10906',   name: 'Aaron Rai' },
  { id: '11119',   name: 'Wyndham Clark' },
  { id: '11378',   name: 'Robert MacIntyre' },
  { id: '10364',   name: 'Kurt Kitayama' },
  { id: '9126',    name: 'Corey Conners' },
  { id: '11382',   name: 'Sungjae Im' },
  { id: '8973',    name: 'Max Homa' },
  { id: '10058',   name: 'Davis Riley' },
  { id: '9843',    name: 'Jake Knapp' },
  { id: '4410932', name: 'Min Woo Lee' },
  { id: '1225',    name: 'Brian Harman' },
  { id: '388',     name: 'Adam Scott' },
  { id: '4304',    name: 'Danny Willett' },
  { id: '3792',    name: 'Nick Taylor' },
  { id: '4408316', name: 'Nico Echavarria' },
  { id: '9025',    name: 'Daniel Berger' },
  { id: '10166',   name: 'J.J. Spaun' },
  { id: '3832',    name: 'Alex Noren' },
  { id: '8961',    name: 'Sepp Straka' },
  { id: '4404992', name: 'Ben Griffin' },
  { id: '5076021', name: 'Ryan Gerard' },
  { id: '4426181', name: 'Sam Stevens' },
  { id: '4690755', name: 'Chris Gotterup' },
  { id: '4348470', name: 'Kristoffer Reitan' },
  { id: '4585548', name: 'Sami Välimäki' },
  { id: '4251',    name: 'Ryan Fox' },
  { id: '4848',    name: 'Justin Thomas' },
  { id: '5054388', name: 'Jacob Bridgeman' },
  { id: '4348444', name: 'Tom McKibbin' },
  { id: '11101',   name: 'Max Greyserman' },
  { id: '11332',   name: 'Andrew Novak' },
  { id: '9530',    name: 'Maverick McNealy' },
  { id: '4589438', name: 'Harry Hall' },
  { id: '4921329', name: 'Michael Brennan' },
  { id: '5293232', name: 'Ethan Fang' },
  { id: '4901368', name: 'Matt McCarty' },
  { id: '5289811', name: 'Mason Howell' },
  { id: '5344763', name: 'Mateo Pulcini' },
  { id: '5344766', name: 'Jackson Herrington' },
  { id: '5080439', name: 'Aldrich Potgieter' },
  { id: '4610056', name: 'Casey Jarvis' },
  { id: '4858859', name: 'Rasmus Neergaard-Petersen' },
  { id: '2201886', name: 'Brandon Holtz' },
  { id: '9221',    name: 'Haotong Li' },
  { id: '5532',    name: 'Carlos Ortiz' },
  { id: '5327297', name: 'Fifa Laopakdee' },
  { id: '686',     name: 'Zach Johnson' },
  { id: '158',     name: 'Sergio García' },
  { id: '453',     name: 'Mike Weir' },
  { id: '392',     name: 'Vijay Singh' },
  { id: '91',      name: 'Fred Couples' },
  { id: '329',     name: 'José María Olazábal' },
  { id: '65',      name: 'Ángel Cabrera' },
  { id: '780',     name: 'Bubba Watson' },
  { id: '3550',    name: 'Gary Woodland' },
  { id: '7081',    name: 'Si Woo Kim' },
  { id: '8974',    name: 'Michael Kim' },
  { id: '5408',    name: 'Harris English' },
  { id: '9525',    name: 'Brian Campbell' },
  { id: '4585549', name: 'Marco Penge' },
  { id: '5217048', name: 'Johnny Keefer' },
]

function normalise(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z\s]/g, '')
    .trim()
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('active', true)
    .single()

  if (!tournament) {
    return NextResponse.json({ error: 'No active tournament' }, { status: 404 })
  }

  const { data: players } = await supabase
    .from('players')
    .select('id, name_full, espn_id')
    .eq('tournament_id', tournament.id)

  if (!players) {
    return NextResponse.json({ error: 'No players found' }, { status: 404 })
  }

  let matched = 0
  let alreadySet = 0
  const unmatched: string[] = []

  for (const espnPlayer of ESPN_FIELD) {
    const normEspn = normalise(espnPlayer.name)

    const dbPlayer = players.find((p) => normalise(p.name_full) === normEspn)

    if (!dbPlayer) {
      unmatched.push(espnPlayer.name)
      continue
    }

    if (dbPlayer.espn_id === espnPlayer.id) {
      alreadySet++
      continue
    }

    await supabase
      .from('players')
      .update({ espn_id: espnPlayer.id })
      .eq('id', dbPlayer.id)

    matched++
  }

  return NextResponse.json({
    ok: true,
    matched,
    alreadySet,
    unmatched,
    total: ESPN_FIELD.length,
  })
}

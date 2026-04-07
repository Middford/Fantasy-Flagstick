import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  name: z.string().min(1).max(50),
  tournamentId: z.string().uuid(),
})

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { name, tournamentId } = parsed.data
  const supabase = createServiceClient()

  // Get user's display name from Clerk
  const user = await currentUser()
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0]
    || 'Player'

  // Generate unique code
  let code = generateCode()
  let attempts = 0
  while (attempts < 5) {
    const { data } = await supabase.from('leagues').select('id').eq('code', code).single()
    if (!data) break
    code = generateCode()
    attempts++
  }

  // Create league
  const { data: league, error } = await supabase
    .from('leagues')
    .insert({ tournament_id: tournamentId, name, code, created_by: userId })
    .select()
    .single()

  if (error || !league) {
    return NextResponse.json({ error: 'Failed to create league' }, { status: 500 })
  }

  // Add creator as member with their real name
  await supabase.from('league_members').insert({
    league_id: league.id,
    user_id: userId,
    display_name: displayName,
  })

  // Create chips row for creator
  await supabase.from('chips').insert({
    league_id: league.id,
    user_id: userId,
    tournament_id: tournamentId,
  })

  return NextResponse.json({ league })
}

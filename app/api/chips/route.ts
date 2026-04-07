// Fantasy Flagstick — Chips API
// Chip mutations via service client (browser client blocked by RLS)

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sponsorship'),
    chipsId: z.string().uuid(),
    round: z.number().int().min(1).max(4),
  }),
  z.object({
    action: z.literal('postman'),
    chipsId: z.string().uuid(),
    round: z.number().int().min(1).max(4),
    playerId: z.string().uuid(),
  }),
])

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const supabase = createServiceClient()

  // Verify this chips row belongs to the current user
  const { data: chips } = await supabase
    .from('chips')
    .select('id, user_id')
    .eq('id', parsed.data.chipsId)
    .single()

  if (!chips || chips.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (parsed.data.action === 'sponsorship') {
    const { error } = await supabase
      .from('chips')
      .update({ sponsorship_used: true, sponsorship_round: parsed.data.round })
      .eq('id', parsed.data.chipsId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (parsed.data.action === 'postman') {
    const col = `postman_r${parsed.data.round}_player_id`
    const { error } = await supabase
      .from('chips')
      .update({ [col]: parsed.data.playerId })
      .eq('id', parsed.data.chipsId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

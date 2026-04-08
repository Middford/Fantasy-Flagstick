import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  leagueId: z.string().uuid(),
})

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const supabase = createServiceClient()

  // Verify the league exists and the caller is the creator
  const { data: league } = await supabase
    .from('leagues')
    .select('id, created_by')
    .eq('id', parsed.data.leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
  if (league.created_by !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete league — league_members, chips, and picks cascade automatically
  const { error } = await supabase
    .from('leagues')
    .delete()
    .eq('id', parsed.data.leagueId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

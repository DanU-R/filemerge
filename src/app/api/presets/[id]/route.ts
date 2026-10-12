import { NextResponse } from 'next/server'
import { getDb } from '@/prisma/db'
import { getCurrentUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const db = getDb()
  const preset = await db.orm.public.MergePreset.where({ id, userId: user.id }).first()
  if (!preset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.orm.public.MergePreset.where({ id, userId: user.id }).delete()
  return NextResponse.json({ ok: true })
}

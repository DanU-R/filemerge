import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { getCurrentUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

const MAX_PRESETS = 20

const Item = z.object({ documentId: z.string().min(1).max(64) })
const Body = z.object({
  name: z.string().min(1).max(60),
  items: z.array(Item).min(1).max(50),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const presets = await db.orm.public.MergePreset.where({ userId: user.id })
    .orderBy((p) => p.createdAt.desc())
    .all()
  return NextResponse.json({
    presets: presets.map((p) => ({ id: p.id, name: p.name, items: p.items })),
  })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data preset tidak valid.' }, { status: 400 })
  }

  const db = getDb()
  const existing = await db.orm.public.MergePreset.where({ userId: user.id }).all()
  if (existing.length >= MAX_PRESETS) {
    return NextResponse.json({ error: 'Kuota preset penuh (maks 20).' }, { status: 409 })
  }

  // Pastikan semua dokumen benar milik pengguna (isolasi data).
  const owned = await db.orm.public.Document.where({ userId: user.id }).all()
  const ownedIds = new Set(owned.map((d) => d.id))
  const items = parsed.data.items.map((it, i) => ({
    documentId: it.documentId,
    order: i,
  }))
  const invalid = items.some((it) => !ownedIds.has(it.documentId))
  if (invalid) {
    return NextResponse.json({ error: 'Ada dokumen yang bukan milik Anda.' }, { status: 400 })
  }

  const preset = await db.orm.public.MergePreset.create({
    userId: user.id,
    name: parsed.data.name,
    items,
  })
  return NextResponse.json({ preset: { id: preset.id, name: preset.name } }, { status: 201 })
}

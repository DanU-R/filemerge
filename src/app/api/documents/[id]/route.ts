import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { getCurrentUser } from '@/lib/server/auth'
import { deleteObject, getObjectStream } from '@/lib/server/storage'
import { sanitizeFileName } from '@/lib/sanitize'
import { DOC_CATEGORIES } from '@/lib/server/docLimits'

export const runtime = 'nodejs'

const CATEGORIES = new Set<string>(DOC_CATEGORIES)

/** Ambil dokumen MILIK pengguna. Dokumen orang lain -> null (jadi 404). */
async function ownedDoc(userId: string, id: string) {
  const db = getDb()
  return db.orm.public.Document.where({ id, userId }).first()
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const doc = await ownedDoc(user.id, id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const obj = await getObjectStream(user.id, doc.storageKey)
  if (!obj) return NextResponse.json({ error: 'Objek tidak ditemukan.' }, { status: 404 })

  return new NextResponse(obj.stream, {
    headers: {
      'Content-Type': obj.contentType || doc.mimeType,
      'Content-Disposition': `attachment; filename="${sanitizeFileName(doc.displayName)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

const PatchBody = z.object({
  displayName: z.string().min(1).max(100).optional(),
  category: z.string().optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const parsed = PatchBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 })
  if (parsed.data.category && !CATEGORIES.has(parsed.data.category)) {
    return NextResponse.json({ error: 'Kategori tidak valid.' }, { status: 400 })
  }

  const doc = await ownedDoc(user.id, id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, string> = {}
  if (parsed.data.displayName) data.displayName = sanitizeFileName(parsed.data.displayName)
  if (parsed.data.category) data.category = parsed.data.category

  const db = getDb()
  await db.orm.public.Document.where({ id, userId: user.id }).update(data)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const doc = await ownedDoc(user.id, id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = getDb()
  // Tandai dulu (kegagalan sebagian tidak menyisakan metadata menggantung).
  await db.orm.public.Document.where({ id, userId: user.id }).update({
    status: 'PENDING_DELETION',
  })
  await deleteObject(user.id, doc.storageKey)
  await db.orm.public.Document.where({ id, userId: user.id }).delete()
  return NextResponse.json({ ok: true })
}

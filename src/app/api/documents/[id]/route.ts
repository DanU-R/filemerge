import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { getCurrentUser } from '@/lib/server/auth'
import { deleteObject, getObjectStream, putObject } from '@/lib/server/storage'
import { detectKind } from '@/lib/validate'
import { sanitizeFileName } from '@/lib/sanitize'
import { DOC_CATEGORIES, DOC_LIMITS } from '@/lib/server/docLimits'
import { rateLimit } from '@/lib/server/rateLimit'

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
  // PRD 15.4: tandai dulu, lalu hapus objek. Bila hapus objek gagal, baris tetap
  // PENDING_DELETION (disembunyikan dari UI) dan dilaporkan untuk dicoba ulang,
  // supaya tidak ada metadata menggantung yang menunjuk objek yang masih ada.
  await db.orm.public.Document.where({ id, userId: user.id }).update({
    status: 'PENDING_DELETION',
  })
  const ok = await deleteObject(user.id, doc.storageKey)
  if (!ok) {
    return NextResponse.json(
      {
        error:
          'File belum dapat dihapus dari penyimpanan. Dokumen disembunyikan dan akan dicoba lagi.',
        retryable: true,
      },
      { status: 502 },
    )
  }
  await db.orm.public.Document.where({ id, userId: user.id }).delete()
  return NextResponse.json({ ok: true })
}

/**
 * FR-DOC-04: ganti file secara aman.
 * Unggah baru -> verifikasi -> alihkan metadata ke key baru -> hapus objek lama.
 * Bila gagal, file lama tetap utuh.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const rl = rateLimit(`replace:${user.id}`, 60, 60 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const doc = await ownedDoc(user.id, id)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Form tidak valid.' }, { status: 400 })
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File wajib diisi.' }, { status: 400 })
  }
  if (file.size === 0) return NextResponse.json({ error: 'File kosong.' }, { status: 400 })
  if (file.size > DOC_LIMITS.MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Melebihi batas ukuran file.' }, { status: 413 })
  }

  const buf = new Uint8Array(await file.arrayBuffer())
  const kind = detectKind(buf)
  if (!kind) {
    return NextResponse.json(
      { error: 'Isi file tidak dikenali (hanya PDF/JPG/PNG).' },
      { status: 415 },
    )
  }

  const db = getDb()
  // Cek kuota terhadap selisih ukuran.
  const all = await db.orm.public.Document.where({ userId: user.id }).all()
  const used = all.reduce((s, d) => s + d.sizeBytes, 0) - doc.sizeBytes
  if (used + file.size > DOC_LIMITS.MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: 'Kuota penyimpanan penuh.' }, { status: 409 })
  }

  const newKey = randomUUID()
  const mimeType =
    kind === 'pdf' ? 'application/pdf' : kind === 'png' ? 'image/png' : 'image/jpeg'

  // 1) unggah file baru (key baru). Bila ini gagal, file lama tak tersentuh.
  await putObject(user.id, newKey, buf, mimeType)

  const oldKey = doc.storageKey
  try {
    // 2) alihkan metadata ke key baru.
    await db.orm.public.Document.where({ id, userId: user.id }).update({
      storageKey: newKey,
      sizeBytes: file.size,
      mimeType,
      status: 'READY',
    })
  } catch {
    // Metadata gagal -> buang objek baru, file lama tetap utuh.
    await deleteObject(user.id, newKey)
    return NextResponse.json({ error: 'Gagal memperbarui metadata.' }, { status: 500 })
  }

  // 3) hapus objek lama (kegagalan di sini tidak merusak dokumen).
  await deleteObject(user.id, oldKey)

  return NextResponse.json({ ok: true })
}

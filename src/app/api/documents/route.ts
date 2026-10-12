import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { getCurrentUser } from '@/lib/server/auth'
import { putObject, deleteObject } from '@/lib/server/storage'
import { detectKind } from '@/lib/validate'
import { sanitizeFileName } from '@/lib/sanitize'
import { DOC_CATEGORIES, DOC_LIMITS } from '@/lib/server/docLimits'
import type { DocCategoryValue } from '@/lib/server/docLimits'

export const runtime = 'nodejs'

const CATEGORIES = new Set<string>(DOC_CATEGORIES)

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const docs = await db.orm.public.Document.where({ userId: user.id })
    .orderBy((d) => d.createdAt.desc())
    .all()

  const totalBytes = docs.reduce((s, d) => s + d.sizeBytes, 0)
  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id,
      displayName: d.displayName,
      category: d.category,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
    })),
    quota: {
      usedBytes: totalBytes,
      maxBytes: DOC_LIMITS.MAX_TOTAL_BYTES,
      count: docs.length,
      maxCount: DOC_LIMITS.MAX_DOCS_PER_USER,
    },
  })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Form tidak valid.' }, { status: 400 })

  const file = form.get('file')
  const nameRaw = String(form.get('name') ?? '')
  const category = String(form.get('category') ?? 'LAINNYA')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File wajib diisi.' }, { status: 400 })
  }
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Kategori tidak valid.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'File kosong.' }, { status: 400 })
  }
  if (file.size > DOC_LIMITS.MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File melebihi batas ${DOC_LIMITS.MAX_FILE_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    )
  }

  const buf = new Uint8Array(await file.arrayBuffer())
  // Validasi berbasis konten (magic bytes), bukan ekstensi.
  const kind = detectKind(buf)
  if (!kind) {
    return NextResponse.json(
      { error: 'Isi file tidak dikenali (hanya PDF/JPG/PNG).' },
      { status: 415 },
    )
  }

  const db = getDb()
  const existing = await db.orm.public.Document.where({ userId: user.id }).all()
  if (existing.length >= DOC_LIMITS.MAX_DOCS_PER_USER) {
    return NextResponse.json({ error: 'Kuota jumlah dokumen penuh.' }, { status: 409 })
  }
  const used = existing.reduce((s, d) => s + d.sizeBytes, 0)
  if (used + file.size > DOC_LIMITS.MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: 'Kuota penyimpanan penuh.' }, { status: 409 })
  }

  const storageKey = randomUUID()
  const mimeType =
    kind === 'pdf' ? 'application/pdf' : kind === 'png' ? 'image/png' : 'image/jpeg'
  const displayName = sanitizeFileName(nameRaw || file.name, 'dokumen')

  // Upload dulu; bila metadata gagal, objek dihapus (hindari objek yatim).
  await putObject(user.id, storageKey, buf, mimeType)
  try {
    const doc = await db.orm.public.Document.create({
      userId: user.id,
      displayName,
      category: category as DocCategoryValue,
      mimeType,
      sizeBytes: file.size,
      storageKey,
      status: 'READY',
    })
    return NextResponse.json(
      { document: { id: doc.id, displayName: doc.displayName, category: doc.category } },
      { status: 201 },
    )
  } catch {
    await deleteObject(user.id, storageKey)
    return NextResponse.json({ error: 'Gagal menyimpan metadata.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { createSession, hashPassword, normalizeEmail } from '@/lib/server/auth'

export const runtime = 'nodejs'

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Email tidak valid atau password minimal 8 karakter.' },
      { status: 400 },
    )
  }

  const email = normalizeEmail(parsed.data.email)
  const db = getDb()

  // Pre-check duplikat (Prisma 8 RC belum punya kode error P2002).
  const existing = await db.orm.public.User.where({ email }).first()
  if (existing) {
    return NextResponse.json(
      { error: 'Email sudah terdaftar. Coba masuk.' },
      { status: 409 },
    )
  }

  const passwordHash = await hashPassword(parsed.data.password)
  let user
  try {
    user = await db.orm.public.User.create({ email, passwordHash })
  } catch {
    // Balapan: unique constraint menangkap duplikat.
    return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 409 })
  }

  await createSession(user.id)
  return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 })
}

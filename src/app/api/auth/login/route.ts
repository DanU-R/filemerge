import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { createSession, normalizeEmail, verifyPassword } from '@/lib/server/auth'

export const runtime = 'nodejs'

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
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
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 400 })
  }

  const email = normalizeEmail(parsed.data.email)
  const db = getDb()
  const user = await db.orm.public.User.where({ email }).first()

  // Pesan seragam -> tidak membocorkan apakah email terdaftar.
  if (!user) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 })
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Email atau password salah.' }, { status: 401 })
  }

  await createSession(user.id)
  return NextResponse.json({ user: { id: user.id, email: user.email } })
}

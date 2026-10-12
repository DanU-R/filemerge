import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/prisma/db'
import { createSession, normalizeEmail, verifyPassword } from '@/lib/server/auth'
import { clientIp, rateLimit } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

/** Batas dapat dikonfigurasi (SEC-08); default aman untuk produksi. */
const LOGIN_LIMIT = Number(process.env.RATE_LIMIT_LOGIN ?? 20)

const Body = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
})

export async function POST(req: Request) {
  // SEC-08: batasi percobaan login per IP per 15 menit.
  const rl = rateLimit(`login:${clientIp(req)}`, LOGIN_LIMIT, 15 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSeconds} detik.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

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

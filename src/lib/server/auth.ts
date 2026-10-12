import 'server-only'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { Temporal } from 'temporal-polyfill'
import { getDb } from '@/prisma/db'
import { hashPassword, normalizeEmail, verifyPassword } from '@/lib/password'

export { hashPassword, normalizeEmail, verifyPassword }

export const SESSION_COOKIE = 'fm_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 hari

export interface SessionUser {
  id: string
  email: string
}

/** Buat sesi baru di DB dan set cookie HttpOnly. */
export async function createSession(userId: string): Promise<string> {
  const db = getDb()
  const token = randomUUID()
  const expiresAt = Temporal.Instant.fromEpochMilliseconds(Date.now() + SESSION_TTL_MS)
  await db.orm.public.Session.create({ id: token, userId, expiresAt })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt.epochMilliseconds),
  })
  return token
}

function instantToMs(value: unknown): number {
  if (value && typeof value === 'object' && 'epochMilliseconds' in value) {
    return Number((value as { epochMilliseconds: number }).epochMilliseconds)
  }
  return new Date(value as string).getTime()
}

/** Ambil pengguna dari sesi cookie. Null bila tidak ada/kedaluwarsa. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const db = getDb()
  const session = await db.orm.public.Session.where({ id: token }).first()
  if (!session) return null
  if (instantToMs(session.expiresAt) < Date.now()) {
    await db.orm.public.Session.where({ id: token }).delete().catch(() => {})
    return null
  }

  const user = await db.orm.public.User.where({ id: session.userId }).first()
  if (!user) return null
  return { id: user.id, email: user.email }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    const db = getDb()
    await db.orm.public.Session.where({ id: token }).delete().catch(() => {})
  }
  jar.delete(SESSION_COOKIE)
}

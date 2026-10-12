import { NextResponse } from 'next/server'
import { z } from 'zod'
import { destroySession, getCurrentUser, verifyPassword } from '@/lib/server/auth'
import { getDb } from '@/prisma/db'
import { deleteAccount } from '@/lib/server/account'

export const runtime = 'nodejs'

const Body = z.object({ password: z.string().min(1).max(200) })

/** Hapus akun + seluruh data terkait (§12.6, AC-16). Wajib konfirmasi password. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password wajib diisi.' }, { status: 400 })
  }

  const db = getDb()
  const row = await db.orm.public.User.where({ id: user.id }).first()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ok = await verifyPassword(parsed.data.password, row.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Password salah.' }, { status: 403 })
  }

  const result = await deleteAccount(user.id)
  await destroySession()

  return NextResponse.json({
    ok: true,
    deletedObjects: result.deletedObjects,
    failedObjects: result.failedObjects.length,
  })
}

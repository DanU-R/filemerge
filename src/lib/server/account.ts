import 'server-only'
import { getDb } from '@/prisma/db'
import { deleteObject } from './storage'

/**
 * Hapus akun beserta seluruh data terkait (§12.6, AC-16).
 * Urutan: tandai -> hapus objek storage -> hapus baris (cascade dari user).
 * Bila ada objek yang gagal dihapus, akun tetap dihapus tapi kegagalan dicatat.
 */
export async function deleteAccount(
  userId: string,
): Promise<{ deletedObjects: number; failedObjects: string[] }> {
  const db = getDb()

  const docs = await db.orm.public.Document.where({ userId }).all()

  const failedObjects: string[] = []
  let deletedObjects = 0
  for (const doc of docs) {
    try {
      await deleteObject(userId, doc.storageKey)
      deletedObjects += 1
    } catch {
      failedObjects.push(doc.storageKey)
    }
  }

  // Hapus turunan lebih dulu (jangan mengandalkan cascade saja),
  // lalu user terakhir.
  await db.orm.public.Document.where({ userId }).delete()
  await db.orm.public.MergePreset.where({ userId }).delete()
  await db.orm.public.Session.where({ userId }).delete()
  await db.orm.public.User.where({ id: userId }).delete()

  return { deletedObjects, failedObjects }
}

export interface AccountSummary {
  email: string
  createdAt: string
  documentCount: number
  presetCount: number
  usedBytes: number
}

export async function accountSummary(userId: string): Promise<AccountSummary | null> {
  const db = getDb()
  const user = await db.orm.public.User.where({ id: userId }).first()
  if (!user) return null
  const docs = await db.orm.public.Document.where({ userId }).all()
  const presets = await db.orm.public.MergePreset.where({ userId }).all()
  return {
    email: user.email,
    createdAt: String(user.createdAt),
    documentCount: docs.length,
    presetCount: presets.length,
    usedBytes: docs.reduce((s, d) => s + d.sizeBytes, 0),
  }
}

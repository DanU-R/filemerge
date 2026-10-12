/**
 * Rekonsiliasi storage <-> database (PRD §15.4).
 *
 * 1. Menuntaskan dokumen berstatus PENDING_DELETION: hapus objek lalu hapus baris.
 * 2. Melaporkan objek yatim (ada di storage, tidak ada baris DB) dan — dengan
 *    flag --purge — menghapusnya.
 *
 * Jalankan pada lingkungan yang punya DATABASE_URL + BLOB_READ_WRITE_TOKEN:
 *   bun run storage:reconcile
 *   bun run storage:reconcile -- --purge
 */
import dotenv from 'dotenv'
dotenv.config()
dotenv.config({ path: '.env.local' })

import { getDb } from '../src/prisma/db'
import { storagePath } from '../src/lib/storageKey'
import { list, del } from '@vercel/blob'

const purge = process.argv.includes('--purge')

const db = getDb()

/**
 * Hapus objek; true bila berhasil atau memang tidak ada. Logika sama dengan
 * src/lib/server/storage.ts (tidak diimpor agar skrip CLI tidak menyentuh
 * `server-only`).
 */
async function removeObject(pathname: string): Promise<boolean> {
  try {
    await del(pathname)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    if (msg.includes('not found') || msg.includes('404')) return true
    console.error('gagal hapus', pathname)
    return false
  }
}

// 1) Tuntaskan PENDING_DELETION
const pending = await db.orm.public.Document.where({ status: 'PENDING_DELETION' }).all()
let finished = 0
let stuck = 0
for (const doc of pending) {
  const ok = await removeObject(storagePath(doc.userId, doc.storageKey))
  if (ok) {
    await db.orm.public.Document.where({ id: doc.id, userId: doc.userId }).delete()
    finished += 1
  } else {
    stuck += 1
  }
}
console.log(`PENDING_DELETION: ${pending.length} ditinjau, ${finished} dituntaskan, ${stuck} masih gagal`)

// 2) Objek yatim
const docs = await db.orm.public.Document.all()
const expected = new Set(docs.map((d) => storagePath(d.userId, d.storageKey)))

let cursor: string | undefined
const orphans: string[] = []
do {
  const page = await list({ cursor, limit: 1000 })
  for (const b of page.blobs) if (!expected.has(b.pathname)) orphans.push(b.pathname)
  cursor = page.cursor
} while (cursor)

console.log(`Objek yatim: ${orphans.length}`)
for (const p of orphans.slice(0, 10)) console.log(`  - ${p}`)
if (orphans.length > 10) console.log(`  … dan ${orphans.length - 10} lainnya`)

if (purge && orphans.length) {
  await del(orphans)
  console.log(`Dihapus: ${orphans.length}`)
} else if (orphans.length) {
  console.log('Jalankan ulang dengan --purge untuk menghapus objek yatim.')
}

process.exit(stuck > 0 ? 1 : 0)

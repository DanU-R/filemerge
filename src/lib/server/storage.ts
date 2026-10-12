import 'server-only'
import { del, get, put } from '@vercel/blob'
import { storagePath } from '@/lib/storageKey'

/**
 * Abstraksi penyimpanan file. Provider saat ini: Vercel Blob (private).
 * Ganti provider (mis. Cloudflare R2) cukup dengan mengubah file ini.
 *
 * `storageKey` selalu dibuat server (UUID), tidak pernah dari nama file.
 */

const prefix = storagePath

export async function putObject(
  userId: string,
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await put(prefix(userId, key), body as ArrayBuffer, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: false,
  })
}

/**
 * Hapus objek. Mengembalikan `true` bila berhasil ATAU objek memang tidak ada
 * (idempoten), `false` bila gagal karena sebab lain (mis. token/network).
 *
 * Sengaja TIDAK menelan semua error: PRD §15.4 mewajibkan kegagalan hapus objek
 * terlihat agar dokumen dapat ditandai `PENDING_DELETION` dan dicoba ulang.
 * (Bug lama: `catch {}` menyembunyikan kegagalan hapus sehingga menyisakan
 * objek yatim di storage.)
 */
export async function deleteObject(userId: string, key: string): Promise<boolean> {
  try {
    await del(prefix(userId, key))
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    // Objek tidak ada = sudah bersih, anggap sukses.
    if (msg.includes('not found') || msg.includes('404')) return true
    console.error('deleteObject gagal', { userId, key })
    return false
  }
}

/** Ambil objek privat sebagai stream (untuk route unduh terotorisasi). */
export async function getObjectStream(
  userId: string,
  key: string,
): Promise<{ stream: ReadableStream; contentType: string | null } | null> {
  const res = await get(prefix(userId, key), { access: 'private' })
  if (!res || res.statusCode !== 200 || !res.stream) return null
  return { stream: res.stream, contentType: res.blob?.contentType ?? null }
}

import 'server-only'
import { del, get, put } from '@vercel/blob'

/**
 * Abstraksi penyimpanan file. Provider saat ini: Vercel Blob (private).
 * Ganti provider (mis. Cloudflare R2) cukup dengan mengubah file ini.
 *
 * `storageKey` selalu dibuat server (UUID), tidak pernah dari nama file.
 */

function prefix(userId: string, key: string): string {
  // Namespace per pengguna -> isolasi di level path juga.
  return `u/${userId}/${key}`
}

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

export async function deleteObject(userId: string, key: string): Promise<void> {
  try {
    await del(prefix(userId, key))
  } catch {
    // Objek mungkin sudah tidak ada -> idempoten.
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

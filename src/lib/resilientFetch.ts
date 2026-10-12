'use client'

/**
 * Fetch dengan retry + backoff (NFR-03).
 *
 * Hanya mencoba ulang pada kegagalan yang masuk akal untuk diulang:
 * - error jaringan (fetch melempar)
 * - HTTP 408/429/5xx
 * Kegagalan sisi-klien (4xx lain: 400/401/403/404/409/413/415) TIDAK diulang —
 * mengulangnya hanya membuang waktu dan kuota.
 *
 * Balasan 429 menghormati header `Retry-After` bila ada.
 */

export interface RetryOptions {
  /** Jumlah percobaan total (termasuk yang pertama). Default 3. */
  attempts?: number
  /** Jeda dasar antar percobaan (ms). Default 400. */
  baseDelayMs?: number
  /** Batas jeda maksimum (ms). Default 4000. */
  maxDelayMs?: number
  /** Batas waktu satu permintaan (ms). Default 30000. */
  timeoutMs?: number
  /** Beri sinyal transien ke UI, mis. "mencoba lagi (2/3)…". */
  onRetry?: (attempt: number, max: number) => void
}

export class HttpError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Jalankan `fetch`. Mengembalikan `Response` (mungkin `!ok`) bila server menjawab.
 * Melempar `HttpError` bila status akhir tetap gagal, atau error jaringan bila habis percobaan.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, opts.attempts ?? 3)
  const baseDelayMs = opts.baseDelayMs ?? 400
  const maxDelayMs = opts.maxDelayMs ?? 4000
  const timeoutMs = opts.timeoutMs ?? 30000

  let lastNetworkError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) opts.onRetry?.(attempt, attempts)

    const controller = new AbortController()
    // Hormati signal pemanggil bila ada.
    const external = init?.signal
    if (external) {
      if (external.aborted) controller.abort()
      else external.addEventListener('abort', () => controller.abort(), { once: true })
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      clearTimeout(timer)

      if (res.ok) return res

      // Gagal tapi tidak layak diulang -> langsung kembalikan; biar pemanggil baca pesannya.
      if (!isRetryable(res.status) || attempt === attempts) return res

      // Hitung jeda; hormati Retry-After untuk 429. Bila antreannya lebih lama
      // dari batas, jangan menunggu — kembalikan pesan sekarang agar UI responsif.
      let delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after'))
        if (Number.isFinite(ra) && ra > 0) {
          if (ra * 1000 > maxDelayMs) return res
          delay = ra * 1000
        }
      }
      await sleep(delay)
      continue
    } catch (err) {
      clearTimeout(timer)
      lastNetworkError = err
      if (attempt === attempts) break
      await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs))
    }
  }

  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error('Tidak dapat menghubungi server.')
}

/** Unduh dokumen via klik ber-retry. href tetap ada untuk aksesibilitas/tests. */
export async function downloadWithRetry(
  url: string,
  filename: string,
  opts: RetryOptions = {},
): Promise<void> {
  const res = await fetchWithRetry(url, undefined, opts)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new HttpError(res.status, body, (body as { error?: string } | null)?.error)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Beri jeda singkat sebelum revoke agar unduhan sempat mulai.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  }
}

/** Sama seperti fetchWithRetry, tapi mengurai JSON dan melempar HttpError dengan body. */
export async function fetchJsonWithRetry<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: RetryOptions = {},
): Promise<T> {
  const res = await fetchWithRetry(input, init, opts)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error
    throw new HttpError(res.status, body, message)
  }
  return body as T
}

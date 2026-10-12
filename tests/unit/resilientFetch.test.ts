import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry, fetchJsonWithRetry, HttpError } from '../../src/lib/resilientFetch'

const originalFetch = globalThis.fetch

function res(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchWithRetry', () => {
  it('berhasil pada percobaan pertama', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { ok: true }))
    globalThis.fetch = f as never
    const r = await fetchWithRetry('/x', undefined, { baseDelayMs: 1 })
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('mengulang pada 500 lalu berhasil', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(200, { ok: true }))
    globalThis.fetch = f as never
    const r = await fetchWithRetry('/x', undefined, { attempts: 3, baseDelayMs: 1 })
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('TIDAK mengulang pada 404 (kesalahan permanen)', async () => {
    const f = vi.fn().mockResolvedValue(res(404, { error: 'Not found' }))
    globalThis.fetch = f as never
    const r = await fetchWithRetry('/x', undefined, { attempts: 3, baseDelayMs: 1 })
    expect(r.status).toBe(404)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('menyerah setelah batas percobaan (500)', async () => {
    const f = vi.fn().mockResolvedValue(res(503))
    globalThis.fetch = f as never
    const r = await fetchWithRetry('/x', undefined, { attempts: 2, baseDelayMs: 1 })
    expect(r.status).toBe(503)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('mengulang pada kegagalan jaringan lalu melempar bila habis', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    globalThis.fetch = f as never
    await expect(fetchWithRetry('/x', undefined, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow(
      /Failed to fetch/,
    )
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('memanggil onRetry dengan nomor percobaan', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(200))
    globalThis.fetch = f as never
    const onRetry = vi.fn()
    await fetchWithRetry('/x', undefined, { attempts: 3, baseDelayMs: 1, onRetry })
    expect(onRetry).toHaveBeenCalledWith(2, 3)
  })

  it('tidak menunggu lama bila Retry-After > maxDelayMs (langsung kembalikan)', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(res(429, { error: 'slow down' }, { 'retry-after': '3600' }))
    globalThis.fetch = f as never
    const r = await fetchWithRetry('/x', undefined, { attempts: 3, maxDelayMs: 50 })
    expect(r.status).toBe(429)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('timeout membatalkan permintaan yang menggantung', async () => {
    const f = vi.fn().mockImplementation(
      (_u: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )
    globalThis.fetch = f as never
    await expect(
      fetchWithRetry('/x', undefined, { attempts: 1, timeoutMs: 20 }),
    ).rejects.toThrow()
  })
})

describe('fetchJsonWithRetry', () => {
  it('mengembalikan JSON saat sukses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(res(200, { document: { displayName: 'CV' } })) as never
    const data = await fetchJsonWithRetry<{ document: { displayName: string } }>('/x')
    expect(data.document.displayName).toBe('CV')
  })

  it('melempar HttpError dengan pesan server pada 4xx', async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(res(413, { error: 'Melebihi batas ukuran file.' }))) as never
    await expect(fetchJsonWithRetry('/x')).rejects.toBeInstanceOf(HttpError)
    await expect(fetchJsonWithRetry('/x')).rejects.toThrow('Melebihi batas ukuran file.')
  })
})

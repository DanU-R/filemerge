import 'server-only'

/**
 * Rate limiter sederhana per-instance (SEC-08). Cukup untuk menahan
 * penyalahgunaan dasar tanpa layanan eksternal. Pada serverless, batas berlaku
 * per instance, bukan pengganti layanan terpusat, tapi lebih baik daripada nol.
 */
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  if (b.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    }
  }

  b.count += 1
  return { ok: true, remaining: limit - b.count, retryAfterSeconds: 0 }
}

/** Ambil IP dari header proxy (Vercel) dengan fallback aman. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/** Bersihkan bucket kedaluwarsa agar Map tidak tumbuh tanpa batas. */
export function sweepRateLimits(): void {
  const now = Date.now()
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
}

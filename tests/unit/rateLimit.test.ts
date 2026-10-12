import { describe, it, expect } from 'vitest'
import { rateLimit } from '../../src/lib/server/rateLimit'

describe('rateLimit', () => {
  it('mengizinkan sampai batas lalu menolak', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true)
    }
    const blocked = rateLimit(key, 3, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('key berbeda punya kuota terpisah', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    rateLimit(a, 1, 60_000)
    expect(rateLimit(a, 1, 60_000).ok).toBe(false)
    expect(rateLimit(b, 1, 60_000).ok).toBe(true)
  })

  it('jendela kedaluwarsa memulihkan kuota', () => {
    const key = `w-${Math.random()}`
    expect(rateLimit(key, 1, 1).ok).toBe(true)
    expect(rateLimit(key, 1, 1).ok).toBe(false)
    // tunggu jendela lewat
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(rateLimit(key, 1, 1).ok).toBe(true)
        resolve()
      }, 10),
    )
  })
})

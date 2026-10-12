import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, normalizeEmail } from '../../src/lib/password'

describe('password util', () => {
  it('hash bukan plaintext dan bisa diverifikasi', async () => {
    const hash = await hashPassword('rahasia12345')
    expect(hash).not.toBe('rahasia12345')
    expect(hash.startsWith('$2')).toBe(true) // bcrypt
    expect(await verifyPassword('rahasia12345', hash)).toBe(true)
    expect(await verifyPassword('salahbanget99', hash)).toBe(false)
  })

  it('hash berbeda untuk password sama (salt)', async () => {
    const a = await hashPassword('rahasia12345')
    const b = await hashPassword('rahasia12345')
    expect(a).not.toBe(b)
  })
})

describe('normalizeEmail', () => {
  it('trim + lowercase', () => {
    expect(normalizeEmail('  Kavera@Example.COM  ')).toBe('kavera@example.com')
  })
})

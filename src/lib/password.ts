/**
 * Utilitas password murni (tanpa `server-only` / next/headers) sehingga dapat
 * dipakai juga oleh skrip CLI (mis. `account:password`).
 */
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Normalisasi email agar unik case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

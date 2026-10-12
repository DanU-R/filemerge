'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'
  const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Terjadi kesalahan.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth" onSubmit={submit} data-testid="auth-form">
      <h1>{isRegister ? 'Buat akun' : 'Masuk'}</h1>
      <p className="muted">
        {isRegister
          ? 'Simpan dokumen sekali, pakai ulang kapan saja.'
          : 'Masuk untuk mengelola dokumen tersimpan.'}
      </p>

      {error && (
        <p className="alert alert--error" role="alert" data-testid="auth-error">
          {error}
        </p>
      )}

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="email"
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          required
          minLength={isRegister ? 8 : 1}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="password"
        />
      </label>

      <button className="btn btn--primary" type="submit" disabled={busy} data-testid="submit">
        {busy ? 'Memproses…' : isRegister ? 'Daftar' : 'Masuk'}
      </button>

      <p className="muted">
        {isRegister ? (
          <>
            Sudah punya akun? <Link href="/login">Masuk</Link>
          </>
        ) : (
          <>
            Belum punya akun? <Link href="/register">Daftar</Link>
          </>
        )}
      </p>
    </form>
  )
}

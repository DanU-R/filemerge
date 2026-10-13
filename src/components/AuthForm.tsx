'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchJsonWithRetry } from '@/lib/resilientFetch'
import { CheckIcon, DocsIllustration } from '@/components/Illustration'

/** Nilai produk di kolom kiri — supaya halaman tidak terasa lapang kosong. */
const BENEFITS = [
  {
    title: 'Simpan sekali, pakai berkali-kali',
    body: 'Unggah CV, KTP, atau ijazah satu kali; pakai lagi tanpa mengunggah ulang.',
  },
  {
    title: 'Gabungkan tetap di browser',
    body: 'Proses merge berjalan di perangkat kamu — isi dokumen tidak dikirim ke server.',
  },
  {
    title: 'Preset susunan berkas',
    body: 'Simpan urutan favorit (mis. “Lamaran Kerja”) dan terapkan dalam satu klik.',
  },
]

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'
  const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await fetchJsonWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      {/* ---- Kolom kiri: nilai produk ---- */}
      <aside className="auth-aside">
        <p className="auth-aside__eyebrow">Akun FileMerge</p>
        <h2 className="auth-aside__title">
          {isRegister ? 'Satu tempat untuk berkas yang sering dipakai' : 'Lanjut dari berkas yang sudah kamu simpan'}
        </h2>
        <p className="auth-aside__lead">
          Akun dipakai untuk menyimpan dokumen dan preset susunan. Menggabungkan berkas tetap
          gratis dan tetap berjalan di browser kamu.
        </p>

        <ul className="auth-benefits">
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <CheckIcon />
              <span>
                <strong>{b.title}</strong>
                <br />
                {b.body}
              </span>
            </li>
          ))}
        </ul>

        <DocsIllustration className="auth-aside__art" />
      </aside>

      {/* ---- Kolom kanan: kartu form ---- */}
      <form className="auth-card" onSubmit={submit} data-testid="auth-form">
        <div>
          <h1>{isRegister ? 'Buat akun' : 'Masuk'}</h1>
          <p className="muted">
            {isRegister
              ? 'Gratis. Tanpa kartu kredit.'
              : 'Masuk untuk membuka dokumen dan preset kamu.'}
          </p>
        </div>

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
            placeholder="nama@email.com"
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
            placeholder={isRegister ? 'Minimal 8 karakter' : 'Password kamu'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="password"
          />
          {isRegister && <span className="field__help">Minimal 8 karakter.</span>}
        </label>

        <button className="btn btn--primary" type="submit" disabled={busy} data-testid="submit">
          {busy ? 'Memproses…' : isRegister ? 'Daftar' : 'Masuk'}
        </button>

        <div className="auth-divider" />

        <p className="auth-switch">
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
    </div>
  )
}

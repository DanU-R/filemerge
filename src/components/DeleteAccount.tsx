'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteAccount({
  email,
  documentCount,
  presetCount,
}: {
  email: string
  documentCount: number
  presetCount: number
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (confirm !== 'HAPUS') {
      setError('Ketik HAPUS untuk mengonfirmasi.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Gagal menghapus akun.')
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth" onSubmit={submit} data-testid="delete-account-form">
      <h1>Hapus akun</h1>
      <p className="muted">
        Akun <strong>{email}</strong> beserta {documentCount} dokumen dan {presetCount} preset akan
        dihapus permanen. Tindakan ini tidak dapat dibatalkan.
      </p>

      {error && (
        <p className="alert alert--error" role="alert" data-testid="delete-error">
          {error}
        </p>
      )}

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="delete-password"
        />
      </label>

      <label className="field">
        <span>Ketik HAPUS untuk konfirmasi</span>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="HAPUS"
          data-testid="delete-confirm"
        />
      </label>

      <button
        className="btn btn--danger"
        type="submit"
        disabled={busy}
        data-testid="delete-submit"
      >
        {busy ? 'Menghapus…' : 'Hapus akun saya'}
      </button>
    </form>
  )
}

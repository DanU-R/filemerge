'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchJsonWithRetry, HttpError } from '@/lib/resilientFetch'

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
      // Lewat fetchJsonWithRetry (konvensi repo): penghapusan akun juga
      // menghapus berkas, jadi kegagalan jaringan sementara diulang otomatis.
      await fetchJsonWithRetry('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message || 'Gagal menghapus akun.'
          : 'Tidak dapat menghubungi server.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card card--danger" onSubmit={submit} data-testid="delete-account-form">
      <div className="card__head">
        <div>
          <h2 className="card__title">Hapus akun</h2>
          <p className="card__sub">
            Akun <strong>{email}</strong> beserta {documentCount} dokumen dan {presetCount} preset
            akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
      </div>

      {error && (
        <p className="alert alert--error" role="alert" data-testid="delete-error">
          {error}
        </p>
      )}

      <div className="controls">
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
      </div>

      <div>
        <button
          className="btn btn--danger"
          type="submit"
          disabled={busy}
          data-testid="delete-submit"
        >
          {busy ? 'Menghapus…' : 'Hapus akun saya'}
        </button>
      </div>
    </form>
  )
}

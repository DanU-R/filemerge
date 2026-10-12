'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DOC_CATEGORIES, CATEGORY_LABELS, DOC_LIMITS } from '@/lib/server/docLimits'
import { downloadWithRetry, fetchJsonWithRetry, HttpError } from '@/lib/resilientFetch'

export interface DocRow {
  id: string
  displayName: string
  category: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface Quota {
  usedBytes: number
  maxBytes: number
  count: number
  maxCount: number
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function typeLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (mime === 'image/png') return 'PNG'
  if (mime === 'image/jpeg') return 'JPG'
  return mime
}

function fmtDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function DocumentsManager({
  initialDocs,
  initialQuota,
}: {
  initialDocs: DocRow[]
  initialQuota: Quota
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('LAINNYA')
  const [retrying, setRetrying] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const working = busy || pending

  /** Pesan ramah dari error apa pun (NFR-03). */
  function msg(err: unknown, fallback: string): string {
    if (err instanceof HttpError) return err.message || fallback
    if (err instanceof Error && /abort|network|fetch/i.test(err.message))
      return 'Koneksi terputus. Periksa jaringan lalu coba lagi.'
    return fallback
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', name || file.name)
      fd.append('category', category)
      const data = await fetchJsonWithRetry<{ document: { displayName: string } }>(
        '/api/documents',
        { method: 'POST', body: fd },
        { onRetry: () => setRetrying(true) },
      )
      setNotice(`Dokumen "${data.document.displayName}" tersimpan.`)
      setFile(null)
      setName('')
      if (fileRef.current) fileRef.current.value = ''
      startTransition(() => router.refresh())
    } catch (err) {
      setError(msg(err, 'Upload gagal.'))
    } finally {
      setRetrying(false)
      setBusy(false)
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Hapus "${label}"? Tindakan ini permanen.`)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fetchJsonWithRetry(
        `/api/documents/${id}`,
        { method: 'DELETE' },
        { onRetry: () => setRetrying(true) },
      )
      setNotice('Dokumen dihapus.')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(msg(err, 'Gagal menghapus.'))
    } finally {
      setRetrying(false)
      setBusy(false)
    }
  }

  async function rename(id: string, current: string, currentCat: string) {
    const next = prompt('Nama baru:', current)
    if (!next || next === current) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fetchJsonWithRetry(
        `/api/documents/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: next, category: currentCat }),
        },
        { onRetry: () => setRetrying(true) },
      )
      setNotice('Nama diperbarui.')
      startTransition(() => router.refresh())
    } catch (err) {
      setError(msg(err, 'Gagal memperbarui.'))
    } finally {
      setRetrying(false)
      setBusy(false)
    }
  }

  async function download(id: string, label: string) {
    setError(null)
    setNotice(null)
    try {
      await downloadWithRetry(`/api/documents/${id}`, label, {
        onRetry: () => setRetrying(true),
      })
    } catch (err) {
      setError(msg(err, 'Gagal mengunduh.'))
    } finally {
      setRetrying(false)
    }
  }

  async function replaceFile(id: string, label: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        const fd = new FormData()
        fd.append('file', f)
        await fetchJsonWithRetry(
          `/api/documents/${id}`,
          { method: 'PUT', body: fd },
          { onRetry: () => setRetrying(true) },
        )
        setNotice(`File "${label}" diperbarui.`)
        startTransition(() => router.refresh())
      } catch (err) {
        setError(msg(err, 'Gagal mengganti file.'))
      } finally {
        setRetrying(false)
        setBusy(false)
      }
    }
    input.click()
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const docs = initialDocs
  const quota = initialQuota
  const filtered = docs.filter((d) => {
    const q = query.trim().toLowerCase()
    const matchQ = !q || d.displayName.toLowerCase().includes(q)
    const matchC = !filter || d.category === filter
    const matchT = !typeFilter || d.mimeType === typeFilter
    return matchQ && matchC && matchT
  })

  return (
    <div className="dash">
      <div className="dash__head">
        <h1>My Documents</h1>
        <button className="btn" onClick={logout} type="button" data-testid="logout">
          Keluar
        </button>
      </div>

      <p className="muted" data-testid="quota">
        {quota.count}/{quota.maxCount} dokumen · {fmt(quota.usedBytes)} / {fmt(quota.maxBytes)}
      </p>

      {error && (
        <p className="alert alert--error" role="alert" data-testid="dash-error">
          {error}
        </p>
      )}
      {retrying && (
        <p className="muted small" role="status" data-testid="retrying">
          Koneksi bermasalah — mencoba lagi…
        </p>
      )}
      {notice && (
        <p className="alert alert--ok" role="status" data-testid="dash-notice">
          {notice}
        </p>
      )}

      <form className="upload" onSubmit={upload} data-testid="upload-form">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            if (f && !name) setName(f.name)
          }}
          data-testid="doc-file"
          required
        />
        <label className="field">
          <span>Nama</span>
          <input value={name} onChange={(e) => setName(e.target.value)} data-testid="doc-name" />
        </label>
        <label className="field">
          <span>Kategori</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="doc-category"
          >
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn--primary"
          disabled={working || !file}
          type="submit"
          data-testid="upload"
        >
          {working ? 'Mengunggah…' : 'Unggah'}
        </button>
        <span className="muted small">Maks {DOC_LIMITS.MAX_FILE_BYTES / 1024 / 1024} MB/file</span>
      </form>

      <div className="filters">
        <input
          placeholder="Cari nama…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="search"
          aria-label="Cari dokumen"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter kategori"
          data-testid="filter"
        >
          <option value="">Semua kategori</option>
          {DOC_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter tipe"
          data-testid="filter-type"
        >
          <option value="">Semua tipe</option>
          <option value="application/pdf">PDF</option>
          <option value="image/jpeg">JPG</option>
          <option value="image/png">PNG</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty" data-testid="empty">
          {docs.length === 0
            ? 'Belum ada dokumen. Unggah PDF/JPG/PNG pertama kamu.'
            : 'Tidak ada dokumen yang cocok.'}
        </p>
      ) : (
        <ul className="doclist" data-testid="doclist">
          {filtered.map((d) => (
            <li key={d.id} className="doclist__item" data-testid="doc-item">
              <span className="doclist__name" title={d.displayName}>
                {d.displayName}
              </span>
              <span className="badge">
                {CATEGORY_LABELS[d.category as keyof typeof CATEGORY_LABELS] ?? d.category}
              </span>
              <span className="badge">{typeLabel(d.mimeType)}</span>
              <span className="muted small">{fmt(d.sizeBytes)}</span>
              <span className="muted small" data-testid="doc-date">
                {fmtDate(d.createdAt)}
              </span>
              <span className="doclist__actions">
                <button
                  className="icon"
                  type="button"
                  aria-label={`Unduh ${d.displayName}`}
                  onClick={() => download(d.id, d.displayName)}
                  data-testid="download"
                  data-href={`/api/documents/${d.id}`}
                >
                  ⤓
                </button>
                <button
                  className="icon"
                  type="button"
                  aria-label={`Ganti file ${d.displayName}`}
                  onClick={() => replaceFile(d.id, d.displayName)}
                  data-testid="replace"
                >
                  ⇄
                </button>
                <button
                  className="icon"
                  type="button"
                  aria-label={`Ganti nama ${d.displayName}`}
                  onClick={() => rename(d.id, d.displayName, d.category)}
                >
                  ✎
                </button>
                <button
                  className="icon icon--danger"
                  type="button"
                  aria-label={`Hapus ${d.displayName}`}
                  onClick={() => remove(d.id, d.displayName)}
                  data-testid="delete"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

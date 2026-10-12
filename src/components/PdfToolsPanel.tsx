'use client'

import { useCallback, useState } from 'react'
import { applyEditsBytes, compressPdfBytes, inspectPdfBytes, splitPdfBytes } from '@/lib/pageToolsClient'
import { parseRanges, type PageEdit, type PageInfo } from '@/lib/pageTools'
import { detectKind } from '@/lib/validate'
import { sanitizeOutputName, sanitizeFileName } from '@/lib/sanitize'

const ACCEPT = '.pdf,application/pdf'

interface Loaded {
  name: string
  bytes: Uint8Array
  pages: PageInfo[]
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function baseName(name: string): string {
  return sanitizeFileName(name).replace(/\.pdf$/i, '') || 'dokumen'
}

/**
 * Alat PDF (Fase 5 lanjutan): rotasi/hapus per halaman, pecah (split), kompresi.
 * Semua diproses di browser — isi dokumen tidak dikirim ke server.
 */
export default function PdfToolsPanel() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [edits, setEdits] = useState<Record<number, PageEdit>>({})
  const [ranges, setRanges] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadBytes = useCallback(async (name: string, bytes: Uint8Array) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const pages = await inspectPdfBytes(bytes)
      setLoaded({ name, bytes, pages })
      setEdits({})
      setRanges(`1-${Math.max(1, pages.length)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membaca PDF.')
      setLoaded(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const onPick = useCallback(
    async (file: File | null) => {
      if (!file) return
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (!detectKind(bytes.subarray(0, 16))) {
        setError('File tidak dikenali — hanya PDF atau gambar JPG/PNG yang didukung.')
        return
      }
      await loadBytes(file.name, bytes)
    },
    [loadBytes],
  )

  const rotate = (index: number, deg: number) => {
    setEdits((prev) => ({
      ...prev,
      [index]: { ...prev[index], rotate: ((prev[index]?.rotate ?? 0) + deg) % 360 },
    }))
  }
  const toggleDelete = (index: number) => {
    setEdits((prev) => {
      const next = { ...prev }
      const cur = next[index]
      if (cur?.deleted) delete next[index]
      else next[index] = { ...cur, deleted: true }
      return next
    })
  }

  const keptCount = loaded
    ? loaded.pages.filter((p) => !edits[p.index]?.deleted).length
    : 0

  async function applyEdits() {
    if (!loaded) return
    if (keptCount === 0) {
      setError('Semua halaman dihapus — sisakan minimal 1 halaman.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const list: PageEdit[] = loaded.pages.map((p) => edits[p.index] ?? {})
      const out = await applyEditsBytes(loaded.bytes, list)
      downloadBytes(out, `${sanitizeOutputName(baseName(loaded.name))}.pdf`)
      setNotice(`Halaman disimpan: ${keptCount} dari ${loaded.pages.length}.`)
      // Muat ulang dari hasil agar indeks halaman konsisten.
      await loadBytes(loaded.name, out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menerapkan perubahan halaman.')
    } finally {
      setBusy(false)
    }
  }

  async function runSplit() {
    if (!loaded) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const parsed = parseRanges(ranges, loaded.pages.length)
      const parts = await splitPdfBytes(loaded.bytes, parsed)
      if (parts.length === 0) {
        setError('Tidak ada bagian yang dihasilkan.')
        return
      }
      const base = baseName(loaded.name)
      parts.forEach((p, i) => downloadBytes(p, `${sanitizeOutputName(`${base}-bagian-${i + 1}`)}.pdf`))
      setNotice(`Pecah menjadi ${parts.length} file.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memecah PDF.')
    } finally {
      setBusy(false)
    }
  }

  async function runCompress() {
    if (!loaded) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const r = await compressPdfBytes(loaded.bytes)
      downloadBytes(r.bytes, `${sanitizeOutputName(baseName(loaded.name))}-kompres.pdf`)
      const before = (r.originalBytes / 1024).toFixed(0)
      const after = (r.compressedBytes / 1024).toFixed(0)
      setNotice(
        r.savedRatio > 0
          ? `Kompresi: ${before} KB → ${after} KB (hemat ${Math.round(r.savedRatio * 100)}%).`
          : `Tidak ada penghematan berarti (${before} KB). File asli dipertahankan.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengompres PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="cloud" data-testid="pdftools">
      <h2 className="cloud__title">Alat PDF — rotasi, hapus halaman, pecah, kompres</h2>
      <p className="muted small">
        Pilih satu PDF. Semua diproses di browser kamu. Jika salah satu file sudah ada di antrean,
        unggah ulang di sini.
      </p>

      <label className="field">
        <span>File PDF</span>
        <input
          type="file"
          accept={ACCEPT}
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
          data-testid="pdftools-input"
        />
      </label>

      {error && (
        <p className="alert alert--error" role="alert" data-testid="pdftools-error">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert--ok" role="status" data-testid="pdftools-notice">
          {notice}
        </p>
      )}

      {loaded && (
        <>
          <p className="muted small" data-testid="pdftools-summary">
            {loaded.name} · {loaded.pages.length} halaman · {keptCount} dipakai
          </p>

          <ul className="doclist" data-testid="pdftools-pages">
            {loaded.pages.map((p) => {
              const e = edits[p.index] ?? {}
              return (
                <li key={p.index} className="doclist__item" data-testid="pdftools-page">
                  <span className="doclist__name">
                    Hal {p.index + 1}{' '}
                    <span className="muted small">
                      ({Math.round(p.width)}×{Math.round(p.height)}
                      {e.rotate ? ` · +${e.rotate}°` : ''}
                      {p.rotation ? ` · asal ${p.rotation}°` : ''})
                    </span>
                  </span>
                  {e.deleted ? (
                    <span className="badge" data-testid="page-deleted">
                      dihapus
                    </span>
                  ) : (
                    <>
                      <button
                        className="icon"
                        type="button"
                        aria-label={`Putar halaman ${p.index + 1} 90 derajat`}
                        onClick={() => rotate(p.index, 90)}
                        data-testid="page-rotate-90"
                      >
                        ↻
                      </button>
                      <button
                        className="icon"
                        type="button"
                        aria-label={`Putar halaman ${p.index + 1} 180 derajat`}
                        onClick={() => rotate(p.index, 180)}
                        data-testid="page-rotate-180"
                      >
                        ⟳
                      </button>
                    </>
                  )}
                  <button
                    className="icon icon--danger"
                    type="button"
                    aria-label={`${e.deleted ? 'Kembalikan' : 'Hapus'} halaman ${p.index + 1}`}
                    onClick={() => toggleDelete(p.index)}
                    data-testid="page-delete"
                  >
                    {e.deleted ? '↺' : '×'}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="preset">
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => void applyEdits()}
              disabled={busy}
              data-testid="pdftools-apply"
            >
              {busy ? 'Memproses…' : 'Terapkan & unduh'}
            </button>
          </div>

          <div className="preset">
            <label className="field">
              <span>Pecah (rentang, mis. 1-3, 5)</span>
              <input
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                data-testid="split-ranges"
              />
            </label>
            <button
              className="btn"
              type="button"
              onClick={() => void runSplit()}
              disabled={busy}
              data-testid="split-run"
            >
              Pecah PDF
            </button>
          </div>

          <div className="preset">
            <button
              className="btn"
              type="button"
              onClick={() => void runCompress()}
              disabled={busy}
              data-testid="compress-run"
            >
              Kompres PDF
            </button>
          </div>
        </>
      )}
    </section>
  )
}

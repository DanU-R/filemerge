'use client'

/* eslint-disable @next/next/no-img-element --
   Thumbnail berasal dari blob hasil render pdf.js (object URL), tidak melewati
   jaringan sehingga next/image tidak memberi manfaat dan malah menambah biaya. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEditsBytes, compressPdfBytes, inspectPdfBytes, splitPdfBytes } from '@/lib/pageToolsClient'
import { parseRanges, type PageEdit, type PageInfo } from '@/lib/pageTools'
import { detectKind } from '@/lib/validate'
import { sanitizeOutputName, sanitizeFileName } from '@/lib/sanitize'
import { renderThumbnails, revokeThumbnails, type Thumbnail } from '@/lib/pdfThumbnails'
import { ReorderableThumbs } from '@/components/ReorderableThumbs'

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

/**
 * Tunggu unduhan selesai sebelum melanjutkan. Beberapa browser membatalkan
 * unduhan yang dibuat terlalu cepat berturut-turut (bug nyata: dua bagian split
 * hilang karena unduhan kedua dibuat sebelum yang pertama sempat mulai).
 */
function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/** Nama dasar tanpa ekstensi .pdf (aman, tanpa ekstensi ganda). */
function baseName(name: string): string {
  return sanitizeFileName(name).replace(/\.pdf$/i, '') || 'dokumen'
}

/**
 * Putar thumbnail secara visual mengikuti rotasi aktif. Ini cerminan akurat dari
 * hasil akhir: halaman A4 tegak (595×842) yang diputar 90° memang menjadi melintang.
 */
function thumbStyle(t: Thumbnail, rotate: number): React.CSSProperties {
  const swapped = rotate % 180 !== 0
  const boxW = swapped ? t.height : t.width
  const boxH = swapped ? t.width : t.height
  return {
    width: boxW,
    height: boxH,
    transform: `rotate(${rotate}deg)`,
    transition: 'transform 160ms ease',
  }
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
  const [thumbs, setThumbs] = useState<Thumbnail[] | null>(null)
  const [thumbStatus, setThumbStatus] = useState<'idle' | 'rendering' | 'ready' | 'failed'>('idle')
  /** Urutan halaman secara visual (id = `p<indeksAsal>`). */
  const [order, setOrder] = useState<string[]>([])

  // Object URL thumbnail harus di-revoke agar tidak bocor memori.
  const thumbsRef = useRef<Thumbnail[] | null>(null)
  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])
  useEffect(
    () => () => {
      revokeThumbnails(thumbsRef.current)
    },
    [],
  )

  const loadBytes = useCallback(
    async (name: string, bytes: Uint8Array, opts: { keepNotice?: boolean } = {}) => {
      setBusy(true)
      setError(null)
      if (!opts.keepNotice) setNotice(null)
      try {
        const pages = await inspectPdfBytes(bytes)
        setLoaded({ name, bytes, pages })
        setEdits({})
        setOrder(pages.map((p) => `p${p.index}`))
        setRanges(`1-${Math.max(1, pages.length)}`)

        // Preview visual (tidak wajib): kegagalan render tidak boleh menggagalkan
        // fungsi inti. Bila pdf.js gagal dimuat, editor tetap berguna tanpa gambar.
        setThumbs(null)
        setThumbStatus('rendering')
        try {
          const rendered = await renderThumbnails(bytes, { maxWidth: 200, yieldMs: 0 })
          setThumbs(rendered)
          setThumbStatus('ready')
        } catch {
          setThumbs(null)
          setThumbStatus('failed')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal membaca PDF.')
        setLoaded(null)
        setThumbs(null)
        setThumbStatus('idle')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

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
  /** Rotasi 90° dengan umpan balik berkala: baca nilai state terbaru saat diklik. */
  const rotate90 = (index: number) => {
    setEdits((prev) => ({
      ...prev,
      [index]: { ...prev[index], rotate: ((prev[index]?.rotate ?? 0) + 90) % 360 },
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

  /** Pindahkan posisi halaman (drag-and-drop). */
  const reorder = (from: number, to: number) => {
    setOrder((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  /** Alternatif aksesibilitas: naik/turun satu posisi. */
  const move = (pos: number, dir: -1 | 1) => reorder(pos, pos + dir)

  const isReordered = order.some((id, i) => id !== `p${i}`)

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
      const list: PageEdit[] = loaded.pages.map((p) => ({ ...(edits[p.index] ?? {}) }))
      // Kirim urutan hasil: posisi visual -> indeks halaman asal.
      order.forEach((id, pos) => {
        const idx = Number(id.slice(1))
        list[idx] = { ...list[idx], order: pos }
      })
      const out = await applyEditsBytes(loaded.bytes, list)
      downloadBytes(out, sanitizeOutputName(baseName(loaded.name)))
      // Muat ulang dari hasil agar indeks halaman konsisten, tetapi pertahankan
      // pesan sukses (sebelumnya pesan ini terhapus oleh reload).
      await loadBytes(loaded.name, out, { keepNotice: true })
      setNotice(
        `Halaman disimpan: ${keptCount} dari ${loaded.pages.length}${isReordered ? ', urutan diubah' : ''}.`,
      )
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
      // Beri jeda antar unduhan agar browser tidak membatalkan yang berikutnya.
      for (let i = 0; i < parts.length; i++) {
        downloadBytes(parts[i], sanitizeOutputName(`${base}-bagian-${i + 1}`))
        await wait(700)
      }
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
      downloadBytes(r.bytes, sanitizeOutputName(`${baseName(loaded.name)}-kompres`))
      const before = (r.originalBytes / 1024).toFixed(0)
      const after = (r.compressedBytes / 1024).toFixed(0)
      setNotice(
        r.savedRatio > 0
          ? `Kompresi: ${before} KB → ${after} KB (hemat ${Math.round(r.savedRatio * 100)}%). Kualitas & teks utuh.`
          : `Tidak ada penghematan berarti (${before} KB). File asli dipertahankan.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengompres PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" data-testid="pdftools">
      <div className="card__head">
        <div>
          <h2 className="card__title">Halaman PDF</h2>
          <p className="card__sub">
            Susun ulang, putar, atau hapus halaman; lalu pecah / kompres berkasnya. Semua diproses
            di browser.
          </p>
        </div>
      </div>

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
          {thumbStatus === 'rendering' && (
            <p className="muted small" data-testid="thumbs-status">
              Menyiapkan pratinjau…
            </p>
          )}
          {thumbStatus === 'failed' && (
            <p className="muted small" data-testid="thumbs-status">
              Pratinjau tidak tersedia — editor tetap bisa dipakai.
            </p>
          )}

          <ReorderableThumbs
            orderIds={order}
            onReorder={reorder}
            className="thumbgrid"
            renderItem={(id, pos, handle) => {
              const p = loaded.pages[Number(id.slice(1))]
              if (!p) return null
              const e = edits[p.index] ?? {}
              const t = thumbs?.[p.index]
              const angle = ((p.rotation + (e.rotate ?? 0)) % 360 + 360) % 360
              return (
                <>
                  <div className="thumb__top">
                    {handle}
                    <span className="thumb__pos" data-testid="page-pos">
                      #{pos + 1}
                    </span>
                  </div>
                  <div className="thumb__frame" data-testid="thumb-frame">
                    {t ? (
                      <img
                        className="thumb__img"
                        src={t.url}
                        alt={`Pratinjau halaman ${p.index + 1}`}
                        style={thumbStyle(t, angle)}
                        data-testid="thumb-img"
                      />
                    ) : (
                      <span className="thumb__ph" aria-hidden="true">
                        {p.index + 1}
                      </span>
                    )}
                  </div>
                  <div className="thumb__meta">
                    <span className="thumb__label">
                      Hal {p.index + 1}{' '}
                      <span className="muted small">
                        {Math.round(p.width)}×{Math.round(p.height)}
                        {angle ? ` · ${angle}°` : ''}
                      </span>
                    </span>
                  </div>
                  <div className="thumb__actions">
                    {e.deleted ? (
                      <span className="badge" data-testid="page-deleted">
                        dihapus
                      </span>
                    ) : (
                      <>
                        <button
                          className="icon"
                          type="button"
                          aria-label={`Geser halaman ${p.index + 1} ke kiri`}
                          onClick={() => move(pos, -1)}
                          disabled={pos === 0}
                          data-testid="page-up"
                        >
                          ←
                        </button>
                        <button
                          className="icon"
                          type="button"
                          aria-label={`Geser halaman ${p.index + 1} ke kanan`}
                          onClick={() => move(pos, 1)}
                          disabled={pos === order.length - 1}
                          data-testid="page-down"
                        >
                          →
                        </button>
                        <button
                          className="icon"
                          type="button"
                          aria-label={`Putar halaman ${p.index + 1} 90 derajat`}
                          onClick={() => rotate90(p.index)}
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
                  </div>
                </>
              )
            }}
          />

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

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { runMerge } from '@/lib/mergeClient'
import { validateFile, detectKind } from '@/lib/validate'
import { sanitizeOutputName, sanitizeFileName } from '@/lib/sanitize'
import { LIMITS, formatBytes, wouldExceedTotal } from '@/lib/limits'
import {
  DEFAULT_PAGE_SETTINGS,
  PAGE_SIZE_OPTIONS,
  ORIENTATION_OPTIONS,
  MARGIN_OPTIONS,
  type PageSettings,
} from '@/lib/pageSettings'
import { ReorderableList } from '@/components/ReorderableList'
import PageSettingsPanel from '@/components/PageSettingsPanel'
import PresetPanel, { type PresetRow } from '@/components/PresetPanel'
import { fetchWithRetry } from '@/lib/resilientFetch'
import type { MergeSource, QueueItem } from '@/lib/types'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

interface QueueState {
  items: QueueItem[]
  errors: string[]
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export interface CloudDocItem {
  id: string
  displayName: string
  category: string
  sizeBytes: number
}

export default function MergeTool({
  cloudDocs = [],
  presets: initialPresets = [],
  isAuthed = false,
}: {
  cloudDocs?: CloudDocItem[]
  presets?: PresetRow[]
  isAuthed?: boolean
}) {
  const [queue, setQueue] = useState<QueueState>({ items: [], errors: [] })
  const [presets, setPresets] = useState<PresetRow[]>(initialPresets)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(
    null,
  )
  const [failures, setFailures] = useState<{ name: string; reason: string }[]>([])
  const [outputName, setOutputName] = useState('hasil-gabung')
  const [result, setResult] = useState<{
    url: string
    size: number
    pages: number
    id: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastUrlRef = useRef<string | null>(null)
  const itemsRef = useRef<QueueItem[]>([])
  const resultCounterRef = useRef(0)

  const items = queue.items
  const errors = queue.errors

  // Sinkronkan ref dengan state terbaru (dipakai addFiles agar tidak ada race).
  useEffect(() => {
    itemsRef.current = queue.items
  }, [queue.items])

  const totalBytes = useMemo(() => items.reduce((s, i) => s + i.size, 0), [items])
  const overWarn = totalBytes > LIMITS.WARN_TOTAL_BYTES

  // Bersihkan object URL terakhir saat komponen dilepas (cegah kebocoran memori).
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
      lastUrlRef.current = null
    }
  }, [])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files)
    if (incoming.length === 0) return
    const nextErrors: string[] = []
    const accepted: QueueItem[] = []
    // Snapshot antrean saat ini (ref) -> hindari race antar pemanggilan addFiles.
    const current = itemsRef.current
    let running = current.reduce((s, i) => s + i.size, 0)
    let count = current.length

    for (const file of incoming) {
      if (count >= LIMITS.MAX_FILES) {
        nextErrors.push(`${file.name}: antrean penuh (maks ${LIMITS.MAX_FILES} file).`)
        continue
      }
      // Validasi ukuran & tipe/konten (baca byte pertama untuk magic bytes).
      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
      const check = validateFile({ name: file.name, type: file.type, size: file.size }, head)
      if (!check.ok) {
        nextErrors.push(`${file.name}: ${check.reason}`)
        continue
      }
      if (wouldExceedTotal(running, file.size)) {
        nextErrors.push(
          `${file.name}: total antrean melebihi ${formatBytes(LIMITS.MAX_TOTAL_BYTES)}.`,
        )
        continue
      }
      running += file.size
      count += 1
      accepted.push({
        id: newId(),
        file,
        name: sanitizeFileName(file.name),
        kind: check.kind,
        size: file.size,
      })
    }

    // Satu pembaruan state atomik -> antrean tidak terpotong.
    setQueue((prev) => ({
      items: [...prev.items, ...accepted],
      errors: nextErrors,
    }))
  }, [])

  // Fase 3: unduh dokumen tersimpan ke browser, lalu masuk antrean (diproses lokal).
  const addCloudDoc = useCallback(async (doc: CloudDocItem) => {
    try {
      const res = await fetchWithRetry(`/api/documents/${doc.id}`)
      if (!res.ok) {
        setQueue((prev) => ({ ...prev, errors: [`Gagal mengambil "${doc.displayName}".`] }))
        return
      }
      const blob = await res.blob()
      const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
      const kind = detectKind(head)
      if (!kind) {
        setQueue((prev) => ({ ...prev, errors: [`"${doc.displayName}" tidak dikenali.`] }))
        return
      }
      const item: QueueItem = {
        id: newId(),
        file: new File([blob], doc.displayName, { type: blob.type }),
        name: sanitizeFileName(doc.displayName),
        kind: kind === 'pdf' ? 'pdf' : 'image',
        size: blob.size,
        cloudId: doc.id,
      }
      setQueue((prev) => {
        if (prev.items.length >= LIMITS.MAX_FILES) {
          return { ...prev, errors: [`Antrean penuh (maks ${LIMITS.MAX_FILES} file).`] }
        }
        if (wouldExceedTotal(prev.items.reduce((s, i) => s + i.size, 0), item.size)) {
          return { ...prev, errors: ['Total antrean melebihi batas.'] }
        }
        return { ...prev, items: [...prev.items, item], errors: [] }
      })
    } catch {
      setQueue((prev) => ({ ...prev, errors: [`Gagal mengambil "${doc.displayName}".`] }))
    }
  }, [])

  const move = (index: number, dir: -1 | 1) => {
    setQueue((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.items.length) return prev
      const next = [...prev.items]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, items: next }
    })
  }

  // Drag-and-drop (Fase 5): pindahkan item dari index `from` ke `to`.
  const reorder = (from: number, to: number) => {
    setQueue((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.items.length || to >= prev.items.length) {
        return prev
      }
      const next = [...prev.items]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { ...prev, items: next }
    })
  }

  const remove = (id: string) =>
    setQueue((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }))

  // Fase 5: simpan susunan saat ini (dokumen akun) sebagai preset.
  const savePreset = async (name: string) => {
    const ids = items.filter((i) => i.cloudId).map((i) => ({ documentId: i.cloudId as string }))
    if (ids.length === 0) return
    try {
      const res = await fetchWithRetry('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, items: ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setQueue((prev) => ({ ...prev, errors: [data.error || 'Gagal menyimpan preset.'] }))
        return
      }
      setPresets((prev) => [{ id: data.preset.id, name: data.preset.name, items: ids.map((x, i) => ({ documentId: x.documentId, order: i })) }, ...prev])
    } catch {
      setQueue((prev) => ({ ...prev, errors: ['Gagal menyimpan preset.'] }))
    }
  }

  const applyPreset = async (ids: string[]) => {
    const docs = ids
      .map((id) => cloudDocs.find((d) => d.id === id))
      .filter((d): d is CloudDocItem => !!d)
    if (docs.length === 0) {
      setQueue((prev) => ({ ...prev, errors: ['Preset kosong atau dokumen sudah dihapus.'] }))
      return
    }
    setQueue({ items: [], errors: [] })
    for (const d of docs) await addCloudDoc(d)
  }

  const deletePreset = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/presets/${id}`, { method: 'DELETE' })
      if (res.ok) setPresets((prev) => prev.filter((p) => p.id !== id))
    } catch {
      /* abaikan */
    }
  }

  const reset = () => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
    lastUrlRef.current = null
    setQueue({ items: [], errors: [] })
    setFailures([])
    setResult(null)
    setProgress(null)
  }

  const merge = async () => {
    if (items.length < 1 || busy) return
    setBusy(true)
    setQueue((prev) => ({ ...prev, errors: [] }))
    setFailures([])
    setProgress({ done: 0, total: items.length, name: '' })
    try {
      const sources: MergeSource[] = items.map((i) => ({
        id: i.id,
        kind: i.kind,
        name: i.name,
        file: i.file,
      }))
      const out = sanitizeOutputName(outputName)
      const merged = await runMerge({
        sources,
        outputName: out,
        pageSettings,
        onProgress: (index, total, name) => setProgress({ done: index, total, name }),
      })
      const blob = new Blob([merged.bytes as BlobPart], { type: 'application/pdf' })
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
      const url = URL.createObjectURL(blob)
      lastUrlRef.current = url
      setResult({ url, size: blob.size, pages: merged.pages, id: ++resultCounterRef.current })
      setFailures(merged.failures.map((f) => ({ name: f.name, reason: f.reason })))
      triggerDownload(url, out)
    } catch (err) {
      setQueue((prev) => ({
        ...prev,
        errors: [`Gagal menggabungkan: ${err instanceof Error ? err.message : String(err)}`],
      }))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="tool">
      <section
        className={`dropzone${dragging ? ' dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addFiles(e.dataTransfer.files)
        }}
      >
        <p>
          <strong>Tarik &amp; lepas</strong> file ke sini, atau
        </p>
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          Pilih file
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="visually-hidden"
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="hint">
          PDF, JPG, atau PNG. Maks {formatBytes(LIMITS.MAX_FILE_BYTES)} per file,{' '}
          {LIMITS.MAX_FILES} file, total {formatBytes(LIMITS.MAX_TOTAL_BYTES)}.
        </p>
      </section>

      {cloudDocs.length > 0 && (
        <section className="cloud" data-testid="cloud-docs">
          <h2 className="cloud__title">Pilih dari dokumen saya</h2>
          <ul className="cloud__list">
            {cloudDocs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void addCloudDoc(d)}
                  data-testid="cloud-add"
                >
                  + {d.displayName}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {errors.length > 0 && (
        <ul className="alert alert--error" role="alert" data-testid="errors">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {overWarn && (
        <p className="alert alert--warn" role="status">
          Total antrean {formatBytes(totalBytes)} cukup besar — proses bisa lambat di perangkat
          berkapasitas rendah.
        </p>
      )}

      <ReorderableList
        items={items}
        onReorder={reorder}
        className="queue"
        renderItem={(item, index, handle) => (
          <>
            {handle}
            <span className="queue__index">{index + 1}</span>
            <span className="queue__name" title={item.name}>
              {item.name}
            </span>
            <span className={`badge badge--${item.kind}`}>
              {item.kind === 'pdf' ? 'PDF' : 'Gambar'}
            </span>
            <span className="queue__size">{formatBytes(item.size)}</span>
            <span className="queue__actions">
              <button
                type="button"
                className="icon"
                aria-label={`Naikkan ${item.name}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon"
                aria-label={`Turunkan ${item.name}`}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon icon--danger"
                aria-label={`Hapus ${item.name}`}
                onClick={() => remove(item.id)}
              >
                ×
              </button>
            </span>
          </>
        )}
      />

      {items.length === 0 && (
        <p className="empty" data-testid="empty">
          Belum ada file. Tambahkan minimal satu PDF atau gambar untuk mulai.
        </p>
      )}

      {isAuthed && (
        <PresetPanel
          presets={presets}
          busy={busy}
          canCreate={items.some((i) => i.cloudId)}
          onCreate={(name) => void savePreset(name)}
          onApply={(ids) => void applyPreset(ids)}
          onDelete={(id) => void deletePreset(id)}
        />
      )}

      <PageSettingsPanel value={pageSettings} onChange={setPageSettings} />

      <div className="controls">
        <label className="field">
          <span>Nama hasil</span>
          <input
            type="text"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
            aria-label="Nama file hasil"
            data-testid="output-name"
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          disabled={items.length === 0 || busy}
          onClick={() => void merge()}
          data-testid="merge"
        >
          {busy ? 'Menggabungkan…' : 'Gabungkan'}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={reset}>
          Bersihkan
        </button>
      </div>

      {progress && (
        <p className="progress" role="status" data-testid="progress">
          Memproses {Math.min(progress.done + 1, progress.total)}/{progress.total}
          {progress.name ? ` — ${progress.name}` : ''}
        </p>
      )}

      {failures.length > 0 && (
        <ul className="alert alert--error" role="alert" data-testid="failures">
          {failures.map((f, i) => (
            <li key={i}>
              {f.name}: {f.reason}
            </li>
          ))}
        </ul>
      )}

      {result && (
        <div className="result" data-testid="result" data-result-id={result.id}>
          <p>
            Selesai — {result.pages} halaman, {formatBytes(result.size)}.
          </p>
          <a
            className="btn btn--primary"
            href={result.url}
            download={sanitizeOutputName(outputName)}
            data-testid="download"
          >
            Unduh PDF
          </a>
        </div>
      )}
    </div>
  )
}

function triggerDownload(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

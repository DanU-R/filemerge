'use client'

import { useState } from 'react'

export interface PresetItem {
  documentId: string
  order: number
}

export interface PresetRow {
  id: string
  name: string
  items: PresetItem[] | unknown
}

function itemIds(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((it) => (it && typeof it === 'object' ? (it as { documentId?: string }).documentId : null))
    .filter((x): x is string => typeof x === 'string')
}

export default function PresetPanel({
  presets,
  onApply,
  onDelete,
  onCreate,
  canCreate,
  busy,
}: {
  presets: PresetRow[]
  onApply: (ids: string[]) => void
  onDelete: (id: string) => void
  onCreate: (name: string) => void
  canCreate: boolean
  busy: boolean
}) {
  const [name, setName] = useState('')

  return (
    <section className="cloud" data-testid="presets">
      <h2 className="cloud__title">Preset susunan</h2>

      <div className="preset">
        <input
          placeholder="Nama preset (mis. Lamaran Kerja)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nama preset"
          data-testid="preset-name"
        />
        <button
          type="button"
          className="btn btn--small"
          disabled={!canCreate || busy || name.trim().length === 0}
          onClick={() => {
            onCreate(name.trim())
            setName('')
          }}
          data-testid="preset-save"
        >
          Simpan susunan saat ini
        </button>
        {!canCreate && (
          <span className="muted small">
            Tambahkan dokumen dari akun Anda agar susunan bisa disimpan.
          </span>
        )}
      </div>

      {presets.length > 0 && (
        <ul className="cloud__list" style={{ marginTop: 10 }}>
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="btn btn--small"
                disabled={busy}
                onClick={() => onApply(itemIds(p.items))}
                data-testid="preset-apply"
              >
                Terapkan: {p.name}
              </button>
              <button
                type="button"
                className="icon icon--danger"
                aria-label={`Hapus preset ${p.name}`}
                disabled={busy}
                onClick={() => onDelete(p.id)}
                data-testid="preset-delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

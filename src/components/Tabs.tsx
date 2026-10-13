'use client'

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  /** Satu kalimat bantu di bawah bilah tab; berubah per tab. */
  hint: string
  content: ReactNode
}

/**
 * Navigasi tab gaya "segmented pill" (Percikan): track putih berisi pil-pil;
 * tab aktif = pil putih dengan teks aksen + bayangan tipis.
 *
 * Semua panel tetap ter-mount di DOM (hanya yang tidak aktif diberi `hidden`)
 * supaya keadaan di dalamnya — input file, hasil merge, dan lain-lain — tidak
 * hilang saat pengguna berpindah tab.
 */
export default function Tabs({
  items,
  testId = 'tabs',
  defaultTab,
}: {
  items: TabItem[]
  testId?: string
  /** Tab awal; diabaikan bila id-nya tidak ada di `items`. */
  defaultTab?: string
}) {
  const initial = items.some((t) => t.id === defaultTab) ? (defaultTab as string) : (items[0]?.id ?? '')
  const [active, setActive] = useState(initial)
  const base = useId()
  const current = items.find((t) => t.id === active) ?? items[0]

  const select = (id: string, focus = false) => {
    setActive(id)
    if (focus) document.getElementById(`${base}-tab-${id}`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    if (next >= 0) {
      e.preventDefault()
      select(items[next].id, true)
    }
  }

  return (
    <div className="tabs" data-testid={testId}>
      <div className="tabbar" role="tablist" aria-label="Bagian halaman merger">
        {items.map((t, i) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              id={`${base}-tab-${t.id}`}
              className="tab"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              data-testid={`tab-${t.id}`}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <p className="tabhint" data-testid="tab-hint">
        {current?.hint}
      </p>

      {items.map((t) => (
        <section
          key={t.id}
          id={`${base}-panel-${t.id}`}
          className="tabpanel"
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          data-testid={`panel-${t.id}`}
          hidden={t.id !== active}
        >
          {t.content}
        </section>
      ))}
    </div>
  )
}

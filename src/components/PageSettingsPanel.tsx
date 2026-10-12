'use client'

import {
  PAGE_SIZE_OPTIONS,
  ORIENTATION_OPTIONS,
  MARGIN_OPTIONS,
  type PageSettings,
} from '@/lib/pageSettings'

export default function PageSettingsPanel({
  value,
  onChange,
}: {
  value: PageSettings
  onChange: (next: PageSettings) => void
}) {
  return (
    <div className="pageset" data-testid="page-settings">
      <label className="field">
        <span>Ukuran halaman</span>
        <select
          value={value.pageSize}
          onChange={(e) => onChange({ ...value, pageSize: e.target.value as PageSettings['pageSize'] })}
          data-testid="page-size"
        >
          {PAGE_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Orientasi</span>
        <select
          value={value.orientation}
          onChange={(e) =>
            onChange({ ...value, orientation: e.target.value as PageSettings['orientation'] })
          }
          disabled={value.pageSize === 'fit'}
          data-testid="page-orientation"
        >
          {ORIENTATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Margin</span>
        <select
          value={String(value.margin)}
          onChange={(e) => onChange({ ...value, margin: Number(e.target.value) })}
          data-testid="page-margin"
        >
          {MARGIN_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'Tanpa margin' : `${m} pt`}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

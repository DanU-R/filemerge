import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PAGE_SETTINGS,
  resolvePageSize,
  normalizePageSettings,
  PAGE_SIZES,
} from '../../src/lib/pageSettings'

describe('resolvePageSize', () => {
  it('A4 portrait', () => {
    expect(resolvePageSize({ pageSize: 'A4', orientation: 'portrait', margin: 0 }, 10, 10)).toEqual(
      PAGE_SIZES.A4,
    )
  })

  it('A4 landscape menukar lebar/tinggi', () => {
    const s = resolvePageSize({ pageSize: 'A4', orientation: 'landscape', margin: 0 }, 10, 10)
    expect(s.width).toBe(PAGE_SIZES.A4.height)
    expect(s.height).toBe(PAGE_SIZES.A4.width)
  })

  it('Letter portrait', () => {
    expect(
      resolvePageSize({ pageSize: 'Letter', orientation: 'portrait', margin: 0 }, 10, 10),
    ).toEqual(PAGE_SIZES.Letter)
  })

  it('fit mengikuti ukuran gambar + margin', () => {
    expect(resolvePageSize({ pageSize: 'fit', orientation: 'portrait', margin: 20 }, 100, 200)).toEqual(
      { width: 140, height: 240 },
    )
  })
})

describe('normalizePageSettings', () => {
  it('default bila kosong', () => {
    expect(normalizePageSettings(undefined)).toEqual(DEFAULT_PAGE_SETTINGS)
  })

  it('menolak nilai tak dikenal & membatasi margin', () => {
    const n = normalizePageSettings({ pageSize: 'B5' as never, margin: 999 })
    expect(n.pageSize).toBe('A4')
    expect(n.margin).toBe(72)
    expect(normalizePageSettings({ margin: -5 }).margin).toBe(0)
  })
})

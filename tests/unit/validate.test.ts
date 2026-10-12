import { describe, it, expect } from 'vitest'
import { detectKind, validateFile } from '../../src/lib/validate'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const TXT = new TextEncoder().encode('hello world')

describe('detectKind', () => {
  it('detects magic bytes', () => {
    expect(detectKind(PDF)).toBe('pdf')
    expect(detectKind(PNG)).toBe('png')
    expect(detectKind(JPG)).toBe('jpeg')
    expect(detectKind(TXT)).toBe(null)
  })
})

describe('validateFile', () => {
  it('accepts pdf with .pdf extension', () => {
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 100 }, PDF)).toEqual({
      ok: true,
      kind: 'pdf',
    })
  })

  it('rejects a .pdf whose content is not a PDF (magic bytes)', () => {
    const r = validateFile({ name: 'fake.pdf', type: 'application/pdf', size: 100 }, TXT)
    expect(r.ok).toBe(false)
  })

  it('rejects PDF content with a wrong extension', () => {
    const r = validateFile({ name: 'a.txt', type: 'text/plain', size: 100 }, PDF)
    expect(r.ok).toBe(false)
  })

  it('accepts images by content', () => {
    expect(validateFile({ name: 'a.png', type: 'image/png', size: 10 }, PNG)).toEqual({
      ok: true,
      kind: 'image',
    })
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }, JPG)).toEqual({
      ok: true,
      kind: 'image',
    })
    expect(validateFile({ name: 'a.jpeg', type: 'image/jpeg', size: 10 }, JPG)).toEqual({
      ok: true,
      kind: 'image',
    })
  })

  it('rejects empty files', () => {
    expect(validateFile({ name: 'a.pdf', type: '', size: 0 }, new Uint8Array()).ok).toBe(false)
  })

  it('rejects oversize files', () => {
    const big = { name: 'a.pdf', type: 'application/pdf', size: 999 * 1024 * 1024 }
    expect(validateFile(big, PDF).ok).toBe(false)
  })
})

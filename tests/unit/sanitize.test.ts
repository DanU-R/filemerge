import { describe, it, expect } from 'vitest'
import { sanitizeFileName, sanitizeOutputName } from '../../src/lib/sanitize'

describe('sanitizeFileName', () => {
  it('strips path traversal', () => {
    expect(sanitizeFileName('../../x.pdf')).toBe('x.pdf')
    expect(sanitizeFileName('..\\..\\x.pdf')).toBe('x.pdf')
    expect(sanitizeFileName('/etc/passwd')).toBe('passwd')
  })

  it('removes control chars and illegal chars', () => {
    expect(sanitizeFileName('a\u0000b\u001fc.pdf')).toBe('abc.pdf')
    expect(sanitizeFileName('a<b>c.pdf')).toBe('a_b_c.pdf')
  })

  it('neutralizes leading dots', () => {
    expect(sanitizeFileName('.env')).toBe('env')
    expect(sanitizeFileName('..')).toBe('berkas')
  })

  it('escapes reserved windows names', () => {
    expect(sanitizeFileName('CON.txt')).toBe('_CON.txt')
  })

  it('caps length but keeps extension', () => {
    const out = sanitizeFileName('a'.repeat(200) + '.pdf')
    expect(out.length).toBeLessThanOrEqual(100)
    expect(out.endsWith('.pdf')).toBe(true)
  })

  it('falls back when empty', () => {
    expect(sanitizeFileName('   ')).toBe('berkas')
  })
})

describe('sanitizeOutputName', () => {
  it('forces a single .pdf extension', () => {
    expect(sanitizeOutputName('hasil')).toBe('hasil.pdf')
    expect(sanitizeOutputName('hasil.pdf')).toBe('hasil.pdf')
    expect(sanitizeOutputName('hasil.PDF')).toBe('hasil.pdf')
    expect(sanitizeOutputName('../../evil')).toBe('evil.pdf')
  })

  it('falls back on empty', () => {
    expect(sanitizeOutputName('')).toBe('hasil-gabung.pdf')
  })
})

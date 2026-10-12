/**
 * Sanitasi nama file. Murni (tanpa DOM) agar dapat di-unit-test.
 * Nama berbahaya / path traversal tidak boleh memengaruhi output unduhan.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const ILLEGAL_CHARS = /[<>:"|?*]/g
const RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export function sanitizeFileName(name: string, fallback = 'berkas'): string {
  let base = (name ?? '').replace(/\\/g, '/').split('/').pop() ?? ''
  base = base.replace(CONTROL_CHARS, '')
  base = base.replace(ILLEGAL_CHARS, '_')
  base = base.trim()
  base = base.replace(/^\.+/, '') // buang leading dots -> cegah "..", ".env"
  if (RESERVED_WINDOWS.test(base)) base = `_${base}`
  if (base.length > 100) {
    const dot = base.lastIndexOf('.')
    const ext = dot > 0 && base.length - dot <= 6 ? base.slice(dot) : ''
    base = base.slice(0, 100 - ext.length) + ext
  }
  if (base.length === 0) base = fallback
  return base
}

/** Nama unduhan hasil merge: dipaksa berekstensi .pdf, tanpa ekstensi ganda. */
export function sanitizeOutputName(name: string, fallback = 'hasil-gabung'): string {
  let base = sanitizeFileName(name, fallback)
  base = base.replace(/\.pdf$/i, '')
  if (base.trim().length === 0) base = fallback
  return `${base}.pdf`
}

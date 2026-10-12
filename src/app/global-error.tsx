'use client'

import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 640,
          margin: '48px auto',
          padding: '0 20px',
          color: '#14171f',
        }}
      >
        <h1>Terjadi kesalahan</h1>
        <p>Aplikasi mengalami gangguan. Silakan coba lagi.</p>
        <p>
          <button type="button" onClick={reset}>
            Coba lagi
          </button>{' '}
          <Link href="/">Kembali ke beranda</Link>
        </p>
        {error.digest ? <p style={{ color: '#5b6472' }}>Kode: {error.digest}</p> : null}
      </body>
    </html>
  )
}

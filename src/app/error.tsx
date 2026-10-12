'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Logging minimal (SEC-10): tanpa data sensitif pengguna.
    console.error('Application error', error.digest ?? '(no digest)')
  }, [error])

  return (
    <main className="page">
      <header className="page__head">
        <h1>Terjadi kesalahan</h1>
        <p>Sesuatu tidak berjalan seperti seharusnya. Coba lagi.</p>
      </header>
      <p>
        <button className="btn btn--primary" type="button" onClick={reset}>
          Coba lagi
        </button>
      </p>
    </main>
  )
}

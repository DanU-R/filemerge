import Link from 'next/link'

export default function Home() {
  return (
    <main className="page">
      <header className="hero">
        <p className="hero__eyebrow">Open source · MIT · Gratis</p>
        <h1>Gabungkan PDF &amp; gambar jadi satu berkas</h1>
        <p className="hero__lead">
          Susun CV, KTP, KK, ijazah, dan sertifikat menjadi satu PDF. Proses penggabungan
          berjalan <strong>di browser kamu</strong> — isi dokumen tidak dikirim ke server.
        </p>
        <div className="hero__actions">
          <Link className="btn btn--primary" href="/merge">
            Mulai Merge
          </Link>
          <Link className="btn" href="/privacy">
            Info privasi
          </Link>
        </div>
      </header>

      <section className="features" aria-label="Fitur utama">
        <article>
          <h2>Tanpa login</h2>
          <p>Menggabungkan PDF dan gambar tidak butuh akun. Buka, susun, unduh.</p>
        </article>
        <article>
          <h2>Diproses lokal</h2>
          <p>Merge berjalan di perangkat kamu memakai Web Worker. Tidak ada upload isi file.</p>
        </article>
        <article>
          <h2>Urutan mudah</h2>
          <p>Atur urutan halaman dengan tombol naik/turun, lalu unduh dengan nama pilihanmu.</p>
        </article>
        <article>
          <h2>Source terbuka</h2>
          <p>Kode berlisensi MIT dan dapat dipelajari. Privasi didokumentasikan apa adanya.</p>
        </article>
      </section>
    </main>
  )
}

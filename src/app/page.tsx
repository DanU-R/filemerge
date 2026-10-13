import Link from 'next/link'
import {
  CapIcon,
  CheckIcon,
  DocsIllustration,
  ShieldIllustration,
  type CapKind,
} from '@/components/Illustration'

export const metadata = {
  title: 'FileMerge: Gabungkan PDF & gambar jadi satu berkas',
  description:
    'Gabungkan PDF dan gambar menjadi satu berkas dengan isi dokumen tetap di perangkat kamu.',
}

const TRUST = ['Tanpa akun', 'Tanpa upload isi dokumen', 'Gratis & MIT']

const CAPS: { kind: CapKind; title: string; body: string; warm?: boolean }[] = [
  {
    kind: 'lock',
    title: 'Diproses di browser kamu',
    body: 'Penggabungan memakai Web Worker di perangkat sendiri. Isi dokumen tidak pernah dikirim ke server.',
  },
  {
    kind: 'layers',
    title: 'Susun ulang, putar, hapus halaman',
    body: 'Geser halaman lewat pratinjau visual, putar 90°/180°, atau hapus halaman yang tidak perlu.',
  },
  {
    kind: 'scissors',
    title: 'Pecah & kompres PDF',
    body: 'Belah satu berkas jadi beberapa bagian berdasarkan rentang halaman, atau kecilkan ukurannya.',
    warm: true,
  },
  {
    kind: 'folder',
    title: 'Simpan dokumen & preset',
    body: 'Simpan berkas yang sering dipakai (CV, KTP, ijazah) sekali saja, lalu pakai ulang tanpa unggah lagi.',
  },
  {
    kind: 'clock',
    title: 'Tanpa akun untuk fungsi dasar',
    body: 'Buka halaman, tarik berkas, unduh hasilnya. Akun hanya diperlukan bila ingin menyimpan.',
  },
  {
    kind: 'code',
    title: 'Open source, lisensi MIT',
    body: 'Kode dapat dibaca dan dipelajari. Kebijakan privasi ditulis apa adanya, bukan klaim kosong.',
  },
]

const STEPS = [
  { n: '1', t: 'Tarik berkas', d: 'PDF, JPG, atau PNG. Bisa banyak sekaligus.' },
  { n: '2', t: 'Susun & atur', d: 'Urutkan halaman, pilih ukuran kertas, margin.' },
  { n: '3', t: 'Unduh PDF', d: 'Beri nama, lalu simpan hasilnya. Selesai.' },
]

export default function Home() {
  return (
    <main className="page">
      {/* ---- Hero ---- */}
      <header className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">Open source · MIT · Gratis</p>
          <h1>Gabungkan PDF &amp; gambar jadi satu berkas</h1>
          <p className="hero__lead">
            Susun CV, KTP, ijazah, dan sertifikat menjadi satu PDF. Penggabungan berjalan{' '}
            <strong>di browser kamu</strong>. Isi dokumen tidak dikirim ke server.
          </p>

          <div className="hero__actions">
            <Link className="btn btn--primary" href="/merge">
              Mulai gabungkan
            </Link>
            <Link className="btn" href="/privacy">
              Info privasi
            </Link>
          </div>

          <ul className="hero__trust">
            {TRUST.map((t) => (
              <li key={t}>
                <CheckIcon />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <DocsIllustration className="hero__art" />
      </header>

      {/* ---- Cara kerjanya ---- */}
      <section className="how" aria-labelledby="how-title">
        <h2 className="how__title" id="how-title">
          Tiga langkah
        </h2>
        <p className="how__sub">Tanpa pendaftaran, tanpa unggah ulang.</p>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="steps__num" aria-hidden="true">
                {s.n}
              </span>
              <div>
                <strong>{s.t}</strong>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Kemampuan (daftar, bukan kartu seragam) ---- */}
      <section className="caps" aria-labelledby="caps-title">
        <h2 className="caps__title" id="caps-title">
          Yang bisa dilakukan
        </h2>
        <p className="caps__sub">Alat lengkap untuk merapikan berkas administrasi.</p>
        <ul className="caps__list">
          {CAPS.map((c) => (
            <li className="cap" key={c.title}>
              <CapIcon kind={c.kind} className={`cap__icon${c.warm ? ' cap__icon--warm' : ''}`} />
              <div>
                <strong>{c.title}</strong>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Band privasi ---- */}
      <section className="band" aria-labelledby="band-title">
        <div>
          <h2 id="band-title">Dokumen sensitif tetap di perangkat kamu</h2>
          <p>
            Fungsi menggabungkan, memutar, memecah, dan mengompres berjalan lokal. Server hanya
            menyimpan metadata bila kamu memilih menyimpan dokumen ke akun.
          </p>
        </div>
        <ShieldIllustration className="band__art" />
      </section>

      {/* ---- Ajakan akhir ---- */}
      <section className="cta">
        <h2>Siap merapikan berkas?</h2>
        <p>Buka alatnya, tarik berkas, unduh hasilnya.</p>
        <div className="cta__actions">
          <Link className="btn btn--primary" href="/merge">
            Mulai gabungkan
          </Link>
          <Link className="btn" href="/register">
            Buat akun
          </Link>
        </div>
      </section>
    </main>
  )
}

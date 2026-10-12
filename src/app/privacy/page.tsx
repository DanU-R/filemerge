export default function PrivacyPage() {
  return (
    <main className="page">
      <header className="page__head">
        <h1>Kebijakan Privasi (dasar)</h1>
        <p>Ringkas dan jujur — diperbarui untuk Fase 1.</p>
      </header>
      <section className="prose">
        <h2>Fase 1: pemrosesan lokal</h2>
        <p>
          Penggabungan PDF dan gambar berjalan sepenuhnya di browser kamu. Isi dokumen{' '}
          <strong>tidak dikirim ke server</strong> dan tidak disimpan di mana pun.
        </p>
        <h2>Tidak ada akun</h2>
        <p>
          Fase 1 tidak menyediakan akun, database, atau penyimpanan cloud. Tidak ada data
          pengguna yang dikumpulkan.
        </p>
        <h2>Fase lanjutan (belum aktif)</h2>
        <p>
          Bila fitur penyimpanan dokumen ditambahkan nanti, dokumen di cloud{' '}
          <strong>tidak dienkripsi end-to-end</strong> dan operator layanan secara teknis dapat
          mengakses storage. Kebijakan akan diperbarui sebelum fitur tersebut aktif.
        </p>
        <h2>Lisensi</h2>
        <p>
          Lisensi MIT berlaku untuk kode, bukan izin mempublikasikan dokumen pengguna.
        </p>
      </section>
    </main>
  )
}

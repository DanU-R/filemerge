# FileMerge — Laporan Fase 6 (Alat PDF Lanjutan)

| Item | Nilai |
|---|---|
| Tanggal | 12 Oktober 2026 |
| Lingkup | Rotasi/hapus halaman per halaman, split, kompresi |
| Status | **Selesai, teruji, LIVE** di https://filemerge-seven.vercel.app |

Semua angka dari eksekusi nyata. **Semua diproses di browser** — isi dokumen tidak
pernah dikirim ke server.

## Yang dikerjakan

### 1. Editor halaman (susun ulang, rotasi, hapus)
- `src/lib/pageTools.ts`: `inspectPdf` (info tiap halaman + ukuran efektif setelah rotasi),
  `applyPageEdits`, `resolvePageOrder`.
- **Susun ulang urutan:** drag-and-drop antar kartu thumbnail (dnd-kit) atau tombol ←/→
  sebagai alternatif aksesibilitas. Posisi ditampilkan (`#1`, `#2`, …). Urutan dikirim ke
  `applyPageEdits` lewat medan `order` sehingga hasil PDF benar-benar tersusun ulang —
  bukan sekadar tampilan.
- Rotasi 90°/180° per halaman, digabung dengan rotasi asli file (mis. asal 90° + 180° = 270°).
- Hapus halaman per halaman dengan opsi kembalikan (undo) sebelum diterapkan.
- Ketiga operasi dapat digabung dalam satu penerapan (susun ulang + rotasi + hapus).
- **Pratinjau visual:** setiap halaman dirender sebagai thumbnail asli (pdf.js) dan rotasi
  terlihat langsung di pratinjau — bukan sekadar angka derajat. Rotasi ditampilkan lewat
  CSS transform dengan kotak yang bertukar (A4 tegak → melintang), cerminan akurat hasil akhir.
- Menolak bila semua halaman dihapus (minimal 1 halaman) — mencegah PDF kosong.

### 1b. Renderer pratinjau (pdf.js)
- `src/lib/pdfThumbnails.ts`: render thumbnail per halaman, berkelompok (concurrency 2) agar
  UI responsif. Resource dibersihkan (`page.cleanup` → `doc.cleanup` → `task.destroy`;
  di pdf.js v6 `destroy()` ada di loading task, bukan document proxy). Object URL
  di-revoke saat ganti dokumen/unmount (cegah kebocoran memori).
- Worker pdf.js disalin ke `public/` oleh `scripts/copy-pdfjs-worker.mjs` (dijalankan pada
  `predev`/`prebuild`) agar **same-origin** — CSP kita (`worker-src 'self' blob:`) memblokir
  worker eksternal. Salinan di-gitignore.
- **Degradasi anggun:** bila render pratinjau gagal (mis. worker diblokir), editor tetap
  berfungsi penuh dan menampilkan pesan "Pratinjau tidak tersedia". Pratinjau adalah
  tambahan, bukan syarat.

### 2. Pecah (split) PDF
- `splitPdf` + `parseRanges`: spesifikasi rentang `"1-3, 5, 7-9"` (1-based, inklusif).
- Validasi rentang: menolak di luar batas, rentang terbalik, format tak dikenal.
- Tiap bagian diunduh sebagai file terpisah.

### 3. Kompresi
- `src/lib/compressPdf.ts`: buang metadata + simpan ulang dengan object streams.
- **Keputusan desain (penting):** kompresi agresif via rasterisasi halaman **dibatalkan
  dengan sengaja**. Cara itu memperkecil file jauh lebih banyak, tetapi (a) memerlukan
  renderer halaman (pdf.js, dependency berat) dan (b) membuat teks **tidak bisa dicari**
  serta menurunkan ketajaman — kerugian nyata untuk dokumen identitas (KTP, ijazah).
- Penghematan dilaporkan apa adanya. Bila tidak ada penghematan, **file asli
  dikembalikan** (tidak pernah memperbesar file pengguna).

### 4. Infrastruktur
- Worker terpisah (`pageTools.worker.ts`) + klien (`pageToolsClient.ts`) dengan fallback
  main-thread, sehingga UI tetap responsif untuk PDF besar.

---

## Bug nyata yang ditemukan & diperbaiki

| # | Bug | Dampak | Perbaikan |
|---|---|---|---|
| 1 | **ArrayBuffer detached** — buffer PDF ditransfer ke worker, lalu dipakai lagi pada operasi berikutnya (inspect → apply → split) | Semua operasi kedua gagal: *"ArrayBuffer at index 0 is already detached"* | Kirim **salinan** (`bytes.slice()`) dan transfer buffer salinan |
| 2 | **Ekstensi ganda** — nama hasil `x.pdf.pdf` | Nama file jelek/rusak | `sanitizeOutputName` sudah menambahkan `.pdf`; tidak ditambahkan lagi |
| 3 | **Unduhan split hilang** — browser membatalkan unduhan kedua yang dibuat terlalu cepat | Sebagian bagian split tidak tersimpan | Jeda 700 ms antar bagian |
| 4 | **Server usang meracuni E2E** — `reuseExistingServer` memakai `next-server` lama setelah rebuild | Chunk statis balas **500**, React tidak hydrate, semua tes klik gagal | Kill berdasarkan **port** (nama proses `next-server` tidak terdeteksi `pkill -f next`) |

Semua diverifikasi ulang di produksi setelah perbaikan (bukan hanya unit test).

---

## Hasil pengujian (kondisi kode terbaru)

| Gate | Hasil |
|---|---|
| Typecheck | **exit 0** |
| Unit (vitest) | **70/70** (10 file) — +17 untuk pageTools & compress |
| Lint | **exit 0** |
| Build | **exit 0** |
| E2E Playwright | **96/96** (48 tes × Chromium + Firefox) |

E2E alat PDF (11 tes): daftar halaman, hapus 1 halaman (verifikasi 2 halaman pada hasil),
tolak bila semua dihapus, rotasi (`/Rotate 90` + halaman utuh), split (tiap bagian dibaca
dan dihitung halamannya), rentang tidak valid, kompres (nama + halaman + laporan),
file bukan PDF ditolak, **pratinjau dirender (gambar termuat)**, **rotasi mengubah pratinjau
secara visual**, **pratinjau gagal tetap bisa mengedit (degradasi anggun)**.

## Verifikasi produksi (deployment `30671e8`)

Worker pdf.js: **HTTP 200** `application/javascript` (same-origin). CSP mengandung
`worker-src 'self' blob:`. PDF 4→3 halaman uji: **3 thumbnail dirender** (`naturalWidth 200`),
rotasi mengubah kotak `198×265` → `265×198` dengan sudut berputar, label `· 90°`,
hapus/split/kompres berfungsi, **0 page error**.

Sebelumnya (`738dcce`): hapus 4→3 halaman, rotasi `/Rotate 90` dengan halaman utuh,
split `1-2,3` → 2 file berisi 1 dan 2 halaman, kompres jujur — semua tanpa error.

## Keterbatasan

- Kompresi hanya lossless (metadata + object streams). Penghematan kecil untuk PDF yang
  sudah padat. Kompresi agresif sengaja tidak dipakai (lihat alasan di atas).
- Pratinjau adalah thumbnail statis hasil render awal; setelah rotasi/hapus diterapkan,
  gambar dimuat ulang dari hasil sehingga pratinjau selalu mencerminkan dokumen terkini.
- Menambah `pdfjs-dist` (~1,2 MB worker disalin ke `public/`) — hanya dimuat saat panel
  alat PDF membuka sebuah dokumen, dan kegagalannya tidak menghalangi fungsi inti.
- **NFR-04 (Safari/iOS perangkat nyata)** tetap di luar cakupan atas permintaan operator.

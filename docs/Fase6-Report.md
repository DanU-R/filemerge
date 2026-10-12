# FileMerge — Laporan Fase 6 (Alat PDF Lanjutan)

| Item | Nilai |
|---|---|
| Tanggal | 12 Oktober 2026 |
| Lingkup | Rotasi/hapus halaman per halaman, split, kompresi |
| Status | **Selesai, teruji, LIVE** di https://filemerge-seven.vercel.app |

Semua angka dari eksekusi nyata. **Semua diproses di browser** — isi dokumen tidak
pernah dikirim ke server.

## Yang dikerjakan

### 1. Editor halaman (rotasi & hapus)
- `src/lib/pageTools.ts`: `inspectPdf` (info tiap halaman + ukuran efektif setelah rotasi),
  `applyPageEdits`.
- Rotasi 90°/180° per halaman, digabung dengan rotasi asli file (mis. asal 90° + 180° = 270°).
- Hapus halaman per halaman dengan opsi kembalikan (undo) sebelum diterapkan.
- UI menampilkan indeks, ukuran (pt), dan rotasi aktif per halaman.
- Menolak bila semua halaman dihapus (minimal 1 halaman) — mencegah PDF kosong.

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
| E2E Playwright | **90/90** (45 tes × Chromium + Firefox) |

E2E alat PDF (8 tes): daftar halaman, hapus 1 halaman (verifikasi 2 halaman pada hasil),
tolak bila semua dihapus, rotasi (`/Rotate 90` + halaman utuh), split (tiap bagian dibaca
dan dihitung halamannya), rentang tidak valid, kompres (nama + halaman + laporan),
file bukan PDF ditolak.

## Verifikasi produksi (deployment `738dcce`)

PDF 4 halaman uji → hapus halaman 2 → **3 halaman**, nama `scanktp.pdf`;
rotasi 90° → `/Rotate 90` ada, **3 halaman utuh**; split `1-2, 3` → **2 file**
(`scanktp-bagian-1.pdf`, `scanktp-bagian-2.pdf`) dengan halaman **1** dan **2**;
kompres → `scanktp-kompres.pdf`, 3 halaman, laporan jujur. **0 page error.**

## Keterbatasan

- Kompresi hanya lossless (metadata + object streams). Penghematan kecil untuk PDF yang
  sudah padat. Kompresi agresif sengaja tidak dipakai (lihat alasan di atas).
- Editor halaman tidak menyediakan preview visual (hanya indeks + ukuran + rotasi).
- **NFR-04 (Safari/iOS perangkat nyata)** tetap di luar cakupan atas permintaan operator.

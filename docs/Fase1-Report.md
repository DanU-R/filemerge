# FileMerge: Laporan Fase 1 (MVP Merger) + Audit

| Item | Nilai |
|---|---|
| Tanggal | 12 Oktober 2026 |
| Lingkup | Fase 1: merger PDF & gambar di browser; tanpa login; tanpa upload isi ke server |
| Status | Implementasi + audit + perbaikan selesai. Push/deploy belum dilakukan (kredensial tidak tersedia). |

Semua hasil di bawah berasal dari eksekusi nyata pada mesin ini.

---

## 1. Ringkasan hasil validasi (kondisi kode terbaru)

| Gate | Perintah | Hasil |
|---|---|---|
| Typecheck | `bunx tsc -p tsconfig.json --noEmit` | **exit 0** |
| Unit test | `bunx vitest run` | **30/30 lulus** (4 file) |
| Lint | `bunx eslint .` | **exit 0** (0 error/warning) |
| Production build | `bun run build` | **exit 0** (6 route) |
| E2E Chromium | `bunx playwright test` | **14/14 lulus** |
| E2E Firefox | `bunx playwright test` | **14/14 lulus** |
| Total E2E | | **28/28 lulus** |
| Benchmark batas | `node tests/bench/limits.bench.mjs` | lihat §5 |

---

## 2. Temuan audit & perbaikan

Audit terhadap baseline Git (`7c7629e`) menemukan isu berikut; **semuanya diperbaiki**
kecuali yang ditandai keterbatasan.

| # | Temuan | Dampak | Perbaikan |
|---|---|---|---|
| A1 | `addFiles` memakai `items` dari closure + `useCallback([items])` -> dua pemanggilan beruntun dapat **saling menimpa** (file hilang) | Tinggi (data hilang) | Snapshot antrean lewat `itemsRef`; satu pembaruan state atomik. **Regresi test E2E ditambahkan** |
| A2 | Jumlah halaman hasil menghitung `1` per gambar (hardcoded) | Rendah | `DecodedImage.pages`; `appendImage` mengembalikan `decoded.pages` |
| A3 | Object URL hasil **tidak dibersihkan saat unmount** | Sedang (kebocoran memori) | `useEffect` cleanup melepas URL |
| A4 | Batas ukuran tidak konsisten: `validateFile` pakai `>`, util pakai `>=` -> file tepat 50 MB lolos | Sedang (batas bocor) | Disatukan ke `isOverFileLimit` (`>=`); file tepat 50 MB ditolak. **Unit test ditambahkan** |
| A5 | JPG **CMYK** (4 komponen) di-embed byte-mentah -> berpotensi salah render | Sedang | Deteksi komponen SOF; CMYK di-reencode via canvas ke RGB. **Unit test ditambahkan** |
| A6 | Tidak ada **skip-link**; fokus keyboard belum optimal | Rendah (a11y) | Skip-link "Lompat ke konten" + CSS; **E2E a11y ditambahkan** |
| A7 | Import mati (`isOverFileLimit`) | Rendah | Dibersihkan; lint 0 |
| A8 | `README.md` masih template Prisma | Rendah | Ditulis ulang untuk FileMerge |
| A9 | Tipe `MergeFailure` diduplikasi di 3 file | Rendah | Dipusatkan di `types.ts` |
| A10 | `.gitignore` belum mengabaikan artefak test | Rendah | Tambah `test-results`, `playwright-report`, `tsconfig.tsbuildinfo` |

**Diperiksa & sudah benar:** tidak ada secret di bundle klien (`.next/static` bersih);
tidak ada `NEXT_PUBLIC_`; validasi magic bytes; sanitasi nama (path traversal, reserved
Windows); penanganan PDF rusak/terenkripsi/kosong; `.env` tidak ada/terabaikan;
konfigurasi deployment utuh.

---

## 3. Acceptance Criteria (AC-01 s/d AC-07), diuji ulang

| AC | Deskripsi | Bukti | Status |
|---|---|---|---|
| AC-01 | Gabung >=2 PDF jadi satu | E2E 2 PDF (2+1 hal) -> 3 halaman | LULUS |
| AC-02 | Gambar jadi halaman, proporsi & orientasi benar (EXIF) | JPEG EXIF=6 (60x30) -> XObject **30x60** (portrait), Chromium+Firefox; JPEG tanpa EXIF tetap 80x40; PNG transparan jadi halaman | LULUS |
| AC-03 | Urutan halaman = urutan antrean | MediaBox `[200,200],[200,200],[300,400]`; setelah naik 1x -> `[300,400],[200,200],[200,200]` | LULUS |
| AC-04 | Unduh nama kustom | `download="lamaran-kerja.pdf"`; sanitasi ekstensi tunggal | LULUS |
| AC-05 | Tanpa backend PDF; tidak ada upload isi | **0** request POST/`/api/` selama merge | LULUS |
| AC-06 | Rusak/terenkripsi/kosong ditandai tanpa crash | encrypted+corrupt ditandai; kosong ditolak di intake; app tetap hidup | LULUS |
| AC-07 | Desktop & mobile | viewport 375x720 lulus; Chromium + Firefox lulus | LULUS |

---

## 4. Privasi & keamanan pemrosesan file

- **Tidak ada upload isi dokumen** saat merge (diverifikasi via listener Network E2E = 0 POST).
- Merge berjalan di **Web Worker**; fallback otomatis ke main thread bila Worker absen (diuji).
- Validasi **magic bytes** (bukan ekstensi): `.pdf` berisi konten lain ditolak.
- **Sanitasi nama** output: path traversal, karakter kontrol, nama reserved Windows, panjang.
- Penanganan kegagalan per file: rusak/terenkripsi/kosong -> ditandai, aplikasi tidak crash.
- Object URL dibersihkan (saat merge berikutnya, reset, dan unmount).

---

## 5. Batas file: pengukuran nyata

Benchmark Chromium headless, PDF dasar sekitar 5.57 MB:

| Total | File | Waktu | Hasil |
|---|---|---|---|
| 22.3 MB | 4 | 0.3 s | sukses |
| 61.3 MB | 11 | 0.8 s | sukses |
| 122.6 MB | 22 | 0.8 s | sukses |
| 200.7 MB | 35 diterima (ke-36 ditolak) | 1.3 s | sukses |

Batas: **50 MB/file** (`>=` ditolak), **200 MB total**, **50 file**, peringatan lunak **120 MB**.
Diuji E2E: file 51 MB ditolak; 51 file -> 50 diterima + pesan "antrean penuh".

---

## 6. Kendala & keterbatasan (jujur)

1. **Safari/iOS belum diuji**: tidak tersedia di lingkungan ini (hanya Chromium & Firefox). **Bukan** diklaim lulus. Jalur fallback `createImageBitmap` -> `<img>` tersedia; wajib diuji di perangkat nyata sebelum rilis.
2. **PDF teks vektor besar** belum diuji beban (benchmark memakai PDF bergambar; `copyPages` cepat).
3. **CMYK JPG** kini di-reencode (diverifikasi di level deteksi komponen, bukan render visual per-piksel).
4. **PNG transparansi** diverifikasi struktural (image XObject hadir), bukan perbandingan visual.
5. **Warning build**: `next start` menyarankan `node .next/standalone/server.js` (karena `output: "standalone"`), hanya cara menjalankan lokal; tidak memengaruhi Compute.
6. **Push/deploy belum dilakukan**, kredensial GitHub (token non-aktif, SSH unauthorized) dan login Prisma CLI tidak tersedia. Lihat §8.

---

## 7. Konfigurasi deployment: TIDAK diubah

`next.config.ts` (`output:"standalone"`), `module.ts`, `src/service.ts`,
`prisma-composer.config.ts`, `prisma.config.ts`, `.github/workflows/prisma-deploy.yml`,
`bunfig.toml` (`linker="hoisted"`), script `build`/`start`/`contract:emit`/`db:*`/`compute:*`, **semua utuh** (diverifikasi sebelum & sesudah). Hanya **ditambah** script
`test`/`test:watch`/`test:e2e`/`typecheck`/`lint`/`bench:limits`. Tidak ada `.env` dibuat/diubah,
tidak ada migrasi DB, tidak ada deployment.

---

## 8. Langkah yang terblokir (butuh akses)

| Aksi | Status | Hambatan |
|---|---|---|
| `git push` | belum | `GITHUB_TOKEN` di `.env` non-aktif; SSH key tidak terdaftar di GitHub |
| Deployment Prisma Compute | belum | `prisma auth whoami` -> `authenticated: false`; tidak ada token Prisma Cloud |

Setelah akses tersedia: `git push origin main` (memicu workflow `prisma-deploy`) atau
`bunx prisma deploy module.ts` setelah `prisma auth login`.

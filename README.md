# FileMerge

Aplikasi web open-source (MIT) untuk menggabungkan PDF dan gambar menjadi satu PDF.
**Penggabungan berjalan sepenuhnya di browser** (Web Worker + `@cantoo/pdf-lib`) — isi
dokumen tidak dikirim ke server. Tanpa login.

> Status: **Fase 1 (MVP merger) selesai & teruji.** Fase 2+ (akun, database, penyimpanan
> dokumen) ditahan sampai keputusan desain diambil. Lihat `docs/FileMerge-PRD-v0.3.md`
> dan `docs/Fase1-Report.md`.

## Fitur Fase 1
- Gabung banyak PDF + gambar (JPG/JPEG/PNG) menjadi satu PDF.
- Urutkan dengan tombol naik/turun (aksesibilitas; drag-and-drop library ditunda).
- Orientasi EXIF diterapkan ke piksel (foto portrait tidak terputar).
- Validasi berbasis konten (magic bytes), bukan ekstensi.
- Penanganan PDF rusak/terenkripsi/kosong tanpa crash.
- Batas: 50 MB/file, 200 MB total, 50 file (peringatan lunak di 120 MB).
- Proses di Web Worker dengan fallback otomatis ke main thread.

## Prasyarat
- Node.js 24+ dan [Bun](https://bun.sh) 1.3.x (`packageManager: bun@1.3.14`).

## Jalankan lokal
```bash
bun install
bun run dev          # http://localhost:3000  -> /merge
```
Fase 1 **tidak** memerlukan database atau `.env`. Untuk pengembangan template/DB
(Prisma 8), salin `.env.example` ke `.env` dan isi `DATABASE_URL` (jangan commit `.env`).

## Perintah
```bash
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run test         # vitest (unit)
bun run test:e2e     # playwright (chromium + firefox)
bun run build        # contract:emit && next build
bun run bench:limits # benchmark batas file (butuh server di :3100)
```

## Struktur
- `src/lib/` — logika murni: `limits`, `sanitize`, `validate`, `pdfMerge`, `imageDecode`,
  `merge.worker`, `mergeClient`.
- `src/components/MergeTool.tsx` — UI merger.
- `src/app/` — `page` (landing), `merge`, `privacy`, `not-found`, `layout`.
- `tests/unit`, `tests/e2e`, `tests/bench`.

## Deploy ke Prisma Compute
Konfigurasi deploy (jangan diubah tanpa alasan kuat): `next.config.ts`
(`output: "standalone"`), `module.ts`, `src/service.ts`, `prisma-composer.config.ts`,
`prisma.config.ts`, `.github/workflows/prisma-deploy.yml`, `bunfig.toml`
(`linker = "hoisted"`). Push ke branch akan memicu Composer.

```bash
bun run compute:connect   # hubungkan repo ke Prisma Cloud (sekali)
bun run compute:open      # buka service yang berjalan
```

## Lisensi
MIT — berlaku untuk kode, bukan izin mempublikasikan dokumen pengguna.

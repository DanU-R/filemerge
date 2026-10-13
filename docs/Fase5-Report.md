# FileMerge: Laporan Fase 5 (Lanjutan)

| Item | Nilai |
|---|---|
| Tanggal | 12 Oktober 2026 |
| Lingkup | Pengaturan halaman, drag-and-drop urutan, preset susunan |
| Status | **Selesai, teruji, LIVE** di https://filemerge-seven.vercel.app |

## Yang dikerjakan

### 1. Pengaturan halaman
- Ukuran: **A4 / Letter / Sesuai gambar**.
- Orientasi: **tegak / mendatar**.
- Margin: 0 / 12 / 24 / 36 / 48 pt.
- Diimplementasi di `src/lib/pageSettings.ts` (`resolvePageSize`) dan dipakai
  `pdfMerge.appendImage`: berlaku untuk jalur Web Worker **dan** fallback main-thread.
- Kontrol UI: `PageSettingsPanel`, nilai dikirim ke `runMerge({ pageSettings })`.

### 2. Drag-and-drop urutan antrean
- Library: **`@dnd-kit/react` 0.5.0** (`DragDropProvider` + `useSortable`), mendukung React 19.
- Komponen `ReorderableList` menyediakan *drag handle* (⠿) per item.
- **Tombol naik/turun tetap tersedia** sebagai alternatif aksesibilitas/keyboard.

### 3. Preset susunan
- Model `MergePreset` (Prisma 8 contract-first) + migrasi `add_merge_preset`.
  `items` = JSON `[{ documentId, order }]`, referensi, **bukan** salinan file.
- API: `GET/POST /api/presets`, `DELETE /api/presets/[id]`.
- Validasi: semua dokumen harus milik pengguna (isolasi), maks 20 preset.
- UI `PresetPanel`: simpan susunan saat ini, terapkan kembali, hapus.
- Hanya muncul untuk pengguna login dan hanya untuk item dari dokumen akun.

---

## Hasil pengujian (kondisi kode terbaru)

| Gate | Hasil |
|---|---|
| Typecheck | **exit 0** |
| Unit (vitest) | **38/38** (5 file) |
| Lint | **exit 0** |
| Build | **exit 0** (17 route) |
| E2E Playwright | **52/52** (26 tes × Chromium + Firefox) |

E2E Fase 5 (5 tes): Letter-landscape diterapkan, "Sesuai gambar"+margin, drag
handle tersedia, simpan+terapkan preset (merge 3 halaman), isolasi preset antar-akun.

## Verifikasi produksi (live)

Diuji di https://filemerge-seven.vercel.app (deployment `84f4e89`, READY):
- Register + upload 2 dokumen (**2**).
- Preset disimpan → tombol "Terapkan: Lamaran" muncul.
- Drag handle hadir di antrean.
- Pengaturan halaman Letter/landscape diterapkan (0 error).
- Bersihkan antrean → terapkan preset → antrean terisi kembali.

## Keterbatasan

- Rotasi/hapus halaman PDF individual, split, dan kompresi **belum** dikerjakan
  (di luar cakupan yang dipilih untuk Fase 5).
- Drag-and-drop diuji pada level DOM (handle & reorder) di Chromium/Firefox;
  gestur drag aktual sebaiknya dicoba manual di perangkat sentuh (mobile).
- **Safari/iOS** belum diuji pada perangkat nyata.

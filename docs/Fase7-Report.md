# Fase 7 — Desain Percikan & Organisasi Tab `/merge`

Status: **selesai** · Tanggal: 13 Oktober 2026

## Latar

Halaman `/merge` menumpuk semua kontrol dalam satu kolom panjang (±2.500 px di desktop):
dropzone, antrean, pengaturan kertas, dokumen tersimpan, preset, dan alat editor halaman PDF.
Di kanvas desain (Superdesign) panjangnya terasa melelahkan. Dua perubahan dikerjakan:

1. Menerapkan arah visual **Percikan** (yang sebelumnya hanya ada di kanvas) ke kode aplikasi.
2. Memecah `/merge` menjadi **tiga tab** supaya hanya satu bagian tampil sekaligus.

## 1. Arah visual Percikan masuk kode

Sebelumnya `globals.css` memakai biru `#1f5eff` di abu terang dengan font sistem — bertentangan
dengan `design-system.md`. Sekarang token Percikan menjadi sumber kebenaran:

| Token | Nilai | Peran |
|---|---|---|
| `--bg` | `#F2FBF7` | latar mint |
| `--ink` | `#10342B` | teks utama |
| `--muted` | `#5B7A70` | teks bantu |
| `--line` | `#CDE8DE` | garis |
| `--accent` | `#0E9F6E` | aksi utama |
| `--accent2` | `#FF8A3D` | pil tipe file, aksen |
| `--soft` | `#DFF5EC` | bidang lembut |
| `--danger` | `#C0362C` | aksi merusak |

`--primary` di-alias ke `--accent` agar seluruh rule lama tetap benar tanpa disentuh.

Bentuk & gerak mengikuti design system: radius kartu 20px, thumbnail 16px, tombol pil 999px
dengan tinggi minimum 44px, ikon aksi daftar 44×44px, bayangan **hanya** pada tombol primary
saat hover (`0 8px 18px rgba(14,159,110,.30)`), dan `prefers-reduced-motion` tetap dihormati.

### Tipografi: font di-host sendiri

CSP di `next.config.ts` hanya mengizinkan `style-src 'self'` dan tidak ada `font-src` khusus
(sehingga jatuh ke `default-src 'self'`). **Google Fonts CDN tidak dapat dipakai.**

`scripts/fetch-fonts.py` mengunduh Fredoka (500/600) dan Nunito (400/700) subset latin +
latin-ext ke `public/fonts/` (8 berkas, ±240 KB) dan menghasilkan `src/app/fonts.css` dengan
`unicode-range` per subset. `fonts.css` di-import di `layout.tsx` sebelum `globals.css`.

Fredoka dipakai **hanya** untuk judul (h1–h3 dan kelas judul di panel); isi memakai Nunito.

## 2. Tiga tab di `/merge`

`src/components/Tabs.tsx` — komponen tab tanpa dependensi baru:

- **Gabungkan** — dropzone, antrean berkas, pengaturan kertas, nama hasil, Bersihkan/Gabungkan.
- **Atur halaman** — `PdfToolsPanel` (pratinjau, susun ulang, rotasi, hapus, pecah, kompres).
- **Dokumen & preset** — dokumen akun + `PresetPanel`; hanya dirender bila `isAuthed` atau ada
  dokumen tersimpan.

Keputusan penting:

- **Panel tidak di-unmount.** Panel yang tidak aktif diberi atribut `hidden`, bukan dilepas dari
  DOM. Kalau dilepas, antrean berkas, `<input type=file>`, dan hasil merge akan hilang setiap
  kali pengguna berpindah tab. Ada tes yang mengunci perilaku ini.
- **Pesan status di luar tab.** Alert galat, peringatan ukuran, progres, kegagalan, dan kartu
  hasil ditaruh di atas bilah tab supaya tetap terlihat dari tab mana pun.
- **Tab awal dapat dipaksa dari URL** lewat `?tab=gabungkan|halaman|dokumen` (divalidasi
  terhadap allowlist di `src/app/merge/page.tsx`). Berguna untuk penautan langsung dan membuat
  tes E2E tidak perlu mengklik bilah tab.
- **Aksesibilitas**: `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`,
  `aria-labelledby`, roving `tabIndex`, dan navigasi papan ketik ← → Home End dengan fokus
  mengikuti tab aktif.

Gaya bilah tab: **garis bawah** (tab aktif = teks `--ink` + garis 3px `--accent`), dipilih
setelah membandingkan empat alternatif (garis bawah, tab map, segmented, langkah bernomor).

## 3. Hasil

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Tinggi halaman (tab terpanjang) | ±2.500 px | ±1.200 px |
| Panel tampil sekaligus | semua | 1 |
| Kontrol hilang | — | **0** |

## 4. Verifikasi

- `bunx tsc --noEmit` — bersih
- `bunx vitest run` — **76/76**
- `bunx eslint .` — bersih
- `bun run build` — sukses
- `bunx playwright test` — **122/122** (Chromium + Firefox)
- `tests/e2e/tabs.spec.ts` (baru, 10 tes) menutup: tab default, tab dokumen absen tanpa sesi,
  perpindahan panel + petunjuk, `?tab=` valid/tidak valid, kontrol tetap ter-mount, keadaan
  antrean bertahan antar tab, navigasi papan ketik, semantik ARIA, dan satu-panel-tampil.

Bukti runtime (diukur dari DOM aplikasi, bukan asumsi):

| Properti | Nilai terukur |
|---|---|
| Latar body | `rgb(242,251,247)` = `--bg` |
| Font body / judul | `Nunito` / `Fredoka` (keduanya `status: loaded`) |
| Tab aktif / non-aktif | `rgb(16,52,43)` / `rgb(91,122,112)` |
| Garis bawah tab aktif | `rgb(14,159,110)` 3px |
| Tombol primary | `rgb(14,159,110)`, radius `999px` |
| Lebar bilah tab | 820px di dalam kolom 860px (tidak melar) |
| Tinggi halaman | 899px (Gabungkan) · 646px (Atur halaman) |

### Penyesuaian tes lama

Elemen di panel `hidden` tidak dapat diklik Playwright. Tes lama diarahkan ke tab yang benar
lewat URL: `pdftools.spec.ts` → `?tab=halaman`; `account.spec.ts` (AC-10) dan tes preset di
`fase5.spec.ts` → `?tab=dokumen`. Dua tes yang berpindah panel di tengah alur (AC-10 dan preset)
kini mengklik tab yang sesuai sebelum menyentuh kontrol di tab lain.

Catatan proses: dua kali sebuah run harus diulang karena suite dijalankan **sebelum** perbaikan
tes ditulis — hasil "gagal" itu artefak dari tes versi lama, bukan bug aplikasi. Alur preset
diverifikasi ulang di browser sungguhan (antrean kembali terisi 2 berkas, tanpa galat) untuk
memastikan hal ini.

## Catatan

- Kanvas Superdesign tetap dipakai sebagai sumber arah desain; versi kode ini adalah
  penerjemahan manual dari draf terpilih (tanpa memakai kredit generator).
- Halaman lain (`/`, `/dashboard`, `/login`, `/register`, `/settings`, `/privacy`) belum
  ditata ulang ke Percikan — token global sudah berubah, jadi mereka mengikuti palet & font
  baru, tetapi komposisinya belum didesain ulang.

---

## 5. Fase 7b — rombak LAYOUT (bukan hanya warna)

Pekerjaan Fase 7 di atas awalnya hanya mengganti **_token_** (warna, font, radius) dan
memecah halaman jadi tab. **Layout/komposisinya tidak disentuh** — panel masih ditumpuk
`gap: 16px` tanpa pengelompokan, judul header 32px, dan dropzone berupa kotak putus-putus
polos. Hasilnya terasa "diganti cat, bukan ditata". Bagian ini memperbaikinya.

### Yang berubah

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Pengelompokan | 5 elemen ditumpuk tanpa wadah | **3 kartu berjudul** |
| Judul kartu | tidak ada | `Berkas` · `Pengaturan kertas` · `Susun & gabungkan` |
| Header halaman | `h1` 32px, tanpa label | eyebrow + `h1` clamp(1.9rem→2.6rem) ≈ **41.6px** |
| Dropzone | kotak polos, tanpa ikon, hint tercampur | ilustrasi dokumen SVG 46px, tombol `btn--primary`, batas info dipindah ke kepala kartu |
| Kotak pengaturan | kartu bersarang (border di dalam kartu) | menyatu di kartu — `background:none; border:none` |
| Area aksi | flex-wrap | **grid** `1fr auto auto`, tombol 44px, menumpuk penuh di ≤640px |
| Jarak antar kartu | 16px (seragam, padat) | 18px + padding kartu 20px |

Tidak ada kelas lama yang dihapus, jadi tidak ada tes yang perlu diubah: seluruh penataan
ulang memakai kelas baru (`.card`, `.card--soft`, `.card__title`, `.card__sub`, `.card__head`,
`.dropzone__icon`, `.dropzone__lead`, `.empty-card`, `.page__eyebrow`).

Kelas `.cloud`/`.cloud__title` sengaja dibiarkan hidup (dipakai gaya kartu lama) supaya
perubahan ini tetap bisa dibalik dan tidak menyentuh apa pun di luar `/merge`.

### Angka sesudah rombak

| Ukuran | Sebelum 7b | Sesudah 7b |
|---|---|---|
| Tinggi panel Gabungkan | 899px | 1217px (3 kartu, kini berstruktur) |
| Tinggi panel Atur halaman | 646px | 806px |
| Judul `h1` | 32px | 41.6px |
| Kartu pada tab Gabungkan | 0 | 3 (347 / 181 / 179 px) |

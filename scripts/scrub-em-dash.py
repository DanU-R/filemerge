#!/usr/bin/env python3
"""Hapus em dash (—, penanda tulisan AI: humanizer pattern #14) dari kode FileMerge.

Diganti KONTEKSTUAL, bukan sekadar cari-ganti: koma, titik dua, tanda kurung,
atau '·' untuk pemisah label. Komentar/komentar JSDoc ikut dibersihkan karena
em dash di komentar pun terbaca sebagai tulisan mesin.

Jalankan: python3 scripts/scrub-em-dash.py [--check]
"""
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (berkas, teks lama, teks baru) — dicocokkan PERSIS, harus cocok tepat sekali.
EXACT: list[tuple[str, str, str]] = [
    # --- teks yang terlihat pengguna ---
    ('src/app/page.tsx',
     'title: \'FileMerge — Gabungkan PDF & gambar jadi satu berkas\',',
     'title: \'FileMerge: Gabungkan PDF & gambar jadi satu berkas\','),
    ('src/app/page.tsx',
     '<strong>di browser kamu</strong> — isi dokumen tidak dikirim ke server.',
     '<strong>di browser kamu</strong>. Isi dokumen tidak dikirim ke server.'),
    ('src/app/layout.tsx',
     "title: 'FileMerge — Gabungkan PDF & gambar',",
     "title: 'FileMerge: Gabungkan PDF & gambar',"),
    ('src/app/merge/page.tsx',
     "title: 'PDF Merger — FileMerge',",
     "title: 'PDF Merger: FileMerge',"),
    ('src/app/merge/page.tsx',
     'Susun berkas, atur ukuran halaman, lalu unduh satu PDF. Semua diproses di browser kamu —\n          tidak ada berkas yang dikirim ke server.',
     'Susun berkas, atur ukuran halaman, lalu unduh satu PDF. Semua diproses di browser kamu.\n          Tidak ada berkas yang dikirim ke server.'),
    ('src/app/dashboard/page.tsx',
     "title: 'Dashboard — FileMerge'",
     "title: 'Dashboard: FileMerge'"),
    ('src/app/settings/page.tsx',
     "title: 'Account Settings — FileMerge'",
     "title: 'Pengaturan Akun: FileMerge'"),
    ('src/app/login/page.tsx',
     "title: 'Masuk — FileMerge'",
     "title: 'Masuk: FileMerge'"),
    ('src/app/register/page.tsx',
     "title: 'Daftar — FileMerge'",
     "title: 'Daftar: FileMerge'"),
    ('src/app/privacy/page.tsx',
     "title: 'Kebijakan Privasi — FileMerge'",
     "title: 'Kebijakan Privasi: FileMerge'"),
    ('src/app/privacy/page.tsx',
     '<p>Ditulis apa adanya — tanpa klaim berlebihan.</p>',
     '<p>Ditulis apa adanya, tanpa klaim berlebihan.</p>'),
    ('src/app/privacy/page.tsx',
     '<h2>Enkripsi — jujur apa adanya</h2>',
     '<h2>Enkripsi: jujur apa adanya</h2>'),
    ('src/app/privacy/page.tsx',
     'unggah dokumen tersebut — gunakan fitur merge tanpa akun.',
     'unggah dokumen tersebut. Gunakan fitur merge tanpa akun.'),
    ('src/app/not-found.tsx',
     '<h1>404 — Halaman tidak ditemukan</h1>',
     '<h1>404: Halaman tidak ditemukan</h1>'),
    ('src/components/AuthForm.tsx',
     "body: 'Proses merge berjalan di perangkat kamu — isi dokumen tidak dikirim ke server.',",
     "body: 'Proses merge berjalan di perangkat kamu. Isi dokumen tidak dikirim ke server.',"),
    ('src/components/PdfToolsPanel.tsx',
     "setError('File tidak dikenali — hanya PDF atau gambar JPG/PNG yang didukung.')",
     "setError('File tidak dikenali. Hanya PDF atau gambar JPG/PNG yang didukung.')"),
    ('src/components/PdfToolsPanel.tsx',
     "setError('Semua halaman dihapus — sisakan minimal 1 halaman.')",
     "setError('Semua halaman dihapus. Sisakan minimal 1 halaman.')"),
    ('src/components/PdfToolsPanel.tsx',
     'Pratinjau tidak tersedia — editor tetap bisa dipakai.',
     'Pratinjau tidak tersedia. Editor tetap bisa dipakai.'),
    ('src/components/DocumentsManager.tsx',
     'Koneksi bermasalah — mencoba lagi…',
     'Koneksi bermasalah, mencoba lagi…'),
    ('src/components/MergeTool.tsx',
     'Total antrean {formatBytes(totalBytes)} cukup besar — proses bisa lambat di perangkat',
     'Total antrean {formatBytes(totalBytes)} cukup besar. Proses bisa lambat di perangkat'),
    ('src/components/MergeTool.tsx',
     '{progress.name ? ` — ${progress.name}` : \'\'}',
     '{progress.name ? ` · ${progress.name}` : \'\'}'),
    ('src/components/MergeTool.tsx',
     'Selesai — {result.pages} halaman, {formatBytes(result.size)}.',
     'Selesai. {result.pages} halaman, {formatBytes(result.size)}.'),

    # --- komentar / JSDoc (tetap penanda tulisan mesin) ---
    ('src/components/Tabs.tsx',
     ' * supaya keadaan di dalamnya — input file, hasil merge, dan lain-lain — tidak',
     ' * supaya keadaan di dalamnya (input file, hasil merge, dan lain-lain) tidak'),
    ('src/components/PdfToolsPanel.tsx',
     ' * Semua diproses di browser — isi dokumen tidak dikirim ke server.',
     ' * Semua diproses di browser. Isi dokumen tidak dikirim ke server.'),
    ('src/components/AuthForm.tsx',
     '/** Nilai produk di kolom kiri — supaya halaman tidak terasa lapang kosong. */',
     '/** Nilai produk di kolom kiri, supaya halaman tidak terasa lapang kosong. */'),
    ('src/lib/resilientFetch.ts',
     ' * Kegagalan sisi-klien (4xx lain: 400/401/403/404/409/413/415) TIDAK diulang —',
     ' * Kegagalan sisi-klien (4xx lain: 400/401/403/404/409/413/415) TIDAK diulang:'),
    ('src/lib/resilientFetch.ts',
     '      // dari batas, jangan menunggu — kembalikan pesan sekarang agar UI responsif.',
     '      // dari batas, jangan menunggu: kembalikan pesan sekarang agar UI responsif.'),
    ('src/lib/compressPdf.ts',
     ' * halaman/gambar tidak tersentuh — penting untuk dokumen administratif (KTP,',
     ' * halaman/gambar tidak tersentuh, penting untuk dokumen administratif (KTP,'),
    ('src/lib/compressPdf.ts',
     ' * dapat dicari serta menurunkan ketajaman — kerugian nyata untuk dokumen',
     ' * dapat dicari serta menurunkan ketajaman. Kerugian nyata untuk dokumen'),
    ('src/lib/server/rateLimit.ts',
     ' * per instance — bukan pengganti layanan terpusat, tapi lebih baik daripada nol.',
     ' * per instance, bukan pengganti layanan terpusat, tapi lebih baik daripada nol.'),
    ('src/lib/pdfMerge.ts',
     ' * dan dilewati — aplikasi tidak crash. `decodeImage` di-inject agar dapat diuji',
     ' * dan dilewati. Aplikasi tidak crash. `decodeImage` di-inject agar dapat diuji'),
    ('src/lib/pageTools.ts',
     ' * Semua di browser — isi dokumen tidak pernah dikirim ke server.',
     ' * Semua di browser. Isi dokumen tidak pernah dikirim ke server.'),
    ('src/lib/pageTools.ts',
     '    // Tidak ada perubahan berarti — tetap normalisasi via save.',
     '    // Tidak ada perubahan berarti. Tetap normalisasi via save.'),
    ('src/lib/pdfThumbnails.ts',
     ' * Renderer: pdf.js (`pdfjs-dist`). Dipakai **hanya untuk preview** — tidak ada',
     ' * Renderer: pdf.js (`pdfjs-dist`). Dipakai **hanya untuk preview**, tidak ada'),
    ('src/app/api/documents/[id]/route.ts',
     '  // 1) unggah file baru (key baru) — bila ini gagal, file lama tak tersentuh.',
     '  // 1) unggah file baru (key baru). Bila ini gagal, file lama tak tersentuh.'),
    ('src/app/fonts.css',
     ' * Dihasilkan oleh scripts/fetch-fonts.py — jangan diedit manual.',
     ' * Dihasilkan oleh scripts/fetch-fonts.py, jangan diedit manual.'),
    ('src/app/globals.css',
     '   Landing (Fase 7c) — ditata ulang mengikuti arah Percikan.',
     '   Landing (Fase 7c): ditata ulang mengikuti arah Percikan.'),
    ('src/app/globals.css',
     '   sehingga label hanya berisi input ~43px tetapi memakan 220px — muncul celah',
     '   sehingga label hanya berisi input ~43px tetapi memakan 220px, muncul celah'),
    ('src/app/globals.css',
     '   Halaman auth (login & register) — Fase 7d',
     '   Halaman auth (login & register): Fase 7d'),
    ('src/app/globals.css',
     '/* ---- Tabs (gaya garis bawah) — /merge ---- */',
     '/* ---- Tabs (gaya garis bawah), /merge ---- */'),
    ('src/app/globals.css',
     '   Fase 7b — Rombak LAYOUT /merge',
     '   Fase 7b: Rombak LAYOUT /merge'),
    ('src/app/globals.css',
     '/* Kartu dengan kepala berwarna lembut — hanya dipakai untuk area unggah. */',
     '/* Kartu dengan kepala berwarna lembut, hanya dipakai untuk area unggah. */'),
]


def main() -> int:
    check_only = '--check' in sys.argv
    changed = 0
    problems: list[str] = []

    for rel, old, new in EXACT:
        p = ROOT / rel
        if not p.exists():
            problems.append(f'HILANG: {rel}')
            continue
        s = p.read_text(encoding='utf-8')
        n = s.count(old)
        if n == 0:
            problems.append(f'TIDAK COCOK: {rel}: {old[:60]!r}')
            continue
        if n > 1:
            problems.append(f'AMBIGU ({n}x): {rel}: {old[:60]!r}')
            continue
        if not check_only:
            p.write_text(s.replace(old, new), encoding='utf-8')
        changed += 1
        print(f'  ok  {rel}')

    print(f'\n{changed}/{len(EXACT)} penggantian {"diperiksa" if check_only else "diterapkan"}')

    # sisa em dash
    leftovers = []
    for p in sorted(ROOT.joinpath('src').rglob('*')):
        if p.suffix in {'.ts', '.tsx', '.css'}:
            t = p.read_text(encoding='utf-8')
            for i, line in enumerate(t.split('\n'), 1):
                if '—' in line:
                    leftovers.append(f'{p.relative_to(ROOT)}:{i}: {line.strip()[:90]}')

    if leftovers:
        print(f'\nSISA em dash ({len(leftovers)}):')
        for l in leftovers:
            print('  -', l)
    else:
        print('\nSISA em dash di src/: TIDAK ADA')

    if problems:
        print('\nMASALAH:')
        for x in problems:
            print('  !', x)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

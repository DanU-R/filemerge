/**
 * Ilustrasi gaya "Percikan" (lihat .superdesign/design-system.md):
 * bentuk dokumen/kertas, garis tebal 2.5px warna --ink, bidang isian putih/--soft,
 * aksen --accent + --accent2, sudut membulat, tanpa emoji.
 *
 * Selalu hiasan: aria-hidden + tidak fokusabel.
 */

export function DocsIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 320"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* percikan hiasan */}
      <Spark x={44} y={54} r={11} className="spark" />
      <Spark x={352} y={92} r={8} className="spark spark--mint" />
      <Spark x={318} y={266} r={9} className="spark" />

      {/* lembar belakang (miring kiri) */}
      <g transform="rotate(-7 190 160)">
        <rect
          x="96"
          y="46"
          width="168"
          height="222"
          rx="16"
          fill="var(--soft)"
          stroke="var(--ink)"
          strokeWidth="2.5"
        />
      </g>

      {/* lembar tengah (miring kanan) */}
      <g transform="rotate(5 210 160)">
        <rect
          x="118"
          y="38"
          width="168"
          height="222"
          rx="16"
          fill="#fff"
          stroke="var(--ink)"
          strokeWidth="2.5"
        />
      </g>

      {/* lembar depan */}
      <rect
        x="140"
        y="60"
        width="168"
        height="222"
        rx="16"
        fill="#fff"
        stroke="var(--ink)"
        strokeWidth="2.5"
      />

      {/* judul dokumen (aksen hangat) */}
      <rect x="162" y="86" width="92" height="16" rx="8" fill="var(--accent2)" />

      {/* baris isi */}
      <rect x="162" y="118" width="124" height="10" rx="5" fill="var(--soft)" />
      <rect x="162" y="140" width="124" height="10" rx="5" fill="var(--soft)" />
      <rect x="162" y="162" width="96" height="10" rx="5" fill="var(--soft)" />
      <rect x="162" y="184" width="110" height="10" rx="5" fill="var(--soft)" />

      {/* tanda selesai */}
      <circle cx="252" cy="238" r="22" fill="var(--accent)" />
      <path
        d="M243 238.5l6.5 6.5L262 232"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ShieldIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <Spark x={26} y={40} r={9} className="spark" />
      <Spark x={172} y={150} r={7} className="spark spark--mint" />

      {/* perisai */}
      <path
        d="M100 22l58 22v46c0 34-24 62-58 74-34-12-58-40-58-74V44l58-22Z"
        fill="#fff"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* dokumen di dalam perisai */}
      <rect
        x="76"
        y="72"
        width="48"
        height="60"
        rx="8"
        fill="var(--soft)"
        stroke="var(--accent)"
        strokeWidth="2.5"
      />
      <path
        d="M88 90h24M88 102h24M88 114h14"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Bintang kecil 4 sudut (hiasan latar). */
function Spark({
  x,
  y,
  r,
  className,
}: {
  x: number
  y: number
  r: number
  className?: string
}) {
  const d = `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`
  return <path className={className} d={d} fill="currentColor" />
}

/** Ikon garis sederhana untuk daftar kemampuan (bukan emoji). */
export function CapIcon({ kind, className }: { kind: CapKind; className?: string }) {
  const c = className ?? 'cap__icon'
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className: c,
  }
  switch (kind) {
    case 'clock': // tanpa login
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      )
    case 'lock': // diproses lokal
      return (
        <svg {...common}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      )
    case 'layers': // urutan & halaman
      return (
        <svg {...common}>
          <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" />
          <path d="m4.5 12.5 7.5 4 7.5-4M4.5 16.5l7.5 4 7.5-4" />
        </svg>
      )
    case 'scissors': // pecah
      return (
        <svg {...common}>
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="6.5" cy="17.5" r="2.5" />
          <path d="M8.7 8.4 20 18M8.7 15.6 20 6" />
        </svg>
      )
    case 'folder': // dokumen tersimpan
      return (
        <svg {...common}>
          <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.5h7A2 2 0 0 1 20.5 10v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9.5Z" />
        </svg>
      )
    case 'code': // open source
      return (
        <svg {...common}>
          <path d="m9 8-4.5 4L9 16M15 8l4.5 4L15 16" />
        </svg>
      )
  }
}

export type CapKind = 'clock' | 'lock' | 'layers' | 'scissors' | 'folder' | 'code'

/** Ikon centang kecil untuk daftar kepercayaan di hero. */
export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 12.5 5 5L19 7" />
    </svg>
  )
}

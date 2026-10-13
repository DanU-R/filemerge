/**
 * Logo FileMerge: dua lembar dokumen bergaya Percikan (garis 2.5px).
 * Hiasan murni di samping nama brand, jadi aria-hidden.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* lembar belakang */}
      <rect
        x="4.5"
        y="7.5"
        width="15"
        height="20"
        rx="4"
        fill="var(--soft)"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* lembar depan */}
      <rect
        x="12.5"
        y="4.5"
        width="15"
        height="20"
        rx="4"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* aksen isi dokumen */}
      <path
        d="M16.5 11h7M16.5 15.5h7M16.5 20h4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

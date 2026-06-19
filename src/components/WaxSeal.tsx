interface WaxSealProps {
  size?: number
}

export function WaxSeal({ size = 52 }: WaxSealProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="wax-seal"
    >
      <defs>
        <radialGradient id="waxBase" cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#e8d4a0" />
          <stop offset="35%" stopColor="#c9ad6e" />
          <stop offset="72%" stopColor="#a8894a" />
          <stop offset="100%" stopColor="#7a6030" />
        </radialGradient>
        <radialGradient id="waxHighlight" cx="28%" cy="22%" r="40%">
          <stop offset="0%" stopColor="#fff8e8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff8e8" stopOpacity="0" />
        </radialGradient>
        <filter id="waxShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#5a4520" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Irregular wax edge */}
      <path
        d="M32 4
           C38 3 44 5 48 8 C52 6 56 9 58 14
           C62 16 63 22 61 27 C64 32 62 38 58 42
           C59 47 56 52 51 55 C50 59 45 62 40 61
           C35 64 29 63 25 60 C20 61 15 58 12 54
           C8 52 5 47 6 42 C3 38 2 32 4 27
           C2 22 4 16 8 13 C9 8 14 5 19 6
           C23 4 28 3 32 4 Z"
        fill="url(#waxBase)"
        filter="url(#waxShadow)"
      />

      <ellipse cx="24" cy="20" rx="14" ry="10" fill="url(#waxHighlight)" />

      {/* Inner ring — embossed border */}
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="#8a6d38"
        strokeWidth="0.6"
        opacity="0.35"
      />
      <circle
        cx="32"
        cy="32"
        r="19"
        fill="none"
        stroke="#f0e0b8"
        strokeWidth="0.4"
        opacity="0.25"
      />

      {/* Olive branch emboss */}
      <g opacity="0.5" stroke="#6b5428" strokeWidth="0.9" fill="none" strokeLinecap="round">
        <path d="M32 22 C28 26 26 32 32 38 C38 32 36 26 32 22" />
        <path d="M32 24 L32 36" />
        <path d="M27 28 C29 26 31 27 32 28" />
        <path d="M37 28 C35 26 33 27 32 28" />
        <path d="M26 31 C28 29 30 30 31 31" />
        <path d="M38 31 C36 29 34 30 33 31" />
      </g>

      {/* Wax drip accents */}
      <ellipse cx="18" cy="48" rx="3" ry="4" fill="#9a7b42" opacity="0.45" />
      <ellipse cx="46" cy="50" rx="2.5" ry="3.5" fill="#8a6d38" opacity="0.35" />
      <ellipse cx="52" cy="38" rx="2" ry="2.5" fill="#9a7b42" opacity="0.3" />
    </svg>
  )
}

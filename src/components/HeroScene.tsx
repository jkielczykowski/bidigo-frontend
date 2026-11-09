// Kreskówkowa scena licytacji: ludzie podnoszą tabliczki, licytator stuka młotkiem, nad nimi lecą oferty.
type P = { x: number; skin: string; shirt: string; hair: string; delay: number; paddle: string; label: string }

const PEOPLE: P[] = [
  { x: 110, skin: '#f6c7a0', shirt: '#2563eb', hair: '#3b2a20', delay: 0, paddle: '#ff8551', label: '120' },
  { x: 270, skin: '#c98f64', shirt: '#10b981', hair: '#1c1410', delay: 0.9, paddle: '#facc15', label: '130' },
  { x: 630, skin: '#f1b98c', shirt: '#a855f7', hair: '#b45309', delay: 1.7, paddle: '#38bdf8', label: '140' },
  { x: 790, skin: '#8d5a3b', shirt: '#ef4444', hair: '#0f0a08', delay: 0.4, paddle: '#ff8551', label: '150' },
]

function Person({ p }: { p: P }) {
  return (
    <g transform={`translate(${p.x} 0)`}>
    <g className="hs-person" style={{ animationDelay: `${p.delay}s` }}>
      {/* nogi i buty */}
      <rect x="-20" y="166" width="14" height="20" rx="6" fill="#1a2744" />
      <rect x="6" y="166" width="14" height="20" rx="6" fill="#1a2744" />
      <ellipse cx="-14" cy="187" rx="11" ry="5" fill="#fff" />
      <ellipse cx="14" cy="187" rx="11" ry="5" fill="#fff" />
      {/* szyja i uszy */}
      <rect x="-7" y="112" width="14" height="14" rx="5" fill={p.skin} />
      <circle cx="-26" cy="94" r="5" fill={p.skin} />
      <circle cx="26" cy="94" r="5" fill={p.skin} />
      {/* ciało */}
      <rect x="-30" y="118" width="60" height="62" rx="24" fill={p.shirt} />
      {/* opuszczona ręka */}
      <path d="M-26 134 q-12 18 -4 36" stroke={p.skin} strokeWidth="9" strokeLinecap="round" fill="none" />
      {/* głowa */}
      <circle cx="0" cy="92" r="26" fill={p.skin} />
      <path d="M-27 88 q2 -30 27 -28 q26 -2 27 28 q-14 -14 -27 -12 q-14 -2 -27 12z" fill={p.hair} />
      <g className="hs-eyes">
        <circle cx="-9" cy="95" r="3.4" fill="#1a2744" />
        <circle cx="9" cy="95" r="3.4" fill="#1a2744" />
      </g>
      <path d="M-14 86 q5 -4 10 0 M4 86 q5 -4 10 0" stroke={p.hair} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M-8 106 q8 8 16 0" stroke="#1a2744" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="-17" cy="104" r="4" fill="#ff8551" opacity=".35" />
      <circle cx="17" cy="104" r="4" fill="#ff8551" opacity=".35" />
      {/* podniesiona ręka z tabliczką */}
      <g className="hs-arm" style={{ animationDelay: `${p.delay}s` }}>
        <path d="M22 134 q22 -14 20 -52" stroke={p.skin} strokeWidth="9" strokeLinecap="round" fill="none" />
        <rect x="26" y="40" width="40" height="30" rx="5" fill={p.paddle} stroke="#fff" strokeWidth="3" />
        <text x="46" y="61" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1a2744">
          {p.label}
        </text>
        <rect x="44" y="70" width="4" height="14" fill="#fff" />
      </g>
    </g>
    </g>
  )
}

export default function HeroScene() {
  return (
    <svg className="hero-scene" viewBox="0 0 900 200" role="img" aria-label="Ludzie licytują przedmiot" preserveAspectRatio="xMidYMax meet">
      <ellipse cx="450" cy="186" rx="430" ry="10" fill="#000" opacity=".18" />
      {PEOPLE.map((p) => (
        <Person key={p.x} p={p} />
      ))}

      {/* licytator za podium */}
      <g transform="translate(450 0)">
        <rect x="-26" y="108" width="52" height="60" rx="22" fill="#fff" />
        <circle cx="0" cy="84" r="25" fill="#f6c7a0" />
        <path d="M-26 80 q0 -28 26 -27 q26 -1 26 27 q-13 -12 -26 -10 q-13 -2 -26 10z" fill="#6b7280" />
        <circle cx="-9" cy="86" r="3" fill="#1a2744" />
        <circle cx="9" cy="86" r="3" fill="#1a2744" />
        <path d="M-9 97 q9 9 18 0" stroke="#1a2744" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M-8 112 l8 10 l8 -10 z" fill="#ff8551" />
        <rect x="-62" y="140" width="124" height="46" rx="8" fill="#ff8551" />
        <rect x="-62" y="140" width="124" height="9" rx="4" fill="#ffb088" />
        <text x="0" y="172" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">
          bidigo
        </text>
        <g className="hs-gavel">
          <rect x="34" y="96" width="6" height="40" rx="3" fill="#8b5a2b" transform="rotate(30 37 116)" />
          <rect x="34" y="86" width="26" height="14" rx="4" fill="#5b3a1a" transform="rotate(30 47 93)" />
        </g>
      </g>

      {/* lecące oferty */}
      <g className="hs-bubbles" fontWeight="800" fontSize="14">
        <g className="hs-b b1"><rect x="165" y="30" width="62" height="26" rx="13" fill="#fff" /><text x="196" y="48" textAnchor="middle" fill="#2563eb">+10 zł</text></g>
        <g className="hs-b b2"><rect x="325" y="14" width="62" height="26" rx="13" fill="#fff" /><text x="356" y="32" textAnchor="middle" fill="#10b981">+20 zł</text></g>
        <g className="hs-b b3"><rect x="510" y="12" width="92" height="26" rx="13" fill="#ff8551" /><text x="556" y="30" textAnchor="middle" fill="#fff">Sprzedane!</text></g>
        <g className="hs-b b4"><rect x="690" y="30" width="62" height="26" rx="13" fill="#fff" /><text x="721" y="48" textAnchor="middle" fill="#a855f7">+50 zł</text></g>
      </g>
    </svg>
  )
}

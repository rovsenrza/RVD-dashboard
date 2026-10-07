/**
 * The sign-in screen's picture (customer reference, 2026-10-07): a technical
 * drawing of what the supplier makes — a hose assembly in side view, cut away
 * to its braids, and the crimping machine's die set seen face-on around a
 * fitting. Drawn, not photographed: amber linework on the dark ground, sharp at
 * any size, whole at any panel shape (the drafting grid behind it is the panel's).
 * Decorative; the caption beside it says what it shows.
 */

const BRAND = 'var(--color-brand)'
const MUTED = 'var(--color-ink-muted)'
const GRID = 'var(--color-line)'

/** An annular sector from `a0` to `a1` degrees between radii `r` and `R`. */
function sector(cx: number, cy: number, r: number, R: number, a0: number, a1: number) {
  const at = (rad: number, deg: number) => {
    const t = (deg * Math.PI) / 180
    return `${(cx + rad * Math.cos(t)).toFixed(2)} ${(cy + rad * Math.sin(t)).toFixed(2)}`
  }
  return `M ${at(R, a0)} A ${R} ${R} 0 0 1 ${at(R, a1)} L ${at(r, a1)} A ${r} ${r} 0 0 0 ${at(r, a0)} Z`
}

const polar = (cx: number, cy: number, rad: number, deg: number) => {
  const t = (deg * Math.PI) / 180
  return { x: cx + rad * Math.cos(t), y: cy + rad * Math.sin(t) }
}

/** The die set of a crimping machine, face-on: eight segments closing on a fitting. */
function DieSet({ cx, cy }: { cx: number; cy: number }) {
  const R = 300
  const r = 92
  const gap = 1.8
  const segments = Array.from({ length: 8 }, (_, i) => -90 + 22.5 + i * 45)
  const hex = Array.from({ length: 6 }, (_, i) => polar(cx, cy, 70, 30 + i * 60))
  return (
    <g>
      <circle cx={cx} cy={cy} r={R + 22} fill="none" stroke={GRID} strokeWidth={1.5} />
      {segments.map((mid) => {
        const hole = (offset: number) => polar(cx, cy, 214, mid + offset)
        const mark = polar(cx, cy, 262, mid)
        const g0 = polar(cx, cy, r + 16, mid)
        const g1 = polar(cx, cy, r + 48, mid)
        return (
          <g key={mid}>
            <path
              className="auth-draw"
              pathLength={1}
              d={sector(cx, cy, r, R, mid - 22.5 + gap, mid + 22.5 - gap)}
              fill={BRAND}
              fillOpacity={0.035}
              stroke={BRAND}
              strokeOpacity={0.55}
              strokeWidth={1.4}
            />
            {[-9, 9].map((o) => (
              <circle
                key={o}
                cx={hole(o).x}
                cy={hole(o).y}
                r={9}
                fill="none"
                stroke={BRAND}
                strokeOpacity={0.4}
                strokeWidth={1.2}
              />
            ))}
            <rect
              x={mark.x - 6}
              y={mark.y - 6}
              width={12}
              height={12}
              transform={`rotate(${mid + 90} ${mark.x} ${mark.y})`}
              fill="none"
              stroke={BRAND}
              strokeOpacity={0.35}
            />
            <line x1={g0.x} y1={g0.y} x2={g1.x} y2={g1.y} stroke={BRAND} strokeOpacity={0.3} />
          </g>
        )
      })}
      {/* The fitting the dies close on: its hex nut, thread and bore. */}
      <polygon
        className="auth-draw"
        pathLength={1}
        points={hex.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
        fill="none"
        stroke={BRAND}
        strokeOpacity={0.9}
        strokeWidth={1.6}
      />
      <circle
        cx={cx}
        cy={cy}
        r={52}
        fill="none"
        stroke={BRAND}
        strokeOpacity={0.7}
        strokeWidth={1.3}
      />
      <circle
        cx={cx}
        cy={cy}
        r={45}
        fill="none"
        stroke={BRAND}
        strokeOpacity={0.45}
        strokeDasharray="3 4"
      />
      <circle
        cx={cx}
        cy={cy}
        r={28}
        fill="none"
        stroke={BRAND}
        strokeOpacity={0.8}
        strokeWidth={1.3}
      />
      {/* Centre lines, the way a drawing marks an axis. */}
      <g stroke={MUTED} strokeOpacity={0.45} strokeDasharray="22 5 3 5">
        <line x1={cx - R - 60} y1={cy} x2={cx + R + 60} y2={cy} />
        <line x1={cx} y1={cy - R - 60} x2={cx} y2={cy + R + 60} />
      </g>
    </g>
  )
}

/** A hose assembly in side view: hose cut away to its braids, crimped ferrule, nipple, nut, thread. */
function Assembly({ y }: { y: number }) {
  const line = { fill: 'none', stroke: BRAND, strokeWidth: 1.5 } as const
  const crimps = Array.from({ length: 7 }, (_, i) => 352 + i * 17)
  const threads = Array.from({ length: 9 }, (_, i) => 586 + i * 9)
  const label = (x: number, text: string, from: number) => (
    <g>
      <line x1={x} y1={from} x2={x} y2={y + 66} stroke={MUTED} strokeOpacity={0.6} />
      <circle cx={x} cy={from} r={2.5} fill={MUTED} />
      <text x={x} y={y + 84} textAnchor="middle" fill={MUTED} fontSize={13} letterSpacing="0.08em">
        {text}
      </text>
    </g>
  )
  return (
    <g>
      <defs>
        <pattern id="braid" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 9 L9 0 M0 0 L9 9" stroke={BRAND} strokeOpacity={0.55} strokeWidth={0.9} />
        </pattern>
      </defs>
      {/* Overall length, dimensioned. */}
      <g stroke={MUTED} strokeOpacity={0.7}>
        <line x1={46} y1={y - 70} x2={684} y2={y - 70} />
        <line x1={46} y1={y - 80} x2={46} y2={y - 34} />
        <line x1={684} y1={y - 80} x2={684} y2={y - 46} />
        <path d="M46 0 l12 -4 v8 z" transform={`translate(0 ${y - 70})`} fill={MUTED} />
        <path d="M684 0 l-12 -4 v8 z" transform={`translate(0 ${y - 70})`} fill={MUTED} />
      </g>
      <text
        x={365}
        y={y - 80}
        textAnchor="middle"
        fill={MUTED}
        fontSize={14}
        letterSpacing="0.06em"
      >
        РВД В СБОРЕ
      </text>

      {/* Hose: outer cover, a cut-away window showing the two braids around the inner tube. */}
      <path
        className="auth-draw"
        pathLength={1}
        {...line}
        d={`M46 ${y - 26} H330 M46 ${y + 26} H330`}
      />
      <path {...line} strokeOpacity={0.7} d={`M46 ${y - 26} c -10 13 10 39 0 52`} />
      <rect x={118} y={y - 24} width={150} height={10} fill="url(#braid)" />
      <rect x={118} y={y + 14} width={150} height={10} fill="url(#braid)" />
      <path
        d={`M118 ${y - 26} V${y + 26} M268 ${y - 26} V${y + 26} M118 ${y - 13} H268 M118 ${y + 13} H268`}
        fill="none"
        stroke={BRAND}
        strokeOpacity={0.6}
      />

      {/* Ferrule, crimped: the die marks run round it. */}
      <path
        className="auth-draw"
        pathLength={1}
        {...line}
        strokeWidth={1.7}
        d={`M330 ${y - 30} L338 ${y - 36} H470 V${y + 36} H338 L330 ${y + 30} Z`}
      />
      {crimps.map((x) => (
        <line key={x} x1={x} y1={y - 36} x2={x} y2={y + 36} stroke={BRAND} strokeOpacity={0.4} />
      ))}

      {/* Nipple neck, hex nut, thread and the sealing cone. */}
      <path {...line} d={`M470 ${y - 20} H502 M470 ${y + 20} H502`} />
      <path
        className="auth-draw"
        pathLength={1}
        {...line}
        strokeWidth={1.7}
        d={`M502 ${y - 42} H580 V${y + 42} H502 Z M502 ${y - 21} H580 M502 ${y + 21} H580`}
      />
      <path {...line} d={`M580 ${y - 26} H668 L684 ${y - 12} V${y + 12} L668 ${y + 26} H580`} />
      {threads.map((x) => (
        <line
          key={x}
          x1={x}
          y1={y - 26}
          x2={x + 6}
          y2={y + 26}
          stroke={BRAND}
          strokeOpacity={0.35}
        />
      ))}
      <line
        x1={30}
        y1={y}
        x2={700}
        y2={y}
        stroke={MUTED}
        strokeOpacity={0.45}
        strokeDasharray="22 5 3 5"
      />

      {label(193, 'РУКАВ', y + 19)}
      {label(400, 'МУФТА', y + 36)}
      {label(541, 'ГАЙКА', y + 42)}
      {label(632, 'РЕЗЬБА', y + 26)}
    </g>
  )
}

export function CrimpDrawing({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
      fontFamily="inherit"
      // The die set runs on past the drawing's frame, off the panel's edge.
      overflow="visible"
    >
      <Assembly y={190} />
      <DieSet cx={470} cy={590} />
    </svg>
  )
}

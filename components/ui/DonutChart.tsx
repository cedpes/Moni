'use client'

// Les postes connus gardent toujours la même couleur (cohérence entre écrans) ;
// les autres catégories prennent la palette complémentaire dans l'ordre.
const NAMED: Record<string, string> = {
  'Fixe': 'var(--cat-fixe)',
  'Variable': 'var(--cat-variable)',
  'Plaisir': 'var(--cat-variable)',
  'Courses': 'var(--cat-courses)',
  'Épargne': 'var(--cat-epargne)',
  'Revenus': 'var(--cat-revenus)',
}
const PALETTE = [
  'var(--cat-revenus)', 'var(--cat-extra-1)', 'var(--cat-extra-2)', 'var(--cat-extra-3)',
  'var(--cat-extra-4)', 'var(--cat-fixe)', 'var(--cat-variable)', 'var(--cat-courses)', 'var(--cat-epargne)',
]

export function colorFor(index: number, label?: string) {
  if (label && NAMED[label]) return NAMED[label]
  return PALETTE[index % PALETTE.length]
}

export default function DonutChart({
  data,
  total,
  size = 140,
  thickness = 16,
  centerLabel = 'Total',
}: {
  data: Record<string, number>
  total: number
  size?: number
  thickness?: number
  centerLabel?: string
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  let cumulative = 0

  let unnamed = 0
  const slices = entries.map(([label, amount]) => {
    const color = colorFor(NAMED[label] ? 0 : unnamed++, label)
    const pct = total > 0 ? amount / total : 0
    const dash = pct * circ
    const gap = circ - dash
    const offset = circ - cumulative * circ
    cumulative += pct
    return { label, amount, pct, dash, gap, offset, color }
  })

  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-surface-2)" strokeWidth={thickness} />
          {slices.length > 0 ? slices.map(({ label, dash, gap, offset, color }) => (
            <circle key={label} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={thickness}
              strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              transform={`rotate(-90 ${cx} ${cy})`} />
          )) : null}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{centerLabel}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)">
            {Math.round(total)}€
          </text>
        </svg>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {slices.length === 0 && <p className="text-[13px] text-[var(--text-secondary)]">Aucune donnée</p>}
        {slices.map(({ label, amount, pct, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{label}</p>
                <p className="text-[12px] text-[var(--text-secondary)] ml-1 flex-shrink-0">{Math.round(pct * 100)}%</p>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">{Math.round(amount)}€</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

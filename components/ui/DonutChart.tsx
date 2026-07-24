'use client'

const PALETTE = ['#fbbf24', '#a78bfa', '#60a5fa', '#34d399', '#f87171', '#fb923c', '#22d3ee', '#f472b6', '#a3e635']

export function colorFor(index: number) {
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

  const slices = entries.map(([label, amount], i) => {
    const pct = total > 0 ? amount / total : 0
    const dash = pct * circ
    const gap = circ - dash
    const offset = circ - cumulative * circ
    cumulative += pct
    return { label, amount, pct, dash, gap, offset, color: colorFor(i) }
  })

  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2c2c2e" strokeWidth={thickness} />
          {slices.length > 0 ? slices.map(({ label, dash, gap, offset, color }) => (
            <circle key={label} cx={cx} cy={cy} r={r} fill="none"
              stroke={color} strokeWidth={thickness}
              strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              transform={`rotate(-90 ${cx} ${cy})`} />
          )) : null}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="#8e8e93">{centerLabel}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">
            {Math.round(total)}€
          </text>
        </svg>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {slices.length === 0 && <p className="text-[13px] text-[#8e8e93]">Aucune donnée</p>}
        {slices.map(({ label, amount, pct, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <p className="text-[12px] font-medium text-white truncate">{label}</p>
                <p className="text-[12px] text-[#8e8e93] ml-1 flex-shrink-0">{Math.round(pct * 100)}%</p>
              </div>
              <p className="text-[11px] text-[#8e8e93]">{Math.round(amount)}€</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

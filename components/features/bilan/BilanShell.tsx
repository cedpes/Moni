'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/pocketbase/client'
import { useMonth } from '@/lib/context/MonthContext'
import { fmt } from '@/lib/utils'
import { computeBilan, type BilanMonth } from '@/lib/utils/bilan'

interface Props { workspaceId: string; userId: string }

const SERIES = [
  { key: 'revenus', label: 'Revenus', color: 'var(--chart-income)' },
  { key: 'depenses', label: 'Dépenses', color: 'var(--chart-expense)' },
  { key: 'epargne', label: 'Épargne', color: 'var(--chart-savings)' },
] as const

const fmtShort = (v: number) => (Math.abs(v) >= 1000 ? `${String(Math.round(v / 100) / 10).replace('.', ',')}k` : `${Math.round(v)}`)

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-[16px] px-4 py-3.5">
      <p className="text-[12px] text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-[20px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const m: BilanMonth = payload[0].payload
  const rows: [string, number, string?][] = [
    ['Revenus', m.revenus, 'var(--chart-income)'],
    ['Charges fixes', m.charges, 'var(--chart-expense)'],
    ['Dépenses variables', m.variables, 'var(--chart-expense)'],
    ['Épargne', m.epargne, 'var(--chart-savings)'],
  ]
  return (
    <div className="bg-[var(--bg-surface-2)] border border-[var(--border-default)] rounded-[12px] px-3 py-2.5 shadow-lg min-w-[180px]">
      <p className="text-[12px] font-semibold text-[var(--text-primary)] mb-1.5">
        {m.label} {m.monthKey.slice(0, 4)}{m.status === 'future' ? ' · prévisionnel' : m.status === 'current' ? ' · en cours' : ''}
      </p>
      {rows.map(([label, value, color]) => (
        <div key={label} className="flex items-center gap-2 text-[12px] py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="flex-1 text-[var(--text-secondary)]">{label}</span>
          <span className="text-[var(--text-primary)] tabular-nums">{fmt(value)}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 text-[12px] pt-1.5 mt-1 border-t border-[var(--border-default)]">
        <span className="flex-1 text-[var(--text-secondary)]">Solde</span>
        <span className="font-semibold text-[var(--text-primary)] tabular-nums">{fmt(m.solde)}</span>
      </div>
    </div>
  )
}

export default function BilanShell({ workspaceId }: Props) {
  const { monthKey } = useMonth()
  const [year, setYear] = useState(() => Number(monthKey.slice(0, 4)))
  const [data, setData] = useState<{ year: number; monthRecords: any[]; fixedItems: any[]; envelopes: any[]; transactions: any[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pb = createClient()
        const [monthRecords, fixedItems, transactions] = await Promise.all([
          pb.collection('months').getFullList({ filter: `workspace_id="${workspaceId}" && month_key~"${year}-"`, requestKey: null }),
          pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && is_active=true`, requestKey: null }),
          pb.collection('transactions').getFullList({
            filter: `workspace_id="${workspaceId}" && date>="${year}-01-01" && date<="${year}-12-31 23:59:59"`,
            fields: 'id,date,amount,envelope_slug', requestKey: null,
          }),
        ])
        const envelopes = monthRecords.length
          ? await pb.collection('envelopes').getFullList({
              filter: `slug="epargne" && (${monthRecords.map(m => `month_id="${m.id}"`).join(' || ')})`, requestKey: null,
            })
          : []
        if (!cancelled) { setData({ year, monthRecords, fixedItems, envelopes, transactions }); setError(null) }
      } catch (err: any) {
        console.error('BilanShell fetch error:', err)
        if (!cancelled) setError(err?.message ?? 'Erreur de chargement')
      }
    })()
    return () => { cancelled = true }
  }, [workspaceId, year])

  const loading = !data || data.year !== year
  const bilan = useMemo(() => (data ? computeBilan(data) : null), [data])

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-[var(--border-default)] px-5 pt-14 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/budget" aria-label="Retour au budget" className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
              <ArrowLeft size={15} color="var(--text-secondary)" />
            </Link>
            <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Bilan</h1>
          </div>
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded-full p-1">
            <button onClick={() => setYear(y => y - 1)} aria-label="Année précédente" className="w-7 h-7 rounded-full flex items-center justify-center">
              <ChevronLeft size={16} color="var(--text-secondary)" />
            </button>
            <span className="text-[14px] font-semibold text-[var(--text-primary)] tabular-nums px-1">{year}</span>
            <button onClick={() => setYear(y => y + 1)} aria-label="Année suivante" className="w-7 h-7 rounded-full flex items-center justify-center">
              <ChevronRight size={16} color="var(--text-secondary)" />
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <p className="px-5 pt-10 text-center text-[14px] text-[var(--text-secondary)]">{error}</p>
      ) : loading || !bilan ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[var(--text-secondary)]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          {/* Moyennes + taux d'épargne */}
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Revenu moyen" value={fmt(bilan.avgRevenus)} sub="par mois" />
            <StatTile label="Dépenses moyennes" value={fmt(bilan.avgDepenses)} sub="charges + variables" />
            <StatTile label="Épargne moyenne" value={fmt(bilan.avgEpargne)} sub="par mois" />
            <StatTile label="Taux d'épargne" value={`${Math.round(bilan.tauxEpargne * 100)} %`} sub="épargne ÷ revenus" />
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] px-1">
            {bilan.counted > 0
              ? `Sur ${bilan.counted} mois écoulé${bilan.counted > 1 ? 's' : ''} : ${fmt(bilan.totalRevenus)} de revenus, ${fmt(bilan.totalDepenses)} de dépenses, ${fmt(bilan.totalEpargne)} épargnés, solde ${fmt(bilan.totalSolde)}.`
              : 'Aucun mois écoulé avec des revenus sur cette année.'}
          </p>

          {/* Graphique */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">Mois par mois</p>
              <button onClick={() => setShowTable(v => !v)} className="text-[12px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface-2)] rounded-full px-3 py-1">
                {showTable ? 'Graphique' : 'Tableau'}
              </button>
            </div>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
              {SERIES.map(s => (
                <span key={s.key} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                  <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />{s.label}
                </span>
              ))}
              <span className="text-[12px] text-[var(--text-tertiary)]">Pâle = prévisionnel</span>
            </div>

            {showTable ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[12px] tabular-nums">
                  <thead>
                    <tr className="text-[var(--text-secondary)] text-right">
                      <th className="text-left font-medium py-1.5 px-1">Mois</th>
                      <th className="font-medium px-1">Revenus</th>
                      <th className="font-medium px-1">Dépenses</th>
                      <th className="font-medium px-1">Épargne</th>
                      <th className="font-medium px-1">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bilan.months.map(m => (
                      <tr key={m.monthKey} className={`border-t border-[var(--border-subtle)] text-right ${m.status === 'future' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                        <td className="text-left py-1.5 px-1">{m.label}{m.status === 'current' ? ' •' : ''}</td>
                        <td className="px-1">{fmt(m.revenus)}</td>
                        <td className="px-1">{fmt(m.depenses)}</td>
                        <td className="px-1">{fmt(m.epargne)}</td>
                        <td className="px-1 font-semibold">{fmt(m.solde)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-[240px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bilan.months} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickFormatter={(v: string) => v.slice(0, 1)} />
                    <YAxis width={36} tickLine={false} axisLine={false} tickFormatter={fmtShort}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-highlight-2)' }} />
                    {/* Entrées */}
                    <Bar dataKey="revenus" name="Revenus" stackId="in" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={14}>
                      {bilan.months.map(m => <Cell key={m.monthKey} fillOpacity={m.status === 'future' ? 0.4 : 1} />)}
                    </Bar>
                    {/* Sorties : dépenses + épargne empilées */}
                    <Bar dataKey="depenses" name="Dépenses" stackId="out" fill="var(--chart-expense)" maxBarSize={14}>
                      {bilan.months.map(m => <Cell key={m.monthKey} fillOpacity={m.status === 'future' ? 0.4 : 1} />)}
                    </Bar>
                    <Bar dataKey="epargne" name="Épargne" stackId="out" fill="var(--chart-savings)" radius={[4, 4, 0, 0]} maxBarSize={14}>
                      {bilan.months.map(m => <Cell key={m.monthKey} fillOpacity={m.status === 'future' ? 0.4 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[var(--text-tertiary)] px-1 leading-relaxed">
            Revenus et charges fixes : montants du mois (figés si le mois est clôturé). Dépenses variables : transactions réelles, courses incluses.
            Épargne : enveloppe Épargne du mois. Moyennes calculées sur les mois écoulés et le mois en cours.
          </p>
        </div>
      )}
    </div>
  )
}

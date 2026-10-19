'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/pocketbase/client'
import { fmt, barColorHex, fixedItemMonthlyAmount, tileBg } from '@/lib/utils'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import MonthPicker from '@/components/ui/MonthPicker'
import { Settings, Plus, Loader2, X, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  workspaceId: string
  userId: string
  displayName: string | null
}

const CAT_ICONS: Record<string, string> = {
  Courses:'🛒', Sortie:'🎉', Resto:'🍽️', Essence:'⛽',
  Achat:'🛍️', Santé:'💊', Cadeau:'🎁', Plaisir:'✨', Autre:'📦',
}
const CAT_COLORS: Record<string, string> = {
  Courses:'#e8f4ff', Sortie:'#fef0f5', Resto:'#fff3e0', Essence:'#fff8e6',
  Achat:'#f0f7ff', Santé:'#e8faf0', Cadeau:'#fff0f5', Plaisir:'#f3f0ff', Autre:'#f5f5f7',
}
const ENV_COLORS: Record<string, string> = {
  charges:'#fff3e0', plaisir:'#f3f0ff', epargne:'#e8faf0', courses:'#e8f4ff',
}

export default function DashboardClient({ workspaceId, userId, displayName }: Props) {
  const router = useRouter()
  const { monthKey, monthLabel, isCurrentMonth } = useMonth()
  const { month, envelopes, transactions, planned, fixedItems, loading, refetch } = useMonthData(monthKey, workspaceId)

  const [showModal, setShowModal] = useState(false)
  const [txLabel, setTxLabel] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txEnv, setTxEnv] = useState('plaisir')
  const [saving, setSaving] = useState(false)

  const metrics = useMemo(() => {
    const epargneEnv = envelopes.find((e: any) => e.slug === 'epargne')
    const coursesEnv = envelopes.find((e: any) => e.slug === 'courses')
    const chargesEnv = envelopes.find((e: any) => e.slug === 'charges')

    const chargesBudget = chargesEnv?.budget ?? 0
    const epargne = epargneEnv?.budget ?? 0
    const coursesBudget = month?.courses_budget ?? coursesEnv?.budget ?? 0
    const income = month?.income ?? 0

    // Plaisir = Revenus − Charges − Épargne − Courses
    const plaisir = Math.max(0, income - chargesBudget - epargne - coursesBudget)

    // Prédictif = seulement les non validés
    const totalPlanned = planned
      .filter((p: any) => !p.is_validated)
      .reduce((s: number, p: any) => s + p.amount, 0)

    const totalReal = transactions
      .filter((t: any) => t.envelope_slug === 'plaisir')
      .reduce((s: number, t: any) => s + t.amount, 0)

    // Anneau = Plaisir − Prédictif à venir − Dépensé réel
    const reste = plaisir - totalPlanned - totalReal
    const pct = plaisir > 0 ? Math.max(0, Math.min(100, Math.round(reste / plaisir * 100))) : 0

    // Solde final
    const totalCharges = (fixedItems ?? []).filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + fixedItemMonthlyAmount(f, monthKey), 0)
    const totalIncome = income
    const [y, m] = (month?.month_key ?? '2026-01').split('-').map(Number)
    const monthStart = `${y}-${String(m).padStart(2,'0')}-01`
    const monthEnd = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
    const txInMonth = transactions.filter((t: any) => t.date >= monthStart && t.date <= monthEnd)
    const depenseCourses = txInMonth.filter((t: any) => t.envelope_slug === 'courses').reduce((s: number, t: any) => s + t.amount, 0)
    const coursesBudgetPrevu = coursesBudget
    const soldeFinal = totalIncome - totalCharges - totalReal - depenseCourses - epargne

    // Camembert
    const chargesByCategory: Record<string, number> = {}
    ;(fixedItems ?? []).filter((f: any) => f.type === 'charge').forEach((f: any) => {
      const cat = f.category ?? 'Autre'
      chargesByCategory[cat] = (chargesByCategory[cat] ?? 0) + fixedItemMonthlyAmount(f, monthKey)
    })

    return { plaisir, totalPlanned, totalReal, reste, pct, soldeFinal, totalCharges, totalIncome, chargesByCategory, coursesBudgetPrevu, depenseCourses }
  }, [envelopes, planned, transactions, fixedItems, month, monthKey])

  const { plaisir, totalPlanned, totalReal, reste, pct, soldeFinal, totalCharges, totalIncome, chargesByCategory, coursesBudgetPrevu, depenseCourses } = metrics
  const circ = 2 * Math.PI * 60
  const offset = circ - (circ * pct / 100)
  const ringColor = barColorHex(100 - pct)

  const [greeting, setGreeting] = useState('Bonjour')
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir')
  }, [])

  const statusLabel = reste > 50 ? 'Budget OK' : reste > 0 ? 'Attention' : 'Dépassement'
  const statusClass = reste > 50 ? 'bg-positive/15 text-positive' : reste > 0 ? 'bg-warning/15 text-warning' : 'bg-negative/15 text-negative'
  const dotColor = reste > 50 ? 'var(--positive)' : reste > 0 ? 'var(--warning)' : 'var(--negative)'

  async function addTransaction() {
    const amount = parseFloat(txAmount)
    if (!txLabel.trim() || !amount || amount <= 0 || !month) return
    setSaving(true)
    const pb = createClient()
    await pb.collection('transactions').create({
      month_id: month.id,
      workspace_id: workspaceId,
      envelope_slug: txEnv,
      label: txLabel.trim(),
      amount,
      date: new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    setTxLabel(''); setTxAmount('')
    setShowModal(false)
    setSaving(false)
    refetch()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-black/[0.06] px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">{greeting} {displayName?.split(' ')[0] ?? ''} 👋</p>
            <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Budget</h1>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <a href="https://hacpe.duckdns.org/local/domotique.html"
              className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-transform">
              <Home size={15} />
            </a>
            <MonthPicker />
            <button onClick={() => router.push('/settings')}
              className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-transform">
              <Settings size={15} />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <Loader2 size={28} className="animate-spin text-[var(--text-secondary)]" />
        </div>
      ) : (
        <div className="px-4 pt-5 space-y-3">

          {/* Hero card */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] mb-3">{monthLabel}</p>

            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium mb-4 ${statusClass}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
              {statusLabel}
            </div>

            <div className="flex justify-center mb-5">
              <div className="relative w-[140px] h-[140px]">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="60" fill="none" stroke="var(--bg-surface-2)" strokeWidth="8" />
                  <circle cx="70" cy="70" r="60" fill="none" stroke={ringColor} strokeWidth="8"
                    strokeDasharray={circ.toFixed(1)} strokeDashoffset={offset.toFixed(1)}
                    strokeLinecap="round" transform="rotate(-90 70 70)" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] text-[var(--text-secondary)]">Reste plaisir</span>
                  <span className="text-[24px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">{fmt(reste)}</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">{pct}% dispo</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] pt-4">
              {[
                { label: 'Plaisir', value: fmt(plaisir) },
                { label: 'Prédictif', value: '−'+fmt(totalPlanned), cls: 'text-warning' },
                { label: 'Dépensé', value: '−'+fmt(totalReal), cls: 'text-negative' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="text-center px-2">
                  <p className="text-[11px] text-[var(--text-secondary)] mb-1">{label}</p>
                  <p className={`text-[15px] font-semibold text-[var(--text-primary)] ${cls ?? ''}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Conseil */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] px-4 py-3.5 flex gap-3">
            <span className="text-[18px] mt-0.5">{reste > 50 ? '✅' : reste > 0 ? '⚠️' : '🚨'}</span>
            <p className="text-[13px] text-[var(--text-body)] leading-relaxed">
              {reste > 50
                ? <>Il te reste <strong className="text-[var(--text-primary)]">{fmt(reste)}</strong> après prédictif et dépenses. Tu es dans les clous.</>
                : reste > 0
                ? <>Attention, il ne reste que <strong className="text-[var(--text-primary)]">{fmt(reste)}</strong>. Surveille les prochaines dépenses.</>
                : <>Budget dépassé de <strong className="text-[var(--text-primary)]">{fmt(-reste)}</strong>.</>
              }
            </p>
          </div>

          {/* Mois non courant — bannière info */}
          {!isCurrentMonth && (
            <div className="bg-accent-soft rounded-[16px] px-4 py-3 flex items-center gap-3">
              <span className="text-lg">📅</span>
              <p className="text-[13px] text-accent-text font-medium">Tu consultes {monthLabel}</p>
            </div>
          )}

          {/* Solde final du mois */}
          {totalIncome > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 pt-1">Solde fin de mois</p>
              <div className="bg-[var(--bg-surface)] rounded-[20px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] text-[var(--text-secondary)]">Revenus − tout le reste</p>
                  <p className={`text-[22px] font-bold tracking-tight ${soldeFinal >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {soldeFinal >= 0 ? '+' : ''}{fmt(soldeFinal)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Revenus', value: totalIncome, color: 'var(--cat-revenus)', sign: '+' },
                    { label: 'Charges fixes', value: totalCharges, color: 'var(--cat-fixe)', sign: '−' },
                    { label: 'Plaisir dépensé', value: metrics.totalReal, color: 'var(--cat-variable)', sign: '−' },
                    { label: 'Courses réelles', value: depenseCourses, color: 'var(--cat-courses)', sign: '−' },
                    { label: 'Épargne', value: envelopes.find((e:any)=>e.slug==='epargne')?.budget??0, color: 'var(--cat-epargne)', sign: '−' },
                  ].map(({ label, value, color, sign }) => value > 0 ? (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <p className="text-[13px] text-[var(--text-secondary)]">{label}</p>
                      </div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">{sign}{fmt(value)}</p>
                    </div>
                  ) : null)}
                </div>
              </div>
            </>
          )}

          {/* Camembert répartition budget complet */}
          {totalIncome > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 pt-1">Répartition du budget</p>
              <div className="bg-[var(--bg-surface)] rounded-[20px] p-4">
                <DonutChart
                  data={{
                    ...chargesByCategory,
                    ...(plaisir > 0 ? { 'Plaisir': plaisir } : {}),
                    ...(envelopes.find((e:any)=>e.slug==='epargne')?.budget > 0 ? { 'Épargne': envelopes.find((e:any)=>e.slug==='epargne')?.budget } : {}),
                    ...(coursesBudgetPrevu > 0 ? { 'Courses': coursesBudgetPrevu } : {}),
                  }}
                  total={totalIncome}
                />
              </div>
            </>
          )}

          {/* Actions rapides — seulement mois courant */}
          {isCurrentMonth && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 pt-1">Actions rapides</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label:'Dépense', sub:'Ajouter au suivi', icon:'💸', bg:'var(--negative-soft)', action: () => { setTxEnv('plaisir'); setShowModal(true) } },
                  { label:'Courses', sub:'Saisir un passage', icon:'🛒', bg:'var(--positive-soft)', action: () => router.push('/courses') },
                  { label:'Prédictif', sub:'Planifier', icon:'📋', bg:'var(--accent-soft)', action: () => router.push('/planned') },
                  { label:'Calendrier', sub:'Voir les échéances', icon:'📅', bg:'var(--surface-highlight-2)', action: () => router.push('/calendar') },
                ].map(({ label, sub, icon, bg, action }) => (
                  <button key={label} onClick={action} className="bg-[var(--bg-surface)] rounded-[16px] p-4 text-left active:scale-[0.97] transition-transform">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg mb-2" style={{ background: tileBg(bg) }}>{icon}</div>
                    <p className="text-[14px] font-medium text-[var(--text-primary)]">{label}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{sub}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Dernières transactions */}
          <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 pt-1">Dernières dépenses</p>
          <div className="bg-[var(--bg-surface)] rounded-[20px] overflow-hidden">
            {transactions.length === 0 ? (
              <div className="px-4 py-8 text-center text-[14px] text-[var(--text-secondary)]">Aucune dépense ce mois-ci</div>
            ) : transactions.slice(0, 6).map((tx: any, i: number) => {
              const catName = tx.categories?.name ?? 'Autre'
              const icon = tx.categories?.icon ?? CAT_ICONS[catName] ?? '📦'
              const bg = CAT_COLORS[catName] ?? '#f5f5f7'
              return (
                <div key={tx.id} className={`flex items-center px-4 py-3 gap-3 ${i < Math.min(transactions.length, 6) - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}>
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0" style={{ background: tileBg(bg) }}>{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[var(--text-primary)] truncate">{tx.label}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{catName}</p>
                  </div>
                  <p className="text-[15px] font-semibold text-negative flex-shrink-0">−{fmt(tx.amount)}</p>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* FAB */}
      {isCurrentMonth && (
        <button onClick={() => { setTxEnv('plaisir'); setShowModal(true) }}
          className="fixed right-4 w-14 h-14 bg-[var(--bg-surface-3)] border border-[var(--border-default)] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}>
          <Plus size={24} color="var(--text-primary)" />
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[var(--bg-surface)] rounded-t-[24px] w-full max-w-lg overflow-y-auto"
            style={{ maxHeight: '85vh', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <div className="sticky top-0 bg-[var(--bg-surface)] pt-4 px-5 pb-2 z-10">
              <div className="w-9 h-1 bg-[var(--bg-surface-3)] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Nouvelle dépense</h2>
                <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center">
                  <X size={14} color="var(--text-secondary)" />
                </button>
              </div>
            </div>
            <div className="px-5 pb-4 space-y-3">
              <div>
                <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Libellé</label>
                <input className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] outline-none focus:border-accent-text focus:bg-[var(--bg-surface)]"
                  placeholder="Ex : Netflix, restaurant…" value={txLabel} onChange={e => setTxLabel(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] outline-none focus:border-accent-text focus:bg-[var(--bg-surface)]"
                    placeholder="0.00" value={txAmount} onChange={e => setTxAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Enveloppe</label>
                  <select className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] outline-none appearance-none"
                    value={txEnv} onChange={e => setTxEnv(e.target.value)}>
                    <option value="plaisir">✨ Plaisir</option>
                    <option value="courses">🛒 Courses</option>
                    <option value="charges">🏠 Charges</option>
                    <option value="epargne">💰 Épargne</option>
                  </select>
                </div>
              </div>
              <button onClick={addTransaction} disabled={saving}
                className="w-full h-12 bg-accent text-accent-ink rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CAT_PALETTE: Record<string, string> = {
  'Logement': 'var(--cat-fixe)',
  'Énergie': 'var(--cat-courses)',
  'Telecom': 'var(--cat-revenus)',
  'Abonnements': 'var(--cat-extra-4)',
  'Transport': 'var(--cat-extra-2)',
  'Santé': 'var(--cat-extra-3)',
  'Assurances': 'var(--cat-extra-1)',
  'Banque': 'var(--cat-epargne)',
  'Autre': 'var(--text-tertiary)',
  'Plaisir': 'var(--cat-variable)',
  'Épargne': 'var(--cat-epargne)',
  'Courses': 'var(--cat-courses)',
}

function DonutChart({ data, total }: { data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const r = 54, cx = 70, cy = 70
  const circ = 2 * Math.PI * r
  let cumulative = 0

  const slices = entries.map(([cat, amount]) => {
    const pct = amount / total
    const dash = pct * circ
    const gap = circ - dash
    const offset = circ - cumulative * circ
    cumulative += pct
    return { cat, amount, pct, dash, gap, offset }
  })

  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-surface-2)" strokeWidth="16" />
          {slices.map(({ cat, dash, gap, offset }) => (
            <circle key={cat} cx={cx} cy={cy} r={r} fill="none"
              stroke={CAT_PALETTE[cat] ?? 'var(--text-tertiary)'} strokeWidth="16"
              strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              transform={`rotate(-90 ${cx} ${cy})`} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">Total</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)">
            {Math.round(total)}€
          </text>
        </svg>
      </div>
      <div className="flex-1 space-y-2">
        {slices.map(({ cat, amount, pct }) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CAT_PALETTE[cat] ?? 'var(--text-tertiary)' }} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{cat}</p>
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

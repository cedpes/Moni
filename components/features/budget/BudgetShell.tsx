'use client'

import { useMemo, useState } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { useRouter } from 'next/navigation'
import { fmt, getWeeksOfMonth, fixedItemAmountForWeek } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import DonutChart from '@/components/ui/DonutChart'
import { Wallet, CreditCard, Mail, PiggyBank, Loader2, Settings, Home, Info, ShoppingCart, CalendarRange } from 'lucide-react'

interface Props { workspaceId: string; userId: string; displayName: string | null }

export default function BudgetShell({ workspaceId, displayName }: Props) {
  const router = useRouter()
  const { monthKey, monthLabel } = useMonth()
  const { month, envelopes, transactions, planned, fixedItems, fixedItemStatuses, loading } = useMonthData(monthKey, workspaceId)
  const [tab, setTab] = useState<'reel' | 'previsionnel'>('reel')
  const [viewMode, setViewMode] = useState<'mensuel' | 'hebdomadaire'>('mensuel')

  const metrics = useMemo(() => {
    const income = month?.income ?? 0
    const chargesEnv = envelopes.find((e: any) => e.slug === 'charges')
    const epargneEnv = envelopes.find((e: any) => e.slug === 'epargne')
    const totalCharges = (fixedItems ?? []).filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + f.amount, 0)
    // Charges déjà payées ce mois-ci (cochées ✓ dans Dépenses > Fixe) — c'est ce qui a
    // réellement quitté le compte en banque, contrairement à totalCharges qui est le budgété.
    const doneChargeIds = new Set(
      (fixedItemStatuses ?? []).filter((s: any) => s.is_done).map((s: any) => s.fixed_item_id)
    )
    const chargesValidated = (fixedItems ?? [])
      .filter((f: any) => f.type === 'charge' && doneChargeIds.has(f.id))
      .reduce((s: number, f: any) => s + f.amount, 0)
    const epargne = epargneEnv?.budget ?? 0

    const [y, m] = (month?.month_key ?? monthKey).split('-').map(Number)
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const daysInMonth = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    const txInMonth = transactions.filter((t: any) => t.date >= monthStart && t.date <= monthEnd)

    // Réel : dépenses variables déjà réalisées (hors charges fixes, hors épargne, hors courses -> ligne à part)
    const variableReal = txInMonth
      .filter((t: any) => t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne' && t.envelope_slug !== 'courses')
      .reduce((s: number, t: any) => s + t.amount, 0)
    const coursesReal = txInMonth
      .filter((t: any) => t.envelope_slug === 'courses')
      .reduce((s: number, t: any) => s + t.amount, 0)

    // Prévisionnel : tout le prévisionnel planifié (validé ou pas — un prévisionnel validé
    // est de l'argent dépensé, pas de l'argent libéré) + les dépenses courantes "spontanées"
    // ajoutées à côté du plan (sinon elles ne comptent nulle part dans cette vue).
    // Courses a sa propre ligne, alimentée par le budget mensuel Courses (page Courses).
    const coursesEnv = envelopes.find((e: any) => e.slug === 'courses')
    const coursesBudget = coursesEnv?.budget ?? 0
    const validatedTxIds = new Set(
      (planned ?? []).filter((p: any) => p.is_validated && p.validated_transaction_id).map((p: any) => p.validated_transaction_id)
    )
    const totalPlannedAll = (planned ?? []).reduce((s: number, p: any) => s + p.amount, 0)
    const spontaneousReal = txInMonth
      .filter((t: any) => t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne' && t.envelope_slug !== 'courses' && !validatedTxIds.has(t.id))
      .reduce((s: number, t: any) => s + t.amount, 0)
    const variablePrevu = totalPlannedAll + spontaneousReal

    const variable = tab === 'reel' ? variableReal : variablePrevu
    const courses = tab === 'reel' ? coursesReal : coursesBudget
    const charges = tab === 'reel' ? chargesValidated : totalCharges
    const restant = income - charges - variable - courses - epargne

    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
    const daysLeft = isCurrentMonth ? Math.max(1, daysInMonth - today.getDate() + 1) : daysInMonth
    const perDay = restant > 0 ? restant / daysLeft : 0

    // Répartition par catégorie : vue complète du budget. Fixe, Courses et Épargne sont
    // ajoutés tels quels (même valeur que les lignes au-dessus), et le reste des dépenses
    // "variables" (plaisir) est détaillé catégorie par catégorie.
    const catSource = tab === 'reel'
      ? txInMonth.filter((t: any) => t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne' && t.envelope_slug !== 'courses')
      : [
          ...(planned ?? []),
          ...txInMonth.filter((t: any) => t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne' && t.envelope_slug !== 'courses' && !validatedTxIds.has(t.id)),
        ]
    const categoryData: Record<string, number> = {}
    catSource.forEach((item: any) => {
      const name = item.categories?.name ?? 'Sans catégorie'
      categoryData[name] = (categoryData[name] ?? 0) + item.amount
    })
    if (charges > 0) categoryData['Fixe'] = (categoryData['Fixe'] ?? 0) + charges
    if (courses > 0) categoryData['Courses'] = (categoryData['Courses'] ?? 0) + courses
    if (epargne > 0) categoryData['Épargne'] = (categoryData['Épargne'] ?? 0) + epargne
    const categoryTotal = Object.values(categoryData).reduce((s, v) => s + v, 0)

    return {
      income, charges, totalCharges, variable, courses, epargne, restant, daysLeft, perDay,
      categoryData, categoryTotal,
    }
  }, [month, envelopes, transactions, planned, fixedItems, fixedItemStatuses, monthKey, tab])

  const { income, charges, variable, courses, epargne, restant, daysLeft, perDay, categoryData, categoryTotal } = metrics

  // Vue hebdomadaire : découpe le mois en semaines et affecte à chacune les revenus/charges
  // fixes qui tombent dedans (grâce au jour de prélèvement / jour de semaine des fixed_items).
  // Le prévisionnel variable n'a pas de date précise -> il est réparti à parts égales entre les semaines.
  const weekly = useMemo(() => {
    const weeks = getWeeksOfMonth(monthKey)
    const incomeItems = (fixedItems ?? []).filter((f: any) => f.type === 'income')
    const chargeItems = (fixedItems ?? []).filter((f: any) => f.type === 'charge')
    const validatedTxIds = new Set(
      (planned ?? []).filter((p: any) => p.is_validated && p.validated_transaction_id).map((p: any) => p.validated_transaction_id)
    )
    const totalPlannedAll = (planned ?? []).reduce((s: number, p: any) => s + p.amount, 0)
    const spontaneousReal = transactions
      .filter((t: any) => t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne' && t.envelope_slug !== 'courses' && !validatedTxIds.has(t.id))
      .reduce((s: number, t: any) => s + t.amount, 0)
    const variablePrevuTotal = totalPlannedAll + spontaneousReal
    const variablePerWeek = weeks.length > 0 ? variablePrevuTotal / weeks.length : 0

    let cumulative = 0
    const rows = weeks.map(w => {
      const weekIncome = incomeItems.reduce((s: number, f: any) => s + fixedItemAmountForWeek(f, monthKey, w), 0)
      const weekCharges = chargeItems.reduce((s: number, f: any) => s + fixedItemAmountForWeek(f, monthKey, w), 0)
      const weekRestant = weekIncome - weekCharges - variablePerWeek
      cumulative += weekRestant
      return { ...w, income: weekIncome, charges: weekCharges, variable: variablePerWeek, restant: weekRestant, cumulative }
    })
    return { rows, variablePrevuTotal }
  }, [fixedItems, planned, transactions, monthKey])

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-[var(--border-default)] px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">Bonjour {displayName?.split(' ')[0] ?? ''}</p>
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
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[var(--text-secondary)]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          {/* Toggle Mensuel / Hebdomadaire */}
          <div className="flex bg-[var(--bg-surface)] rounded-[16px] p-1 gap-1">
            {(['mensuel', 'hebdomadaire'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`flex-1 h-9 rounded-[12px] text-[14px] font-semibold transition-all flex items-center justify-center gap-1.5 ${viewMode === v ? 'bg-[var(--text-primary)] text-[var(--bg-app)]' : 'text-[var(--text-secondary)]'}`}>
                {v === 'hebdomadaire' && <CalendarRange size={14} />}
                {v === 'mensuel' ? 'Mensuel' : 'Hebdomadaire'}
              </button>
            ))}
          </div>

          {viewMode === 'hebdomadaire' ? (
            <div className="space-y-3">
              <div className="bg-[var(--bg-surface)] rounded-[16px] px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-surface-2)] flex items-center justify-center flex-shrink-0">
                  <Info size={15} color="var(--text-secondary)" />
                </div>
                <p className="text-[13px] text-[var(--text-body)] leading-relaxed">
                  Revenus et charges affectés à la semaine où ils tombent. Le prévisionnel variable ({fmt(weekly.variablePrevuTotal)}) est réparti à parts égales.
                </p>
              </div>
              {weekly.rows.map(w => (
                <div key={w.index} className="bg-[var(--bg-surface)] rounded-[20px] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">Semaine du {w.label}</p>
                    <p className={`text-[15px] font-bold ${w.restant >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{fmt(w.restant)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)]">Revenus</span>
                      <span className="text-[var(--text-primary)] font-medium">{fmt(w.income)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)]">Charges fixes</span>
                      <span className="text-[var(--text-primary)] font-medium">{fmt(w.charges)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-secondary)]">Variable prévu (part)</span>
                      <span className="text-[var(--text-primary)] font-medium">{fmt(w.variable)}</span>
                    </div>
                  </div>
                  <div className="h-px bg-[var(--surface-highlight-2)] my-2.5" />
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)]">Cumul depuis le début du mois</span>
                    <span className={`font-semibold ${w.cumulative >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{fmt(w.cumulative)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <>
          {/* Tabs Réel / Prévisionnel */}
          <div className="flex bg-[var(--bg-surface)] rounded-[16px] p-1 gap-1">
            {(['reel', 'previsionnel'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 h-9 rounded-[12px] text-[14px] font-semibold transition-all ${tab === t ? 'bg-[var(--text-primary)] text-[var(--bg-app)]' : 'text-[var(--text-secondary)]'}`}>
                {t === 'reel' ? 'Réel' : 'Prévisionnel'}
              </button>
            ))}
          </div>

          {/* Entrées et sorties d'argent */}
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)] px-1 mb-2">Entrées et sorties d&apos;argent</p>
            <div className="bg-[var(--bg-surface)] rounded-[20px] overflow-hidden">
              {[
                { label: 'Revenus', value: income, icon: Wallet, bg: '#1e3a8a', color: '#60a5fa' },
                { label: tab === 'reel' ? 'Dépenses fixes payées' : 'Dépenses fixes', value: charges, icon: CreditCard, bg: '#3b0764', color: '#a78bfa' },
                { label: tab === 'reel' ? 'Dépenses variables' : 'Dépenses variables prévues', value: variable, icon: Mail, bg: '#312e81', color: '#818cf8' },
                { label: 'Courses', value: courses, icon: ShoppingCart, bg: '#1e3a5f', color: '#60a5fa' },
                { label: 'Épargne', value: epargne, icon: PiggyBank, bg: '#1e3a5f', color: '#38bdf8' },
              ].map(({ label, value, icon: Icon, bg, color }, i) => (
                <div key={label} className={`flex items-center px-4 py-3.5 gap-3 ${i < 4 ? 'border-b border-[var(--border-subtle)]' : ''}`}>
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon size={16} color={color} />
                  </div>
                  <p className="flex-1 text-[15px] text-[var(--text-primary)]">{label}</p>
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">{fmt(value)}</p>
                </div>
              ))}
              <div className="flex items-center px-4 py-3.5 gap-3 bg-[var(--surface-highlight)]">
                <div className="w-9 h-9 rounded-[10px] bg-[#064e3b] flex items-center justify-center flex-shrink-0">
                  <Wallet size={16} color="#34d399" />
                </div>
                <p className="flex-1 text-[15px] font-semibold text-[var(--text-primary)]">Restant {tab === 'reel' ? 'réel' : 'prévisionnel'}</p>
                <p className={`text-[15px] font-bold ${restant >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{fmt(restant)}</p>
              </div>
            </div>
          </div>

          {/* Gestion du budget quotidien */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-4">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Gestion du budget quotidien</p>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center flex-shrink-0">
                <Info size={14} color="var(--text-secondary)" />
              </div>
              <p className="text-[14px] text-[var(--text-body)] leading-relaxed">
                Il reste <strong className="text-[#f87171]">{daysLeft} jour{daysLeft > 1 ? 's' : ''}</strong> avant la fin du mois &amp;{' '}
                <strong className="text-[#34d399]">{fmt(perDay)}</strong> à dépenser par jour !
              </p>
            </div>
          </div>

          {/* Part des dépenses par rapport aux revenus */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-4">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Part des dépenses par rapport aux revenus</p>
            <DonutChart
              data={{ Fixe: charges, Variable: variable, Courses: courses, Épargne: epargne }}
              total={income}
              centerLabel="Revenus"
            />
          </div>

          {/* Répartition par catégorie */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-4">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Répartition par catégorie</p>
            <DonutChart
              data={categoryData}
              total={categoryTotal}
              centerLabel="Dépensé"
            />
          </div>
          </>
          )}
        </div>
      )}
    </div>
  )
}

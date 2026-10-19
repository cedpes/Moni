'use client'

import { useMemo, useState } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { fmt, getWeeksOfMonth, fixedItemAmountForWeek, fixedItemMonthlyAmount } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import DonutChart from '@/components/ui/DonutChart'
import { Wallet, CreditCard, Mail, PiggyBank, Loader2, Home, Info, ShoppingCart, CalendarRange } from 'lucide-react'

interface Props { workspaceId: string; userId: string; displayName: string | null }

export default function BudgetShell({ workspaceId, displayName }: Props) {
  const { monthKey, monthLabel } = useMonth()
  const { month, envelopes, transactions, planned, fixedItems, fixedItemStatuses, loading } = useMonthData(monthKey, workspaceId)
  const [tab, setTab] = useState<'reel' | 'previsionnel'>('reel')
  const [viewMode, setViewMode] = useState<'mensuel' | 'hebdomadaire'>('mensuel')

  const metrics = useMemo(() => {
    const income = month?.income ?? 0
    const chargesEnv = envelopes.find((e: any) => e.slug === 'charges')
    const epargneEnv = envelopes.find((e: any) => e.slug === 'epargne')
    const totalCharges = (fixedItems ?? []).filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + fixedItemMonthlyAmount(f, monthKey), 0)
    // Charges déjà payées ce mois-ci (cochées ✓ dans Dépenses > Fixe) — c'est ce qui a
    // réellement quitté le compte en banque, contrairement à totalCharges qui est le budgété.
    const doneChargeIds = new Set(
      (fixedItemStatuses ?? []).filter((s: any) => s.is_done).map((s: any) => s.fixed_item_id)
    )
    const chargesValidated = (fixedItems ?? [])
      .filter((f: any) => f.type === 'charge' && doneChargeIds.has(f.id))
      .reduce((s: number, f: any) => s + fixedItemMonthlyAmount(f, monthKey), 0)
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

  const engaged = charges + variable + courses + epargne
  const usedPct = income > 0 ? Math.min(100, Math.max(0, (engaged / income) * 100)) : (engaged > 0 ? 100 : 0)
  const flowSegments = [
    { label: tab === 'reel' ? 'Fixe payé' : 'Fixe', value: charges, color: 'var(--cat-fixe)' },
    { label: 'Variable', value: variable, color: 'var(--cat-variable)' },
    { label: 'Courses', value: courses, color: 'var(--cat-courses)' },
    { label: 'Épargne', value: epargne, color: 'var(--cat-epargne)' },
  ]
  // Si les dépenses dépassent les revenus, la barre se base sur le total dépensé
  const flowBase = Math.max(income, engaged, 1)

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
            <a href="https://hacpe.duckdns.org/local/domotique.html" aria-label="Domotique"
              className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-transform">
              <Home size={15} />
            </a>
            <MonthPicker />
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
              <button key={v} onClick={() => setViewMode(v)} aria-pressed={viewMode === v}
                className={`flex-1 h-9 rounded-[12px] text-[14px] font-semibold transition-all flex items-center justify-center gap-1.5 ${viewMode === v ? 'bg-[var(--bg-surface-3)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
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
                    <p className={`text-[15px] font-bold ${w.restant >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(w.restant)}</p>
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
                    <span className={`font-semibold ${w.cumulative >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(w.cumulative)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <>
          {/* Carte héros : reste à vivre, mode Réel / Prévisionnel, rythme quotidien */}
          <section aria-labelledby="hero-title" className="rounded-[var(--radius-hero)] p-5 space-y-4"
            style={{ background: 'var(--hero-bg)', color: 'var(--hero-fg)' }}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="hero-title" className="text-[13px] font-bold uppercase tracking-[0.04em]">
                {restant >= 0 ? 'Reste à vivre' : 'Dépassement'}
              </h2>
              <div role="group" aria-label="Mode de calcul" className="flex rounded-full p-[3px]" style={{ background: 'var(--hero-track)' }}>
                {(['reel', 'previsionnel'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
                    className="h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors"
                    style={tab === t ? { background: 'var(--hero-pill-bg)', color: 'var(--hero-pill-fg)' } : { color: 'var(--hero-fg)' }}>
                    {t === 'reel' ? 'Réel' : 'Prévu'}
                  </button>
                ))}
              </div>
            </div>
            <p className="font-display text-[48px] font-bold leading-none">{fmt(restant)}</p>
            <div className="space-y-1.5">
              <div role="progressbar" aria-label="Part du revenu déjà engagée"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPct)}
                className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--hero-track)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: 'var(--hero-bar)' }} />
              </div>
              <div className="flex justify-between text-[13px] font-semibold" style={{ color: 'var(--hero-muted)' }}>
                <span>{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</span>
                <span>{restant > 0 ? <>≈ {fmt(perDay)} / jour</> : 'Plus de marge ce mois-ci'}</span>
              </div>
            </div>
          </section>

          {/* Où va l'argent : barre empilée par rapport aux revenus */}
          <section aria-labelledby="flux-title" className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="flux-title" className="text-[15px] font-bold text-[var(--text-primary)]">Où va l&apos;argent</h2>
              <span className="text-[13px] text-[var(--text-secondary)]">sur {fmt(income)} de revenus</span>
            </div>
            <div role="img"
              aria-label={flowSegments.map(f => `${f.label} ${fmt(f.value)}`).join(', ') + (restant > 0 ? `, reste ${fmt(restant)}` : '')}
              className="flex h-3.5 rounded-full overflow-hidden gap-[2px] bg-[var(--bg-surface-2)]">
              {flowSegments.filter(f => f.value > 0).map(f => (
                <div key={f.label} style={{ width: `${(f.value / flowBase) * 100}%`, background: f.color }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3.5">
              {flowSegments.map(f => (
                <div key={f.label} className="flex items-center gap-2 text-[13px] min-w-0">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: f.color }} />
                  <span className="flex-1 truncate text-[var(--text-body)]">{f.label}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{fmt(f.value)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Entrées et sorties d'argent */}
          <div>
            <p className="text-[15px] font-semibold text-[var(--text-primary)] px-1 mb-2">Entrées et sorties d&apos;argent</p>
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] overflow-hidden">
              {[
                { label: 'Revenus', value: income, icon: Wallet, bg: 'color-mix(in srgb, var(--cat-revenus) 16%, transparent)', color: 'var(--cat-revenus)' },
                { label: tab === 'reel' ? 'Dépenses fixes payées' : 'Dépenses fixes', value: charges, icon: CreditCard, bg: 'color-mix(in srgb, var(--cat-fixe) 16%, transparent)', color: 'var(--cat-fixe)' },
                { label: tab === 'reel' ? 'Dépenses variables' : 'Dépenses variables prévues', value: variable, icon: Mail, bg: 'color-mix(in srgb, var(--cat-variable) 16%, transparent)', color: 'var(--cat-variable)' },
                { label: 'Courses', value: courses, icon: ShoppingCart, bg: 'color-mix(in srgb, var(--cat-courses) 16%, transparent)', color: 'var(--cat-courses)' },
                { label: 'Épargne', value: epargne, icon: PiggyBank, bg: 'color-mix(in srgb, var(--cat-epargne) 16%, transparent)', color: 'var(--cat-epargne)' },
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
                <div className="w-9 h-9 rounded-[10px] bg-positive/15 flex items-center justify-center flex-shrink-0">
                  <Wallet size={16} color="var(--positive)" />
                </div>
                <p className="flex-1 text-[15px] font-semibold text-[var(--text-primary)]">Restant {tab === 'reel' ? 'réel' : 'prévisionnel'}</p>
                <p className={`text-[15px] font-bold ${restant >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt(restant)}</p>
              </div>
            </div>
          </div>

          {/* Répartition par catégorie */}
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] p-4">
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

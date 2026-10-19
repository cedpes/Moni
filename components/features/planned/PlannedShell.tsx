'use client'

import { useState, useMemo } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { createClient } from '@/lib/pocketbase/client'
import { fmt, barColorHex, tileBg } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, RotateCcw, Copy, Check } from 'lucide-react'

interface Props { workspaceId: string; userId: string; categories: any[] }

const CAT_ICONS: Record<string, string> = {
  Courses:'🛒', Sortie:'🎉', Resto:'🍽️', Essence:'⛽',
  Achat:'🛍️', Santé:'💊', Cadeau:'🎁', Plaisir:'✨', Autre:'📦',
}
const CAT_COLORS: Record<string, string> = {
  Courses:'#e8f4ff', Sortie:'#fef0f5', Resto:'#fff3e0', Essence:'#fff8e6',
  Achat:'#f0f7ff', Santé:'#e8faf0', Cadeau:'#fff0f5', Plaisir:'#f3f0ff', Autre:'#f5f5f7',
}

export default function PlannedShell({ workspaceId, userId, categories }: Props) {
  const { monthKey } = useMonth()
  const { month, envelopes, planned, loading, refetch } = useMonthData(monthKey, workspaceId)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [validating, setValidating] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fCatId, setFCatId] = useState('')
  const [fRecurring, setFRecurring] = useState(false)

  const plaisirBudget = envelopes.find((e: any) => e.slug === 'plaisir')?.budget ?? 0
  const pending = planned.filter((p: any) => !p.is_validated)
  const validated = planned.filter((p: any) => p.is_validated)
  const totalPending = useMemo(() => pending.reduce((s: number, p: any) => s + p.amount, 0), [pending])
  const totalValidated = useMemo(() => validated.reduce((s: number, p: any) => s + p.amount, 0), [validated])
  const pct = plaisirBudget > 0 ? Math.min(100, Math.round(totalPending / plaisirBudget * 100)) : 0

  async function validateItem(item: any) {
    if (!month) return
    setValidating(item.id)
    const pb = createClient()

    // Créer la transaction réelle
    const tx = await pb.collection('transactions').create({
      month_id: month.id,
      workspace_id: workspaceId,
      envelope_slug: 'plaisir',
      label: item.label,
      amount: item.amount,
      category_id: item.category_id ?? null,
      date: new Date().toISOString().slice(0, 10),
      created_by: userId,
    })

    // Marquer comme validé
    await pb.collection('planned_expenses').update(item.id, {
      is_validated: true,
      validated_transaction_id: tx?.id ?? null,
    })

    setValidating(null)
    refetch()
  }

  async function unvalidateItem(item: any) {
    setValidating(item.id)
    const pb = createClient()

    // Supprimer la transaction liée si elle existe
    if (item.validated_transaction_id) {
      await pb.collection('transactions').delete(item.validated_transaction_id)
    }

    // Remettre en attente
    await pb.collection('planned_expenses').update(item.id, {
      is_validated: false,
      validated_transaction_id: null,
    })

    setValidating(null)
    refetch()
  }

  async function addPlanned() {
    const amount = parseFloat(fAmount)
    if (!fLabel.trim() || !amount || !month) return
    setSaving(true)
    const pb = createClient()
    await pb.collection('planned_expenses').create({
      month_id: month.id, label: fLabel.trim(), amount,
      category_id: fCatId || null, is_recurring: fRecurring, position: planned.length,
    })
    setSaving(false); setShowModal(false); refetch()
  }

  async function deletePlanned(id: string) {
    setDeleting(id)
    const pb = createClient()
    await pb.collection('planned_expenses').delete(id)
    setDeleting(null); refetch()
  }

  async function copyPrevMonth() {
    if (!month) return
    const pb = createClient()
    const d = new Date(monthKey + '-01')
    d.setMonth(d.getMonth() - 1)
    const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const prevMonths = await pb.collection('months').getFullList({
      filter: pb.filter('workspace_id={:p0} && month_key={:p1}', { p0: workspaceId, p1: prevKey }),
    })
    if (!prevMonths?.[0]) return
    const prevPlanned = await pb.collection('planned_expenses').getFullList({
      filter: pb.filter('month_id={:p0} && is_recurring=true', { p0: prevMonths[0].id }),
    })
    if (!prevPlanned?.length) return
    await Promise.all(prevPlanned.map((p: any, i: number) =>
      pb.collection('planned_expenses').create({
        month_id: month.id, label: p.label, amount: p.amount,
        category_id: p.category_id, is_recurring: true, position: planned.length + i,
      })
    ))
    refetch()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-black/[0.06] px-5 pt-14 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Prédictif</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <MonthPicker />
            <button onClick={() => { setFLabel(''); setFAmount(''); setFCatId(''); setFRecurring(false); setShowModal(true) }}
              className="w-8 h-8 rounded-full bg-accent flex items-center justify-center active:scale-95 transition-transform">
              <Plus size={16} color="var(--accent-ink)" />
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between mb-2.5">
          {[
            { label: 'Plaisir', value: fmt(plaisirBudget), color: '' },
            { label: 'À venir', value: '−'+fmt(totalPending), color: 'text-warning' },
            { label: 'Validé', value: '−'+fmt(totalValidated), color: 'text-positive' },
          ].map(({ label, value, color }, i) => (
            <div key={label} className={`text-center flex-1 ${i > 0 ? 'border-l border-[var(--border-default)]' : ''}`}>
              <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-medium">{label}</p>
              <p className={`text-[17px] font-bold tracking-tight mt-0.5 ${color || 'text-[var(--text-primary)]'}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColorHex(pct) }} />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[var(--text-secondary)]" /></div>
      ) : (
        <div className="px-4 pt-4 space-y-3">

          {/* Conseil */}
          <div className="bg-[var(--bg-surface)] rounded-[20px] px-4 py-3.5 flex gap-3">
            <span className="text-lg mt-0.5">{planned.length === 0 ? '📋' : totalPending > 0 ? '⏳' : '✅'}</span>
            <p className="text-[13px] text-[var(--text-body)] leading-relaxed">
              {planned.length === 0
                ? 'Aucune dépense planifiée. Ajoute tes sorties et achats prévus.'
                : totalPending > 0
                ? <>{pending.length} dépense{pending.length > 1 ? 's' : ''} à valider · <strong className="text-[var(--text-primary)]">{fmt(totalPending)}</strong> prévus.</>
                : <>Tout est validé ce mois ! <strong className="text-[var(--text-primary)]">{fmt(totalValidated)}</strong> dépensé.</>
              }
            </p>
          </div>

          {/* Copier mois précédent */}
          {planned.length === 0 && (
            <div className="bg-[var(--bg-surface)] rounded-[20px] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-accent-soft flex items-center justify-center flex-shrink-0">
                  <Copy size={16} color="var(--accent-text)" />
                </div>
                <p className="text-[13px] text-[var(--text-body)]">Copier les récurrents du mois précédent ?</p>
              </div>
              <button onClick={copyPrevMonth}
                className="px-3 py-1.5 bg-[var(--bg-surface-2)] rounded-[10px] text-[13px] font-medium text-[var(--text-primary)] active:scale-95 whitespace-nowrap">
                Copier
              </button>
            </div>
          )}

          {/* À valider */}
          {pending.length > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1">À valider</p>
              <div className="bg-[var(--bg-surface)] rounded-[20px] overflow-hidden">
                {pending.map((p: any, i: number) => (
                  <PlannedRow key={p.id} item={p} isLast={i === pending.length - 1}
                    deleting={deleting === p.id} validating={validating === p.id}
                    onDelete={() => deletePlanned(p.id)}
                    onValidate={() => validateItem(p)} />
                ))}
              </div>
            </>
          )}

          {/* Validés */}
          {validated.length > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1">Validés ✓</p>
              <div className="bg-[var(--bg-surface)] rounded-[20px] overflow-hidden">
                {validated.map((p: any, i: number) => (
                  <PlannedRow key={p.id} item={p} isLast={i === validated.length - 1}
                    deleting={deleting === p.id} validating={validating === p.id}
                    onDelete={() => deletePlanned(p.id)}
                    onUnvalidate={() => unvalidateItem(p)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setFLabel(''); setFAmount(''); setFCatId(''); setFRecurring(false); setShowModal(true) }}
        className="fixed right-4 w-14 h-14 bg-accent rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="var(--accent-ink)" />
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[var(--bg-surface)] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[var(--bg-surface-3)] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Nouvelle dépense prévue</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center">
                <X size={14} color="var(--text-secondary)" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Libellé</label>
                <input className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] outline-none focus:border-accent-text focus:bg-[var(--bg-surface)]"
                  placeholder="Ex : Cinéma, essence…" value={fLabel} onChange={e => setFLabel(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] outline-none focus:border-accent-text focus:bg-[var(--bg-surface)]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Catégorie</label>
                  <select className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] outline-none appearance-none"
                    value={fCatId} onChange={e => setFCatId(e.target.value)}>
                    <option value="">Sans catégorie</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[15px] text-[var(--text-primary)]">Récurrent (chaque mois)</span>
                <button onClick={() => setFRecurring(!fRecurring)}
                  className="relative flex-shrink-0"
                  style={{ width: 44, height: 26, borderRadius: 13, background: fRecurring ? 'var(--positive)' : 'var(--bg-surface-3)' }}>
                  <span className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow transition-transform ${fRecurring ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>
              <button onClick={addPlanned} disabled={saving || !fLabel || !fAmount}
                className="w-full h-12 bg-accent text-accent-ink rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
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

function PlannedRow({ item, isLast, deleting, validating, onDelete, onValidate, onUnvalidate }: {
  item: any; isLast: boolean; deleting: boolean; validating: boolean
  onDelete: () => void; onValidate?: () => void; onUnvalidate?: () => void
}) {
  const catName = item.categories?.name ?? 'Autre'
  const icon = item.categories?.icon ?? CAT_ICONS[catName] ?? '📦'
  const bg = CAT_COLORS[catName] ?? '#f5f5f7'
  const validated = item.is_validated

  return (
    <div className={`flex items-center px-4 py-3.5 gap-3 ${!isLast ? 'border-b border-[var(--border-subtle)]' : ''} ${validated ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0" style={{ background: tileBg(bg) }}>
        {validated ? '✓' : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-medium truncate ${validated ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{item.label}</p>
        <p className="text-[12px] text-[var(--text-secondary)]">{catName}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.is_recurring && !validated && (
          <span className="flex items-center gap-1 text-[11px] font-semibold bg-accent-soft text-accent-text px-2 py-0.5 rounded-full">
            <RotateCcw size={10} />↺
          </span>
        )}
        <p className={`text-[15px] font-semibold ${validated ? 'text-[var(--text-secondary)]' : 'text-negative'}`}>−{fmt(item.amount)}</p>

        {/* Bouton valider / dévalider */}
        {!validated ? (
          <button onClick={onValidate} disabled={validating}
            className="w-7 h-7 rounded-full bg-positive/15 border border-positive flex items-center justify-center active:scale-95 transition-transform">
            {validating ? <Loader2 size={12} className="animate-spin text-positive" /> : <Check size={13} color="var(--positive)" strokeWidth={2.5} />}
          </button>
        ) : (
          <button onClick={onUnvalidate} disabled={validating}
            className="w-7 h-7 rounded-full bg-positive flex items-center justify-center active:scale-95 transition-transform">
            {validating ? <Loader2 size={12} className="animate-spin text-on-positive" /> : <Check size={13} color="var(--on-positive)" strokeWidth={2.5} />}
          </button>
        )}

        {!validated && (
          <button onClick={onDelete} disabled={deleting}
            className="w-6 h-6 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center active:scale-95">
            {deleting ? <Loader2 size={11} className="animate-spin text-[var(--text-secondary)]" /> : <X size={11} color="var(--text-secondary)" />}
          </button>
        )}
      </div>
    </div>
  )
}


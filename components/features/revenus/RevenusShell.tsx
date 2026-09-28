'use client'

import { useState, useEffect } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { createClient } from '@/lib/pocketbase/client'
import { fmt, fixedItemMonthlyAmount, isWeeklyDueDay, isoWeekdayFromDueDay, weeklyDueDay, WEEKDAY_NAMES, countWeekdayOccurrences, getMonthLabel } from '@/lib/utils'
import { filterFixedItemsForMonth, saveFixedItemVersioned, removeFixedItemFromMonth, parseAnnualMonths, formatAnnualMonths, addMonths, isFixedItemActiveInMonth, MONTH_NAMES_SHORT, type VersionedFixedItem } from '@/lib/utils/fixedItemsVersioning'
import MonthPicker from '@/components/ui/MonthPicker'
import MonthLockBanner from '@/components/ui/MonthLockBanner'
import { useMonthLock } from '@/lib/utils/monthLock'
import DonutChart from '@/components/ui/DonutChart'
import { Plus, X, Loader2, Check, Pencil, Settings2 } from 'lucide-react'

interface Props { workspaceId: string; userId: string }

interface Income {
  id: string
  name: string
  amount: number
  due_day: number
  icon: string
  color: string | null
  is_active: boolean
  type: 'income'
  start_month?: string | null
  end_month?: string | null
  is_exceptional?: boolean
  annual_months?: string | null
}

type Frequency = 'monthly' | 'weekly' | 'annual' | 'exceptional'

const INCOME_ICONS = ['💵', '💼', '🏦', '💻', '🎨', '📊', '🏪', '💰']
const COLORS = ['#fff3e0', '#f3f0ff', '#e8faf0', '#e8f4ff', '#fef0f5', '#fff8e6', '#f0f7ff', '#f5f5f7']

export default function RevenusShell({ workspaceId }: Props) {
  const { monthKey } = useMonth()
  const lock = useMonthLock(workspaceId, monthKey)
  const [liveItems, setItems] = useState<Income[]>([])
  const [allIncomes, setAllIncomes] = useState<Income[]>([]) // toutes versions, pour les primes à venir
  // Mois clôturé : copie figée ; sinon, versions valables ce mois-ci
  const items: Income[] = lock.closed
    ? (lock.month.fixed_snapshot as Income[]).filter((i: any) => i.type === 'income')
    : liveItems
  const readOnly = lock.closed
  const [statuses, setStatuses] = useState<{ fixed_item_id: string; id?: string; is_done: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Income | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPct, setShowPct] = useState(false)

  const [fName, setFName] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fFrequency, setFFrequency] = useState<Frequency>('monthly')
  const [fDay, setFDay] = useState('') // jour du mois (1-31), si mensuel
  const [fWeekday, setFWeekday] = useState(3) // jour de la semaine ISO (1=Lundi...7=Dimanche), si hebdomadaire, défaut Mercredi
  const [fIcon, setFIcon] = useState('💵')
  const [fColor, setFColor] = useState('#e8faf0')
  const [fTargetMonth, setFTargetMonth] = useState('') // exceptionnel : mois de versement
  const [fAnnualMonths, setFAnnualMonths] = useState<number[]>([]) // annuel : mois de versement chaque année
  const [savedNote, setSavedNote] = useState('')

  async function fetchData() {
    setLoading(true)
    try {
      const pb = createClient()
      const [incomes, monthStatuses] = await Promise.all([
        pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && type="income" && is_active=true`, sort: 'due_day' }),
        pb.collection('fixed_item_status').getFullList({ filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"` }),
      ])
      // Seuls les revenus valables pour le mois affiché (historique préservé)
      setItems(filterFixedItemsForMonth((incomes ?? []) as any, monthKey))
      setAllIncomes((incomes ?? []) as any)
      setStatuses((monthStatuses ?? []) as any)
    } catch (err: any) {
      // Ignore les annulations automatiques du SDK PocketBase (changement rapide de mois) ;
      // ce ne sont pas de vraies erreurs, il ne faut juste pas rester bloqué en chargement.
      if (err?.isAbort) return
      console.error('RevenusShell fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [monthKey, workspaceId])

  function isDone(id: string) {
    return statuses.find(s => s.fixed_item_id === id)?.is_done ?? false
  }

  async function toggleDone(item: Income) {
    const pb = createClient()
    const current = isDone(item.id)
    const existing = statuses.find(s => s.fixed_item_id === item.id)
    if (existing?.id) {
      await pb.collection('fixed_item_status').update(existing.id, { is_done: !current, done_at: !current ? new Date().toISOString() : null })
    } else {
      await pb.collection('fixed_item_status').create({ fixed_item_id: item.id, workspace_id: workspaceId, month_key: monthKey, is_done: !current, done_at: !current ? new Date().toISOString() : null })
    }
    setStatuses(prev => {
      const exists = prev.find(s => s.fixed_item_id === item.id)
      if (exists) return prev.map(s => s.fixed_item_id === item.id ? { ...s, is_done: !current } : s)
      return [...prev, { fixed_item_id: item.id, is_done: !current }]
    })
  }

  function openAdd() {
    setFName(''); setFAmount(''); setFFrequency('monthly'); setFDay(''); setFWeekday(3); setFIcon('💵'); setFColor('#e8faf0')
    setFTargetMonth(monthKey); setFAnnualMonths([])
    setEditItem(null); setShowModal(true)
  }

  function openEdit(item: Income) {
    setFName(item.name); setFAmount(String(item.amount))
    setFTargetMonth(item.is_exceptional ? (item.start_month || monthKey) : monthKey)
    setFAnnualMonths(parseAnnualMonths(item.annual_months))
    if (item.is_exceptional) {
      setFFrequency('exceptional'); setFDay(String(item.due_day))
    } else if (parseAnnualMonths(item.annual_months).length > 0) {
      setFFrequency('annual'); setFDay(String(item.due_day))
    } else if (isWeeklyDueDay(item.due_day)) {
      setFFrequency('weekly'); setFWeekday(isoWeekdayFromDueDay(item.due_day)); setFDay('')
    } else {
      setFFrequency('monthly'); setFDay(String(item.due_day))
    }
    setFIcon(item.icon); setFColor(item.color ?? '#e8faf0')
    setEditItem(item); setShowModal(true)
  }

  async function saveItem() {
    if (!fName.trim() || !fAmount) return
    if (fFrequency !== 'weekly' && !fDay) return
    if (fFrequency === 'annual' && fAnnualMonths.length === 0) return
    setSaving(true)
    try {
      const pb = createClient()
      const payload = {
        workspace_id: workspaceId, type: 'income' as const, name: fName.trim(),
        amount: parseFloat(fAmount),
        due_day: fFrequency === 'weekly' ? weeklyDueDay(fWeekday) : parseInt(fDay),
        icon: fIcon, color: fColor, category: 'Revenu',
        is_exceptional: fFrequency === 'exceptional',
        annual_months: fFrequency === 'annual' ? formatAnnualMonths(fAnnualMonths) : '',
        target_month: fFrequency === 'exceptional' ? fTargetMonth : undefined,
      }
      await saveFixedItemVersioned(pb, { editItem: editItem as VersionedFixedItem | null, payload, monthKey })
      setShowModal(false)
      // Revenu programmé sur un autre mois : il n'apparaît pas ici, on le signale
      if (fFrequency === 'exceptional' && fTargetMonth !== monthKey) setSavedNote(`${fName.trim()} programmé sur ${getMonthLabel(fTargetMonth)}`)
      else if (fFrequency === 'annual' && !fAnnualMonths.includes(Number(monthKey.slice(5, 7)))) setSavedNote(`${fName.trim()} programmé chaque année en ${fAnnualMonths.map(m => MONTH_NAMES_SHORT[m - 1]).join(' et ')}`)
      else setSavedNote('')
    } catch (err) {
      console.error('RevenusShell saveItem error:', err)
    } finally {
      setSaving(false); fetchData()
    }
  }

  async function deleteItem(item: Income) {
    const pb = createClient()
    await removeFixedItemFromMonth(pb, item as VersionedFixedItem, monthKey)
    fetchData()
  }

  const recurringItems = items.filter(i => !i.is_exceptional && parseAnnualMonths(i.annual_months).length === 0)
  const exceptionalItems = items.filter(i => i.is_exceptional || parseAnnualMonths(i.annual_months).length > 0)

  // Primes / revenus exceptionnels et annuels à venir sur les 12 prochains mois
  const upcoming = (() => {
    const out: { key: string; month: string; item: Income }[] = []
    for (let n = 1; n <= 12; n++) {
      const mk = addMonths(monthKey, n)
      allIncomes
        .filter(i => i.is_exceptional || parseAnnualMonths(i.annual_months).length > 0)
        .filter(i => isFixedItemActiveInMonth(i, mk))
        .forEach(i => out.push({ key: `${i.id}-${mk}`, month: mk, item: i }))
    }
    return out
  })()

  // Options de mois pour un revenu exceptionnel : 12 mois avant → 24 mois après le mois affiché
  const monthOptions = Array.from({ length: 37 }, (_, i) => addMonths(monthKey, i - 12))
  const isEditingRecurring = !!editItem && !editItem.is_exceptional && fFrequency !== 'exceptional'

  // Montant effectif de chaque revenu pour le mois affiché (un item hebdo compte 4 ou 5 fois selon le mois)
  const total = items.reduce((s, i) => s + fixedItemMonthlyAmount(i, monthKey), 0)
  const data: Record<string, number> = {}
  items.forEach(i => { data[i.name] = (data[i.name] ?? 0) + fixedItemMonthlyAmount(i, monthKey) })
  const pctData: Record<string, number> = {}
  Object.entries(data).forEach(([k, v]) => { pctData[k] = total > 0 ? Math.round((v / total) * 100) : 0 })

  function renderItem(item: Income) {
    const done = isDone(item.id)
    const weekly = !item.is_exceptional && isWeeklyDueDay(item.due_day) && parseAnnualMonths(item.annual_months).length === 0
    const annual = parseAnnualMonths(item.annual_months)
    const subLabel = item.is_exceptional
      ? `${fmt(item.amount)} · exceptionnel, le ${item.due_day}`
      : annual.length > 0
      ? `${fmt(item.amount)} · chaque année en ${annual.map(m => MONTH_NAMES_SHORT[m - 1]).join(', ')}, le ${item.due_day}`
      : weekly
        ? `${fmt(item.amount)} · tous les ${WEEKDAY_NAMES[isoWeekdayFromDueDay(item.due_day) - 1]}s (${countWeekdayOccurrences(monthKey, isoWeekdayFromDueDay(item.due_day))}× ce mois)`
        : `${fmt(item.amount)} · le ${item.due_day} de chaque mois`
    return (
      <div key={item.id} className="bg-[var(--bg-surface)] rounded-[16px] flex items-center px-4 py-3.5 gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: item.color ?? 'var(--bg-surface-2)' }}>
          {item.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">{item.name}</p>
          <p className="text-[12px] text-[var(--text-secondary)]">{subLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!readOnly && (<>
          <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center">
            <Pencil size={11} color="var(--text-secondary)" />
          </button>
          <button onClick={() => deleteItem(item)} className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center">
            <X size={11} color="var(--text-secondary)" />
          </button>
          </>)}
          {!weekly && (
            <button onClick={() => toggleDone(item)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${done ? 'bg-[#34c759]' : 'bg-[var(--bg-surface-2)] border border-[var(--border-default)]'}`}>
              <Check size={14} color={done ? 'white' : 'var(--text-tertiary)'} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-[var(--border-default)] px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Revenus</h1>
          <MonthPicker />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[var(--text-secondary)]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          <MonthLockBanner monthKey={monthKey} month={lock.month} closed={lock.closed} onClose={lock.close} onReopen={lock.reopen} />
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] text-[var(--text-secondary)] mb-1">Total</p>
                <p className="text-[26px] font-bold text-[var(--text-primary)] tracking-tight">{fmt(total)}</p>
              </div>
              <button onClick={() => setShowPct(!showPct)}
                className="flex bg-[var(--bg-surface-2)] rounded-full p-0.5 text-[12px] font-semibold">
                <span className={`px-3 py-1 rounded-full ${!showPct ? 'bg-[var(--text-primary)] text-[var(--bg-app)]' : 'text-[var(--text-secondary)]'}`}>€</span>
                <span className={`px-3 py-1 rounded-full ${showPct ? 'bg-[var(--text-primary)] text-[var(--bg-app)]' : 'text-[var(--text-secondary)]'}`}>%</span>
              </button>
            </div>
            <DonutChart data={showPct ? pctData : data} total={showPct ? 100 : total} centerLabel="Total" />
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)]">Historique des revenus</p>
            {!readOnly && (
              <button onClick={openAdd} className="w-7 h-7 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                <Settings2 size={13} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="bg-[var(--bg-surface)] rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">💵</p>
              <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucun revenu</p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">Appuie sur + pour en ajouter un</p>
            </div>
          ) : (
            <>
              {recurringItems.length > 0 && (
                <div className="space-y-2">{recurringItems.map(renderItem)}</div>
              )}
              {exceptionalItems.length > 0 && (
                <>
                  <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 pt-2">Primes et revenus exceptionnels</p>
                  <div className="space-y-2">{exceptionalItems.map(renderItem)}</div>
                </>
              )}
            </>
          )}

          {savedNote && (
            <div className="bg-[#3b82f6]/15 border border-[#3b82f6]/40 rounded-[14px] px-4 py-3 flex items-center gap-3">
              <p className="flex-1 text-[13px] text-[var(--text-primary)]">✓ {savedNote}</p>
              <button onClick={() => setSavedNote('')} aria-label="Fermer"><X size={14} color="var(--text-secondary)" /></button>
            </div>
          )}

          {upcoming.length > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 pt-2">À venir (12 mois)</p>
              <div className="bg-[var(--bg-surface)] rounded-[16px] divide-y divide-[var(--border-subtle)]">
                {upcoming.map(({ key, month, item }) => (
                  <div key={key} className="flex items-center px-4 py-3 gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                      <p className="text-[12px] text-[var(--text-secondary)]">{getMonthLabel(month)} · le {item.due_day}</p>
                    </div>
                    <p className="text-[14px] font-semibold text-[var(--text-primary)]">{fmt(item.amount)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!readOnly && <button onClick={openAdd}
        className="fixed right-4 w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="white" />
      </button>}

      {showModal && (
        <div className="fixed inset-0 bg-[var(--overlay)] z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[var(--bg-surface)] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[var(--bg-surface-3)] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{editItem ? 'Modifier' : 'Nouveau revenu'}</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center">
                <X size={14} color="var(--text-secondary)" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Nom</label>
                  <input className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] text-[var(--text-primary)] outline-none focus:border-[#3b82f6]"
                    placeholder="Salaire, Freelance…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] text-[var(--text-primary)] outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Fréquence</label>
                <div className="flex bg-[var(--bg-surface-2)] rounded-[12px] p-1 gap-1">
                  {([['monthly', 'Mensuel'], ['weekly', 'Hebdo'], ['annual', 'Annuel'], ['exceptional', 'Ponctuel']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setFFrequency(val)}
                      className={`flex-1 h-9 rounded-[9px] text-[12px] font-semibold transition-all ${fFrequency === val ? 'bg-[var(--text-primary)] text-[var(--bg-app)]' : 'text-[var(--text-secondary)]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {fFrequency !== 'weekly' ? (
                <div>
                  {fFrequency === 'exceptional' && (
                    <div className="mb-3">
                      <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Mois de versement</label>
                      <select value={fTargetMonth} onChange={e => setFTargetMonth(e.target.value)}
                        className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3 text-[16px] bg-[var(--bg-surface-2)] text-[var(--text-primary)] outline-none focus:border-[#3b82f6]">
                        {monthOptions.map(mk => <option key={mk} value={mk}>{getMonthLabel(mk)}</option>)}
                      </select>
                      <p className="text-[12px] text-[var(--text-secondary)] mt-2">Compté uniquement sur ce mois, jamais reporté sur les autres.</p>
                    </div>
                  )}
                  {fFrequency === 'annual' && (
                    <div className="mb-3">
                      <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Mois de versement (chaque année)</label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {MONTH_NAMES_SHORT.map((name, i) => {
                          const on = fAnnualMonths.includes(i + 1)
                          return (
                            <button key={name} onClick={() => setFAnnualMonths(prev => on ? prev.filter(m => m !== i + 1) : [...prev, i + 1])}
                              className={`h-9 rounded-[9px] text-[12px] font-medium transition-all border ${on ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#93c5fd]' : 'border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]'}`}>
                              {name}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] mt-2">Ex : 13e mois en Juin et Nov. Le montant est celui de chaque versement.</p>
                    </div>
                  )}
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Jour de réception</label>
                  <input type="number" min="1" max="31"
                    className="w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] text-[var(--text-primary)] outline-none focus:border-[#3b82f6]"
                    placeholder="Ex : 28" value={fDay} onChange={e => setFDay(e.target.value)} />
                </div>
              ) : (
                <div>
                  <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Jour de la semaine</label>
                  <div className="grid grid-cols-4 gap-2">
                    {WEEKDAY_NAMES.map((name, i) => (
                      <button key={name} onClick={() => setFWeekday(i + 1)}
                        className={`h-10 rounded-[10px] text-[13px] font-medium transition-all border ${fWeekday === i + 1 ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#93c5fd]' : 'border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]'}`}>
                        {name}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-2">Compté automatiquement 4 ou 5 fois selon le mois.</p>
                </div>
              )}

              <div>
                <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {INCOME_ICONS.map(icon => (
                    <button key={icon} onClick={() => setFIcon(icon)}
                      className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-lg ${fIcon === icon ? 'ring-2 ring-[#3b82f6]' : ''}`}
                      style={{ background: fColor }}>{icon}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Couleur</label>
                <div className="flex gap-2">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setFColor(color)}
                      className={`w-8 h-8 rounded-full ${fColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-surface)] ring-[#3b82f6]' : ''}`}
                      style={{ background: color }} />
                  ))}
                </div>
              </div>
              {isEditingRecurring && (
                <p className="text-[12px] text-[var(--text-secondary)] bg-[var(--bg-surface-2)] rounded-[10px] px-3 py-2">
                  Un changement de montant ou de date s&apos;applique à partir de {getMonthLabel(monthKey)}. Les mois précédents gardent l&apos;ancien montant.
                </p>
              )}
              <button onClick={saveItem} disabled={saving || !fName || !fAmount || (fFrequency !== 'weekly' && !fDay) || (fFrequency === 'annual' && fAnnualMonths.length === 0)}
                className="w-full h-12 bg-[#3b82f6] text-[var(--text-primary)] rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editItem ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

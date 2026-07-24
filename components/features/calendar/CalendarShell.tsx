'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, Check, Pencil } from 'lucide-react'

interface Props { workspaceId: string }

interface FixedItem {
  id: string
  type: 'charge' | 'income'
  name: string
  amount: number
  due_day: number
  icon: string
  color: string | null
  is_active: boolean
  category: string
}

interface ItemStatus {
  fixed_item_id: string
  is_done: boolean
}

const CATEGORIES = [
  { id: 'Logement',    icon: '🏠', color: '#fff3e0' },
  { id: 'Énergie',     icon: '⚡', color: '#fff8e6' },
  { id: 'Telecom',     icon: '📡', color: '#e8f4ff' },
  { id: 'Abonnements', icon: '🎵', color: '#f3f0ff' },
  { id: 'Transport',   icon: '🚗', color: '#f0f7ff' },
  { id: 'Santé',       icon: '💊', color: '#e8faf0' },
  { id: 'Assurances',  icon: '🛡️', color: '#fef0f5' },
  { id: 'Banque',      icon: '🏦', color: '#f0fff4' },
  { id: 'Autre',       icon: '📦', color: '#f5f5f7' },
]

const CHARGE_ICONS = ['🏠','⚡','📡','🎵','📺','💊','🚗','🏋️','📱','🔥','💧','🛡️','📦']
const INCOME_ICONS = ['💵','💼','🏦','💻','🎨','📊','🏪','💰']
const COLORS = ['#fff3e0','#f3f0ff','#e8faf0','#e8f4ff','#fef0f5','#fff8e6','#f0f7ff','#f5f5f7']

export default function CalendarShell({ workspaceId }: Props) {
  const { monthKey } = useMonth()
  const [items, setItems] = useState<FixedItem[]>([])
  const [statuses, setStatuses] = useState<ItemStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<FixedItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'charge' | 'income'>('charge')

  // Form
  const [fName, setFName] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDay, setFDay] = useState('')
  const [fDayMode, setFDayMode] = useState<'fixed' | 'end'>('fixed')
  const [fIcon, setFIcon] = useState('📌')
  const [fColor, setFColor] = useState('#f5f5f7')
  const [fType, setFType] = useState<'charge' | 'income'>('charge')
  const [fCategory, setFCategory] = useState('Autre')

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const [year, monthNum] = monthKey.split('-').map(Number)
  const isCurrentMonth = year === today.getFullYear() && monthNum - 1 === today.getMonth()
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const firstDayOfWeek = (() => { const d = new Date(year, monthNum - 1, 1).getDay(); return d === 0 ? 6 : d - 1 })()

  async function fetchData() {
    setLoading(true)
    const pb = createClient()
    const [fixedItems, monthStatuses] = await Promise.all([
      pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && is_active=true`, sort: 'due_day' }),
      pb.collection('fixed_item_status').getFullList({ filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"` }),
    ])
    setItems((fixedItems ?? []) as any)
    setStatuses((monthStatuses ?? []) as any)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [monthKey, workspaceId])

  function isDone(itemId: string) {
    return statuses.find(s => s.fixed_item_id === itemId)?.is_done ?? false
  }

  async function toggleDone(item: FixedItem) {
    const pb = createClient()
    const current = isDone(item.id)
    const existing: any = statuses.find((s: any) => s.fixed_item_id === item.id)
    if (existing?.id) {
      await pb.collection('fixed_item_status').update(existing.id, {
        is_done: !current,
        done_at: !current ? new Date().toISOString() : null,
      })
    } else {
      await pb.collection('fixed_item_status').create({
        fixed_item_id: item.id,
        workspace_id: workspaceId,
        month_key: monthKey,
        is_done: !current,
        done_at: !current ? new Date().toISOString() : null,
      })
    }
    setStatuses(prev => {
      const exists = prev.find(s => s.fixed_item_id === item.id)
      if (exists) return prev.map(s => s.fixed_item_id === item.id ? { ...s, is_done: !current } : s)
      return [...prev, { fixed_item_id: item.id, is_done: !current }]
    })
  }

  function openAdd(type: 'charge' | 'income') {
    setFType(type); setFName(''); setFAmount(''); setFDay('')
    setFDayMode('fixed'); setFCategory('Autre')
    setFIcon(type === 'charge' ? '🏠' : '💵'); setFColor('#fff3e0')
    setEditItem(null); setShowModal(true)
  }

  function openEdit(item: FixedItem) {
    setFType(item.type); setFName(item.name); setFAmount(String(item.amount))
    if (item.due_day < 0) {
      setFDayMode('end'); setFDay(String(Math.abs(item.due_day)))
    } else {
      setFDayMode('fixed'); setFDay(String(item.due_day))
    }
    setFIcon(item.icon); setFColor(item.color ?? '#f5f5f7')
    setFCategory(item.category ?? 'Autre')
    setEditItem(item); setShowModal(true)
  }

  async function saveItem() {
    if (!fName.trim() || !fAmount || !fDay) return
    setSaving(true)
    const pb = createClient()
    // due_day négatif pour "fin du mois - X jours"
    const dueDayValue = fDayMode === 'end' ? -Math.abs(parseInt(fDay)) : parseInt(fDay)
    const payload = {
      workspace_id: workspaceId,
      type: fType,
      name: fName.trim(),
      amount: parseFloat(fAmount),
      due_day: dueDayValue,
      icon: fType === 'charge' ? (CATEGORIES.find(c => c.id === fCategory)?.icon ?? fIcon) : fIcon,
      color: fType === 'charge' ? (CATEGORIES.find(c => c.id === fCategory)?.color ?? fColor) : fColor,
      category: fCategory,
      is_active: true,
    }
    if (editItem) {
      await pb.collection('fixed_items').update(editItem.id, payload)
    } else {
      await pb.collection('fixed_items').create(payload)
    }
    setSaving(false); setShowModal(false); fetchData()
  }

  async function deleteItem(id: string) {
    const pb = createClient()
    await pb.collection('fixed_items').update(id, { is_active: false })
    fetchData()
  }

  const charges = items.filter(i => i.type === 'charge')
  const incomes = items.filter(i => i.type === 'income')

  // Calcule le vrai jour du mois depuis due_day (négatif = fin du mois - X)
  function realDay(due_day: number) {
    if (due_day >= 0) return Math.min(due_day, daysInMonth)
    return Math.max(1, daysInMonth + due_day + 1) // ex: -2 → dernier-1
  }

  const totalCharges = charges.reduce((s, i) => s + i.amount, 0)
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const paidCharges = charges.filter(i => isDone(i.id)).reduce((s, i) => s + i.amount, 0)
  const lateCharges = isCurrentMonth ? charges.filter(i => {
    const due = new Date(year, monthNum - 1, realDay(i.due_day)); due.setHours(0,0,0,0)
    return due < today && !isDone(i.id)
  }) : []

  function itemsForDay(day: number) {
    return items.filter(i => realDay(i.due_day) === day)
  }

  function getDayStatus(item: FixedItem) {
    if (isDone(item.id)) return 'done'
    const due = new Date(year, monthNum - 1, realDay(item.due_day)); due.setHours(0,0,0,0)
    if (item.type === 'income') return due <= today ? 'due' : 'future'
    return due < today ? 'late' : 'future'
  }

  const displayItems = tab === 'charge' ? charges : incomes
  const selectedItems = selectedDay ? itemsForDay(selectedDay) : []

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Calendrier</h1>
            <p className="text-[13px] text-[#8e8e93]">
              {lateCharges.length > 0 ? `⚠ ${lateCharges.length} en retard` : charges.filter(i => !isDone(i.id)).length === 0 && charges.length > 0 ? 'Toutes payées ✓' : `${charges.length} charge${charges.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="mt-1"><MonthPicker /></div>
        </div>

        {/* Pills résumé */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium bg-[#f87171]/15 text-[#f87171]">
            Charges {fmt(totalCharges)}
          </span>
          <span className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium bg-[#34d399]/15 text-[#34d399]">
            Revenus {fmt(totalIncome)}
          </span>
          {paidCharges > 0 && (
            <span className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium bg-[#2c2c2e] text-[#8e8e93]">
              ✓ {fmt(paidCharges)} payé
            </span>
          )}
          {lateCharges.length > 0 && (
            <span className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium bg-[#fbbf24]/15 text-[#fbbf24]">
              Reste {fmt(totalCharges - paidCharges)}
            </span>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-4 space-y-3">

          {/* Grille calendrier */}
          <div className="bg-[#1c1c1e] rounded-[20px] p-3">
            <div className="grid grid-cols-7 mb-1">
              {['L','M','M','J','V','S','D'].map((d, i) => (
                <div key={i} className={`text-center text-[11px] font-semibold py-1 ${i >= 5 ? 'text-[#f87171]' : 'text-[#8e8e93]'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const date = new Date(year, monthNum - 1, day); date.setHours(0,0,0,0)
                const isToday = isCurrentMonth && date.getTime() === today.getTime()
                const isPast = date < today && !isToday
                const dayItems = itemsForDay(day)
                const isSelected = selectedDay === day
                const dayCharges = dayItems.filter(x => x.type === 'charge')
                const dayIncomes = dayItems.filter(x => x.type === 'income')

                return (
                  <div key={day} onClick={() => dayItems.length ? setSelectedDay(isSelected ? null : day) : null}
                    className={`rounded-[8px] p-0.5 flex flex-col items-center min-h-[52px] transition-colors ${dayItems.length ? 'cursor-pointer active:bg-[#2c2c2e]' : ''} ${isSelected ? 'bg-[#2c2c2e]' : ''}`}>
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium mb-0.5 ${isToday ? 'bg-[#3b82f6] text-white' : isPast ? 'text-[#5a5a5e]' : 'text-white'}`}>
                      {day}
                    </div>
                    <div className="flex flex-col gap-0.5 w-full">
                      {dayCharges.slice(0, 1).map(c => (
                        <div key={c.id} className={`w-full rounded-[3px] text-[8px] font-semibold px-0.5 leading-[1.4] truncate
                          ${isDone(c.id) ? 'bg-[#34d399]/20 text-[#34d399]' : getDayStatus(c) === 'late' ? 'bg-[#f87171]/20 text-[#f87171]' : 'bg-[#fbbf24]/20 text-[#fbbf24]'}`}>
                          {c.icon} {c.name.slice(0, 4)}
                        </div>
                      ))}
                      {dayIncomes.slice(0, 1).map(c => (
                        <div key={c.id} className={`w-full rounded-[3px] text-[8px] font-semibold px-0.5 leading-[1.4] truncate bg-[#60a5fa]/20 text-[#60a5fa]`}>
                          {c.icon} {c.name.slice(0, 4)}
                        </div>
                      ))}
                      {dayItems.length > 2 && <div className="text-[8px] text-[#8e8e93] text-center">+{dayItems.length - 2}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Détail jour sélectionné */}
          {selectedDay && selectedItems.length > 0 && (
            <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <p className="text-[15px] font-semibold text-white">
                  {new Date(year, monthNum - 1, selectedDay).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }).replace(/^\w/, c => c.toUpperCase())}
                </p>
                <button onClick={() => setSelectedDay(null)} className="w-6 h-6 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                  <X size={12} color="#8e8e93" />
                </button>
              </div>
              {selectedItems.map((item, i) => {
                const status = getDayStatus(item)
                const done = isDone(item.id)
                return (
                  <div key={item.id} className={`flex items-center px-4 py-3.5 gap-3 ${i < selectedItems.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="w-10 h-10 rounded-[11px] flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: item.color ?? '#2c2c2e' }}>{item.icon}</div>
                    <div className="flex-1">
                      <p className="text-[15px] font-medium text-white">{item.name}</p>
                      <p className={`text-[12px] font-medium ${item.type === 'income' ? 'text-[#34d399]' : done ? 'text-[#34d399]' : status === 'late' ? 'text-[#f87171]' : 'text-[#8e8e93]'}`}>
                        {item.type === 'income' ? '+' : '−'}{fmt(item.amount)}
                      </p>
                    </div>
                    <button onClick={() => toggleDone(item)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${done ? 'bg-[#34c759]' : status === 'late' ? 'bg-[#f87171]/15 border border-[#f87171]' : 'bg-[#2c2c2e] border border-white/10'}`}>
                      <Check size={15} color={done ? 'white' : status === 'late' ? '#f87171' : '#5a5a5e'} strokeWidth={2.5} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tabs Charges / Revenus */}
          <div className="flex bg-[#1c1c1e] rounded-[16px] p-1 gap-1">
            {(['charge', 'income'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 h-9 rounded-[12px] text-[14px] font-semibold transition-all ${tab === t ? 'bg-white text-black' : 'text-[#8e8e93]'}`}>
                {t === 'charge' ? `🏠 Charges (${charges.length})` : `💵 Revenus (${incomes.length})`}
              </button>
            ))}
          </div>

          {/* Liste */}
          {displayItems.length > 0 ? (
            <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
              {displayItems.map((item, i) => {
                const status = getDayStatus(item)
                const done = isDone(item.id)
                return (
                  <div key={item.id} className={`flex items-center px-4 py-3.5 gap-3 ${i < displayItems.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="w-10 h-10 rounded-[11px] flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: item.color ?? '#2c2c2e' }}>{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-white">{item.name}</p>
                      <p className={`text-[12px] font-medium ${done ? 'text-[#34d399]' : status === 'late' ? 'text-[#f87171]' : 'text-[#8e8e93]'}`}>
                        {item.type === 'charge' && item.category ? `${CATEGORIES.find(c => c.id === item.category)?.icon ?? ''} ${item.category} · ` : ''}
                        Le {item.due_day < 0 ? `fin du mois − ${Math.abs(item.due_day)}j (${realDay(item.due_day)})` : item.due_day} · {item.type === 'income' ? '+' : '−'}{fmt(item.amount)}
                        {done ? ' · ✓' : status === 'late' ? ' · En retard' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(item)}
                        className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                        <Pencil size={12} color="#8e8e93" />
                      </button>
                      <button onClick={() => deleteItem(item.id)}
                        className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                        <X size={12} color="#8e8e93" />
                      </button>
                      <button onClick={() => toggleDone(item)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${done ? 'bg-[#34c759]' : 'bg-[#2c2c2e] border border-white/10'}`}>
                        <Check size={13} color={done ? 'white' : '#5a5a5e'} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">{tab === 'charge' ? '🏠' : '💵'}</p>
              <p className="text-[15px] font-medium text-white">Aucun {tab === 'charge' ? 'abonnement' : 'revenu'}</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Appuie sur + pour en ajouter un</p>
            </div>
          )}
        </div>
      )}

      {/* FABs */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-40">
        <button onClick={() => openAdd('income')}
          className="w-12 h-12 bg-[#34c759] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          aria-label="Ajouter un revenu">
          <span className="text-white text-lg font-bold">+€</span>
        </button>
        <button onClick={() => openAdd('charge')}
          className="w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          aria-label="Ajouter une charge">
          <Plus size={24} color="white" />
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">
                {editItem ? 'Modifier' : fType === 'charge' ? 'Nouvel abonnement' : 'Nouveau revenu'}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Nom</label>
                  <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder={fType === 'charge' ? 'Netflix, Loyer…' : 'Salaire, Freelance…'}
                    value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Jour du mois</label>
                {/* Toggle fixe / fin de mois */}
                <div className="flex bg-[#2c2c2e] rounded-[10px] p-0.5 mb-2">
                  <button onClick={() => setFDayMode('fixed')}
                    className={`flex-1 h-8 rounded-[8px] text-[13px] font-medium transition-all ${fDayMode === 'fixed' ? 'bg-[#1c1c1e] text-white shadow-sm' : 'text-[#8e8e93]'}`}>
                    Jour fixe
                  </button>
                  <button onClick={() => setFDayMode('end')}
                    className={`flex-1 h-8 rounded-[8px] text-[13px] font-medium transition-all ${fDayMode === 'end' ? 'bg-[#1c1c1e] text-white shadow-sm' : 'text-[#8e8e93]'}`}>
                    Fin du mois − X
                  </button>
                </div>
                {fDayMode === 'fixed' ? (
                  <input type="number" min="1" max="31"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="Ex : 1 pour le 1er du mois" value={fDay} onChange={e => setFDay(e.target.value)} />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-[#8e8e93]">Fin du mois −</span>
                    <input type="number" min="0" max="15"
                      className="w-20 h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                      placeholder="2" value={fDay} onChange={e => setFDay(e.target.value)} />
                    <span className="text-[14px] text-[#8e8e93]">jours</span>
                  </div>
                )}
                {fDay && (
                  <p className="text-[12px] text-[#8e8e93] mt-1">
                    {fDayMode === 'fixed'
                      ? `→ Le ${fDay} de chaque mois`
                      : `→ Ex: janvier = le ${Math.max(1, 31 - Math.abs(parseInt(fDay || '0')))} · février = le ${Math.max(1, 28 - Math.abs(parseInt(fDay || '0')))}`
                    }
                  </p>
                )}
              </div>
              {fType === 'charge' && (
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Catégorie</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} onClick={() => setFCategory(cat.id)}
                        className={`h-10 rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] font-medium transition-all border ${fCategory === cat.id ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#93c5fd]' : 'border-white/10 bg-[#2c2c2e] text-[#8e8e93]'}`}>
                        <span>{cat.icon}</span>
                        <span className="truncate">{cat.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {(fType === 'charge' ? CHARGE_ICONS : INCOME_ICONS).map(icon => (
                    <button key={icon} onClick={() => setFIcon(icon)}
                      className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-lg ${fIcon === icon ? 'ring-2 ring-[#3b82f6]' : ''}`}
                      style={{ background: fColor }}>{icon}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Couleur</label>
                <div className="flex gap-2">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setFColor(color)}
                      className={`w-8 h-8 rounded-full ${fColor === color ? 'ring-2 ring-offset-2 ring-offset-[#1c1c1e] ring-[#3b82f6]' : ''}`}
                      style={{ background: color }} />
                  ))}
                </div>
              </div>
              <button onClick={saveItem} disabled={saving || !fName || !fAmount || !fDay}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
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

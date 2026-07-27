'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, Check, Pencil, CalendarDays, RotateCcw, Copy, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props { workspaceId: string; userId: string; categories: any[] }

interface Charge {
  id: string
  name: string
  amount: number
  due_day: number
  icon: string
  color: string | null
  category: string
  is_active: boolean
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

const CAT_ICONS: Record<string, string> = {
  Courses:'🛒', Sortie:'🎉', Resto:'🍽️', Essence:'⛽',
  Achat:'🛍️', Santé:'💊', Cadeau:'🎁', Plaisir:'✨', Autre:'📦',
}
const CAT_COLORS: Record<string, string> = {
  Courses:'#e8f4ff', Sortie:'#fef0f5', Resto:'#fff3e0', Essence:'#fff8e6',
  Achat:'#f0f7ff', Santé:'#e8faf0', Cadeau:'#fff0f5', Plaisir:'#f3f0ff', Autre:'#f5f5f7',
}

type Tab = 'courante' | 'fixe' | 'previsionnel'

export default function DepensesShell({ workspaceId, userId, categories }: Props) {
  const router = useRouter()
  const { monthKey } = useMonth()
  const { month, envelopes, transactions, planned, loading: monthLoading, refetch } = useMonthData(monthKey, workspaceId)
  const [tab, setTab] = useState<Tab>('courante')

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Dépenses</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => router.push('/calendar')} className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center">
              <CalendarDays size={15} color="#8e8e93" />
            </button>
            <MonthPicker />
          </div>
        </div>
        <div className="flex bg-[#1c1c1e] rounded-[14px] p-1 gap-1">
          {([
            { id: 'courante', label: 'Courante' },
            { id: 'fixe', label: 'Fixe' },
            { id: 'previsionnel', label: 'Prévisionnel' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 h-8 rounded-[10px] text-[13px] font-semibold transition-all ${tab === t.id ? 'bg-white text-black' : 'text-[#8e8e93]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'courante' && (
        <CouranteTab workspaceId={workspaceId} userId={userId} monthKey={monthKey}
          month={month} envelopes={envelopes} planned={planned} transactions={transactions} categories={categories}
          loading={monthLoading} refetch={refetch} />
      )}
      {tab === 'fixe' && (
        <FixeTab workspaceId={workspaceId} monthKey={monthKey} />
      )}
      {tab === 'previsionnel' && (
        <PrevisionnelTab workspaceId={workspaceId} userId={userId} monthKey={monthKey}
          month={month} envelopes={envelopes} planned={planned} categories={categories}
          loading={monthLoading} refetch={refetch} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Onglet Courante : dépenses du quotidien (pas sur le calendrier)
// ─────────────────────────────────────────────────────────
function CouranteTab({ workspaceId, userId, month, envelopes, planned, transactions, categories, loading, refetch }: {
  workspaceId: string; userId: string; monthKey: string
  month: any; envelopes: any[]; planned: any[]; transactions: any[]; categories: any[]; loading: boolean; refetch: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))
  const [fCatId, setFCatId] = useState('')

  // Toutes les dépenses courantes = transactions hors charges fixes
  const courantes = useMemo(() => transactions
    .filter((t: any) => t.envelope_slug !== 'charges')
    .sort((a: any, b: any) => b.date.localeCompare(a.date)), [transactions])

  const total = courantes.reduce((s: number, t: any) => s + t.amount, 0)

  // Rappel : ce qu'il reste une fois le prévisionnel du mois retiré du revenu
  // (mêmes chiffres que l'onglet Budget > Prévisionnel), pour garder un œil dessus
  // avant d'ajouter une dépense courante.
  const restantPrevisionnel = useMemo(() => {
    const income = month?.income ?? 0
    const chargesBudget = envelopes?.find((e: any) => e.slug === 'charges')?.budget ?? 0
    const coursesBudget = envelopes?.find((e: any) => e.slug === 'courses')?.budget ?? 0
    const epargneBudget = envelopes?.find((e: any) => e.slug === 'epargne')?.budget ?? 0
    const totalPlannedPending = (planned ?? [])
      .filter((p: any) => !p.is_validated)
      .reduce((s: number, p: any) => s + p.amount, 0)
    return income - chargesBudget - totalPlannedPending - coursesBudget - epargneBudget
  }, [month, envelopes, planned])

  function openAdd() {
    setFLabel(''); setFAmount(''); setFDate(new Date().toISOString().slice(0, 10)); setFCatId('')
    setShowModal(true)
  }

  async function addTransaction() {
    const amount = parseFloat(fAmount)
    if (!fLabel.trim() || !amount || !month) return
    setSaving(true)
    const pb = createClient()
    const cat = categories.find((c: any) => c.id === fCatId)
    const envelopeSlug = cat?.name === 'Courses' ? 'courses' : 'plaisir'
    await pb.collection('transactions').create({
      month_id: month.id, workspace_id: workspaceId,
      envelope_slug: envelopeSlug, category_id: fCatId || null,
      label: fLabel.trim(), amount,
      date: fDate || new Date().toISOString().slice(0, 10), created_by: userId,
    })
    setSaving(false); setShowModal(false); refetch()
  }

  async function deleteTransaction(id: string) {
    setDeleting(id)
    const pb = createClient()
    await pb.collection('transactions').delete(id)
    setDeleting(null); refetch()
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          <div className="bg-[#1c1c1e] rounded-[20px] p-5">
            <p className="text-[13px] text-[#8e8e93] mb-1">Dépensé ce mois (courant)</p>
            <p className="text-[26px] font-bold text-white tracking-tight">{fmt(total)}</p>
          </div>

          <div className="bg-[#1c1c1e] rounded-[16px] px-4 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
              <Info size={15} color="#8e8e93" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[#8e8e93]">Restant prévisionnel du mois</p>
              <p className={`text-[16px] font-bold ${restantPrevisionnel >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{fmt(restantPrevisionnel)}</p>
            </div>
          </div>

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93] px-1">
            {courantes.length} dépense{courantes.length > 1 ? 's' : ''}
          </p>

          {courantes.length === 0 ? (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">💸</p>
              <p className="text-[15px] font-medium text-white">Aucune dépense courante</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Ex : boulangerie, essence… Appuie sur + pour en ajouter une</p>
            </div>
          ) : (
            <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
              {courantes.map((t: any, i: number) => {
                const catName = t.categories?.name ?? 'Autre'
                const icon = t.categories?.icon ?? CAT_ICONS[catName] ?? '📦'
                const bg = CAT_COLORS[catName] ?? '#2c2c2e'
                return (
                  <div key={t.id} className={`flex items-center px-4 py-3 gap-3 ${i < courantes.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0" style={{ background: bg }}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-white truncate">{t.label}</p>
                      <p className="text-[12px] text-[#8e8e93]">{catName} · {t.date}</p>
                    </div>
                    <p className="text-[15px] font-semibold text-[#f87171] flex-shrink-0">−{fmt(t.amount)}</p>
                    <button onClick={() => deleteTransaction(t.id)} disabled={deleting === t.id}
                      className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
                      {deleting === t.id ? <Loader2 size={11} className="animate-spin text-[#8e8e93]" /> : <X size={11} color="#8e8e93" />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <button onClick={openAdd}
        className="fixed right-4 w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="white" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Nouvelle dépense courante</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Libellé</label>
                <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="Ex : Boulangerie, essence…" value={fLabel} onChange={e => setFLabel(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0.00" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Date</label>
                  <input type="date"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Catégorie</label>
                <select className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none appearance-none"
                  value={fCatId} onChange={e => setFCatId(e.target.value)}>
                  <option value="">Sans catégorie</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon ?? CAT_ICONS[c.name] ?? '📦'} {c.name}</option>)}
                </select>
              </div>
              <button onClick={addTransaction} disabled={saving || !fLabel || !fAmount}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Onglet Fixe : abonnements / charges (apparaissent sur le calendrier)
// ─────────────────────────────────────────────────────────
function FixeTab({ workspaceId, monthKey }: { workspaceId: string; monthKey: string }) {
  const [items, setItems] = useState<Charge[]>([])
  const [statuses, setStatuses] = useState<{ fixed_item_id: string; id?: string; is_done: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Charge | null>(null)
  const [saving, setSaving] = useState(false)

  const [fName, setFName] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDay, setFDay] = useState('')
  const [fCategory, setFCategory] = useState('Autre')

  async function fetchData() {
    setLoading(true)
    const pb = createClient()
    const [charges, monthStatuses] = await Promise.all([
      pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && type="charge" && is_active=true`, sort: 'due_day' }),
      pb.collection('fixed_item_status').getFullList({ filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"` }),
    ])
    setItems((charges ?? []) as any)
    setStatuses((monthStatuses ?? []) as any)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [monthKey, workspaceId])

  function isDone(id: string) {
    return statuses.find(s => s.fixed_item_id === id)?.is_done ?? false
  }

  async function toggleDone(item: Charge) {
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
    setFName(''); setFAmount(''); setFDay(''); setFCategory('Autre')
    setEditItem(null); setShowModal(true)
  }

  function openEdit(item: Charge) {
    setFName(item.name); setFAmount(String(item.amount)); setFDay(String(item.due_day))
    setFCategory(item.category ?? 'Autre')
    setEditItem(item); setShowModal(true)
  }

  async function saveItem() {
    if (!fName.trim() || !fAmount || !fDay) return
    setSaving(true)
    const pb = createClient()
    const cat = CATEGORIES.find(c => c.id === fCategory)
    const payload = {
      workspace_id: workspaceId, type: 'charge', name: fName.trim(),
      amount: parseFloat(fAmount), due_day: parseInt(fDay),
      icon: cat?.icon ?? '📦', color: cat?.color ?? '#f5f5f7',
      category: fCategory, is_active: true,
    }
    if (editItem) await pb.collection('fixed_items').update(editItem.id, payload)
    else await pb.collection('fixed_items').create(payload)
    setSaving(false); setShowModal(false); fetchData()
  }

  async function deleteItem(id: string) {
    const pb = createClient()
    await pb.collection('fixed_items').update(id, { is_active: false })
    fetchData()
  }

  const total = items.reduce((s, i) => s + i.amount, 0)
  const paid = items.filter(i => isDone(i.id)).reduce((s, i) => s + i.amount, 0)
  const remain = total - paid

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-32 px-8 text-center">
          <p className="text-[15px] text-[#8e8e93]">Ajoutez un abonnement ou une charge en cliquant sur le +</p>
        </div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          <div className="bg-[#1c1c1e] rounded-[20px] p-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[13px] text-[#8e8e93] mb-1">Total charges</p>
                <p className="text-[26px] font-bold text-white tracking-tight">{fmt(total)}</p>
              </div>
              <p className="text-[13px] text-[#8e8e93]">{fmt(remain)} restant</p>
            </div>
            <div className="h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#34c759] transition-all" style={{ width: `${total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {items.map(item => {
              const done = isDone(item.id)
              const cat = CATEGORIES.find(c => c.id === item.category)
              return (
                <div key={item.id} className="bg-[#1c1c1e] rounded-[16px] flex items-center px-4 py-3.5 gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: item.color ?? '#2c2c2e' }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white">{item.name}</p>
                    <p className="text-[12px] text-[#8e8e93]">{cat ? `${cat.icon} ${cat.id} · ` : ''}{fmt(item.amount)} · le {item.due_day}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                      <Pencil size={11} color="#8e8e93" />
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                      <X size={11} color="#8e8e93" />
                    </button>
                    <button onClick={() => toggleDone(item)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${done ? 'bg-[#34c759]' : 'bg-[#2c2c2e] border border-white/10'}`}>
                      <Check size={14} color={done ? 'white' : '#5a5a5e'} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button onClick={openAdd}
        className="fixed right-4 w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="white" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">{editItem ? 'Modifier' : 'Nouvelle dépense fixe'}</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Nom</label>
                  <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="Loyer, Netflix…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Jour de prélèvement</label>
                <input type="number" min="1" max="31"
                  className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="Ex : 5" value={fDay} onChange={e => setFDay(e.target.value)} />
              </div>
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
              <button onClick={saveItem} disabled={saving || !fName || !fAmount || !fDay}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editItem ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Onglet Prévisionnel : dépenses planifiées → tap pour valider (devient Courante)
// ─────────────────────────────────────────────────────────
function PrevisionnelTab({ workspaceId, userId, monthKey, month, envelopes, planned, categories, loading, refetch }: {
  workspaceId: string; userId: string; monthKey: string
  month: any; envelopes: any[]; planned: any[]; categories: any[]; loading: boolean; refetch: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [validating, setValidating] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fCatId, setFCatId] = useState('')
  const [fRecurring, setFRecurring] = useState(false)

  const pending = planned.filter((p: any) => !p.is_validated)
  const validated = planned.filter((p: any) => p.is_validated)
  const totalPending = pending.reduce((s: number, p: any) => s + p.amount, 0)

  async function validateItem(item: any) {
    if (!month) return
    setValidating(item.id)
    const pb = createClient()
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
    if (item.validated_transaction_id) {
      await pb.collection('transactions').delete(item.validated_transaction_id)
    }
    await pb.collection('planned_expenses').update(item.id, {
      is_validated: false,
      validated_transaction_id: null,
    })
    setValidating(null)
    refetch()
  }

  async function savePlanned() {
    const amount = parseFloat(fAmount)
    if (!fLabel.trim() || !amount || !month) return
    setSaving(true)
    const pb = createClient()
    if (editingId) {
      const item = planned.find((p: any) => p.id === editingId)
      await pb.collection('planned_expenses').update(editingId, {
        label: fLabel.trim(), amount, category_id: fCatId || null, is_recurring: fRecurring,
      })
      // Si la dépense était déjà validée, on garde la transaction réelle synchronisée.
      if (item?.is_validated && item?.validated_transaction_id) {
        await pb.collection('transactions').update(item.validated_transaction_id, {
          label: fLabel.trim(), amount, category_id: fCatId || null,
        })
      }
    } else {
      await pb.collection('planned_expenses').create({
        month_id: month.id, label: fLabel.trim(), amount,
        category_id: fCatId || null, is_recurring: fRecurring, position: planned.length,
      })
    }
    setSaving(false); setShowModal(false); setEditingId(null); refetch()
  }

  function openEdit(item: any) {
    setEditingId(item.id)
    setFLabel(item.label); setFAmount(String(item.amount))
    setFCatId(item.category_id ?? ''); setFRecurring(item.is_recurring ?? false)
    setShowModal(true)
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
      filter: `workspace_id="${workspaceId}" && month_key="${prevKey}"`,
    })
    if (!prevMonths?.[0]) return
    const prevPlanned = await pb.collection('planned_expenses').getFullList({
      filter: `month_id="${prevMonths[0].id}" && is_recurring=true`,
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

  function openAdd() {
    setEditingId(null)
    setFLabel(''); setFAmount(''); setFCatId(''); setFRecurring(false); setShowModal(true)
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-3">
          <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-3.5 flex gap-3">
            <span className="text-lg mt-0.5">{planned.length === 0 ? '📋' : totalPending > 0 ? '⏳' : '✅'}</span>
            <p className="text-[13px] text-[#d1d1d6] leading-relaxed">
              {planned.length === 0
                ? 'Aucune dépense planifiée. Ajoute ce que tu prévois de dépenser.'
                : totalPending > 0
                ? <>{pending.length} dépense{pending.length > 1 ? 's' : ''} à valider · <strong className="text-white">{fmt(totalPending)}</strong> prévus. Appuie sur ✓ pour la faire passer en courante.</>
                : <>Tout est validé ce mois !</>
              }
            </p>
          </div>

          {planned.length === 0 && (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                  <Copy size={16} color="#60a5fa" />
                </div>
                <p className="text-[13px] text-[#d1d1d6]">Copier les récurrents du mois précédent ?</p>
              </div>
              <button onClick={copyPrevMonth}
                className="px-3 py-1.5 bg-[#2c2c2e] rounded-[10px] text-[13px] font-medium text-white active:scale-95 whitespace-nowrap">
                Copier
              </button>
            </div>
          )}

          {pending.length > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93] px-1">À valider</p>
              <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
                {pending.map((p: any, i: number) => (
                  <PlannedRow key={p.id} item={p} isLast={i === pending.length - 1}
                    deleting={deleting === p.id} validating={validating === p.id}
                    onDelete={() => deletePlanned(p.id)}
                    onEdit={() => openEdit(p)}
                    onValidate={() => validateItem(p)} />
                ))}
              </div>
            </>
          )}

          {validated.length > 0 && (
            <>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93] px-1">Validés ✓</p>
              <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
                {validated.map((p: any, i: number) => (
                  <PlannedRow key={p.id} item={p} isLast={i === validated.length - 1}
                    deleting={deleting === p.id} validating={validating === p.id}
                    onDelete={() => deletePlanned(p.id)}
                    onEdit={() => openEdit(p)}
                    onUnvalidate={() => unvalidateItem(p)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={openAdd}
        className="fixed right-4 w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="white" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">{editingId ? 'Modifier la dépense' : 'Nouvelle dépense prévue'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Libellé</label>
                <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="Ex : Cinéma, essence…" value={fLabel} onChange={e => setFLabel(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Catégorie</label>
                  <select className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none appearance-none"
                    value={fCatId} onChange={e => setFCatId(e.target.value)}>
                    <option value="">Sans catégorie</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[15px] text-white">Récurrent (chaque mois)</span>
                <button onClick={() => setFRecurring(!fRecurring)}
                  className="relative flex-shrink-0"
                  style={{ width: 44, height: 26, borderRadius: 13, background: fRecurring ? '#34c759' : '#3a3a3c' }}>
                  <span className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow transition-transform ${fRecurring ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>
              <button onClick={savePlanned} disabled={saving || !fLabel || !fAmount}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlannedRow({ item, isLast, deleting, validating, onDelete, onEdit, onValidate, onUnvalidate }: {
  item: any; isLast: boolean; deleting: boolean; validating: boolean
  onDelete: () => void; onEdit: () => void; onValidate?: () => void; onUnvalidate?: () => void
}) {
  const catName = item.categories?.name ?? 'Autre'
  const icon = item.categories?.icon ?? CAT_ICONS[catName] ?? '📦'
  const bg = CAT_COLORS[catName] ?? '#2c2c2e'
  const validated = item.is_validated

  return (
    <div className={`flex items-center px-4 py-3.5 gap-3 ${!isLast ? 'border-b border-white/5' : ''} ${validated ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0" style={{ background: bg }}>
        {validated ? '✓' : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-medium truncate ${validated ? 'line-through text-[#8e8e93]' : 'text-white'}`}>{item.label}</p>
        <p className="text-[12px] text-[#8e8e93]">{catName}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.is_recurring && !validated && (
          <span className="flex items-center gap-1 text-[11px] font-semibold bg-[#1e3a5f] text-[#60a5fa] px-2 py-0.5 rounded-full">
            <RotateCcw size={10} />↺
          </span>
        )}
        <p className={`text-[15px] font-semibold ${validated ? 'text-[#8e8e93]' : 'text-[#f87171]'}`}>−{fmt(item.amount)}</p>

        <button onClick={onEdit}
          className="w-6 h-6 rounded-full bg-[#2c2c2e] flex items-center justify-center active:scale-95">
          <Pencil size={10} color="#8e8e93" />
        </button>

        {!validated ? (
          <button onClick={onValidate} disabled={validating}
            className="w-7 h-7 rounded-full bg-[#34d399]/15 border border-[#34c759] flex items-center justify-center active:scale-95 transition-transform">
            {validating ? <Loader2 size={12} className="animate-spin text-[#34c759]" /> : <Check size={13} color="#34c759" strokeWidth={2.5} />}
          </button>
        ) : (
          <button onClick={onUnvalidate} disabled={validating}
            className="w-7 h-7 rounded-full bg-[#34c759] flex items-center justify-center active:scale-95 transition-transform">
            {validating ? <Loader2 size={12} className="animate-spin text-white" /> : <Check size={13} color="white" strokeWidth={2.5} />}
          </button>
        )}

        {!validated && (
          <button onClick={onDelete} disabled={deleting}
            className="w-6 h-6 rounded-full bg-[#2c2c2e] flex items-center justify-center active:scale-95">
            {deleting ? <Loader2 size={11} className="animate-spin text-[#8e8e93]" /> : <X size={11} color="#8e8e93" />}
          </button>
        )}
      </div>
    </div>
  )
}

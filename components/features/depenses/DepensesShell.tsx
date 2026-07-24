'use client'

import { useState, useEffect } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, Check, Pencil, CalendarDays } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props { workspaceId: string }

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

export default function DepensesShell({ workspaceId }: Props) {
  const router = useRouter()
  const { monthKey } = useMonth()
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
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Dépenses fixes</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => router.push('/calendar')} className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center">
              <CalendarDays size={15} color="#8e8e93" />
            </button>
            <MonthPicker />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-32 px-8 text-center">
          <p className="text-[15px] text-[#8e8e93]">Ajoutez des dépenses en cliquant sur le +</p>
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
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
                  <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="Loyer, Netflix…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Jour de prélèvement</label>
                <input type="number" min="1" max="31"
                  className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
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
    </div>
  )
}

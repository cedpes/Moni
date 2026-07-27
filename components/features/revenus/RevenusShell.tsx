'use client'

import { useState, useEffect } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
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
}

const INCOME_ICONS = ['💵', '💼', '🏦', '💻', '🎨', '📊', '🏪', '💰']
const COLORS = ['#fff3e0', '#f3f0ff', '#e8faf0', '#e8f4ff', '#fef0f5', '#fff8e6', '#f0f7ff', '#f5f5f7']

export default function RevenusShell({ workspaceId, userId }: Props) {
  const { monthKey } = useMonth()
  const { month, transactions, refetch: refetchMonth } = useMonthData(monthKey, workspaceId)
  const [items, setItems] = useState<Income[]>([])
  const [statuses, setStatuses] = useState<{ fixed_item_id: string; id?: string; is_done: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Income | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPct, setShowPct] = useState(false)

  const [fName, setFName] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDay, setFDay] = useState('')
  const [fIcon, setFIcon] = useState('💵')
  const [fColor, setFColor] = useState('#e8faf0')

  // Revenus variables : paiements reçus au fil de l'eau (ex: paie hebdo imprévisible),
  // logués comme des transactions avec envelope_slug = 'revenu'.
  const [showVarModal, setShowVarModal] = useState(false)
  const [varSaving, setVarSaving] = useState(false)
  const [varDeleting, setVarDeleting] = useState<string | null>(null)
  const [vLabel, setVLabel] = useState('')
  const [vAmount, setVAmount] = useState('')
  const [vDate, setVDate] = useState(new Date().toISOString().slice(0, 10))

  const variableEntries = transactions
    .filter((t: any) => t.envelope_slug === 'revenu')
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
  const variableTotal = variableEntries.reduce((s: number, t: any) => s + t.amount, 0)

  function openAddVar() {
    setVLabel(''); setVAmount(''); setVDate(new Date().toISOString().slice(0, 10)); setShowVarModal(true)
  }

  async function addVariableIncome() {
    const amount = parseFloat(vAmount)
    if (!vLabel.trim() || !amount || !month) return
    setVarSaving(true)
    const pb = createClient()
    await pb.collection('transactions').create({
      month_id: month.id, workspace_id: workspaceId,
      envelope_slug: 'revenu', label: vLabel.trim(), amount,
      date: vDate || new Date().toISOString().slice(0, 10), created_by: userId,
    })
    setVarSaving(false); setShowVarModal(false); refetchMonth()
  }

  async function deleteVariableIncome(id: string) {
    setVarDeleting(id)
    const pb = createClient()
    await pb.collection('transactions').delete(id)
    setVarDeleting(null); refetchMonth()
  }

  async function fetchData() {
    setLoading(true)
    try {
      const pb = createClient()
      const [incomes, monthStatuses] = await Promise.all([
        pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && type="income" && is_active=true`, sort: 'due_day' }),
        pb.collection('fixed_item_status').getFullList({ filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"` }),
      ])
      setItems((incomes ?? []) as any)
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
    setFName(''); setFAmount(''); setFDay(''); setFIcon('💵'); setFColor('#e8faf0')
    setEditItem(null); setShowModal(true)
  }

  function openEdit(item: Income) {
    setFName(item.name); setFAmount(String(item.amount)); setFDay(String(item.due_day))
    setFIcon(item.icon); setFColor(item.color ?? '#e8faf0')
    setEditItem(item); setShowModal(true)
  }

  async function saveItem() {
    if (!fName.trim() || !fAmount || !fDay) return
    setSaving(true)
    const pb = createClient()
    const payload = {
      workspace_id: workspaceId, type: 'income', name: fName.trim(),
      amount: parseFloat(fAmount), due_day: parseInt(fDay),
      icon: fIcon, color: fColor, category: 'Revenu', is_active: true,
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
  const data: Record<string, number> = {}
  items.forEach(i => { data[i.name] = (data[i.name] ?? 0) + i.amount })
  const pctData: Record<string, number> = {}
  Object.entries(data).forEach(([k, v]) => { pctData[k] = total > 0 ? Math.round((v / total) * 100) : 0 })

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Revenus</h1>
          <MonthPicker />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          <div className="bg-[#1c1c1e] rounded-[20px] p-5 flex items-center justify-between">
            <div>
              <p className="text-[13px] text-[#8e8e93] mb-1">Revenu total du mois</p>
              <p className="text-[26px] font-bold text-[#34d399] tracking-tight">{fmt(month?.income ?? (total + variableTotal))}</p>
            </div>
            <p className="text-[12px] text-[#8e8e93] text-right">Fixes {fmt(total)}<br />Variables {fmt(variableTotal)}</p>
          </div>

          <div className="bg-[#1c1c1e] rounded-[20px] p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[13px] text-[#8e8e93] mb-1">Revenus fixes</p>
                <p className="text-[26px] font-bold text-white tracking-tight">{fmt(total)}</p>
              </div>
              <button onClick={() => setShowPct(!showPct)}
                className="flex bg-[#2c2c2e] rounded-full p-0.5 text-[12px] font-semibold">
                <span className={`px-3 py-1 rounded-full ${!showPct ? 'bg-white text-black' : 'text-[#8e8e93]'}`}>€</span>
                <span className={`px-3 py-1 rounded-full ${showPct ? 'bg-white text-black' : 'text-[#8e8e93]'}`}>%</span>
              </button>
            </div>
            <DonutChart data={showPct ? pctData : data} total={showPct ? 100 : total} centerLabel="Total" />
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93]">Revenus variables (ce mois)</p>
            <button onClick={openAddVar} className="w-7 h-7 rounded-full bg-[#1c1c1e] flex items-center justify-center">
              <Plus size={13} color="#8e8e93" />
            </button>
          </div>

          {variableEntries.length === 0 ? (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-8 text-center">
              <p className="text-[28px] mb-2">💶</p>
              <p className="text-[14px] font-medium text-white">Aucun revenu variable ce mois</p>
              <p className="text-[12px] text-[#8e8e93] mt-1">Ex : paie hebdo. Appuie sur + pour en ajouter un</p>
            </div>
          ) : (
            <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
              {variableEntries.map((t: any, i: number) => (
                <div key={t.id} className={`flex items-center px-4 py-3 gap-3 ${i < variableEntries.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="w-9 h-9 rounded-[10px] bg-[#0f3d2e] flex items-center justify-center text-[16px] flex-shrink-0">💶</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white truncate">{t.label}</p>
                    <p className="text-[12px] text-[#8e8e93]">{new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <p className="text-[14px] font-semibold text-[#34d399] flex-shrink-0">+{fmt(t.amount)}</p>
                  <button onClick={() => deleteVariableIncome(t.id)} disabled={varDeleting === t.id}
                    className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
                    {varDeleting === t.id ? <Loader2 size={11} className="animate-spin text-[#8e8e93]" /> : <X size={11} color="#8e8e93" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93]">Historique des revenus fixes</p>
            <button onClick={openAdd} className="w-7 h-7 rounded-full bg-[#1c1c1e] flex items-center justify-center">
              <Settings2 size={13} color="#8e8e93" />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">💵</p>
              <p className="text-[15px] font-medium text-white">Aucun revenu</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Appuie sur + pour en ajouter un</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const done = isDone(item.id)
                return (
                  <div key={item.id} className="bg-[#1c1c1e] rounded-[16px] flex items-center px-4 py-3.5 gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: item.color ?? '#2c2c2e' }}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-white">{item.name}</p>
                      <p className="text-[12px] text-[#8e8e93]">{fmt(item.amount)} · le {item.due_day} de chaque mois</p>
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
              <h2 className="text-[18px] font-bold text-white">{editItem ? 'Modifier' : 'Nouveau revenu'}</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Nom</label>
                  <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="Salaire, Freelance…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Jour de réception</label>
                <input type="number" min="1" max="31"
                  className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="Ex : 28" value={fDay} onChange={e => setFDay(e.target.value)} />
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {INCOME_ICONS.map(icon => (
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

      {showVarModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowVarModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Revenu variable reçu</h2>
              <button onClick={() => setShowVarModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Libellé</label>
                <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="Ex : Paie Artemis" value={vLabel} onChange={e => setVLabel(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0.00" value={vAmount} onChange={e => setVAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Date</label>
                  <input type="date"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    value={vDate} onChange={e => setVDate(e.target.value)} />
                </div>
              </div>
              <button onClick={addVariableIncome} disabled={varSaving || !vLabel || !vAmount}
                className="w-full h-12 bg-[#34d399] text-[#0f3d2e] rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
                {varSaving && <Loader2 size={16} className="animate-spin" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

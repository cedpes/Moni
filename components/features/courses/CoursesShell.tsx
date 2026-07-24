'use client'

import { useState, useMemo } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, Settings2 } from 'lucide-react'
import { useMonthData } from '@/hooks/useMonthData'

interface Props { workspaceId: string; userId: string }

const STORES = ['Lidl', 'Carrefour', 'Leclerc', 'Aldi', 'Monoprix', 'Picard', 'Bio coop', 'Marché', 'Autre']
const STORE_ICONS: Record<string, string> = {
  'Lidl':'🛒','Carrefour':'🏪','Leclerc':'🛍️','Aldi':'🛒',
  'Monoprix':'🧺','Picard':'❄️','Bio coop':'🌿','Marché':'🥦','Autre':'🛒',
}
const STORE_COLORS: Record<string, string> = {
  'Lidl':'#fff3cd','Carrefour':'#d4edda','Leclerc':'#cce5ff','Aldi':'#fde8d8',
  'Monoprix':'#e2d9f3','Picard':'#cff4fc','Bio coop':'#d4f5e2','Marché':'#d4edda','Autre':'#f2f2f7',
}

function fmtShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function CoursesShell({ workspaceId, userId }: Props) {
  const { monthKey } = useMonth()
  const { month, transactions: allTx, loading, refetch } = useMonthData(monthKey, workspaceId)
  const transactions = allTx.filter((t: any) => t.envelope_slug === 'courses')

  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))
  const [tmpMonthly, setTmpMonthly] = useState('')

  const monthlyBudget = month?.courses_budget ?? 320

  const [year, monthNum] = monthKey.split('-').map(Number)
  const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, '0')}`

  const monthTransactions = useMemo(() => transactions
    .filter((t: any) => t.date >= monthStart && t.date <= monthEnd)
    .sort((a: any, b: any) => b.date.localeCompare(a.date)), [transactions, monthStart, monthEnd])

  const monthTotal = useMemo(() => monthTransactions
    .reduce((s: number, t: any) => s + t.amount, 0), [monthTransactions])
  const monthPct = monthlyBudget > 0 ? Math.min(100, Math.round(monthTotal / monthlyBudget * 100)) : 0
  const monthRemain = monthlyBudget - monthTotal
  const barColor = (pct: number) => pct < 70 ? '#34c759' : pct < 100 ? '#ff9f0a' : '#ff3b30'

  async function addTransaction() {
    const amount = parseFloat(fAmount)
    if (!fLabel.trim() || !amount || !month) return
    setSaving(true)
    const pb = createClient()
    await pb.collection('transactions').create({
      month_id: month.id, workspace_id: workspaceId,
      envelope_slug: 'courses', label: fLabel.trim(), amount,
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

  async function saveSettings() {
    if (!month) return
    const pb = createClient()
    await pb.collection('months').update(month.id, {
      courses_budget: parseFloat(tmpMonthly) || monthlyBudget,
    })
    setShowSettings(false); refetch()
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Courses</h1>
          </div>
          <div className="flex gap-2 mt-1">
            <MonthPicker />
            <button onClick={() => { setTmpMonthly(String(monthlyBudget)); setShowSettings(true) }}
              className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-[#8e8e93] active:scale-95 transition-transform">
              <Settings2 size={15} />
            </button>
            <button onClick={() => { setFLabel(''); setFAmount(''); setFDate(new Date().toISOString().slice(0, 10)); setShowModal(true) }}
              className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center active:scale-95 transition-transform">
              <Plus size={16} color="white" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-3">
          <div className="bg-[#1c1c1e] rounded-[20px] p-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[12px] text-[#8e8e93] mb-1">Dépensé ce mois</p>
                <p className="text-[30px] font-bold tracking-tight text-white leading-none">{fmt(monthTotal)}</p>
              </div>
              <p className="text-[15px] font-medium text-[#8e8e93] pb-1">/ {fmt(monthlyBudget)}</p>
            </div>
            <div className="h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width:`${monthPct}%`, background:barColor(monthPct) }} />
            </div>
            <div className="flex justify-between text-[12px] text-[#8e8e93]">
              <span>{monthPct}% utilisé</span>
              <span className={monthRemain < 0 ? 'text-[#ff3b30]' : ''}>{monthRemain >= 0 ? `${fmt(monthRemain)} restant` : `${fmt(-monthRemain)} dépassé`}</span>
            </div>
          </div>

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93] px-1">
            {monthTransactions.length} passage{monthTransactions.length > 1 ? 's' : ''}
          </p>
          <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
            {monthTransactions.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[32px] mb-3">🛒</p>
                <p className="text-[15px] font-medium text-white">Aucun passage</p>
                <p className="text-[13px] text-[#8e8e93] mt-1">Appuie sur + pour en ajouter un</p>
              </div>
            ) : monthTransactions.map((t: any, i: number) => (
              <div key={t.id} className={`flex items-center px-4 py-3 gap-3 ${i < monthTransactions.length - 1 ? 'border-b border-white/5' : ''}`}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0"
                  style={{ background: STORE_COLORS[t.label] ?? '#f2f2f7' }}>{STORE_ICONS[t.label] ?? '🛒'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-white">{t.label}</p>
                  <p className="text-[12px] text-[#8e8e93]">{fmtShort(t.date)}</p>
                </div>
                <p className="text-[15px] font-semibold text-white flex-shrink-0">{fmt(t.amount)}</p>
                <button onClick={() => deleteTransaction(t.id)} disabled={deleting === t.id}
                  className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
                  {deleting === t.id ? <Loader2 size={11} className="animate-spin text-[#8e8e93]" /> : <X size={11} color="#86868b" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => { setFLabel(''); setFAmount(''); setFDate(new Date().toISOString().slice(0, 10)); setShowModal(true) }}
        className="fixed right-4 w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="white" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Ajouter un passage</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center"><X size={14} color="#86868b" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Magasin</label>
                <select className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none appearance-none"
                  value={fLabel} onChange={e => setFLabel(e.target.value)}>
                  <option value="">Choisir…</option>
                  {STORES.map(s => <option key={s} value={s}>{STORE_ICONS[s]} {s}</option>)}
                </select>
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
              <button onClick={addTransaction} disabled={saving || !fLabel || !fAmount}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Paramètres courses</h2>
              <button onClick={() => setShowSettings(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center"><X size={14} color="#86868b" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Budget mensuel (€)</label>
                <input type="number" min="0"
                  className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  value={tmpMonthly} onChange={e => setTmpMonthly(e.target.value)} />
              </div>
              <button onClick={saveSettings} className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] active:scale-[0.98] transition-all">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

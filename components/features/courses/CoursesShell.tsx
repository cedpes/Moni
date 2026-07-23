'use client'

import { useState, useMemo, useCallback } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, Settings2, Check } from 'lucide-react'
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

function getWeeksOfMonth(year: number, month: number) {
  const weeks: { idx: number; start: Date; end: Date }[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  let cur = new Date(first), wStart = new Date(first), wIdx = 1
  while (cur <= last) {
    if (cur.getDay() === 0 && cur > wStart) {
      weeks.push({ idx: wIdx++, start: new Date(wStart), end: new Date(cur.getTime() - 86400000) })
      wStart = new Date(cur)
    }
    cur = new Date(cur.getTime() + 86400000)
  }
  weeks.push({ idx: wIdx, start: new Date(wStart), end: new Date(last) })
  return weeks
}

function dateInWeek(dateStr: string, w: { start: Date; end: Date }) {
  const d = new Date(dateStr); d.setHours(12)
  const s = new Date(w.start); s.setHours(0)
  const e = new Date(w.end); e.setHours(23, 59, 59)
  return d >= s && d <= e
}

function fmtShort(d: Date) { return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) }

export default function CoursesShell({ workspaceId, userId }: Props) {
  const { monthKey } = useMonth()
  const { month, transactions: allTx, loading, refetch } = useMonthData(monthKey, workspaceId)
  const transactions = allTx.filter((t: any) => t.envelope_slug === 'courses')

  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10))
  const [tmpMonthly, setTmpMonthly] = useState('')
  const [tmpWeekly, setTmpWeekly] = useState('')

  const monthlyBudget = month?.courses_budget ?? 320
  const weeklyBudget = month?.courses_weekly_budget ?? 80

  const [year, monthNum] = monthKey.split('-').map(Number)
  const weeks = useMemo(() => getWeeksOfMonth(year, monthNum - 1), [year, monthNum])

  const today = useMemo(() => { const d = new Date(); d.setHours(12); return d }, [])
  const currentWeek = useMemo(() => weeks.find(w => {
    const s = new Date(w.start); s.setHours(0)
    const e = new Date(w.end); e.setHours(23, 59, 59)
    return today >= s && today <= e
  }) ?? null, [weeks, today])

  const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, '0')}`

  const monthTotal = useMemo(() => transactions
    .filter((t: any) => t.date >= monthStart && t.date <= monthEnd)
    .reduce((s: number, t: any) => s + t.amount, 0), [transactions, monthStart, monthEnd])
  const monthPct = monthlyBudget > 0 ? Math.min(100, Math.round(monthTotal / monthlyBudget * 100)) : 0
  const monthRemain = monthlyBudget - monthTotal

  const weekTotals = useMemo(() => {
    const map: Record<number, number> = {}
    weeks.forEach(w => { map[w.idx] = transactions.filter((t: any) => dateInWeek(t.date, w)).reduce((s: number, t: any) => s + t.amount, 0) })
    return map
  }, [weeks, transactions])

  const currentWeekTotal = currentWeek ? (weekTotals[currentWeek.idx] ?? 0) : 0
  const currentWeekPct = weeklyBudget > 0 ? Math.min(100, Math.round(currentWeekTotal / weeklyBudget * 100)) : 0
  const currentWeekRemain = weeklyBudget - currentWeekTotal
  const ringColor = currentWeekPct < 70 ? '#34c759' : currentWeekPct < 100 ? '#ff9f0a' : '#ff3b30'
  const barColor = (pct: number) => pct < 70 ? '#34c759' : pct < 100 ? '#ff9f0a' : '#ff3b30'
  const circ = 2 * Math.PI * 28
  const offset = circ - (circ * currentWeekPct / 100)

  const isFutureWeek = useCallback((w: { start: Date }) => {
    const t = new Date(); t.setHours(0, 0, 0, 0)
    const s = new Date(w.start); s.setHours(0, 0, 0, 0)
    return s > t
  }, [])

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
      courses_weekly_budget: parseFloat(tmpWeekly) || weeklyBudget,
    })
    setShowSettings(false); refetch()
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24">
      <header className="sticky top-0 z-10 bg-[#f5f5f7]/90 backdrop-blur-xl border-b border-black/[0.06] px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f] leading-tight">Courses</h1>
          </div>
          <div className="flex gap-2 mt-1">
            <MonthPicker />
            <button onClick={() => { setTmpMonthly(String(monthlyBudget)); setTmpWeekly(String(weeklyBudget)); setShowSettings(true) }}
              className="w-8 h-8 rounded-full bg-white border border-[#d1d1d6] flex items-center justify-center text-[#86868b] active:scale-95 transition-transform">
              <Settings2 size={15} />
            </button>
            <button onClick={() => { setFLabel(''); setFAmount(''); setShowModal(true) }}
              className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center active:scale-95 transition-transform">
              <Plus size={16} color="white" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#86868b]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-3">
          {currentWeek && (
            <div className="bg-white rounded-[20px] p-4 flex items-center gap-4">
              <div className="relative flex-shrink-0" style={{ width:72, height:72 }}>
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="28" fill="none" stroke="#f2f2f7" strokeWidth="6" />
                  <circle cx="36" cy="36" r="28" fill="none" stroke={ringColor} strokeWidth="6"
                    strokeDasharray={circ.toFixed(1)} strokeDashoffset={offset.toFixed(1)}
                    strokeLinecap="round" transform="rotate(-90 36 36)" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[14px] font-bold text-[#1d1d1f] leading-none">{currentWeekPct}%</span>
                  <span className="text-[9px] text-[#86868b]">semaine</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[12px] text-[#86868b] mb-1">Cette semaine</p>
                <p className="text-[26px] font-bold tracking-tight text-[#1d1d1f] leading-none mb-1">{fmt(currentWeekTotal)}</p>
                <p className={`text-[13px] font-medium ${currentWeekRemain >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {currentWeekRemain >= 0 ? `${fmt(currentWeekRemain)} restant` : `${fmt(-currentWeekRemain)} dépassé`}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[20px] p-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[12px] text-[#86868b] mb-1">Dépensé ce mois</p>
                <p className="text-[30px] font-bold tracking-tight text-[#1d1d1f] leading-none">{fmt(monthTotal)}</p>
              </div>
              <p className="text-[15px] font-medium text-[#86868b] pb-1">/ {fmt(monthlyBudget)}</p>
            </div>
            <div className="h-1.5 bg-[#f2f2f7] rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width:`${monthPct}%`, background:barColor(monthPct) }} />
            </div>
            <div className="flex justify-between text-[12px] text-[#86868b]">
              <span>{monthPct}% utilisé</span>
              <span className={monthRemain < 0 ? 'text-[#ff3b30]' : ''}>{monthRemain >= 0 ? `${fmt(monthRemain)} restant` : `${fmt(-monthRemain)} dépassé`}</span>
            </div>
          </div>

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#86868b] px-1">Par semaine</p>
          <div className="bg-white rounded-[20px] overflow-hidden">
            {weeks.map(w => {
              const total = weekTotals[w.idx] ?? 0
              const future = isFutureWeek(w)
              const pct = future ? 0 : Math.min(100, Math.round(total / weeklyBudget * 100))
              const isCurrent = currentWeek?.idx === w.idx
              const isExp = expanded === w.idx
              const txs = transactions.filter((t: any) => dateInWeek(t.date, w))
              const dotColor = future ? '#d1d1d6' : barColor(pct)

              return (
                <div key={w.idx}>
                  <div className={`flex items-center px-4 py-3.5 gap-3 border-b border-[#f2f2f7] cursor-pointer active:bg-[#f9f9f9] ${isExp ? 'bg-[#f9f9fa]' : ''}`}
                    onClick={() => {
                    setExpanded(isExp ? null : w.idx)
                    if (!isExp) setFDate(w.start.toISOString().slice(0, 10))
                  }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[15px] font-medium text-[#1d1d1f]">Semaine {w.idx}</p>
                        {isCurrent && <span className="text-[10px] font-semibold bg-[#e8f0ff] text-[#007aff] px-1.5 py-0.5 rounded-full">En cours</span>}
                      </div>
                      <p className="text-[12px] text-[#86868b]">{fmtShort(w.start)} – {fmtShort(w.end)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[15px] font-semibold text-[#1d1d1f]">{future ? '—' : fmt(total)}</p>
                      <p className="text-[11px] text-[#86868b]">/ {fmt(weeklyBudget)}</p>
                      <div className="h-1 bg-[#f2f2f7] rounded-full overflow-hidden mt-1 w-16 ml-auto">
                        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:dotColor }} />
                      </div>
                    </div>
                    <span className={`text-[#aeaeb2] text-lg transition-transform ${isExp ? 'rotate-180' : ''}`}>›</span>
                  </div>
                  {isExp && (
                    <div className="bg-[#f9f9fa] border-b border-[#f2f2f7]">
                      {txs.map((t: any) => (
                        <div key={t.id} className="flex items-center px-4 py-2.5 gap-3 border-b border-[#f2f2f7]">
                          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-base flex-shrink-0"
                            style={{ background: STORE_COLORS[t.label] ?? '#f2f2f7' }}>{STORE_ICONS[t.label] ?? '🛒'}</div>
                          <div className="flex-1">
                            <p className="text-[14px] font-medium text-[#1d1d1f]">{t.label}</p>
                            <p className="text-[11px] text-[#86868b]">{new Date(t.date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}</p>
                          </div>
                          <p className="text-[14px] font-semibold text-[#1d1d1f]">{fmt(t.amount)}</p>
                          <button onClick={() => deleteTransaction(t.id)} disabled={deleting === t.id}
                            className="w-6 h-6 rounded-full bg-[#f2f2f7] flex items-center justify-center ml-1">
                            {deleting === t.id ? <Loader2 size={10} className="animate-spin text-[#86868b]" /> : <X size={10} color="#86868b" />}
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <select className="flex-1 h-9 border border-[#d1d1d6] rounded-[10px] px-2.5 text-[13px] bg-white outline-none appearance-none min-w-0"
                          value={fLabel} onChange={e => setFLabel(e.target.value)}>
                          <option value="">Magasin…</option>
                          {STORES.map(s => <option key={s} value={s}>{STORE_ICONS[s]} {s}</option>)}
                        </select>
                        <input type="number" step="0.01" min="0" placeholder="€"
                          className="w-16 h-9 border border-[#d1d1d6] rounded-[10px] px-2 text-[13px] bg-white outline-none text-right"
                          value={fAmount} onChange={e => setFAmount(e.target.value)} />
                        <input type="date"
                          className="w-28 h-9 border border-[#d1d1d6] rounded-[10px] px-2 text-[11px] bg-white outline-none"
                          value={fDate}
                          min={w.start.toISOString().slice(0, 10)}
                          max={w.end.toISOString().slice(0, 10)}
                          onChange={e => setFDate(e.target.value)} />
                        <button onClick={addTransaction} disabled={saving || !fLabel || !fAmount}
                          className="w-9 h-9 bg-[#1d1d1f] rounded-[10px] flex items-center justify-center disabled:opacity-50 active:scale-95 flex-shrink-0">
                          {saving ? <Loader2 size={14} color="white" className="animate-spin" /> : <Check size={14} color="white" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button onClick={() => { setFLabel(''); setFAmount(''); setShowModal(true) }}
        className="fixed right-4 w-14 h-14 bg-[#1d1d1f] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
        <Plus size={24} color="white" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#d1d1d6] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-[#1d1d1f]">Ajouter un passage</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#f2f2f7] flex items-center justify-center"><X size={14} color="#86868b" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#86868b] block mb-1.5">Magasin</label>
                <select className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none appearance-none"
                  value={fLabel} onChange={e => setFLabel(e.target.value)}>
                  <option value="">Choisir…</option>
                  {STORES.map(s => <option key={s} value={s}>{STORE_ICONS[s]} {s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#86868b] block mb-1.5">Montant (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                    placeholder="0.00" value={fAmount} onChange={e => setFAmount(e.target.value)} />
                </div>
                <div>
                  <label className="text-[13px] text-[#86868b] block mb-1.5">Date</label>
                  <input type="date"
                    className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                    value={fDate} onChange={e => setFDate(e.target.value)} />
                </div>
              </div>
              <button onClick={addTransaction} disabled={saving || !fLabel || !fAmount}
                className="w-full h-12 bg-[#1d1d1f] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="bg-white rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#d1d1d6] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-[#1d1d1f]">Paramètres courses</h2>
              <button onClick={() => setShowSettings(false)} className="w-7 h-7 rounded-full bg-[#f2f2f7] flex items-center justify-center"><X size={14} color="#86868b" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#86868b] block mb-1.5">Budget mensuel (€)</label>
                <input type="number" min="0"
                  className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                  value={tmpMonthly} onChange={e => setTmpMonthly(e.target.value)} />
              </div>
              <div>
                <label className="text-[13px] text-[#86868b] block mb-1.5">Budget hebdomadaire (€)</label>
                <input type="number" min="0"
                  className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                  value={tmpWeekly} onChange={e => setTmpWeekly(e.target.value)} />
              </div>
              <button onClick={saveSettings} className="w-full h-12 bg-[#1d1d1f] text-white rounded-[14px] font-semibold text-[15px] active:scale-[0.98] transition-all">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

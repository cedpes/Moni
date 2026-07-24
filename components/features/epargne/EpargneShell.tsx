'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import DonutChart from '@/components/ui/DonutChart'
import { Plus, X, Loader2, Pencil } from 'lucide-react'

interface Props { workspaceId: string }

interface Goal {
  id: string
  name: string
  icon: string
  color: string | null
  target_amount: number
  current_amount: number
  is_active: boolean
}

const ICONS = ['💰', '🏖️', '🚨', '🏠', '🚗', '🎓', '🎁', '✈️']
const COLORS = ['#fff8e6', '#e8f4ff', '#f3f0ff', '#e8faf0', '#fef0f5', '#fff3e0']

export default function EpargneShell({ workspaceId }: Props) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Goal | null>(null)
  const [contribFor, setContribFor] = useState<Goal | null>(null)
  const [contribAmount, setContribAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const [fName, setFName] = useState('')
  const [fTarget, setFTarget] = useState('')
  const [fIcon, setFIcon] = useState('💰')
  const [fColor, setFColor] = useState('#fff8e6')

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const pb = createClient()
      const items = await pb.collection('savings_goals').getFullList({
        filter: `workspace_id="${workspaceId}" && is_active=true`,
        sort: '-created',
      })
      setGoals((items ?? []) as any)
    } catch (err: any) {
      console.error('EpargneShell fetchData error:', err)
      setError('La collection "savings_goals" n\'existe pas encore dans PocketBase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [workspaceId])

  function openAdd() {
    setFName(''); setFTarget(''); setFIcon('💰'); setFColor('#fff8e6')
    setEditItem(null); setShowModal(true)
  }

  function openEdit(g: Goal) {
    setFName(g.name); setFTarget(String(g.target_amount)); setFIcon(g.icon); setFColor(g.color ?? '#fff8e6')
    setEditItem(g); setShowModal(true)
  }

  async function saveGoal() {
    if (!fName.trim() || !fTarget) return
    setSaving(true)
    const pb = createClient()
    if (editItem) {
      await pb.collection('savings_goals').update(editItem.id, {
        name: fName.trim(), target_amount: parseFloat(fTarget), icon: fIcon, color: fColor,
      })
    } else {
      await pb.collection('savings_goals').create({
        workspace_id: workspaceId, name: fName.trim(), target_amount: parseFloat(fTarget),
        current_amount: 0, icon: fIcon, color: fColor, is_active: true,
      })
    }
    setSaving(false); setShowModal(false); fetchData()
  }

  async function deleteGoal(id: string) {
    const pb = createClient()
    await pb.collection('savings_goals').update(id, { is_active: false })
    fetchData()
  }

  async function addContribution() {
    if (!contribFor || !contribAmount) return
    const amount = parseFloat(contribAmount)
    if (!amount) return
    setSaving(true)
    const pb = createClient()
    await pb.collection('savings_goals').update(contribFor.id, {
      current_amount: contribFor.current_amount + amount,
    })
    setSaving(false); setContribFor(null); setContribAmount(''); fetchData()
  }

  const total = goals.reduce((s, g) => s + g.current_amount, 0)
  const data: Record<string, number> = {}
  goals.forEach(g => { data[g.name] = g.current_amount })

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Épargne</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : error ? (
        <div className="px-4 pt-10">
          <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-8 text-center">
            <p className="text-[32px] mb-3">⚠️</p>
            <p className="text-[15px] font-medium text-white">Collection manquante</p>
            <p className="text-[13px] text-[#8e8e93] mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          <div className="bg-[#1c1c1e] rounded-[20px] p-5">
            <p className="text-[13px] text-[#8e8e93] mb-1">Total</p>
            <p className="text-[26px] font-bold text-white tracking-tight mb-4">{fmt(total)}</p>
            <DonutChart data={data} total={total} centerLabel="Total" />
          </div>

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93] px-1">Objectifs d&apos;épargne</p>

          {goals.length === 0 ? (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">💰</p>
              <p className="text-[15px] font-medium text-white">Aucun objectif</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Appuie sur + pour en créer un</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map(g => {
                const pct = g.target_amount > 0 ? Math.min(100, Math.round(g.current_amount / g.target_amount * 100)) : 0
                return (
                  <div key={g.id} className="bg-[#1c1c1e] rounded-[16px] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: g.color ?? '#2c2c2e' }}>
                        {g.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-white">{g.name}</p>
                        <p className="text-[12px] text-[#8e8e93]">Objectif: {fmt(g.target_amount)} · Total épargné: {fmt(g.current_amount)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => openEdit(g)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                          <Pencil size={11} color="#8e8e93" />
                        </button>
                        <button onClick={() => deleteGoal(g.id)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                          <X size={11} color="#8e8e93" />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full bg-[#fbbf24] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-[#8e8e93]">{pct}% atteint</p>
                      <button onClick={() => { setContribFor(g); setContribAmount('') }}
                        className="w-8 h-8 rounded-full bg-[#fbbf24] flex items-center justify-center active:scale-95 transition-transform">
                        <Plus size={16} color="#1c1c1e" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!error && (
        <button onClick={openAdd}
          className="fixed right-4 w-14 h-14 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
          <Plus size={24} color="white" />
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">{editItem ? 'Modifier' : 'Nouvel objectif'}</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Nom</label>
                <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="Vacances, Fonds d'urgence…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Objectif (€)</label>
                <input type="number" step="0.01" min="0"
                  className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="0" value={fTarget} onChange={e => setFTarget(e.target.value)} />
              </div>
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(icon => (
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
              <button onClick={saveGoal} disabled={saving || !fName || !fTarget}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editItem ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contribFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setContribFor(null) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Ajouter à &quot;{contribFor.name}&quot;</h2>
              <button onClick={() => setContribFor(null)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                <X size={14} color="#8e8e93" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[13px] text-[#8e8e93] block mb-1.5">Montant (€)</label>
                <input type="number" step="0.01" min="0"
                  className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[15px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                  placeholder="0" value={contribAmount} onChange={e => setContribAmount(e.target.value)} autoFocus />
              </div>
              <button onClick={addContribution} disabled={saving || !contribAmount}
                className="w-full h-12 bg-[#fbbf24] text-[#1c1c1e] rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-1 disabled:opacity-50 active:scale-[0.98] transition-all">
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

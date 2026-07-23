'use client'

import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/pocketbase/client'
import { fmt, barColorHex } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Check, Pencil, Loader2, ChevronRight } from 'lucide-react'

const ICONS = ['🏠','✨','💰','🛒','🎉','🍽️','⛽','🎵','📺','💊','🚗','👕','🎮','✈️','🏋️','📦']
const COLORS = ['#fff3e0','#f3f0ff','#e8faf0','#e8f4ff','#fef0f5','#fff8e6','#f0f7ff','#f5f5f7']
const ENV_COLORS: Record<string, string> = {
  charges:'#fff3e0', plaisir:'#f3f0ff', epargne:'#e8faf0', courses:'#e8f4ff',
}

interface Props {
  workspaceId: string
  userId: string
  categories: any[]
}

export default function EnvelopesShell({ workspaceId, userId, categories }: Props) {
  const { monthKey, monthLabel } = useMonth()
  const { month, envelopes, transactions, loading, refetch } = useMonthData(monthKey, workspaceId)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fName, setFName] = useState('')
  const [fBudget, setFBudget] = useState('')
  const [fIcon, setFIcon] = useState('📦')
  const [fColor, setFColor] = useState('#f5f5f7')
  const [fDueDay, setFDueDay] = useState('')

  function spentFor(slug: string) {
    return transactions.filter((t: any) => t.envelope_slug === slug).reduce((s: number, t: any) => s + t.amount, 0)
  }

  function openAdd() {
    setFName(''); setFBudget(''); setFIcon('📦'); setFColor('#f5f5f7'); setFDueDay('')
    setEditingId(null); setShowAdd(true)
  }

  function openEdit(env: any) {
    setFName(env.name); setFBudget(String(env.budget)); setFIcon(env.icon)
    setFColor(env.color ?? '#f5f5f7'); setFDueDay(env.due_day ? String(env.due_day) : '')
    setEditingId(env.id); setShowAdd(true)
  }

  async function saveEnvelope() {
    if (!fName.trim() || !fBudget || !month) return
    setSaving(true)
    const pb = createClient()
    if (editingId) {
      await pb.collection('envelopes').update(editingId, {
        name: fName.trim(), budget: parseFloat(fBudget),
        icon: fIcon, color: fColor, due_day: fDueDay ? parseInt(fDueDay) : null,
      })
    } else {
      await pb.collection('envelopes').create({
        month_id: month.id, slug: fName.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        name: fName.trim(), budget: parseFloat(fBudget), icon: fIcon, color: fColor,
        due_day: fDueDay ? parseInt(fDueDay) : null, is_system: false, position: envelopes.length,
      })
    }
    setSaving(false); setShowAdd(false); refetch()
  }

  async function togglePaid(env: any) {
    const pb = createClient()
    await pb.collection('envelopes').update(env.id, { is_paid: !env.is_paid })
    refetch()
  }

  async function deleteEnvelope(id: string) {
    const pb = createClient()
    await pb.collection('envelopes').delete(id)
    refetch()
  }

  const income = month?.income ?? 0
  const totalSpent = transactions.reduce((s: number, t: any) => s + t.amount, 0)
  const reste = income - totalSpent

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-24">
      <header className="sticky top-0 z-10 bg-[#f5f5f7]/90 backdrop-blur-xl border-b border-black/[0.06] px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#1d1d1f] leading-tight">Enveloppes</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <MonthPicker />
            <button onClick={openAdd} className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center active:scale-95 transition-transform">
              <Plus size={16} color="white" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#86868b]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-3">
          {/* Résumé */}
          <div className="bg-white rounded-[20px] p-5">
            <div className="grid grid-cols-3 divide-x divide-[#f2f2f7]">
              {[
                { label: 'Revenus', value: fmt(income) },
                { label: 'Budgeté', value: fmt(envelopes.reduce((s: number, e: any) => s + e.budget, 0)) },
                { label: 'Dépensé', value: fmt(totalSpent), sub: reste >= 0 ? `${fmt(reste)} restant` : `${fmt(-reste)} dépassé` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="text-center px-2">
                  <p className="text-[11px] text-[#86868b] mb-1">{label}</p>
                  <p className="text-[16px] font-bold text-[#1d1d1f] tracking-tight">{value}</p>
                  {sub && <p className="text-[11px] text-[#86868b] mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Revenu */}
          {month && <RevenueCard month={month} onSaved={refetch} />}

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#86868b] px-1 pt-1">
            {envelopes.length} enveloppe{envelopes.length > 1 ? 's' : ''}
          </p>

          <div className="space-y-2">
            {envelopes.map((env: any) => {
              const spent = spentFor(env.slug)
              const remain = env.budget - spent
              const isPlaisir = env.slug === 'plaisir'
              const isCharges = env.slug === 'charges'

              // Plaisir = Revenus − Charges − Épargne − Courses (auto)
              const epargne = envelopes.find((e: any) => e.slug === 'epargne')?.budget ?? 0
              const courses = envelopes.find((e: any) => e.slug === 'courses')?.budget ?? 0
              const charges = envelopes.find((e: any) => e.slug === 'charges')?.budget ?? 0
              const plaisirAuto = income - charges - epargne - courses
              const displayBudget = isPlaisir ? Math.max(0, plaisirAuto) : env.budget

              return (
                <div key={env.id} className="bg-white rounded-[16px] overflow-hidden">
                  <div className="flex items-center px-4 py-3.5 gap-3">
                    <div className="w-10 h-10 rounded-[11px] flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: env.color ?? ENV_COLORS[env.slug] ?? '#f5f5f7' }}>{env.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-semibold text-[#1d1d1f]">{env.name}</p>
                        {isCharges && <span className="text-[10px] font-medium bg-[#f2f2f7] text-[#86868b] px-1.5 py-0.5 rounded-full">Auto</span>}
                        {isPlaisir && <span className="text-[10px] font-medium bg-[#f3f0ff] text-[#7c3aed] px-1.5 py-0.5 rounded-full">Auto</span>}
                      </div>
                      <p className="text-[12px] text-[#86868b] mt-0.5">
                        {fmt(spent)} dépensé · {(displayBudget - spent) >= 0 ? `${fmt(displayBudget - spent)} restant` : `${fmt(spent - displayBudget)} dépassé`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-[15px] font-bold text-[#1d1d1f]">{fmt(displayBudget)}</p>
                      <div className="flex gap-1.5">
                        {!isPlaisir && !isCharges && (
                          <button onClick={() => openEdit(env)} className="w-6 h-6 rounded-full bg-[#f2f2f7] flex items-center justify-center">
                            <Pencil size={11} color="#86868b" />
                          </button>
                        )}
                        {!env.is_system && (
                          <button onClick={() => deleteEnvelope(env.id)} className="w-6 h-6 rounded-full bg-[#f2f2f7] flex items-center justify-center">
                            <X size={11} color="#86868b" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {envelopes.length === 0 && (
            <div className="bg-white rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">📦</p>
              <p className="text-[15px] font-medium text-[#1d1d1f]">Aucune enveloppe</p>
              <p className="text-[13px] text-[#86868b] mt-1">Appuie sur + pour en créer une</p>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="bg-white rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#d1d1d6] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-[#1d1d1f]">{editingId ? 'Modifier' : 'Nouvelle enveloppe'}</h2>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-full bg-[#f2f2f7] flex items-center justify-center"><X size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-[#86868b] block mb-1.5">Nom</label>
                  <input className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                    placeholder="Loyer, Netflix…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="text-[13px] text-[#86868b] block mb-1.5">Budget (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                    placeholder="0" value={fBudget} onChange={e => setFBudget(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#86868b] block mb-1.5">Jour d&apos;échéance (optionnel)</label>
                <input type="number" min="1" max="31"
                  className="w-full h-11 border border-[#d1d1d6] rounded-[12px] px-3.5 text-[15px] bg-[#f9f9fa] outline-none focus:border-[#007aff] focus:bg-white"
                  placeholder="Ex : 5 pour le 5 du mois" value={fDueDay} onChange={e => setFDueDay(e.target.value)} />
              </div>
              <div>
                <label className="text-[13px] text-[#86868b] block mb-1.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(icon => (
                    <button key={icon} onClick={() => setFIcon(icon)}
                      className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-lg ${fIcon === icon ? 'ring-2 ring-[#007aff]' : ''}`}
                      style={{ background: fColor }}>{icon}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] text-[#86868b] block mb-1.5">Couleur</label>
                <div className="flex gap-2">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setFColor(color)}
                      className={`w-8 h-8 rounded-full ${fColor === color ? 'ring-2 ring-offset-1 ring-[#007aff]' : ''}`}
                      style={{ background: color, border: '1px solid #d1d1d6' }} />
                  ))}
                </div>
              </div>
              <button onClick={saveEnvelope} disabled={saving || !fName || !fBudget}
                className="w-full h-12 bg-[#1d1d1f] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RevenueCard({ month, onSaved }: { month: any, onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(month.income ?? 0))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const pb = createClient()
    await pb.collection('months').update(month.id, { income: parseFloat(value) || 0 })
    setSaving(false); setEditing(false); onSaved()
  }

  return (
    <div className="bg-white rounded-[16px] overflow-hidden">
      <div className="flex items-center px-4 py-3.5 gap-3">
        <div className="w-10 h-10 rounded-[11px] bg-[#e8faf0] flex items-center justify-center text-xl flex-shrink-0">💵</div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-[#1d1d1f]">Revenu mensuel</p>
          <p className="text-[12px] text-[#86868b]">Base de calcul du budget</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input type="number" value={value} onChange={e => setValue(e.target.value)}
              className="w-24 h-9 border border-[#007aff] rounded-[10px] px-2.5 text-[14px] font-semibold text-right bg-white outline-none" autoFocus />
            <button onClick={save} disabled={saving} className="w-9 h-9 bg-[#1d1d1f] rounded-[10px] flex items-center justify-center">
              {saving ? <Loader2 size={14} color="white" className="animate-spin" /> : <Check size={14} color="white" />}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[15px] font-bold text-[#1d1d1f]">
            {fmt(month.income ?? 0)}<ChevronRight size={14} color="#86868b" />
          </button>
        )}
      </div>
    </div>
  )
}

'use client'

import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/pocketbase/client'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import { Plus, X, Loader2, Pencil, CalendarDays, ChevronRight } from 'lucide-react'

const ICONS = ['🏠','✨','💰','🛒','🎉','🍽️','⛽','🎵','📺','💊','🚗','👕','🎮','✈️','🏋️','📦']
const COLORS = ['#fff3e0','#f3f0ff','#e8faf0','#e8f4ff','#fef0f5','#fff8e6','#f0f7ff','#f5f5f7']
const ENV_COLORS: Record<string, string> = {
  charges:'#fff3e0', plaisir:'#f3f0ff', epargne:'#e8faf0', courses:'#e8f4ff',
}
const ENV_BORDER: Record<string, string> = {
  charges:'#fbbf24', plaisir:'#a78bfa', epargne:'#34d399', courses:'#60a5fa',
}

interface Props {
  workspaceId: string
  userId: string
  categories: any[]
}

export default function EnvelopesShell({ workspaceId, userId, categories }: Props) {
  const router = useRouter()
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

  const editingEnv = editingId ? envelopes.find((e: any) => e.id === editingId) : null
  const isEditingCourses = editingEnv?.slug === 'courses'

  async function saveEnvelope() {
    if (!fBudget || !month) return
    if (!isEditingCourses && !fName.trim()) return
    setSaving(true)
    const pb = createClient()
    if (isEditingCourses) {
      // Le budget de l'enveloppe "Courses" est piloté par le budget mensuel prévisionnel
      // (réglage disponible aussi sur la page Courses) : on met à jour cette valeur,
      // l'enveloppe se resynchronise automatiquement au prochain chargement.
      await pb.collection('months').update(month.id, { courses_budget: parseFloat(fBudget) })
    } else if (editingId) {
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

  async function deleteEnvelope(id: string) {
    const pb = createClient()
    await pb.collection('envelopes').delete(id)
    refetch()
  }

  const income = month?.income ?? 0
  const totalSpent = transactions.reduce((s: number, t: any) => s + t.amount, 0)
  const totalBudget = envelopes.reduce((s: number, e: any) => s + e.budget, 0)
  const reste = totalBudget - totalSpent

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Dépenses variables</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => router.push('/calendar')} className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center">
              <CalendarDays size={15} color="#8e8e93" />
            </button>
            <MonthPicker />
            <button onClick={openAdd} className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center active:scale-95 transition-transform">
              <Plus size={16} color="white" />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          {/* Reste dans les enveloppes */}
          <div className="bg-[#1c1c1e] rounded-[20px] p-6 flex flex-col items-center">
            <p className="text-[13px] text-[#8e8e93] mb-4">Reste dans les enveloppes</p>
            <div className="relative w-[140px] h-[140px]">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" fill="none" stroke="#2c2c2e" strokeWidth="10" />
                <circle cx="70" cy="70" r="60" fill="none" stroke="#a78bfa" strokeWidth="10"
                  strokeDasharray={(2 * Math.PI * 60).toFixed(1)}
                  strokeDashoffset={(totalBudget > 0 ? (2 * Math.PI * 60) * (1 - Math.max(0, Math.min(1, reste / totalBudget))) : 2 * Math.PI * 60).toFixed(1)}
                  strokeLinecap="round" transform="rotate(-90 70 70)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[22px] font-bold tracking-tight text-white">{fmt(reste)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Revenus', value: fmt(income) },
              { label: 'Budgeté', value: fmt(totalBudget) },
              { label: 'Dépensé', value: fmt(totalSpent) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#1c1c1e] rounded-[14px] py-3 text-center">
                <p className="text-[11px] text-[#8e8e93] mb-1">{label}</p>
                <p className="text-[14px] font-bold text-white tracking-tight">{value}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[#8e8e93] px-1 pt-1">Les enveloppes</p>

          <div className="space-y-2.5">
            {envelopes.map((env: any) => {
              const spent = spentFor(env.slug)
              const isPlaisir = env.slug === 'plaisir'
              const isCharges = env.slug === 'charges'
              const isCourses = env.slug === 'courses'

              const epargne = envelopes.find((e: any) => e.slug === 'epargne')?.budget ?? 0
              const courses = envelopes.find((e: any) => e.slug === 'courses')?.budget ?? 0
              const charges = envelopes.find((e: any) => e.slug === 'charges')?.budget ?? 0
              const plaisirAuto = income - charges - epargne - courses
              const displayBudget = isPlaisir ? Math.max(0, plaisirAuto) : env.budget
              const remain = displayBudget - spent
              const borderColor = ENV_BORDER[env.slug] ?? '#3a3a3c'

              return (
                <button key={env.id} onClick={() => isCourses && router.push('/courses')}
                  className="w-full text-left bg-[#1c1c1e] rounded-[16px] p-4 border"
                  style={{ borderColor }}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: env.color ?? ENV_COLORS[env.slug] ?? '#2c2c2e' }}>{env.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-semibold text-white">{env.name}</p>
                        {(isCharges || isPlaisir) && <span className="text-[10px] font-medium bg-[#2c2c2e] text-[#8e8e93] px-1.5 py-0.5 rounded-full">Auto</span>}
                      </div>
                      <p className="text-[13px] text-[#60a5fa] mt-1">• Montant : {fmt(displayBudget)}</p>
                      <p className={`text-[13px] mt-0.5 ${remain < 0 ? 'text-[#f87171]' : 'text-[#f87171]'}`}>• Restant: {fmt(remain)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {isCourses && <ChevronRight size={16} color="#8e8e93" />}
                      {!isPlaisir && !isCharges && (
                        <div className="flex gap-1.5">
                          <span onClick={(e) => { e.stopPropagation(); openEdit(env) }}
                            className="w-6 h-6 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                            <Pencil size={11} color="#8e8e93" />
                          </span>
                          {!env.is_system && (
                            <span onClick={(e) => { e.stopPropagation(); deleteEnvelope(env.id) }}
                              className="w-6 h-6 rounded-full bg-[#2c2c2e] flex items-center justify-center">
                              <X size={11} color="#8e8e93" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {envelopes.length === 0 && (
            <div className="bg-[#1c1c1e] rounded-[20px] px-4 py-10 text-center">
              <p className="text-[32px] mb-3">📦</p>
              <p className="text-[15px] font-medium text-white">Aucune enveloppe</p>
              <p className="text-[13px] text-[#8e8e93] mt-1">Appuie sur + pour en créer une</p>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div className="bg-[#1c1c1e] rounded-t-[24px] w-full max-w-lg p-5 pb-10">
            <div className="w-9 h-1 bg-[#3a3a3c] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">{isEditingCourses ? 'Budget Courses' : editingId ? 'Modifier' : 'Nouvelle enveloppe'}</h2>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-full bg-[#2c2c2e] flex items-center justify-center"><X size={14} color="#8e8e93" /></button>
            </div>
            <div className="space-y-3">
              {isEditingCourses ? (
                <div>
                  <label className="text-[13px] text-[#8e8e93] block mb-1.5">Budget prévisionnel du mois (€)</label>
                  <input type="number" step="0.01" min="0"
                    className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                    placeholder="0" value={fBudget} onChange={e => setFBudget(e.target.value)} autoFocus />
                  <p className="text-[12px] text-[#8e8e93] mt-2">Ce montant est le même que celui réglable depuis la page Courses (⚙). Le restant continue de baisser avec les passages ajoutés.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[13px] text-[#8e8e93] block mb-1.5">Nom</label>
                      <input className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                        placeholder="Loyer, Netflix…" value={fName} onChange={e => setFName(e.target.value)} autoFocus />
                    </div>
                    <div>
                      <label className="text-[13px] text-[#8e8e93] block mb-1.5">Budget (€)</label>
                      <input type="number" step="0.01" min="0"
                        className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                        placeholder="0" value={fBudget} onChange={e => setFBudget(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] text-[#8e8e93] block mb-1.5">Jour d&apos;échéance (optionnel)</label>
                    <input type="number" min="1" max="31"
                      className="w-full h-11 border border-white/10 rounded-[12px] px-3.5 text-[16px] bg-[#2c2c2e] text-white outline-none focus:border-[#3b82f6]"
                      placeholder="Ex : 5 pour le 5 du mois" value={fDueDay} onChange={e => setFDueDay(e.target.value)} />
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
                </>
              )}
              <button onClick={saveEnvelope} disabled={saving || !fBudget || (!isEditingCourses && !fName)}
                className="w-full h-12 bg-[#3b82f6] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 mt-2 disabled:opacity-50 active:scale-[0.98] transition-all">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {isEditingCourses ? 'Enregistrer' : editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

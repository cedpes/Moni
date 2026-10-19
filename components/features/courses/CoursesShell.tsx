'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { createClient } from '@/lib/pocketbase/client'
import { fmt, defaultDateForMonth, isDateInMonth, tileBg } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import BottomSheet from '@/components/ui/BottomSheet'
import EditTransactionSheet, { fmtDay, dayOf } from '@/components/features/transactions/EditTransactionSheet'
import { Plus, X, Loader2, Settings2, Trash2 } from 'lucide-react'
import { useMonthData } from '@/hooks/useMonthData'

interface Props { workspaceId: string; userId: string }

interface Store { id?: string; name: string; icon: string; color: string; custom: boolean }

// Magasins proposés par défaut (toujours disponibles, non supprimables)
const DEFAULT_STORES: Store[] = [
  { name: 'Lidl', icon: '🛒', color: '#fff3cd' },
  { name: 'Carrefour', icon: '🏪', color: '#d4edda' },
  { name: 'Leclerc', icon: '🛍️', color: '#cce5ff' },
  { name: 'Aldi', icon: '🛒', color: '#fde8d8' },
  { name: 'Monoprix', icon: '🧺', color: '#e2d9f3' },
  { name: 'Picard', icon: '❄️', color: '#cff4fc' },
  { name: 'Bio coop', icon: '🌿', color: '#d4f5e2' },
  { name: 'Marché', icon: '🥦', color: '#d4edda' },
  { name: 'Autre', icon: '🛒', color: '#f2f2f7' },
].map(s => ({ ...s, custom: false }))

const STORE_EMOJIS = ['🛒', '🏪', '🛍️', '🧺', '🥖', '🥩', '🐟', '🧀', '🍷', '🥦', '🌿', '💊', '🐾', '🏬']
const STORE_COLORS = ['#fff3cd', '#d4edda', '#cce5ff', '#fde8d8', '#e2d9f3', '#cff4fc', '#d4f5e2', '#fef0f5']
const MAX_NAME = 40

const inputCls = 'w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] text-[var(--text-primary)] outline-none focus:border-accent-text'

export default function CoursesShell({ workspaceId, userId }: Props) {
  const { monthKey } = useMonth()
  const { month, transactions: allTx, loading, refetch } = useMonthData(monthKey, workspaceId)
  const transactions = allTx.filter((t: any) => t.envelope_slug === 'courses')

  // ── Magasins personnalisés ────────────────────────────────────────────────
  const [customStores, setCustomStores] = useState<Store[]>([])
  const [storesUnavailable, setStoresUnavailable] = useState(false)

  // Chargement des magasins du workspace (abonnement annulé si le composant change)
  useEffect(() => {
    let alive = true
    const pb = createClient()
    pb.collection('stores').getFullList({
      filter: pb.filter('workspace_id = {:ws}', { ws: workspaceId }),
      sort: 'position,name',
      requestKey: null,
    }).then(list => {
      if (!alive) return
      setCustomStores(list.map(r => ({ id: r.id, name: r.name, icon: r.icon || '🛒', color: r.color || '#f2f2f7', custom: true })))
      setStoresUnavailable(false)
    }).catch((err: { status?: number }) => {
      if (!alive) return
      // Collection absente tant que la migration 1792440000_stores.js n'est pas appliquée
      if (err?.status === 404) setStoresUnavailable(true)
      else console.error('CoursesShell stores error:', err)
    })
    return () => { alive = false }
  }, [workspaceId])

  const allStores = useMemo(() => {
    const names = new Set(customStores.map(s => s.name.toLowerCase()))
    const defaults = DEFAULT_STORES.filter(s => !names.has(s.name.toLowerCase()))
    const autre = defaults.find(s => s.name === 'Autre')
    // Mes magasins d'abord, puis les magasins par défaut, « Autre » en dernier
    return [...customStores, ...defaults.filter(s => s.name !== 'Autre'), ...(autre ? [autre] : [])]
  }, [customStores])
  const storeByName = useCallback((name: string) =>
    allStores.find(s => s.name.toLowerCase() === name.toLowerCase()), [allStores])

  // ── Ajout d'un passage ────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [fLabel, setFLabel] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(() => defaultDateForMonth(monthKey))
  const [dateError, setDateError] = useState(false)
  const [tmpMonthly, setTmpMonthly] = useState('')

  // ── Formulaire « nouveau magasin » (partagé entre l'ajout et les réglages) ──
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(STORE_EMOJIS[0])
  const [creating, setCreating] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const monthlyBudget = month?.courses_budget ?? 320

  const [year, monthNum] = monthKey.split('-').map(Number)
  const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, '0')}`

  const monthTransactions = useMemo(() => transactions
    .filter((t: any) => dayOf(t.date) >= monthStart && dayOf(t.date) <= monthEnd)
    .sort((a: any, b: any) => b.date.localeCompare(a.date)), [transactions, monthStart, monthEnd])

  const monthTotal = useMemo(() => monthTransactions
    .reduce((s: number, t: any) => s + t.amount, 0), [monthTransactions])
  const monthPct = monthlyBudget > 0 ? Math.min(100, Math.round(monthTotal / monthlyBudget * 100)) : 0
  const monthRemain = monthlyBudget - monthTotal
  const barColor = (pct: number) => pct < 70 ? 'var(--positive)' : pct < 100 ? 'var(--warning)' : 'var(--negative)'

  function openAdd() {
    setFLabel(''); setFAmount(''); setFDate(defaultDateForMonth(monthKey)); setDateError(false); setSaveError(null)
    resetNewStore()
    setShowModal(true)
  }

  function resetNewStore() {
    setNewOpen(false); setNewName(''); setNewIcon(STORE_EMOJIS[0]); setStoreError(null)
  }

  async function createStore(selectAfter: boolean) {
    const name = newName.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (name.length > MAX_NAME) { setStoreError(`${MAX_NAME} caractères maximum.`); return }
    if (storeByName(name)) { setStoreError('Ce magasin existe déjà.'); return }
    setCreating(true); setStoreError(null)
    try {
      const pb = createClient()
      const rec = await pb.collection('stores').create({
        workspace_id: workspaceId,
        name,
        icon: newIcon,
        color: STORE_COLORS[customStores.length % STORE_COLORS.length],
        position: customStores.length,
      })
      setCustomStores(prev => [...prev, { id: rec.id, name: rec.name, icon: rec.icon, color: rec.color, custom: true }])
      if (selectAfter) setFLabel(rec.name)
      resetNewStore()
    } catch (err) {
      console.error('CoursesShell create store error:', err)
      setStoreError((err as { status?: number })?.status === 400 ? 'Nom invalide ou déjà utilisé.' : "Impossible d'ajouter le magasin. Réessaie.")
    } finally {
      setCreating(false)
    }
  }

  async function removeStore(store: Store) {
    if (!store.id) return
    setRemoving(store.id)
    try {
      await createClient().collection('stores').delete(store.id)
      setCustomStores(prev => prev.filter(s => s.id !== store.id))
    } catch (err) {
      console.error('CoursesShell delete store error:', err)
      setStoreError('Suppression impossible. Réessaie.')
    } finally {
      setRemoving(null)
    }
  }

  async function addTransaction() {
    const amount = parseFloat(fAmount)
    if (!fLabel.trim()) return
    if (!(amount > 0) || amount >= 1_000_000) { setSaveError('Montant invalide.'); return }
    if (!month) { setSaveError('Le mois n\'est pas encore chargé. Réessaie dans un instant.'); return }
    const date = fDate || defaultDateForMonth(monthKey)
    if (!isDateInMonth(date, monthKey)) { setDateError(true); return }
    setDateError(false); setSaveError(null)
    setSaving(true)
    try {
      const pb = createClient()
      await pb.collection('transactions').create({
        month_id: month.id, workspace_id: workspaceId,
        envelope_slug: 'courses', label: fLabel.trim().slice(0, 120), amount: Math.round(amount * 100) / 100,
        date, created_by: userId,
      })
      setShowModal(false); refetch()
    } catch (err) {
      console.error('CoursesShell add error:', err)
      setSaveError("L'enregistrement a échoué. Réessaie.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransaction(id: string) {
    setDeleting(id)
    try {
      await createClient().collection('transactions').delete(id)
      refetch()
    } catch (err) {
      console.error('CoursesShell delete error:', err)
    } finally {
      setDeleting(null)
    }
  }

  async function saveSettings() {
    if (!month) return
    const value = parseFloat(tmpMonthly)
    const pb = createClient()
    await pb.collection('months').update(month.id, {
      courses_budget: Number.isFinite(value) && value >= 0 ? value : monthlyBudget,
    })
    setShowSettings(false); refetch()
  }

  const closeModal = useCallback(() => setShowModal(false), [])
  const closeSettings = useCallback(() => { setShowSettings(false); resetNewStore() }, [])

  // Formulaire de création d'un magasin
  const newStoreForm = (selectAfter: boolean) => (
    <div className="rounded-[16px] bg-[var(--bg-surface-2)] p-3 space-y-3">
      <label className="block">
        <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Nom du magasin</span>
        <input value={newName} onChange={e => { setNewName(e.target.value); setStoreError(null) }}
          maxLength={MAX_NAME} placeholder="Ex : Intermarché, boulangerie…" data-autofocus
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createStore(selectAfter) } }}
          className="w-full h-11 rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none border border-[var(--border-default)] focus:border-accent-text" />
      </label>
      <div role="radiogroup" aria-label="Icône" className="flex flex-wrap gap-1.5">
        {STORE_EMOJIS.map(e => (
          <button key={e} type="button" role="radio" aria-checked={newIcon === e} aria-label={`Icône ${e}`}
            onClick={() => setNewIcon(e)}
            className={`w-10 h-10 rounded-[10px] text-[18px] flex items-center justify-center ${newIcon === e ? 'bg-accent-soft ring-2 ring-accent-text' : 'bg-[var(--bg-surface)]'}`}>
            {e}
          </button>
        ))}
      </div>
      {storeError && <p role="alert" className="text-[12px] text-negative">{storeError}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={resetNewStore}
          className="flex-1 h-11 rounded-[12px] text-[14px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface)]">
          Annuler
        </button>
        <button type="button" onClick={() => createStore(selectAfter)} disabled={creating || !newName.trim()}
          className="flex-1 h-11 rounded-[12px] text-[14px] font-semibold bg-accent text-accent-ink disabled:opacity-50 flex items-center justify-center gap-2">
          {creating && <Loader2 size={14} className="animate-spin" />}Ajouter le magasin
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-[var(--border-default)] px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Courses</h1>
          </div>
          <div className="flex gap-2 mt-1">
            <MonthPicker />
            <button onClick={() => { setTmpMonthly(String(monthlyBudget)); resetNewStore(); setShowSettings(true) }}
              aria-label="Réglages des courses"
              className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-transform">
              <Settings2 size={15} />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[var(--text-secondary)]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-3">
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] p-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[12px] text-[var(--text-secondary)] mb-1">Dépensé ce mois</p>
                <p className="font-display text-[30px] font-bold text-[var(--text-primary)] leading-none">{fmt(monthTotal)}</p>
              </div>
              <p className="text-[15px] font-medium text-[var(--text-secondary)] pb-1">/ {fmt(monthlyBudget)}</p>
            </div>
            <div className="h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width:`${monthPct}%`, background:barColor(monthPct) }} />
            </div>
            <div className="flex justify-between text-[12px] text-[var(--text-secondary)]">
              <span>{monthPct}% utilisé</span>
              <span className={monthRemain < 0 ? 'text-negative' : ''}>{monthRemain >= 0 ? `${fmt(monthRemain)} restant` : `${fmt(-monthRemain)} dépassé`}</span>
            </div>
          </div>

          <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1">
            {monthTransactions.length} passage{monthTransactions.length > 1 ? 's' : ''}
          </p>
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] overflow-hidden">
            {monthTransactions.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[32px] mb-3">🛒</p>
                <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucun passage</p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Appuie sur + pour en ajouter un</p>
              </div>
            ) : monthTransactions.map((t: any, i: number) => {
              const s = storeByName(t.label)
              return (
                <div key={t.id} className={`flex items-center pr-4 gap-2 ${i < monthTransactions.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}>
                  <button onClick={() => setEditing(t)} aria-label={`Modifier le passage ${t.label}, ${fmt(t.amount)}`}
                    className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-3 text-left active:bg-[var(--surface-highlight)] transition-colors">
                    <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0"
                      style={{ background: tileBg(s?.color ?? null) }}>{s?.icon ?? '🛒'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium text-[var(--text-primary)] truncate">{t.label}</span>
                      <span className="block text-[12px] text-[var(--text-secondary)]">{fmtDay(t.date)}</span>
                    </span>
                    <span className="text-[15px] font-semibold text-[var(--text-primary)] flex-shrink-0">{fmt(t.amount)}</span>
                  </button>
                  <button onClick={() => deleteTransaction(t.id)} disabled={deleting === t.id} aria-label={`Supprimer le passage ${t.label}`}
                    className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center flex-shrink-0">
                    {deleting === t.id ? <Loader2 size={11} className="animate-spin text-[var(--text-secondary)]" /> : <X size={11} color="var(--text-secondary)" />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button onClick={openAdd} aria-label="Ajouter un passage"
        className="fixed right-4 w-14 h-14 bg-[var(--bg-surface-3)] border border-[var(--border-default)] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 92px)' }}>
        <Plus size={24} color="var(--text-primary)" />
      </button>

      {/* Ajouter un passage */}
      <BottomSheet open={showModal} onClose={closeModal} label="Ajouter un passage">
        <div className="space-y-4 max-h-[78vh] overflow-y-auto pb-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Ajouter un passage</h2>
            <button onClick={closeModal} aria-label="Fermer" className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center"><X size={14} color="var(--text-secondary)" /></button>
          </div>

          <div>
            <p id="store-label" className="text-[13px] text-[var(--text-secondary)] mb-2">Magasin</p>
            <div role="radiogroup" aria-labelledby="store-label" className="flex flex-wrap gap-2">
              {allStores.map(s => {
                const on = fLabel === s.name
                return (
                  <button key={s.name} type="button" role="radio" aria-checked={on} onClick={() => setFLabel(s.name)}
                    className={`h-10 px-3.5 rounded-full text-[14px] font-semibold flex items-center gap-1.5 transition-colors ${on ? 'bg-accent text-accent-ink' : 'border border-[var(--border-default)] text-[var(--text-body)]'}`}>
                    <span aria-hidden="true">{s.icon}</span>{s.name}
                  </button>
                )
              })}
              {!storesUnavailable && !newOpen && (
                <button type="button" onClick={() => { setNewOpen(true); setStoreError(null) }}
                  className="h-10 px-3.5 rounded-full text-[14px] font-semibold flex items-center gap-1.5 border border-dashed border-accent-text text-accent-text">
                  <Plus size={15} /> Nouveau magasin
                </button>
              )}
            </div>
            {newOpen && <div className="mt-3">{newStoreForm(true)}</div>}
            {storesUnavailable && (
              <p className="text-[12px] text-[var(--text-secondary)] mt-2">
                L&apos;ajout de magasins sera disponible une fois la mise à jour de la base installée.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Montant (€)</span>
              <input type="number" inputMode="decimal" step="0.01" min="0" className={inputCls}
                placeholder="0,00" value={fAmount} onChange={e => setFAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Date</span>
              <input type="date" className={inputCls} min={monthStart} max={monthEnd}
                value={fDate} onChange={e => { setFDate(e.target.value); setDateError(false) }} />
            </label>
          </div>
          {dateError && (
            <p role="alert" className="text-[12px] text-negative px-1">La date doit être dans le mois affiché, sinon le passage ne compte pas dans son budget.</p>
          )}
          {saveError && <p role="alert" className="text-[12px] text-negative px-1">{saveError}</p>}
          <button onClick={addTransaction} disabled={saving || !fLabel || !fAmount}
            className="w-full h-12 bg-accent text-accent-ink rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving && <Loader2 size={16} className="animate-spin" />}Ajouter{fLabel ? ` chez ${fLabel}` : ''}
          </button>
        </div>
      </BottomSheet>

      <EditTransactionSheet tx={editing} monthKey={monthKey} mode="courses"
        stores={allStores.map(st => ({ name: st.name, icon: st.icon }))}
        onClose={() => setEditing(null)} onSaved={refetch} />

      {/* Réglages : budget mensuel + mes magasins */}
      <BottomSheet open={showSettings} onClose={closeSettings} label="Réglages des courses">
        <div className="space-y-5 max-h-[78vh] overflow-y-auto pb-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Réglages des courses</h2>
            <button onClick={closeSettings} aria-label="Fermer" className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center"><X size={14} color="var(--text-secondary)" /></button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Budget mensuel (€)</span>
              <input type="number" inputMode="decimal" min="0" className={inputCls}
                value={tmpMonthly} onChange={e => setTmpMonthly(e.target.value)} />
            </label>
            <button onClick={saveSettings} className="w-full h-12 bg-accent text-accent-ink rounded-[14px] font-semibold text-[15px] active:scale-[0.98] transition-all">
              Enregistrer le budget
            </button>
          </div>

          <section aria-labelledby="my-stores" className="space-y-2">
            <h3 id="my-stores" className="text-[15px] font-bold text-[var(--text-primary)]">Mes magasins</h3>
            {storesUnavailable ? (
              <p className="text-[13px] text-[var(--text-secondary)]">
                Disponible une fois la mise à jour de la base installée (migration « stores »).
              </p>
            ) : (
              <>
                {customStores.length === 0 && !newOpen && (
                  <p className="text-[13px] text-[var(--text-secondary)]">Aucun magasin ajouté. Les magasins par défaut restent toujours proposés.</p>
                )}
                {customStores.length > 0 && (
                  <ul className="rounded-[16px] bg-[var(--bg-surface-2)] overflow-hidden">
                    {customStores.map((s, i) => (
                      <li key={s.id} className={`flex items-center gap-3 px-3 h-14 ${i < customStores.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}>
                        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[17px]" style={{ background: tileBg(s.color) }}>{s.icon}</span>
                        <span className="flex-1 text-[15px] font-medium text-[var(--text-primary)] truncate">{s.name}</span>
                        <button onClick={() => removeStore(s)} disabled={removing === s.id} aria-label={`Supprimer le magasin ${s.name}`}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] active:scale-95">
                          {removing === s.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {newOpen ? newStoreForm(false) : (
                  <button onClick={() => { setNewOpen(true); setStoreError(null) }}
                    className="w-full h-11 rounded-[12px] border border-dashed border-accent-text text-accent-text text-[14px] font-semibold flex items-center justify-center gap-1.5">
                    <Plus size={15} /> Ajouter un magasin
                  </button>
                )}
                {storeError && !newOpen && <p role="alert" className="text-[12px] text-negative">{storeError}</p>}
                <p className="text-[12px] text-[var(--text-tertiary)]">Supprimer un magasin ne supprime pas les passages déjà enregistrés.</p>
              </>
            )}
          </section>
        </div>
      </BottomSheet>
    </div>
  )
}

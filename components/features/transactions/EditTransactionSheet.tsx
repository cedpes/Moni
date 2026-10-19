'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/pocketbase/client'
import { isDateInMonth } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'

export interface EditableTx {
  id: string
  label: string
  amount: number
  date: string
  category_id?: string | null
  envelope_slug?: string
}

interface Category { id: string; name: string; icon?: string }
interface StoreOption { name: string; icon: string }

interface Props {
  tx: EditableTx | null
  monthKey: string
  onClose: () => void
  onSaved: () => void
  /** Dépense courante : libellé libre + catégorie. Courses : choix du magasin. */
  mode: 'depense' | 'courses'
  categories?: Category[]
  stores?: StoreOption[]
  /** Prévisionnel validé lié à cette transaction : mis à jour en même temps. */
  linkedPlannedId?: string | null
}

const MAX_AMOUNT = 1_000_000
const inputCls = 'w-full h-11 border border-[var(--border-default)] rounded-[12px] px-3.5 text-[16px] bg-[var(--bg-surface-2)] text-[var(--text-primary)] outline-none focus:border-accent-text'

// PocketBase renvoie les dates sous la forme "2026-10-30 00:00:00.000Z"
export function dayOf(date: string | null | undefined): string {
  return (date ?? '').slice(0, 10)
}

export function fmtDay(date: string | null | undefined): string {
  const d = dayOf(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function EditTransactionSheet(props: Props) {
  return (
    <BottomSheet open={!!props.tx} onClose={props.onClose} label="Modifier la dépense">
      {props.tx && <EditForm key={props.tx.id} {...props} tx={props.tx} />}
    </BottomSheet>
  )
}

function EditForm({ tx, monthKey, onClose, onSaved, mode, categories = [], stores = [], linkedPlannedId }: Props & { tx: EditableTx }) {
  const [label, setLabel] = useState(tx.label ?? '')
  const [amount, setAmount] = useState(String(tx.amount ?? ''))
  const [date, setDate] = useState(dayOf(tx.date))
  const [catId, setCatId] = useState(tx.category_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [y, m] = monthKey.split('-').map(Number)
  const monthStart = `${monthKey}-01`
  const monthEnd = `${monthKey}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

  // Le magasin actuel reste proposé même s'il a été supprimé de « Mes magasins »
  const storeOptions = mode === 'courses' && tx.label && !stores.some(s => s.name.toLowerCase() === tx.label.toLowerCase())
    ? [{ name: tx.label, icon: '🛒' }, ...stores]
    : stores

  async function save() {
    const value = Number(amount.replace(',', '.'))
    const cleanLabel = label.trim().replace(/\s+/g, ' ').slice(0, 120)
    if (!cleanLabel) { setError('Le libellé est obligatoire.'); return }
    if (!Number.isFinite(value) || value <= 0 || value >= MAX_AMOUNT) { setError('Montant invalide.'); return }
    if (!isDateInMonth(date, monthKey)) { setError('La date doit rester dans le mois affiché.'); return }

    const data: Record<string, unknown> = {
      label: cleanLabel,
      amount: Math.round(value * 100) / 100,
      date,
    }
    if (mode === 'depense' && catId !== (tx.category_id ?? '')) {
      data.category_id = catId || null
      // Même règle qu'à la création, seulement si la catégorie change
      // et seulement entre « plaisir » et « courses » (on ne touche pas aux autres enveloppes)
      if (tx.envelope_slug === 'plaisir' || tx.envelope_slug === 'courses') {
        const cat = categories.find(c => c.id === catId)
        data.envelope_slug = cat?.name === 'Courses' ? 'courses' : 'plaisir'
      }
    }

    setSaving(true); setError(null)
    try {
      const pb = createClient()
      await pb.collection('transactions').update(tx.id, data)
      if (linkedPlannedId) {
        const planned: Record<string, unknown> = { label: data.label, amount: data.amount }
        if ('category_id' in data) planned.category_id = data.category_id
        await pb.collection('planned_expenses').update(linkedPlannedId, planned)
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('EditTransaction save error:', err)
      setError("L'enregistrement a échoué. Vérifie ta connexion et réessaie.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-h-[78vh] overflow-y-auto pb-1">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Modifier {mode === 'courses' ? 'le passage' : 'la dépense'}</h2>
        <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center">
          <X size={14} color="var(--text-secondary)" />
        </button>
      </div>

      {mode === 'courses' ? (
        <div>
          <p id="edit-store-label" className="text-[13px] text-[var(--text-secondary)] mb-2">Magasin</p>
          <div role="radiogroup" aria-labelledby="edit-store-label" className="flex flex-wrap gap-2">
            {storeOptions.map(s => {
              const on = label.toLowerCase() === s.name.toLowerCase()
              return (
                <button key={s.name} type="button" role="radio" aria-checked={on} onClick={() => setLabel(s.name)}
                  className={`h-10 px-3.5 rounded-full text-[14px] font-semibold flex items-center gap-1.5 transition-colors ${on ? 'bg-accent text-accent-ink' : 'border border-[var(--border-default)] text-[var(--text-body)]'}`}>
                  <span aria-hidden="true">{s.icon}</span>{s.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <label className="block">
          <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Libellé</span>
          <input className={inputCls} value={label} maxLength={120} data-autofocus
            onChange={e => { setLabel(e.target.value); setError(null) }} />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Montant (€)</span>
          <input type="number" inputMode="decimal" step="0.01" min="0" className={inputCls}
            value={amount} onChange={e => { setAmount(e.target.value); setError(null) }} />
        </label>
        <label className="block">
          <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Date</span>
          <input type="date" className={inputCls} min={monthStart} max={monthEnd}
            value={date} onChange={e => { setDate(e.target.value); setError(null) }} />
        </label>
      </div>

      {mode === 'depense' && (
        <label className="block">
          <span className="text-[13px] text-[var(--text-secondary)] block mb-1.5">Catégorie</span>
          <select className={`${inputCls} appearance-none`} value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">Sans catégorie</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
          </select>
        </label>
      )}

      {linkedPlannedId && (
        <p className="text-[12px] text-[var(--text-secondary)]">Cette dépense vient du prévisionnel : il sera mis à jour aussi.</p>
      )}
      {error && <p role="alert" className="text-[13px] text-negative">{error}</p>}

      <button onClick={save} disabled={saving}
        className="w-full h-12 bg-accent text-accent-ink rounded-[14px] font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
        {saving && <Loader2 size={16} className="animate-spin" />}Enregistrer les modifications
      </button>
    </div>
  )
}

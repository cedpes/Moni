'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RecordModel } from 'pocketbase'
import { Loader2, Lock, Delete } from 'lucide-react'
import { createClient } from '@/lib/pocketbase/client'
import { useMonth } from '@/lib/context/MonthContext'
import { defaultDateForMonth, isDateInMonth, fmt } from '@/lib/utils'
import { isMonthClosed } from '@/lib/utils/monthLock'
import BottomSheet from '@/components/ui/BottomSheet'

// Prévient les écrans ouverts (useMonthData) qu'une opération a été ajoutée.
export const DATA_CHANGED_EVENT = 'moni:data-changed'

const MAX_AMOUNT = 1_000_000
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const

interface Ctx {
  userId: string
  workspaceId: string
  month: RecordModel | null
  categories: { id: string; name: string; icon?: string }[]
}

// Montant saisi au pavé ("13,5") → nombre, ou null s'il est invalide.
function parseAmount(raw: string): number | null {
  if (!/^\d{1,7}(,\d{0,2})?$/.test(raw)) return null
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n < MAX_AMOUNT ? n : null
}

function pushKey(raw: string, key: string): string {
  if (key === 'del') return raw.slice(0, -1)
  if (key === ',') return raw.includes(',') ? raw : (raw || '0') + ','
  const [int, dec] = raw.split(',')
  if (dec !== undefined && dec.length >= 2) return raw
  if (dec === undefined && int.length >= 7) return raw
  return raw === '0' ? key : raw + key
}

export default function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} label="Nouvelle dépense">
      {open && <QuickAddForm onClose={onClose} />}
    </BottomSheet>
  )
}

function QuickAddForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { monthKey, monthLabel } = useMonth()
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [raw, setRaw] = useState('')
  const [label, setLabel] = useState('')
  const [catId, setCatId] = useState('')
  const [date, setDate] = useState(() => defaultDateForMonth(monthKey))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Contexte chargé côté client avec la session de l'utilisateur ; les règles d'API
  // PocketBase restent la vraie barrière d'accès. Filtres paramétrés (pb.filter) : valeurs échappées.
  useEffect(() => {
    let alive = true
    const pb = createClient()
    const userId = pb.authStore.record?.id
    if (!pb.authStore.isValid || !userId) {
      router.push('/login')
      return
    }
    ;(async () => {
      const member = await pb.collection('workspace_members').getFirstListItem(
        pb.filter('user_id = {:uid}', { uid: userId }), { requestKey: null })
      const workspaceId = member.workspace_id as string
      const [months, categories] = await Promise.all([
        pb.collection('months').getFullList({
          filter: pb.filter('workspace_id = {:ws} && month_key = {:mk}', { ws: workspaceId, mk: monthKey }),
          requestKey: null,
        }),
        pb.collection('categories').getFullList({
          filter: pb.filter('workspace_id = {:ws}', { ws: workspaceId }), sort: 'name', requestKey: null,
        }),
      ])
      return { userId, workspaceId, month: months[0] ?? null, categories: categories as unknown as Ctx['categories'] }
    })()
      .then(c => { if (alive) setCtx(c) })
      .catch(err => {
        console.error('QuickAdd load error:', err)
        if (alive) setLoadError('Impossible de charger tes enveloppes. Réessaie dans un instant.')
      })
    return () => { alive = false }
  }, [monthKey, router])

  // Saisie au clavier physique (ordinateur), hors champ libellé
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (/^\d$/.test(e.key)) setRaw(r => pushKey(r, e.key))
      else if (e.key === ',' || e.key === '.') setRaw(r => pushKey(r, ','))
      else if (e.key === 'Backspace') setRaw(r => pushKey(r, 'del'))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const amount = parseAmount(raw)
  const closed = ctx?.month ? isMonthClosed(ctx.month) : false
  const selectedCat = useMemo(() => ctx?.categories.find(c => c.id === catId), [ctx, catId])
  const dateOk = isDateInMonth(date, monthKey)
  const canSave = !!ctx?.month && !closed && amount !== null && dateOk && !saving

  async function save() {
    if (!ctx?.month || closed || amount === null || !dateOk) return
    setSaving(true); setSaveError(null)
    try {
      const pb = createClient()
      // Même règle que l'onglet Dépenses > Courante
      const envelopeSlug = selectedCat?.name === 'Courses' ? 'courses' : 'plaisir'
      await pb.collection('transactions').create({
        month_id: ctx.month.id,
        workspace_id: ctx.workspaceId,
        envelope_slug: envelopeSlug,
        category_id: catId || null,
        label: (label.trim() || selectedCat?.name || 'Dépense').slice(0, 120),
        amount: Math.round(amount * 100) / 100,
        date,
        created_by: ctx.userId,
      })
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT))
      onClose()
    } catch (err) {
      console.error('QuickAdd save error:', err)
      setSaveError("L'enregistrement a échoué. Vérifie ta connexion et réessaie.")
    } finally {
      setSaving(false)
    }
  }

  const display = raw === '' ? '0' : raw

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="h-11 text-[15px] font-semibold text-[var(--text-secondary)]">Annuler</button>
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Dépense · {monthLabel}</h2>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="text-center" aria-live="polite">
        <p className={`font-display text-[56px] font-bold leading-none ${raw ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
          {display} €
        </p>
        {amount !== null && <span className="sr-only">{fmt(amount)}</span>}
      </div>

      {loadError && <p role="alert" className="text-[13px] text-negative text-center">{loadError}</p>}
      {ctx && !ctx.month && (
        <p role="alert" className="text-[13px] text-[var(--text-secondary)] text-center">
          Ce mois n&apos;est pas encore ouvert. Affiche-le une première fois depuis Budget.
        </p>
      )}
      {closed && (
        <p role="alert" className="flex items-center justify-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
          <Lock size={13} /> {monthLabel} est clôturé : rouvre-le pour ajouter une dépense.
        </p>
      )}

      <div className="flex gap-2">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Libellé (facultatif)</span>
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={120}
            placeholder="Libellé (facultatif)"
            className="w-full h-11 rounded-[14px] px-4 bg-[var(--bg-surface-2)] text-[15px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none border border-transparent focus:border-accent-text" />
        </label>
        <label className="w-[148px] flex-shrink-0">
          <span className="sr-only">Date</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            min={`${monthKey}-01`} max={`${monthKey}-${String(new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate()).padStart(2, '0')}`}
            aria-invalid={!dateOk}
            className={`w-full h-11 rounded-[14px] px-3 bg-[var(--bg-surface-2)] text-[15px] text-[var(--text-primary)] outline-none border ${dateOk ? 'border-transparent focus:border-accent-text' : 'border-negative'}`} />
        </label>
      </div>
      {!dateOk && <p role="alert" className="text-[12px] text-negative -mt-2">La date doit être en {monthLabel}, sinon la dépense ne compte pas dans ce budget.</p>}

      <div role="radiogroup" aria-label="Catégorie" className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
        {!ctx && !loadError && <Loader2 size={18} className="animate-spin text-[var(--text-secondary)] mx-auto" />}
        {ctx?.categories.map(c => {
          const on = c.id === catId
          return (
            <button key={c.id} role="radio" aria-checked={on} onClick={() => setCatId(on ? '' : c.id)}
              className={`h-10 px-4 rounded-full text-[14px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${on ? 'bg-accent text-accent-ink' : 'border border-[var(--border-default)] text-[var(--text-body)]'}`}>
              {c.icon ? `${c.icon} ` : ''}{c.name}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYS.map(k => (
          <button key={k} onClick={() => setRaw(r => pushKey(r, k))}
            aria-label={k === 'del' ? 'Effacer' : k === ',' ? 'Virgule' : k}
            className="h-14 rounded-[16px] bg-[var(--bg-surface-2)] text-[22px] font-semibold text-[var(--text-primary)] flex items-center justify-center active:scale-95 transition-transform">
            {k === 'del' ? <Delete size={22} /> : k}
          </button>
        ))}
      </div>

      {saveError && <p role="alert" className="text-[13px] text-negative text-center">{saveError}</p>}

      <button onClick={save} disabled={!canSave}
        className="h-14 rounded-[18px] bg-accent text-accent-ink text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform">
        {saving && <Loader2 size={18} className="animate-spin" />}
        Enregistrer
      </button>
    </div>
  )
}

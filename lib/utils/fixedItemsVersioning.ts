// ─────────────────────────────────────────────────────────
// Historisation des revenus (fixed_items de type "income")
//
// Chaque fixed_item a une période de validité :
//   - start_month (YYYY-MM, vide = depuis toujours)
//   - end_month   (YYYY-MM, vide = sans fin)
// Modifier le montant d'un revenu depuis le mois M ne réécrit PAS l'historique :
// l'ancienne version est clôturée au mois M-1 et une nouvelle version démarre en M.
//
// Revenu exceptionnel : is_exceptional=true, start_month = end_month = le mois concerné
// (il n'apparaît que sur ce mois, jamais mensualisé). Peut être programmé sur un mois futur.
//
// Revenu annuel (13e mois, primes) : annual_months = "06,11" → compté uniquement ces
// mois-là, chaque année, dans la limite de start_month / end_month.
// ─────────────────────────────────────────────────────────
import type PocketBase from 'pocketbase'
import { getMonthKey } from '@/lib/utils'

export interface VersionedFixedItem {
  id: string
  type: 'charge' | 'income'
  name: string
  amount: number
  due_day: number
  icon: string
  color: string | null
  category?: string
  is_active: boolean
  start_month?: string | null
  end_month?: string | null
  is_exceptional?: boolean
  annual_months?: string | null
}

export const MONTH_NAMES_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

// "06,11" → [6, 11]
export function parseAnnualMonths(value?: string | null): number[] {
  return (value ?? '').split(',').map(v => parseInt(v, 10)).filter(n => n >= 1 && n <= 12).sort((a, b) => a - b)
}

// [11, 6] → "06,11"
export function formatAnnualMonths(months: number[]): string {
  return [...new Set(months)].sort((a, b) => a - b).map(m => String(m).padStart(2, '0')).join(',')
}

export function addMonths(monthKey: string, n: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  return getMonthKey(new Date(year, month - 1 + n, 1))
}

export function prevMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return getMonthKey(new Date(year, month - 2, 1))
}

// Un item est-il valable pour le mois affiché ? (PocketBase renvoie "" pour un champ texte vide)
type MonthScoped = { start_month?: string | null; end_month?: string | null; annual_months?: string | null }

export function isFixedItemActiveInMonth(item: MonthScoped, monthKey: string): boolean {
  const start = item.start_month || null
  const end = item.end_month || null
  if (start && start > monthKey) return false
  if (end && end < monthKey) return false
  const annual = parseAnnualMonths(item.annual_months)
  if (annual.length > 0 && !annual.includes(Number(monthKey.slice(5, 7)))) return false
  return true
}

export function filterFixedItemsForMonth<T extends MonthScoped>(items: T[], monthKey: string): T[] {
  return (items ?? []).filter(i => isFixedItemActiveInMonth(i, monthKey))
}

interface SavePayload {
  workspace_id: string
  type: 'charge' | 'income'
  name: string
  amount: number
  due_day: number
  icon: string
  color: string | null
  category: string
  is_exceptional?: boolean
  annual_months?: string
  target_month?: string // mois de versement d'un revenu exceptionnel (défaut : mois affiché)
}

// Création / modification d'un fixed_item en préservant l'historique des mois précédents.
export async function saveFixedItemVersioned(
  pb: PocketBase,
  { editItem, payload, monthKey }: { editItem: VersionedFixedItem | null; payload: SavePayload; monthKey: string },
) {
  const { target_month, ...data } = payload
  // annual_months absent (ex : édition depuis le Calendrier) → on garde celui de l'item
  payload = { ...data, annual_months: data.is_exceptional ? '' : (data.annual_months ?? editItem?.annual_months ?? '') }
  const exceptional = !!payload.is_exceptional
  const exceptionalMonth = target_month || monthKey

  // ── Création
  if (!editItem) {
    return pb.collection('fixed_items').create({
      ...payload,
      is_active: true,
      is_exceptional: exceptional,
      start_month: exceptional ? exceptionalMonth : monthKey,
      end_month: exceptional ? exceptionalMonth : '',
    })
  }

  // ── Exceptionnel → exceptionnel : simple mise à jour, il reste sur son mois
  if (exceptional && editItem.is_exceptional) {
    const m = target_month || editItem.start_month || monthKey
    return pb.collection('fixed_items').update(editItem.id, { ...payload, is_exceptional: true, start_month: m, end_month: m })
  }

  // ── Exceptionnel → récurrent : devient mensuel à partir de son mois
  if (!exceptional && editItem.is_exceptional) {
    return pb.collection('fixed_items').update(editItem.id, {
      ...payload, is_exceptional: false, start_month: editItem.start_month || monthKey, end_month: '',
    })
  }

  // ── Récurrent → exceptionnel : on arrête le récurrent à partir de ce mois
  //    (historique conservé) et on crée un exceptionnel pour ce mois uniquement
  if (exceptional && !editItem.is_exceptional) {
    await removeFixedItemFromMonth(pb, editItem, monthKey)
    return pb.collection('fixed_items').create({
      ...payload, is_active: true, is_exceptional: true, start_month: exceptionalMonth, end_month: exceptionalMonth,
    })
  }

  const amountChanged = Number(editItem.amount) !== Number(payload.amount)
  const dayChanged = Number(editItem.due_day) !== Number(payload.due_day)
  const annualChanged = formatAnnualMonths(parseAnnualMonths(editItem.annual_months)) !== formatAnnualMonths(parseAnnualMonths(payload.annual_months))
  const startsThisMonth = (editItem.start_month || '') === monthKey

  // Changement purement cosmétique (nom, icône, couleur) ou version créée ce mois-ci :
  // on met à jour en place, pas besoin de nouvelle version.
  if ((!amountChanged && !dayChanged && !annualChanged) || startsThisMonth) {
    return pb.collection('fixed_items').update(editItem.id, payload)
  }

  // Changement de montant / date : on clôture l'ancienne version au mois précédent
  // et on crée une nouvelle version à partir du mois affiché.
  await pb.collection('fixed_items').update(editItem.id, { end_month: prevMonthKey(monthKey) })
  const created = await pb.collection('fixed_items').create({
    ...payload,
    is_active: true,
    is_exceptional: false,
    start_month: monthKey,
    end_month: editItem.end_month || '',
  })

  // Reporter l'éventuel statut "reçu" du mois courant sur la nouvelle version
  const statuses = await pb.collection('fixed_item_status').getFullList({
    filter: `fixed_item_id="${editItem.id}" && month_key>="${monthKey}"`,
  })
  await Promise.all(statuses.map(s => pb.collection('fixed_item_status').update(s.id, { fixed_item_id: created.id })))

  return created
}

// Suppression depuis le mois affiché : le revenu disparaît à partir de ce mois,
// mais reste visible (et compté) sur les mois précédents.
export async function removeFixedItemFromMonth(pb: PocketBase, item: VersionedFixedItem, monthKey: string) {
  const start = item.start_month || null
  if (item.is_exceptional || (start && start >= monthKey)) {
    return pb.collection('fixed_items').update(item.id, { is_active: false })
  }
  return pb.collection('fixed_items').update(item.id, { end_month: prevMonthKey(monthKey) })
}

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
// (il n'apparaît que sur ce mois, jamais mensualisé).
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
}

export function prevMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return getMonthKey(new Date(year, month - 2, 1))
}

// Un item est-il valable pour le mois affiché ? (PocketBase renvoie "" pour un champ texte vide)
export function isFixedItemActiveInMonth(item: { start_month?: string | null; end_month?: string | null }, monthKey: string): boolean {
  const start = item.start_month || null
  const end = item.end_month || null
  if (start && start > monthKey) return false
  if (end && end < monthKey) return false
  return true
}

export function filterFixedItemsForMonth<T extends { start_month?: string | null; end_month?: string | null }>(items: T[], monthKey: string): T[] {
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
}

// Création / modification d'un fixed_item en préservant l'historique des mois précédents.
export async function saveFixedItemVersioned(
  pb: PocketBase,
  { editItem, payload, monthKey }: { editItem: VersionedFixedItem | null; payload: SavePayload; monthKey: string },
) {
  const exceptional = !!payload.is_exceptional

  // ── Création
  if (!editItem) {
    return pb.collection('fixed_items').create({
      ...payload,
      is_active: true,
      is_exceptional: exceptional,
      start_month: monthKey,
      end_month: exceptional ? monthKey : '',
    })
  }

  // ── Exceptionnel → exceptionnel : simple mise à jour, il reste sur son mois
  if (exceptional && editItem.is_exceptional) {
    const m = editItem.start_month || monthKey
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
      ...payload, is_active: true, is_exceptional: true, start_month: monthKey, end_month: monthKey,
    })
  }

  const amountChanged = Number(editItem.amount) !== Number(payload.amount)
  const dayChanged = Number(editItem.due_day) !== Number(payload.due_day)
  const startsThisMonth = (editItem.start_month || '') === monthKey

  // Changement purement cosmétique (nom, icône, couleur) ou version créée ce mois-ci :
  // on met à jour en place, pas besoin de nouvelle version.
  if ((!amountChanged && !dayChanged) || startsThisMonth) {
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

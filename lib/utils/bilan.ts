// ─────────────────────────────────────────────────────────
// Bilan annuel : revenus / dépenses / épargne mois par mois
//
// Par mois :
//   - revenus  = revenus fixes du mois (copie figée si clôturé, sinon versions valables)
//   - charges  = charges fixes du mois (idem)
//   - variables = transactions réelles hors enveloppes "charges" et "epargne" (courses incluses)
//   - épargne  = budget de l'enveloppe "epargne" du mois
//   - solde    = revenus − charges − variables − épargne
// Les mois futurs sont du prévisionnel (revenus/charges connus, pas encore de dépenses).
// Moyennes et taux d'épargne : calculés sur les mois écoulés + mois en cours ayant un revenu.
// ─────────────────────────────────────────────────────────
import { fixedItemMonthlyAmount, getMonthKey } from '@/lib/utils'
import { fixedItemsForMonth } from '@/lib/utils/monthLock'

export const MONTH_LABELS_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

export interface BilanMonth {
  monthKey: string
  label: string
  status: 'past' | 'current' | 'future'
  revenus: number
  charges: number
  variables: number
  depenses: number // charges + variables
  epargne: number
  solde: number
}

export interface BilanSummary {
  months: BilanMonth[]
  counted: number // nombre de mois pris en compte dans les moyennes
  totalRevenus: number
  totalDepenses: number
  totalEpargne: number
  totalSolde: number
  avgRevenus: number
  avgDepenses: number
  avgEpargne: number
  tauxEpargne: number // épargne / revenus (0-1)
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeBilan({ year, monthRecords, fixedItems, envelopes, transactions, today = new Date() }: {
  year: number
  monthRecords: any[] // records `months` de l'année
  fixedItems: any[] // fixed_items actifs (toutes versions)
  envelopes: any[] // enveloppes des mois de l'année
  transactions: any[] // transactions de l'année
  today?: Date
}): BilanSummary {
  const currentKey = getMonthKey(today)

  const months: BilanMonth[] = Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`
    const record = monthRecords.find(m => m.month_key === monthKey) ?? null
    const items = fixedItemsForMonth(record, fixedItems, monthKey)

    const revenus = items.filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + fixedItemMonthlyAmount(f, monthKey), 0)
    const charges = items.filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + fixedItemMonthlyAmount(f, monthKey), 0)
    const variables = transactions
      .filter(t => String(t.date ?? '').slice(0, 7) === monthKey && t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
    const epargne = record
      ? Number(envelopes.find(e => e.month_id === record.id && e.slug === 'epargne')?.budget ?? 0)
      : 0

    const status: BilanMonth['status'] = monthKey < currentKey ? 'past' : monthKey === currentKey ? 'current' : 'future'
    const depenses = charges + variables
    return {
      monthKey, label: MONTH_LABELS_SHORT[i], status,
      revenus: round2(revenus), charges: round2(charges), variables: round2(variables),
      depenses: round2(depenses), epargne: round2(epargne),
      solde: round2(revenus - depenses - epargne),
    }
  })

  const counted = months.filter(m => m.status !== 'future' && m.revenus > 0)
  const sum = (k: keyof BilanMonth) => counted.reduce((s, m) => s + (m[k] as number), 0)
  const n = counted.length
  const totalRevenus = sum('revenus')
  const totalEpargne = sum('epargne')

  return {
    months,
    counted: n,
    totalRevenus: round2(totalRevenus),
    totalDepenses: round2(sum('depenses')),
    totalEpargne: round2(totalEpargne),
    totalSolde: round2(sum('solde')),
    avgRevenus: n ? round2(totalRevenus / n) : 0,
    avgDepenses: n ? round2(sum('depenses') / n) : 0,
    avgEpargne: n ? round2(totalEpargne / n) : 0,
    tauxEpargne: totalRevenus > 0 ? totalEpargne / totalRevenus : 0,
  }
}

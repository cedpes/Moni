import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Couleur acceptée pour une tuile d'icône : hexadécimal (#rgb, #rrggbb) ou jeton CSS (var(--nom)).
// Les couleurs viennent de la base (choisies par l'utilisateur) : on refuse tout le reste
// plutôt que d'injecter une valeur arbitraire dans un style.
const SAFE_COLOR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|var\(--[a-z0-9-]+\))$/

/**
 * Fond d'une tuile d'icône à partir de sa couleur enregistrée (pastel).
 * En thème sombre la couleur est fortement atténuée dans la surface (--tile-mix),
 * en thème clair elle est affichée telle quelle. Les données en base ne changent pas.
 */
export function tileBg(color: string | null | undefined): string {
  const c = color && SAFE_COLOR.test(color) ? color : 'var(--bg-surface-2)'
  return `color-mix(in srgb, ${c} var(--tile-mix), var(--bg-surface-2))`
}

export function fmt(amount: number, currency = 'EUR'): string {
  const hasCents = Math.round(Math.abs(amount) * 100) % 100 !== 0
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function fmtDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function fmtDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const months = ['Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  return `${months[month - 1]} ${year}`
}

export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month, 1)
  return getMonthKey(next)
}

// Date par défaut à proposer pour une nouvelle dépense/transaction sur un mois donné :
// aujourd'hui si on est sur le mois réel en cours, sinon le jour du mois "aujourd'hui"
// mais recalé dans le mois affiché (ex : le 30 si le mois affiché a moins de jours -> dernier jour).
// Évite le bug où une dépense ajoutée en étant sur un autre mois que le mois réel se voit
// attribuer la date du jour réel (donc un autre mois que celui affiché), ce qui la fait
// disparaître du calcul du mois réellement concerné.
export function defaultDateForMonth(monthKey: string): string {
  const today = new Date()
  const realMonthKey = getMonthKey(today)
  // Date locale (toISOString passerait en UTC : la veille entre minuit et 2 h à Paris)
  if (monthKey === realMonthKey) return `${realMonthKey}-${String(today.getDate()).padStart(2, '0')}`
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const day = Math.min(today.getDate(), daysInMonth)
  return `${monthKey}-${String(day).padStart(2, '0')}`
}

// Vérifie qu'une date (YYYY-MM-DD) tombe bien dans le mois affiché (YYYY-MM)
export function isDateInMonth(date: string, monthKey: string): boolean {
  return typeof date === 'string' && date.slice(0, 7) === monthKey
}

export function barColor(pct: number): string {
  if (pct < 70) return 'bg-positive'
  if (pct < 100) return 'bg-warning'
  return 'bg-negative'
}

export function barColorHex(pct: number): string {
  if (pct < 70) return 'var(--positive)'
  if (pct < 100) return 'var(--warning)'
  return 'var(--negative)'
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ─────────────────────────────────────────────────────────
// Revenus/charges "fixes" hebdomadaires
// On réutilise le champ `due_day` des fixed_items : 1-31 = jour du mois (mensuel),
// 101-107 = jour de la semaine encodé (hebdomadaire, ISO : 1=Lundi ... 7=Dimanche),
// pour éviter d'avoir à ajouter un champ en base.
// ─────────────────────────────────────────────────────────
export const WEEKDAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const WEEKDAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function isWeeklyDueDay(dueDay: number): boolean {
  return dueDay > 100
}

export function isoWeekdayFromDueDay(dueDay: number): number {
  return dueDay - 100
}

export function weeklyDueDay(isoWeekday: number): number {
  return 100 + isoWeekday
}

// Nombre d'occurrences d'un jour de semaine ISO (1=Lundi...7=Dimanche) dans un mois donné (YYYY-MM)
export function countWeekdayOccurrences(monthKey: string, isoWeekday: number): number {
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const jsDay = new Date(year, month - 1, day).getDay() // 0=Dimanche...6=Samedi
    const iso = jsDay === 0 ? 7 : jsDay
    if (iso === isoWeekday) count++
  }
  return count
}

// Montant effectif d'un fixed_item pour un mois donné (multiplie par le nombre d'occurrences si hebdomadaire)
export function fixedItemMonthlyAmount(item: { amount: number; due_day: number }, monthKey: string): number {
  if (isWeeklyDueDay(item.due_day)) {
    return item.amount * countWeekdayOccurrences(monthKey, isoWeekdayFromDueDay(item.due_day))
  }
  return item.amount
}

// ─────────────────────────────────────────────────────────
// Découpage d'un mois en semaines (Lundi → Dimanche, semaines de début/fin
// de mois tronquées aux bornes du mois), pour la vue budget hebdomadaire.
// ─────────────────────────────────────────────────────────
const MONTH_SHORT = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export interface MonthWeek {
  index: number
  startDay: number
  endDay: number
  label: string
}

export function getWeeksOfMonth(monthKey: string): MonthWeek[] {
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const weeks: MonthWeek[] = []
  let day = 1
  let index = 0
  while (day <= daysInMonth) {
    const jsDay = new Date(year, month - 1, day).getDay() // 0=Dimanche...6=Samedi
    const iso = jsDay === 0 ? 7 : jsDay // 1=Lundi...7=Dimanche
    const endDay = Math.min(daysInMonth, day + (7 - iso))
    const mLabel = MONTH_SHORT[month - 1]
    weeks.push({
      index,
      startDay: day,
      endDay,
      label: day === endDay ? `${day} ${mLabel}` : `${day}–${endDay} ${mLabel}`,
    })
    day = endDay + 1
    index++
  }
  return weeks
}

// Montant d'un fixed_item à affecter à une semaine donnée du mois :
// - hebdomadaire : le montant si le jour de la semaine ciblé tombe dans cette semaine, sinon 0
// - mensuel : le montant si le jour de prélèvement tombe dans cette semaine, sinon 0
export function fixedItemAmountForWeek(
  item: { amount: number; due_day: number },
  monthKey: string,
  week: { startDay: number; endDay: number }
): number {
  const [year, month] = monthKey.split('-').map(Number)
  if (isWeeklyDueDay(item.due_day)) {
    const targetIso = isoWeekdayFromDueDay(item.due_day)
    for (let d = week.startDay; d <= week.endDay; d++) {
      const jsDay = new Date(year, month - 1, d).getDay()
      const iso = jsDay === 0 ? 7 : jsDay
      if (iso === targetIso) return item.amount
    }
    return 0
  }
  return item.due_day >= week.startDay && item.due_day <= week.endDay ? item.amount : 0
}

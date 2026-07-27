import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
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

export function barColor(pct: number): string {
  if (pct < 70) return 'bg-green-500'
  if (pct < 100) return 'bg-orange-400'
  return 'bg-red-500'
}

export function barColorHex(pct: number): string {
  if (pct < 70) return '#34c759'
  if (pct < 100) return '#ff9f0a'
  return '#ff3b30'
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

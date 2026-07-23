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

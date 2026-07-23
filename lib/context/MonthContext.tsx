'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { getMonthKey, getMonthLabel } from '@/lib/utils'

interface MonthContextType {
  monthKey: string
  monthLabel: string
  goNext: () => void
  goPrev: () => void
  goToday: () => void
  isCurrentMonth: boolean
}

const MonthContext = createContext<MonthContextType | null>(null)

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const todayKey = getMonthKey()
  const [monthKey, setMonthKey] = useState(todayKey)

  const goNext = useCallback(() => {
    setMonthKey(k => {
      const [y, m] = k.split('-').map(Number)
      const next = new Date(y, m, 1)
      return getMonthKey(next)
    })
  }, [])

  const goPrev = useCallback(() => {
    setMonthKey(k => {
      const [y, m] = k.split('-').map(Number)
      const prev = new Date(y, m - 2, 1)
      return getMonthKey(prev)
    })
  }, [])

  const goToday = useCallback(() => setMonthKey(getMonthKey()), [])

  return (
    <MonthContext.Provider value={{
      monthKey,
      monthLabel: getMonthLabel(monthKey),
      goNext,
      goPrev,
      goToday,
      isCurrentMonth: monthKey === todayKey,
    }}>
      {children}
    </MonthContext.Provider>
  )
}

export function useMonth() {
  const ctx = useContext(MonthContext)
  if (!ctx) throw new Error('useMonth must be used within MonthProvider')
  return ctx
}

'use client'

import { useMonth } from '@/lib/context/MonthContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function MonthPicker() {
  const { monthLabel, goNext, goPrev, isCurrentMonth, goToday } = useMonth()

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={goPrev}
        className="w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Mois précédent"
      >
        <ChevronLeft size={14} color="var(--text-primary)" />
      </button>

      <button
        onClick={goToday}
        className="px-3 h-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-full text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1 active:scale-95 transition-transform min-w-[110px] justify-center"
      >
        {monthLabel}
        {!isCurrentMonth && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] ml-0.5" />
        )}
      </button>

      <button
        onClick={goNext}
        className="w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Mois suivant"
      >
        <ChevronRight size={14} color="var(--text-primary)" />
      </button>
    </div>
  )
}

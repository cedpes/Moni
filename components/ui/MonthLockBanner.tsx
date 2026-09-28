'use client'

import { useState } from 'react'
import { Lock, LockOpen, Loader2 } from 'lucide-react'
import { isPastMonth, isCurrentOrPastMonth } from '@/lib/utils/monthLock'

interface Props {
  monthKey: string
  month: any
  closed: boolean
  onClose: () => Promise<void>
  onReopen: () => Promise<void>
}

// Bandeau affiché sur le mois en cours et les mois passés : clôturé (lecture seule) ou ouvert (modifiable).
export default function MonthLockBanner({ monthKey, month, closed, onClose, onReopen }: Props) {
  const [busy, setBusy] = useState(false)
  if (!month || !isCurrentOrPastMonth(monthKey)) return null
  const current = !isPastMonth(monthKey)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-[16px] px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center flex-shrink-0">
        {closed ? <Lock size={14} color="var(--text-secondary)" /> : <LockOpen size={14} color={current ? 'var(--text-secondary)' : '#ff9f0a'} />}
      </div>
      <p className="flex-1 text-[12px] text-[var(--text-secondary)] leading-snug">
        {closed
          ? 'Mois clôturé : les montants sont figés.'
          : current
            ? 'Mois en cours. Clôture-le quand il est terminé pour figer ses montants.'
            : 'Mois rouvert : les modifications changent ce mois. Pense à le re-clôturer.'}
      </p>
      <button disabled={busy} onClick={() => run(closed ? onReopen : onClose)}
        className="h-8 px-3 rounded-full bg-[var(--bg-surface-2)] text-[12px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5 disabled:opacity-50">
        {busy && <Loader2 size={12} className="animate-spin" />}
        {closed ? 'Rouvrir' : 'Clôturer'}
      </button>
    </div>
  )
}

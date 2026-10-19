'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}

// Feuille modale ancrée en bas d'écran : fermeture au clic sur le fond et à Échap,
// focus placé dans la feuille à l'ouverture puis rendu à l'élément d'origine.
export default function BottomSheet({ open, onClose, label, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], button, a[href], input, select')
    first?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-[var(--overlay)] flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label}
        className="w-full max-w-lg bg-[var(--bg-surface)] rounded-t-[var(--radius-hero)] px-5 pt-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        <div aria-hidden="true" className="w-10 h-[5px] rounded-full bg-[var(--bg-surface-3)] mx-auto mb-3" />
        {children}
      </div>
    </div>
  )
}

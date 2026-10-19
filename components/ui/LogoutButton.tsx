'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { logout } from '@/lib/pocketbase/client'

// Bouton « Se déconnecter » avec confirmation en deux temps (pas de boîte de dialogue native).
export default function LogoutButton({ variant = 'row', onDone }: { variant?: 'row' | 'block'; onDone?: () => void }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  function doLogout() {
    setBusy(true)
    logout()
    onDone?.()
    router.replace('/login')
    router.refresh()
  }

  if (confirm) {
    return (
      <div className={`flex items-center gap-2 ${variant === 'row' ? 'h-14 px-1' : ''}`}>
        <span className="flex-1 text-[14px] text-[var(--text-body)]">Se déconnecter de Moni ?</span>
        <button onClick={() => setConfirm(false)} disabled={busy}
          className="h-10 px-4 rounded-full text-[14px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface-2)]">
          Annuler
        </button>
        <button onClick={doLogout} disabled={busy}
          className="h-10 px-4 rounded-full text-[14px] font-semibold bg-negative text-on-negative flex items-center gap-1.5">
          {busy && <Loader2 size={14} className="animate-spin" />}Déconnexion
        </button>
      </div>
    )
  }

  return variant === 'row' ? (
    <button onClick={() => setConfirm(true)} className="w-full flex items-center gap-3 h-14 px-1 text-left">
      <span className="w-10 h-10 rounded-[var(--radius-icon)] flex items-center justify-center bg-negative/15 text-negative">
        <LogOut size={18} />
      </span>
      <span className="flex-1 text-[16px] font-semibold text-negative">Se déconnecter</span>
    </button>
  ) : (
    <button onClick={() => setConfirm(true)}
      className="w-full h-12 rounded-[16px] bg-[var(--bg-surface)] text-negative text-[15px] font-semibold flex items-center justify-center gap-2">
      <LogOut size={17} /> Se déconnecter
    </button>
  )
}

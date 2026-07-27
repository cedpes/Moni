'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/context/ThemeContext'
import { ChevronLeft, Sun, Moon } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  return (
    <div className="min-h-screen bg-[var(--bg-app)] pb-24">
      <header className="sticky top-0 z-10 bg-[var(--header-blur-bg)] backdrop-blur-xl border-b border-[var(--border-default)] px-5 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-transform">
            <ChevronLeft size={16} />
          </button>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Réglages</h1>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-4">
        <div>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] px-1 mb-2">Apparence</p>
          <div className="bg-[var(--bg-surface)] rounded-[20px] p-1.5 flex gap-1.5">
            {([
              { id: 'dark' as const, label: 'Sombre', icon: Moon },
              { id: 'light' as const, label: 'Clair', icon: Sun },
            ]).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTheme(id)}
                className={`flex-1 h-16 rounded-[16px] flex flex-col items-center justify-center gap-1.5 text-[13px] font-semibold transition-all ${
                  theme === id ? 'bg-[var(--text-primary)] text-[var(--bg-app)]' : 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]'
                }`}>
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

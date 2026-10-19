'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PieChart, CreditCard, PiggyBank, Plus, MoreHorizontal,
  Wallet, Mail, ShoppingCart, CalendarDays, BarChart3, Settings, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthProvider } from '@/lib/context/MonthContext'
import BottomSheet from '@/components/ui/BottomSheet'
import QuickAddSheet from '@/components/features/quick-add/QuickAddSheet'

const mainTabs = [
  { href: '/budget',   label: 'Budget',   icon: PieChart },
  { href: '/depenses', label: 'Dépenses', icon: CreditCard },
]
const sideTabs = [
  { href: '/epargne',  label: 'Épargne',  icon: PiggyBank },
]
const moreLinks = [
  { href: '/revenus',   label: 'Revenus',    icon: Wallet },
  { href: '/envelopes', label: 'Enveloppes', icon: Mail },
  { href: '/courses',   label: 'Courses',    icon: ShoppingCart },
  { href: '/calendar',  label: 'Calendrier', icon: CalendarDays },
  { href: '/bilan',     label: 'Bilan annuel', icon: BarChart3 },
  { href: '/settings',  label: 'Réglages',   icon: Settings },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof PieChart; active: boolean }) {
  return (
    <Link href={href} aria-label={label} aria-current={active ? 'page' : undefined}
      className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
        active ? 'bg-accent-soft text-accent-text' : 'text-[var(--text-secondary)]'
      )}>
      <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [addOpen, setAddOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const closeAdd = useCallback(() => setAddOpen(false), [])
  const closeMore = useCallback(() => setMoreOpen(false), [])
  const moreActive = moreLinks.some(l => isActive(pathname, l.href))

  return (
    <MonthProvider>
      <div className="min-h-screen bg-[var(--bg-app)] pb-28">
        {children}

        <nav aria-label="Navigation principale"
          className="fixed left-4 right-4 z-50 mx-auto max-w-md h-16 rounded-full bg-[var(--header-blur-bg)] backdrop-blur-xl border border-[var(--border-default)] flex items-center justify-around px-2 shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
          {mainTabs.map(t => <TabLink key={t.href} {...t} active={isActive(pathname, t.href)} />)}
          <button onClick={() => setAddOpen(true)} aria-label="Ajouter une dépense" aria-haspopup="dialog"
            className="w-14 h-14 rounded-full bg-accent text-accent-ink flex items-center justify-center active:scale-95 transition-transform">
            <Plus size={26} strokeWidth={2.4} />
          </button>
          {sideTabs.map(t => <TabLink key={t.href} {...t} active={isActive(pathname, t.href)} />)}
          <button onClick={() => setMoreOpen(true)} aria-label="Plus de pages" aria-haspopup="dialog"
            aria-current={moreActive ? 'page' : undefined}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
              moreActive ? 'bg-accent-soft text-accent-text' : 'text-[var(--text-secondary)]'
            )}>
            <MoreHorizontal size={22} />
          </button>
        </nav>

        <QuickAddSheet open={addOpen} onClose={closeAdd} />

        <BottomSheet open={moreOpen} onClose={closeMore} label="Autres pages">
          <ul className="pb-2">
            {moreLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <li key={href}>
                  <Link href={href} onClick={closeMore} aria-current={active ? 'page' : undefined}
                    className="flex items-center gap-3 h-14 px-1 border-b border-[var(--border-subtle)] last:border-b-0">
                    <span className={cn('w-10 h-10 rounded-[var(--radius-icon)] flex items-center justify-center',
                      active ? 'bg-accent-soft text-accent-text' : 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]')}>
                      <Icon size={18} />
                    </span>
                    <span className="flex-1 text-[16px] font-semibold text-[var(--text-primary)]">{label}</span>
                    <ChevronRight size={18} className="text-[var(--text-tertiary)]" aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </BottomSheet>
      </div>
    </MonthProvider>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Layers, ListOrdered, ShoppingCart, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthProvider } from '@/lib/context/MonthContext'

const tabs = [
  { href: '/dashboard',    label: 'Accueil',    icon: LayoutDashboard },
  { href: '/envelopes',    label: 'Enveloppes', icon: Layers },
  { href: '/planned',      label: 'Prédictif',  icon: ListOrdered },
  { href: '/courses',      label: 'Courses',    icon: ShoppingCart },
  { href: '/calendar',     label: 'Calendrier', icon: Calendar },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <MonthProvider>
      <div className="min-h-screen bg-[#f5f5f7] pb-24">
        {children}

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-black/[0.06]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link key={href} href={href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[52px]',
                    active ? 'text-black' : 'text-[#86868b]'
                  )}>
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.8} className="transition-all" />
                  <span className={cn(
                    'text-[10px] font-medium tracking-tight transition-all',
                    active ? 'text-black' : 'text-[#86868b]'
                  )}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </MonthProvider>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wallet, CreditCard, Mail, PiggyBank, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthProvider } from '@/lib/context/MonthContext'

const tabs = [
  { href: '/revenus',   label: 'Revenus',    icon: Wallet },
  { href: '/depenses',  label: 'Dépenses',   icon: CreditCard },
  { href: '/envelopes', label: 'Enveloppes', icon: Mail },
  { href: '/epargne',   label: 'Epargne',    icon: PiggyBank },
  { href: '/budget',    label: 'Budget',     icon: PieChart },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <MonthProvider>
      <div className="min-h-screen bg-black pb-24">
        {children}

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[52px]',
                    active ? 'text-[#a78bfa]' : 'text-[#8e8e93]'
                  )}>
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.8} className="transition-all" />
                  <span className={cn(
                    'text-[10px] font-medium tracking-tight transition-all',
                    active ? 'text-[#a78bfa]' : 'text-[#8e8e93]'
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

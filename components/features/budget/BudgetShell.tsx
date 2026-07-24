'use client'

import { useMemo, useState } from 'react'
import { useMonth } from '@/lib/context/MonthContext'
import { useMonthData } from '@/hooks/useMonthData'
import { useRouter } from 'next/navigation'
import { fmt } from '@/lib/utils'
import MonthPicker from '@/components/ui/MonthPicker'
import DonutChart from '@/components/ui/DonutChart'
import { Wallet, CreditCard, Mail, PiggyBank, Loader2, Settings, Home, Info } from 'lucide-react'

interface Props { workspaceId: string; userId: string; displayName: string | null }

export default function BudgetShell({ workspaceId, displayName }: Props) {
  const router = useRouter()
  const { monthKey, monthLabel } = useMonth()
  const { month, envelopes, transactions, planned, fixedItems, loading } = useMonthData(monthKey, workspaceId)
  const [tab, setTab] = useState<'reel' | 'previsionnel'>('reel')

  const metrics = useMemo(() => {
    const income = month?.income ?? 0
    const chargesEnv = envelopes.find((e: any) => e.slug === 'charges')
    const epargneEnv = envelopes.find((e: any) => e.slug === 'epargne')
    const totalCharges = (fixedItems ?? []).filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + f.amount, 0)
    const epargne = epargneEnv?.budget ?? 0

    const [y, m] = (month?.month_key ?? monthKey).split('-').map(Number)
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const daysInMonth = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    const txInMonth = transactions.filter((t: any) => t.date >= monthStart && t.date <= monthEnd)

    // Réel : dépenses variables déjà réalisées (hors charges fixes, hors épargne)
    const variableReal = txInMonth
      .filter((t: any) => t.envelope_slug !== 'charges' && t.envelope_slug !== 'epargne')
      .reduce((s: number, t: any) => s + t.amount, 0)

    // Prévisionnel : budget alloué aux enveloppes variables (plaisir, courses, etc.)
    const variablePrevu = envelopes
      .filter((e: any) => e.slug !== 'charges' && e.slug !== 'epargne')
      .reduce((s: number, e: any) => s + e.budget, 0)

    const variable = tab === 'reel' ? variableReal : variablePrevu
    const restant = income - totalCharges - variable - epargne

    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
    const daysLeft = isCurrentMonth ? Math.max(1, daysInMonth - today.getDate() + 1) : daysInMonth
    const perDay = restant > 0 ? restant / daysLeft : 0

    const fixePct = income > 0 ? (totalCharges / income) * 100 : 0
    const variablePct = income > 0 ? (variable / income) * 100 : 0
    const epargnePct = income > 0 ? (epargne / income) * 100 : 0

    const budgetReparti = envelopes.reduce((s: number, e: any) => s + e.budget, 0)
    const budgetConsomme = txInMonth.reduce((s: number, t: any) => s + t.amount, 0)

    return {
      income, totalCharges, variable, epargne, restant, daysLeft, perDay,
      fixePct, variablePct, epargnePct, budgetReparti, budgetConsomme,
    }
  }, [month, envelopes, transactions, fixedItems, monthKey, tab])

  const { income, totalCharges, variable, epargne, restant, daysLeft, perDay, fixePct, variablePct, epargnePct, budgetReparti, budgetConsomme } = metrics

  const envDonut: Record<string, number> = {}
  envelopes.forEach((e: any) => { if (e.budget > 0) envDonut[e.name] = e.budget })

  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-xl border-b border-white/10 px-5 pt-14 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-[#8e8e93]">Bonjour {displayName?.split(' ')[0] ?? ''}</p>
            <h1 className="text-[28px] font-bold tracking-tight text-white leading-tight">Budget</h1>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <a href="https://hacpe.duckdns.org/local/domotique.html"
              className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-[#8e8e93] active:scale-95 transition-transform">
              <Home size={15} />
            </a>
            <MonthPicker />
            <button onClick={() => router.push('/settings')}
              className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-[#8e8e93] active:scale-95 transition-transform">
              <Settings size={15} />
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-20"><Loader2 size={28} className="animate-spin text-[#8e8e93]" /></div>
      ) : (
        <div className="px-4 pt-5 space-y-4">
          {/* Tabs Réel / Prévisionnel */}
          <div className="flex bg-[#1c1c1e] rounded-[16px] p-1 gap-1">
            {(['reel', 'previsionnel'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 h-9 rounded-[12px] text-[14px] font-semibold transition-all ${tab === t ? 'bg-white text-black' : 'text-[#8e8e93]'}`}>
                {t === 'reel' ? 'Réel' : 'Prévisionnel'}
              </button>
            ))}
          </div>

          {/* Entrées et sorties d'argent */}
          <div>
            <p className="text-[15px] font-semibold text-white px-1 mb-2">Entrées et sorties d&apos;argent</p>
            <div className="bg-[#1c1c1e] rounded-[20px] overflow-hidden">
              {[
                { label: 'Revenus', value: income, icon: Wallet, bg: '#1e3a8a', color: '#60a5fa' },
                { label: 'Dépenses fixes', value: totalCharges, icon: CreditCard, bg: '#3b0764', color: '#a78bfa' },
                { label: tab === 'reel' ? 'Dépenses variables' : 'Dépenses variables prévues', value: variable, icon: Mail, bg: '#312e81', color: '#818cf8' },
                { label: 'Épargne', value: epargne, icon: PiggyBank, bg: '#1e3a5f', color: '#38bdf8' },
              ].map(({ label, value, icon: Icon, bg, color }, i) => (
                <div key={label} className={`flex items-center px-4 py-3.5 gap-3 ${i < 3 ? 'border-b border-white/5' : ''}`}>
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon size={16} color={color} />
                  </div>
                  <p className="flex-1 text-[15px] text-white">{label}</p>
                  <p className="text-[15px] font-semibold text-white">{fmt(value)}</p>
                </div>
              ))}
              <div className="flex items-center px-4 py-3.5 gap-3 bg-white/5">
                <div className="w-9 h-9 rounded-[10px] bg-[#064e3b] flex items-center justify-center flex-shrink-0">
                  <Wallet size={16} color="#34d399" />
                </div>
                <p className="flex-1 text-[15px] font-semibold text-white">Restant {tab === 'reel' ? 'réel' : 'prévisionnel'}</p>
                <p className={`text-[15px] font-bold ${restant >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{fmt(restant)}</p>
              </div>
            </div>
          </div>

          {/* Gestion du budget quotidien */}
          <div className="bg-[#1c1c1e] rounded-[20px] p-4">
            <p className="text-[15px] font-semibold text-white mb-3">Gestion du budget quotidien</p>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#2c2c2e] flex items-center justify-center flex-shrink-0">
                <Info size={14} color="#8e8e93" />
              </div>
              <p className="text-[14px] text-[#d1d1d6] leading-relaxed">
                Il reste <strong className="text-[#f87171]">{daysLeft} jour{daysLeft > 1 ? 's' : ''}</strong> avant la fin du mois &amp;{' '}
                <strong className="text-[#34d399]">{fmt(perDay)}</strong> à dépenser par jour !
              </p>
            </div>
          </div>

          {/* Part des dépenses par rapport aux revenus */}
          <div className="bg-[#1c1c1e] rounded-[20px] p-4">
            <p className="text-[15px] font-semibold text-white mb-3">Part des dépenses par rapport aux revenus</p>
            <DonutChart
              data={{ Fixe: fixePct, Variable: variablePct, Épargne: epargnePct }}
              total={100}
              centerLabel="Total"
            />
          </div>

          {/* Détails des enveloppes */}
          <div className="bg-[#1c1c1e] rounded-[20px] p-4">
            <p className="text-[15px] font-semibold text-white mb-3">Détails des enveloppes</p>
            <div className="flex justify-between mb-1">
              <div>
                <p className="text-[12px] text-[#8e8e93]">Budget réparti</p>
                <p className="text-[16px] font-bold text-[#60a5fa]">{fmt(budgetReparti)}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#8e8e93]">Budget consommé</p>
                <p className="text-[16px] font-bold text-[#34d399]">{fmt(budgetConsomme)}</p>
              </div>
            </div>
            <p className="text-[12px] text-[#8e8e93] mb-3">Il reste {fmt(budgetReparti - budgetConsomme)} à dépenser</p>
            <DonutChart data={envDonut} total={budgetReparti} centerLabel="Total" />
          </div>
        </div>
      )}
    </div>
  )
}

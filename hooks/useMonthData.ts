'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/pocketbase/client'
import { getMonthLabel } from '@/lib/utils'

// Ajoute un alias `.categories` (compatible avec l'ancien embed Supabase `*, categories(name, icon)`)
// à partir de la relation PocketBase `expand.category_id`.
function withCategoryAlias(record: any) {
  return { ...record, categories: record.expand?.category_id ?? null }
}

export function useMonthData(monthKey: string, workspaceId: string) {
  const [month, setMonth] = useState<any>(null)
  const [envelopes, setEnvelopes] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [planned, setPlanned] = useState<any[]>([])
  const [fixedItems, setFixedItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const pb = createClient()

    // Chercher ou créer le mois
    const months = await pb.collection('months').getFullList({
      filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"`,
    })

    let m: any = months[0] ?? null

    if (!m) {
      m = await pb.collection('months').create({
        workspace_id: workspaceId,
        month_key: monthKey,
        label: getMonthLabel(monthKey),
        income: 0,
        courses_budget: 0,
        courses_weekly_budget: 0,
      })

      if (m) {
        await Promise.all([
          pb.collection('envelopes').create({ month_id: m.id, slug: 'charges', name: 'Charges fixes', icon: '🏠', budget: 0, is_system: true, position: 0 }),
          pb.collection('envelopes').create({ month_id: m.id, slug: 'plaisir',  name: 'Plaisir',      icon: '✨', budget: 0, is_system: true, position: 1 }),
          pb.collection('envelopes').create({ month_id: m.id, slug: 'epargne',  name: 'Épargne',      icon: '💰', budget: 0, is_system: true, position: 2 }),
          pb.collection('envelopes').create({ month_id: m.id, slug: 'courses',  name: 'Courses',      icon: '🛒', budget: 0, is_system: true, position: 3 }),
        ])
      }
    }

    if (!m) { setLoading(false); return }

    // Charger tout en parallèle
    const [envs, txs, pln, fixed] = await Promise.all([
      pb.collection('envelopes').getFullList({ filter: `month_id="${m.id}"`, sort: 'position' }),
      pb.collection('transactions').getFullList({ filter: `month_id="${m.id}"`, sort: '-created', expand: 'category_id' }),
      pb.collection('planned_expenses').getFullList({ filter: `month_id="${m.id}"`, sort: 'position', expand: 'category_id' }),
      pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && is_active=true` }),
    ])

    // Calculer le total des charges fixes depuis fixed_items
    const chargesTotal = (fixed ?? []).filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + f.amount, 0)
    const incomeTotal = (fixed ?? []).filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + f.amount, 0)

    // Mettre à jour l'enveloppe charges fixes et le revenu du mois automatiquement
    const chargesEnv: any = (envs ?? []).find((e: any) => e.slug === 'charges')
    if (chargesEnv && chargesEnv.budget !== chargesTotal) {
      await pb.collection('envelopes').update(chargesEnv.id, { budget: chargesTotal })
      chargesEnv.budget = chargesTotal
    }

    // Mettre à jour le revenu mensuel
    if (m.income !== incomeTotal) {
      await pb.collection('months').update(m.id, { income: incomeTotal })
      m = { ...m, income: incomeTotal }
    }

    setMonth(m)
    setEnvelopes(envs ?? [])
    setTransactions((txs ?? []).map(withCategoryAlias))
    setPlanned((pln ?? []).map(withCategoryAlias))
    setFixedItems(fixed ?? [])
    setLoading(false)
  }, [monthKey, workspaceId])

  useEffect(() => { fetchData() }, [fetchData])

  return { month, envelopes, transactions, planned, fixedItems, loading, refetch: fetchData }
}

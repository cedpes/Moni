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
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
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
        pb.collection('transactions').getFullList({ filter: `month_id="${m.id}"`, sort: '-date', expand: 'category_id' }),
        pb.collection('planned_expenses').getFullList({ filter: `month_id="${m.id}"`, sort: 'position', expand: 'category_id' }),
        pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && is_active=true` }),
      ])

      // Calculer le total des charges fixes depuis fixed_items
      const chargesTotal = (fixed ?? []).filter((f: any) => f.type === 'charge').reduce((s: number, f: any) => s + f.amount, 0)
      // Revenu = revenus fixes récurrents (fixed_items) + revenus variables logués au fil de l'eau
      // (transactions avec envelope_slug = 'revenu', ex: paie hebdo imprévisible d'un des membres du foyer).
      const fixedIncomeTotal = (fixed ?? []).filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + f.amount, 0)
      const variableIncomeTotal = (txs ?? []).filter((t: any) => t.envelope_slug === 'revenu').reduce((s: number, t: any) => s + t.amount, 0)
      const incomeTotal = fixedIncomeTotal + variableIncomeTotal

      // Rattraper les enveloppes système manquantes (ex: mois créés avant l'ajout d'une enveloppe comme "épargne")
      const DEFAULT_ENVELOPES = [
        { slug: 'charges', name: 'Charges fixes', icon: '🏠', position: 0 },
        { slug: 'plaisir', name: 'Plaisir', icon: '✨', position: 1 },
        { slug: 'epargne', name: 'Épargne', icon: '💰', position: 2 },
        { slug: 'courses', name: 'Courses', icon: '🛒', position: 3 },
      ]
      let envList: any[] = envs ?? []
      const missingEnvelopes = DEFAULT_ENVELOPES.filter(d => !envList.some((e: any) => e.slug === d.slug))
      if (missingEnvelopes.length > 0) {
        const created = await Promise.all(missingEnvelopes.map(d =>
          pb.collection('envelopes').create({
            month_id: m.id, slug: d.slug, name: d.name, icon: d.icon,
            budget: 0, is_system: true, position: d.position,
          })
        ))
        envList = [...envList, ...created].sort((a: any, b: any) => a.position - b.position)
      }

      // Mettre à jour l'enveloppe charges fixes et le revenu du mois automatiquement
      const chargesEnv: any = envList.find((e: any) => e.slug === 'charges')
      if (chargesEnv && chargesEnv.budget !== chargesTotal) {
        await pb.collection('envelopes').update(chargesEnv.id, { budget: chargesTotal })
        chargesEnv.budget = chargesTotal
      }

      // Mettre à jour le revenu mensuel
      if (m.income !== incomeTotal) {
        await pb.collection('months').update(m.id, { income: incomeTotal })
        m = { ...m, income: incomeTotal }
      }

      // Synchroniser l'enveloppe "courses" avec le budget prévisionnel défini sur la page Courses
      // (source de vérité = month.courses_budget, réglé via l'icône réglages de la page Courses).
      // Le "restant" de l'enveloppe se base ensuite sur les vraies transactions (passages).
      const coursesEnv: any = envList.find((e: any) => e.slug === 'courses')
      const coursesBudget = m.courses_budget ?? 0
      if (coursesEnv && coursesEnv.budget !== coursesBudget) {
        await pb.collection('envelopes').update(coursesEnv.id, { budget: coursesBudget })
        coursesEnv.budget = coursesBudget
      }

      // L'épargne reste un montant défini manuellement (objectif d'épargne du mois) ;
      // elle est déduite du revenu au même titre que les charges et les courses.
      const epargneEnv: any = envList.find((e: any) => e.slug === 'epargne')
      const epargneBudget = epargneEnv?.budget ?? 0

      // Plaisir = ce qu'il reste une fois charges fixes, épargne et courses retirés du revenu
      const plaisirEnv: any = envList.find((e: any) => e.slug === 'plaisir')
      const plaisirAuto = Math.max(0, incomeTotal - chargesTotal - epargneBudget - coursesBudget)
      if (plaisirEnv && plaisirEnv.budget !== plaisirAuto) {
        await pb.collection('envelopes').update(plaisirEnv.id, { budget: plaisirAuto })
        plaisirEnv.budget = plaisirAuto
      }

      setMonth(m)
      setEnvelopes(envList)
      setTransactions((txs ?? []).map(withCategoryAlias))
      setPlanned((pln ?? []).map(withCategoryAlias))
      setFixedItems(fixed ?? [])
    } catch (err: any) {
      console.error('useMonthData fetchData error:', err)
      setError(err?.message ?? 'Erreur de chargement des données')
    } finally {
      setLoading(false)
    }
  }, [monthKey, workspaceId])

  useEffect(() => { fetchData() }, [fetchData])

  return { month, envelopes, transactions, planned, fixedItems, loading, error, refetch: fetchData }
}

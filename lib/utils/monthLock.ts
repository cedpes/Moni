'use client'
// ─────────────────────────────────────────────────────────
// Clôture des mois
//
// Un mois terminé est "clôturé" : on enregistre sur le record `months` une copie
// (fixed_snapshot) des revenus/charges fixes valables ce mois-là. Tant qu'il est
// clôturé, tous les calculs de ce mois se basent sur cette copie → l'historique
// ne bouge plus, même si on modifie/supprime des revenus ou charges ensuite.
//
// - Auto-clôture : la première fois qu'on ouvre un mois passé (closed_at vide).
// - "Rouvrir" : is_closed=false (closed_at conservé → pas de re-clôture automatique).
// - "Clôturer" : re-fige le mois avec les valeurs actuelles.
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import type PocketBase from 'pocketbase'
import { createClient } from '@/lib/pocketbase/client'
import { getMonthKey } from '@/lib/utils'
import { filterFixedItemsForMonth } from '@/lib/utils/fixedItemsVersioning'

const SNAPSHOT_FIELDS = ['id', 'type', 'name', 'amount', 'due_day', 'icon', 'color', 'category', 'is_exceptional', 'start_month', 'end_month', 'annual_months'] as const

export function toSnapshot(items: any[]): any[] {
  return (items ?? []).map(i => Object.fromEntries(SNAPSHOT_FIELDS.map(k => [k, i[k] ?? null])))
}

export function isPastMonth(monthKey: string): boolean {
  return monthKey < getMonthKey()
}

export function isMonthClosed(month: any): boolean {
  return !!month?.is_closed && Array.isArray(month?.fixed_snapshot)
}

// Items fixes valables pour un mois : la copie figée si le mois est clôturé, sinon le live filtré.
export function fixedItemsForMonth(month: any, liveItems: any[], monthKey: string): any[] {
  if (isMonthClosed(month)) return month.fixed_snapshot
  return filterFixedItemsForMonth(liveItems ?? [], monthKey)
}

export function shouldAutoClose(month: any, monthKey: string): boolean {
  return !!month && isPastMonth(monthKey) && !month.is_closed && !month.closed_at
}

export async function closeMonth(pb: PocketBase, month: any, workspaceId: string, monthKey: string) {
  const live = await pb.collection('fixed_items').getFullList({ filter: `workspace_id="${workspaceId}" && is_active=true` })
  const snapshot = toSnapshot(filterFixedItemsForMonth(live as any[], monthKey))
  return pb.collection('months').update(month.id, {
    is_closed: true,
    closed_at: new Date().toISOString(),
    fixed_snapshot: snapshot,
  })
}

// Mois (record) encore ouvert pour cette clé, ou null s'il n'existe pas / est déjà clôturé
export async function getOpenMonth(pb: PocketBase, workspaceId: string, monthKey: string) {
  const list = await pb.collection('months').getFullList({ filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"` })
  const month = list[0] ?? null
  return month && !isMonthClosed(month) ? month : null
}

export function isCurrentOrPastMonth(monthKey: string): boolean {
  return monthKey <= getMonthKey()
}

export async function reopenMonth(pb: PocketBase, month: any) {
  return pb.collection('months').update(month.id, { is_closed: false })
}

// Pour les pages qui chargent les fixed_items elles-mêmes (Revenus, Dépenses > Fixe, Calendrier)
export function useMonthLock(workspaceId: string, monthKey: string) {
  // Le record est mémorisé avec la clé du mois : au changement de mois, l'ancien est ignoré
  const [state, setState] = useState<{ key: string; month: any }>({ key: '', month: null })
  const key = `${workspaceId}:${monthKey}`
  const month = state.key === key ? state.month : null

  const refresh = useCallback(async () => {
    try {
      const pb = createClient()
      const list = await pb.collection('months').getFullList({ filter: `workspace_id="${workspaceId}" && month_key="${monthKey}"` })
      setState({ key: `${workspaceId}:${monthKey}`, month: list[0] ?? null })
    } catch (err: any) {
      if (err?.isAbort) return
      console.error('useMonthLock error:', err)
    }
  }, [workspaceId, monthKey])

  useEffect(() => { refresh() }, [refresh])

  const close = useCallback(async () => {
    if (!month) return
    await closeMonth(createClient(), month, workspaceId, monthKey)
    await refresh()
  }, [month, workspaceId, monthKey, refresh])

  const reopen = useCallback(async () => {
    if (!month) return
    await reopenMonth(createClient(), month)
    await refresh()
  }, [month, refresh])

  return { month, closed: isMonthClosed(month), close, reopen, refresh }
}

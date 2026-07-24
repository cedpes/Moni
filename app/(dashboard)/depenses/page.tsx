import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import DepensesShell from '@/components/features/depenses/DepensesShell'

export default async function DepensesPage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: `user_id="${user.id}"`,
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  let categories = await pb.collection('categories').getFullList({
    filter: `workspace_id="${workspaceId}"`,
    sort: 'name',
  })

  // On complète avec les catégories par défaut manquantes (une "Autre" existait déjà)
  const defaults = [
    { name: 'Courses', icon: '🛒', color: '#e8f4ff' },
    { name: 'Sortie',  icon: '🎉', color: '#fef0f5' },
    { name: 'Resto',   icon: '🍽️', color: '#fff3e0' },
    { name: 'Essence', icon: '⛽', color: '#fff8e6' },
    { name: 'Achat',   icon: '🛍️', color: '#f0f7ff' },
    { name: 'Santé',   icon: '💊', color: '#e8faf0' },
    { name: 'Cadeau',  icon: '🎁', color: '#fff0f5' },
    { name: 'Plaisir', icon: '✨', color: '#f3f0ff' },
    { name: 'Autre',   icon: '📦', color: '#f5f5f7' },
  ]
  const existingNames = new Set((categories ?? []).map((c: any) => c.name))
  const missing = defaults.filter(d => !existingNames.has(d.name))
  if (missing.length > 0) {
    await Promise.all(missing.map(c => pb.collection('categories').create({ workspace_id: workspaceId, ...c })))
    categories = await pb.collection('categories').getFullList({
      filter: `workspace_id="${workspaceId}"`,
      sort: 'name',
    })
  }

  return <DepensesShell workspaceId={workspaceId} userId={user.id} categories={categories ?? []} />
}

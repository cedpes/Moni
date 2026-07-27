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
    { name: 'Courses',        icon: '🛒', color: '#e8f4ff' },
    { name: 'Sortie',         icon: '🎉', color: '#fef0f5' },
    { name: 'Resto',          icon: '🍽️', color: '#fff3e0' },
    { name: 'Essence',        icon: '⛽', color: '#fff8e6' },
    { name: 'Achat',          icon: '🛍️', color: '#f0f7ff' },
    { name: 'Santé',          icon: '💊', color: '#e8faf0' },
    { name: 'Cadeau',         icon: '🎁', color: '#fff0f5' },
    { name: 'Plaisir',        icon: '✨', color: '#f3f0ff' },
    { name: 'Loyer',          icon: '🏠', color: '#fff3e0' },
    { name: 'Assurance',      icon: '🛡️', color: '#e8f4ff' },
    { name: 'Banque',         icon: '🏦', color: '#f0fff4' },
    { name: 'Abonnements',    icon: '🔁', color: '#f3f0ff' },
    { name: 'Streaming',      icon: '📺', color: '#ede9fe' },
    { name: 'Téléphone',      icon: '📱', color: '#e0f2fe' },
    { name: 'Internet',       icon: '🌐', color: '#e0f2fe' },
    { name: 'Transport',      icon: '🚌', color: '#f0f7ff' },
    { name: 'Parking',        icon: '🅿️', color: '#f5f5f7' },
    { name: 'Vêtements',      icon: '👕', color: '#fdf2f8' },
    { name: 'Beauté',         icon: '💄', color: '#fdf2f8' },
    { name: 'Coiffeur',       icon: '💇', color: '#fdf2f8' },
    { name: 'Sport',          icon: '🏋️', color: '#ecfdf5' },
    { name: 'Enfants',        icon: '🧸', color: '#fef9c3' },
    { name: 'Animaux',        icon: '🐾', color: '#fef3c7' },
    { name: 'Voyage',         icon: '✈️', color: '#e0f2fe' },
    { name: 'Culture',        icon: '🎭', color: '#f3e8ff' },
    { name: 'Livres',         icon: '📚', color: '#eef2ff' },
    { name: 'Jeux vidéo',     icon: '🎮', color: '#ede9fe' },
    { name: 'Bricolage',      icon: '🔧', color: '#fef3c7' },
    { name: 'Jardinage',      icon: '🌱', color: '#ecfdf5' },
    { name: 'Électronique',   icon: '💻', color: '#e0e7ff' },
    { name: 'Impôts',         icon: '🧾', color: '#fee2e2' },
    { name: 'Investissement', icon: '📈', color: '#dcfce7' },
    { name: 'Dons',           icon: '💝', color: '#ffe4e6' },
    { name: 'Formation',      icon: '🎓', color: '#dbeafe' },
    { name: 'Café',           icon: '☕', color: '#fef3c7' },
    { name: 'Pressing',       icon: '👔', color: '#f0f7ff' },
    { name: 'Réparations',    icon: '🔨', color: '#fef3c7' },
    { name: 'Amendes',        icon: '🚨', color: '#fee2e2' },
    { name: 'Divers',         icon: '🗂️', color: '#f5f5f7' },
    { name: 'Autre',          icon: '📦', color: '#f5f5f7' },
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

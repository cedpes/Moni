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

  const categories = await pb.collection('categories').getFullList({
    filter: `workspace_id="${workspaceId}"`,
    sort: 'name',
  })

  return <DepensesShell workspaceId={workspaceId} userId={user.id} categories={categories ?? []} />
}

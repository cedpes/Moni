import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import PlannedShell from '@/components/features/planned/PlannedShell'

export default async function PlannedPage() {
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

  return <PlannedShell workspaceId={workspaceId} userId={user.id} categories={categories ?? []} />
}

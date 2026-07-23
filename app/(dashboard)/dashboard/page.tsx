import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/features/dashboard/DashboardClient'

export default async function DashboardPage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: `user_id="${user.id}"`,
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  return (
    <DashboardClient
      workspaceId={workspaceId}
      userId={user.id}
      displayName={(user.display_name as string) ?? null}
    />
  )
}

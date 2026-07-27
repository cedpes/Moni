import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import RevenusShell from '@/components/features/revenus/RevenusShell'

export default async function RevenusPage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: `user_id="${user.id}"`,
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  return <RevenusShell workspaceId={workspaceId} userId={user.id} />
}

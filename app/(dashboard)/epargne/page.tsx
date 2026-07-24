import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import EpargneShell from '@/components/features/epargne/EpargneShell'

export default async function EpargnePage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: `user_id="${user.id}"`,
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  return <EpargneShell workspaceId={workspaceId} />
}

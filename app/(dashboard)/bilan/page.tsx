import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import BilanShell from '@/components/features/bilan/BilanShell'

export default async function BilanPage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: `user_id="${user.id}"`,
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  return <BilanShell workspaceId={workspaceId} userId={user.id} />
}

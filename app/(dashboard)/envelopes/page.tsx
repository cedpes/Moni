import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import EnvelopesShell from '@/components/features/envelopes/EnvelopesShell'

export default async function EnvelopesPage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: pb.filter('user_id={:p0}', { p0: user.id }),
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  const categories = await pb.collection('categories').getFullList({
    filter: pb.filter('workspace_id={:p0}', { p0: workspaceId }),
    sort: 'name',
  })

  return <EnvelopesShell workspaceId={workspaceId} userId={user.id} categories={categories ?? []} />
}

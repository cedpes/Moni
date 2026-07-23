import { createClient } from '@/lib/pocketbase/server'
import { redirect } from 'next/navigation'
import CoursesShell from '@/components/features/courses/CoursesShell'

export default async function CoursesPage() {
  const pb = await createClient()
  if (!pb.authStore.isValid || !pb.authStore.record) redirect('/login')
  const user = pb.authStore.record

  const memberships = await pb.collection('workspace_members').getFullList({
    filter: `user_id="${user.id}"`,
  })
  const workspaceId: string | null = memberships[0]?.workspace_id ?? null
  if (!workspaceId) redirect('/login')

  return <CoursesShell workspaceId={workspaceId} userId={user.id} />
}

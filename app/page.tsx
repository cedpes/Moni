import { redirect } from 'next/navigation'
import { createClient } from '@/lib/pocketbase/server'

export default async function RootPage() {
  const pb = await createClient()
  redirect(pb.authStore.isValid ? '/dashboard' : '/login')
}

import PocketBase from 'pocketbase'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL!)

  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')
  pb.authStore.loadFromCookie(cookieHeader)

  try {
    if (pb.authStore.isValid) {
      await pb.collection('users').authRefresh()
    }
  } catch {
    pb.authStore.clear()
  }

  return pb
}

'use client'

import PocketBase from 'pocketbase'

let pb: PocketBase | null = null

export function createClient() {
  if (pb) return pb

  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL!)

  // Garde le cookie `pb_auth` synchronisé à chaque changement d'auth (login/logout/refresh)
  // pour que le client SSR (lib/pocketbase/server.ts) puisse lire la session.
  pb.authStore.onChange(() => {
    document.cookie = pb!.authStore.exportToCookie({
      httpOnly: false,
      secure: window.location.protocol === 'https:',
      sameSite: 'Lax',
    })
  })

  return pb
}

// Déconnexion : vide la session PocketBase (le cookie `pb_auth` est expiré par onChange
// ci-dessus) et oublie les données locales liées au compte. Le thème est conservé.
export function logout() {
  const client = createClient()
  client.authStore.clear()
  try { localStorage.removeItem('pocketbase_auth') } catch {}
}

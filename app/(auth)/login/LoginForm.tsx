'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/pocketbase/client'
import { loginSchema } from '@/lib/validations'
import { Loader2 } from 'lucide-react'

// N'accepte qu'un chemin interne ("/budget", "/depenses?x=1"…) pour éviter la redirection
// vers un site externe ("https://…", "//evil.com", "/\evil.com", "javascript:…").
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/budget'
  if (/[\u0000-\u001f]/.test(value)) return '/budget'
  return value
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirectTo'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Page de démarrage de l'app installée : si une session valide existe déjà, on file
  // directement vers l'app. Garde-fou anti-boucle : si le serveur refuse la session et
  // renvoie ici, on ne réessaie pas avant 30 s (le formulaire reste affiché).
  useEffect(() => {
    const pb = createClient()
    if (!pb.authStore.isValid) return
    try {
      const last = Number(sessionStorage.getItem('moni-auto-login') ?? 0)
      if (Date.now() - last < 30_000) return
      sessionStorage.setItem('moni-auto-login', String(Date.now()))
    } catch { return }
    // Recopie la session dans le cookie lu par le serveur avant de rediriger
    document.cookie = pb.authStore.exportToCookie({
      httpOnly: false, secure: window.location.protocol === 'https:', sameSite: 'Lax',
    })
    router.replace(redirectTo)
  }, [router, redirectTo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) { setError(result.error.issues[0].message); return }
    setLoading(true)
    const pb = createClient()
    try {
      await pb.collection('users').authWithPassword(result.data.email, result.data.password)
    } catch {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">💳</div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Budget</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Connexion à ton espace</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-[var(--bg-surface)] rounded-2xl overflow-hidden">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required
              className="w-full px-4 h-12 text-[16px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none border-b border-[var(--border-subtle)]" />
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required
              className="w-full px-4 h-12 text-[16px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none" />
          </div>
          {error && <p className="text-negative text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full h-12 bg-accent text-accent-ink rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Se connecter
          </button>
        </form>
        <div className="flex justify-end mt-6 text-sm">
          <Link href="/register" className="text-accent-text">Créer un compte</Link>
        </div>
      </div>
    </div>
  )
}

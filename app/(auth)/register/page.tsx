'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/pocketbase/client'
import { registerSchema } from '@/lib/validations'
import { Loader2 } from 'lucide-react'

const DEFAULT_CATEGORIES = [
  { name: 'Courses', icon: '🛒' },
  { name: 'Sortie',  icon: '🎉' },
  { name: 'Resto',   icon: '🍽️' },
  { name: 'Essence', icon: '⛽' },
  { name: 'Achat',   icon: '🛍️' },
  { name: 'Santé',   icon: '💊' },
  { name: 'Cadeau',  icon: '🎁' },
  { name: 'Plaisir', icon: '✨' },
  { name: 'Autre',   icon: '📦' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const result = registerSchema.safeParse({ email, password, display_name: name })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setLoading(true)
    const pb = createClient()

    try {
      // 1. Créer le compte
      await pb.collection('users').create({
        email: result.data.email,
        password: result.data.password,
        passwordConfirm: result.data.password,
        display_name: result.data.display_name,
        currency: 'EUR',
      })

      // 2. Se connecter directement
      await pb.collection('users').authWithPassword(result.data.email, result.data.password)
      const userId = pb.authStore.record!.id

      // 3. Créer le workspace personnel par défaut
      const workspace = await pb.collection('workspaces').create({
        name: 'Mon budget',
        owner_id: userId,
      })
      await pb.collection('workspace_members').create({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
      })

      // 4. Catégories par défaut
      await Promise.all(DEFAULT_CATEGORIES.map(c =>
        pb.collection('categories').create({ workspace_id: workspace.id, name: c.name, icon: c.icon })
      ))
    } catch {
      setError('Impossible de créer le compte (email déjà utilisé ?)')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <div className="text-5xl mb-4">💳</div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Créer un compte</h1>
          <p className="text-[#86868b] text-sm mt-1">Gratuit, sans pub, tes données restent tiennes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-white rounded-2xl overflow-hidden">
            <input
              type="text"
              placeholder="Prénom"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="given-name"
              className="w-full px-4 h-12 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] outline-none border-b border-[#f2f2f7]"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-4 h-12 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] outline-none border-b border-[#f2f2f7]"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe (8 caractères min.)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-4 h-12 text-[15px] text-[#1d1d1f] placeholder-[#aeaeb2] outline-none"
              required
            />
          </div>

          {error && (
            <p className="text-[#ff3b30] text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#1d1d1f] text-white rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Créer mon compte
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-[#86868b]">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-[#007aff]">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}

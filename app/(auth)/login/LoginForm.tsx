'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/pocketbase/client'
import { loginSchema } from '@/lib/validations'
import { Loader2 } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/budget'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">💳</div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Budget</h1>
          <p className="text-[#86868b] text-sm mt-1">Connexion à ton espace</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-white rounded-2xl overflow-hidden">
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" required
              className="w-full px-4 h-12 text-[16px] text-[#1d1d1f] placeholder-[#aeaeb2] outline-none border-b border-[#f2f2f7]" />
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required
              className="w-full px-4 h-12 text-[16px] text-[#1d1d1f] placeholder-[#aeaeb2] outline-none" />
          </div>
          {error && <p className="text-[#ff3b30] text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full h-12 bg-[#1d1d1f] text-white rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Se connecter
          </button>
        </form>
        <div className="flex justify-between mt-6 text-sm">
          <Link href="/reset-password" className="text-[#007aff]">Mot de passe oublié</Link>
          <Link href="/register" className="text-[#007aff]">Créer un compte</Link>
        </div>
      </div>
    </div>
  )
}

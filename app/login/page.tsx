'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = supabaseClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Signup successful. If email confirmation is enabled, check your inbox.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (err: any) {
      setMsg(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const signupBtnClass =
    'flex-1 rounded-lg border px-3 py-2 text-sm ' + (mode === 'signup' ? 'bg-black text-white' : '')
  const loginBtnClass =
    'flex-1 rounded-lg border px-3 py-2 text-sm ' + (mode === 'login' ? 'bg-black text-white' : '')

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">NoticePack</h1>
        <p className="text-sm text-gray-500 mt-1">Sign up or log in to continue.</p>

        <div className="mt-4 flex gap-2">
          <button className={signupBtnClass} onClick={() => setMode('signup')} type="button">
            Sign up
          </button>
          <button className={loginBtnClass} onClick={() => setMode('login')} type="button">
            Log in
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-sm">Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div>
            <label className="text-sm">Password</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>

          <button className="w-full rounded-lg bg-black text-white px-3 py-2" disabled={loading} type="submit">
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>

          {msg && <p className="text-sm mt-2">{msg}</p>}
        </form>
      </div>
    </div>
  )
}

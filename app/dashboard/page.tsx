'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  email: string | null
  plan: 'free' | 'starter' | 'pro'
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseClient(), [])

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const timeout = setTimeout(() => {
      if (alive) {
        setError('Timed out loading session/profile. Check browser console + Supabase RLS/policies.')
        setLoading(false)
      }
    }, 8000)

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr) throw sessionErr

        const session = sessionData.session
        if (!session) {
          router.replace('/login')
          return
        }

        if (!alive) return
        setEmail(session.user.email ?? null)

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id,email,plan')
          .eq('id', session.user.id)
          .single()

        if (profErr) throw profErr
        if (!alive) return

        setProfile(prof as Profile)
        setLoading(false)
      } catch (err: any) {
        if (!alive) return
        setError(err?.message ?? 'Unknown error')
        setLoading(false)
      } finally {
        clearTimeout(timeout)
      }
    }

    run()

    return () => {
      alive = false
      clearTimeout(timeout)
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button className="rounded border px-3 py-2" onClick={signOut}>
          Sign out
        </button>
      </div>

      {error && <div className="rounded border p-3">Error: {error}</div>}

      <div className="rounded border p-4">
        <div><strong>Email:</strong> {email ?? '—'}</div>
        <div><strong>Plan:</strong> {profile?.plan ?? '—'}</div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabase/client'

type CaseRow = {
  id: string
  title: string
  state_code: string
  status: string
  created_at: string
}

export default function CasesPage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseClient(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CaseRow[]>([])

  useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr) throw sessionErr
        if (!sessionData.session) {
          router.replace('/login')
          return
        }

        // IMPORTANT: this assumes RLS restricts to the owner (user_id).
        const { data, error } = await supabase
          .from('cases')
          .select('id,title,state_code,status,created_at')
          .order('created_at', { ascending: false })

        if (error) throw error
        if (!alive) return

        setRows((data ?? []) as CaseRow[])
        setLoading(false)
      } catch (err: any) {
        if (!alive) return
        setError(err?.message ?? 'Unknown error')
        setLoading(false)
      }
    }

    run()

    return () => {
      alive = false
    }
  }, [router, supabase])

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
        <h1 className="text-2xl font-semibold">Cases</h1>
        <Link className="rounded border px-3 py-2" href="/dashboard">
          Back
        </Link>
      </div>

      {error && <div className="rounded border p-3">Error: {error}</div>}

      <div className="rounded border p-4">
        {rows.length === 0 ? (
          <p>No cases yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id} className="rounded border p-3">
                <div className="font-semibold">{c.title}</div>
                <div className="text-sm text-gray-600">
                  {c.state_code} · {c.status} · {new Date(c.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

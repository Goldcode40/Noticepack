'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabase/client'

type CaseRow = {
  id: string
  title: string
  state_code: string
  status: string
  created_at: string
}

export default function CaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = useMemo(() => supabaseClient(), [])

  const rawId = (params as any)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<CaseRow | null>(null)

  useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!id || typeof id !== 'string') {
          setError('Missing case id in URL')
          setLoading(false)
          return
        }

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr) throw sessionErr
        if (!sessionData.session) {
          router.replace('/login')
          return
        }

        const { data, error } = await supabase
          .from('cases')
          .select('id,title,state_code,status,created_at')
          .eq('id', id)
          .single()

        if (error) throw error
        if (!alive) return

        setRow(data as CaseRow)
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
  }, [id, router, supabase])

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
        <h1 className="text-2xl font-semibold">Case</h1>
        <Link className="rounded border px-3 py-2" href="/cases">
          Back
        </Link>
      </div>

      {error && <div className="rounded border p-3">Error: {error}</div>}

      {row && (
        <div className="rounded border p-4 space-y-2">
          <div><strong>Title:</strong> {row.title}</div>
          <div><strong>State:</strong> {row.state_code}</div>
          <div><strong>Status:</strong> {row.status}</div>
          <div><strong>Created:</strong> {new Date(row.created_at).toLocaleString()}</div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

type DocInfo = {
  id: string
  name: string
  status: 'implemented' | 'guided' | 'not_available'
}

export default function DocumentWizardPage() {
  const params = useParams<{ id: string; docTypeId: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const caseId = useMemo(() => String(params?.id ?? ''), [params])
  const docTypeId = useMemo(() => String(params?.docTypeId ?? ''), [params])

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = supabaseClient()

        // Client-side session check (works with localStorage session)
        const {
          data: { session },
          error: sErr,
        } = await supabase.auth.getSession()
        if (sErr) throw sErr

        if (!session?.user) {
          if (!alive) return
          router.replace(
            `/login?next=${encodeURIComponent(`/cases/${caseId}/documents/${docTypeId}`)}`
          )
          return
        }

        if (!alive) return
        setEmail(session.user.email ?? null)

        // Get case state
        const { data: c, error: cErr } = await supabase
          .from('cases')
          .select('state_code')
          .eq('id', caseId)
          .single()
        if (cErr) throw cErr

        // Get doc type name
        const { data: d, error: dErr } = await supabase
          .from('document_types')
          .select('id,name')
          .eq('id', docTypeId)
          .single()
        if (dErr) throw dErr

        // Get coverage status for that state + doc type
        const { data: cov, error: covErr } = await supabase
          .from('coverage_matrix')
          .select('status')
          .eq('state_code', c.state_code)
          .eq('document_type_id', docTypeId)
          .single()
        if (covErr) throw covErr

        if (!alive) return
        setDoc({ id: d.id, name: d.name, status: cov.status })
      } catch (e: any) {
        if (!alive) return
        setError(e?.message ?? String(e))
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [caseId, docTypeId, router])

  const badge = (status: DocInfo['status']) => {
    const map: Record<DocInfo['status'], string> = {
      implemented: '✅ Implemented',
      guided: '🟡 Guided',
      not_available: '🔴 Not available',
    }
    return map[status]
  }

  return (
    <main className="p-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Document</h1>
        <Link href={`/cases/${caseId}`} className="rounded border px-3 py-2 text-sm">
          Back
        </Link>
      </div>

      {loading && <p className="mt-4">Loading…</p>}
      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

      {!loading && !error && doc && (
        <div className="mt-6 rounded border p-4 space-y-2">
          <div><b>User:</b> {email}</div>
          <div><b>Document:</b> {doc.name}</div>
          <div><b>Availability:</b> {badge(doc.status)}</div>

          <p className="text-sm text-gray-600 mt-2">
            Wizard UI comes next (guided questions + PDF generation). For now, this confirms routing + auth.
          </p>
        </div>
      )}
    </main>
  )
}
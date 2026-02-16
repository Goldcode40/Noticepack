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

type DocRow = {
  document_type_id: string
  doc_name: string
  status: 'implemented' | 'guided' | 'not_available'
}

function Badge({ status }: { status: DocRow['status'] }) {
  const map: Record<DocRow['status'], { label: string }> = {
    implemented: { label: '✅ Implemented' },
    guided: { label: '🟡 Guided' },
    not_available: { label: '🔴 Not available' },
  }
  return (
    <span className="inline-block rounded border px-2 py-1 text-xs">
      {map[status].label}
    </span>
  )
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

  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])

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

  // load coverage list once we know the case state_code
  useEffect(() => {
    let alive = true

    const runDocs = async () => {
      if (!row?.state_code) return
      try {
        setDocsLoading(true)
        setDocsError(null)

        const stateCode = row.state_code.toUpperCase()

        // NOTE: your seed uses coverage_matrix with state_code + document_type_id + status.
        // We join document_types in a second query for compatibility (no SQL view needed yet).
        const { data: coverage, error: covErr } = await supabase
          .from('coverage_matrix')
          .select('document_type_id,status')
          .eq('state_code', stateCode)
          .order('document_type_id', { ascending: true })

        if (covErr) throw covErr

        const docTypeIds = (coverage ?? []).map((c: any) => c.document_type_id).filter(Boolean)
        if (docTypeIds.length === 0) {
          if (!alive) return
          setDocs([])
          setDocsLoading(false)
          return
        }

        const { data: docTypes, error: dtErr } = await supabase
          .from('document_types')
          .select('id,name')
          .in('id', docTypeIds)

        if (dtErr) throw dtErr

        const nameMap = new Map<string, string>()
        ;(docTypes ?? []).forEach((d: any) => nameMap.set(d.id, d.name))

        const merged: DocRow[] = (coverage ?? []).map((c: any) => ({
          document_type_id: c.document_type_id,
          doc_name: nameMap.get(c.document_type_id) ?? 'Unknown document',
          status: c.status,
        }))

        // sort by doc name for nicer UI
        merged.sort((a, b) => a.doc_name.localeCompare(b.doc_name))

        if (!alive) return
        setDocs(merged)
        setDocsLoading(false)
      } catch (err: any) {
        if (!alive) return
        setDocsError(err?.message ?? 'Unknown error')
        setDocsLoading(false)
      }
    }

    runDocs()

    return () => {
      alive = false
    }
  }, [row?.state_code, supabase])

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

      <div className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documents</h2>
          <div className="text-sm text-gray-600">
            Availability for <strong>{row?.state_code}</strong>
          </div>
        </div>

        {docsLoading && <div>Loading document library…</div>}
        {docsError && <div className="rounded border p-3">Error: {docsError}</div>}

        {!docsLoading && !docsError && docs.length === 0 && (
          <div>No coverage rows found for this state.</div>
        )}

        {!docsLoading && !docsError && docs.length > 0 && (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.document_type_id} className="flex items-center justify-between rounded border p-3">
                <div className="font-medium">{d.doc_name}</div>
                <Badge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

type CaseRow = {
  id: string
  title: string
  state_code: string
  status: string
  created_at: string
}

type CoverageStatus = 'implemented' | 'guided' | 'not_available'

type DocRow = {
  document_type_id: string
  doc_name: string
  status: CoverageStatus
}

type DraftRow = {
  document_type_id: string
  status: string
  updated_at: string
  generated_at: string | null
}

function CoverageBadge({ status }: { status: CoverageStatus }) {
  const map: Record<CoverageStatus, { label: string }> = {
    implemented: { label: 'Implemented' },
    guided: { label: 'Guided' },
    not_available: { label: 'Not available' },
  }

  return (
    <span className="inline-flex items-center rounded border px-2 py-1 text-xs">
      {map[status].label}
    </span>
  )
}

function DraftBadge() {
  return (
    <span className="inline-flex items-center rounded border px-2 py-1 text-xs">
      Draft
    </span>
  )
}

export default function CasePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const caseId = params?.id

  const draftMap = useMemo(() => {
    const m = new Map<string, DraftRow>()
    for (const d of drafts) m.set(d.document_type_id, d)
    return m
  }, [drafts])

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        setError(null)

        const supabase = supabaseClient()

        // 1) Auth gate
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!userRes?.user) {
          router.replace('/login')
          return
        }
        if (!cancelled) setUserEmail(userRes.user.email ?? null)

        if (!caseId) throw new Error('Missing case id in route.')

        // 2) Load case
        const { data: c, error: cErr } = await supabase
          .from('cases')
          .select('id,title,state_code,status,created_at')
          .eq('id', caseId)
          .single()

        if (cErr) throw cErr
        if (!cancelled) setCaseRow(c as CaseRow)

        const stateCode = (c as CaseRow).state_code

        // 3) Load coverage rows for this state
        const { data: coverage, error: covErr } = await supabase
          .from('coverage_matrix')
          .select('document_type_id,status,document_types(name)')
          .eq('state_code', stateCode)
          .order('document_types(name)', { ascending: true })

        if (covErr) throw covErr

        const docRows: DocRow[] = (coverage ?? []).map((r: any) => ({
          document_type_id: r.document_type_id,
          doc_name: r.document_types?.name ?? 'Unknown document',
          status: (r.status as CoverageStatus) ?? 'not_available',
        }))

        if (!cancelled) setDocs(docRows)

        // 4) Load drafts for this case
        const { data: d, error: dErr } = await supabase
          .from('case_documents')
          .select('document_type_id,status,updated_at,generated_at')
          .eq('case_id', caseId)

        if (dErr) throw dErr
        if (!cancelled) setDrafts((d ?? []) as DraftRow[])
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [caseId, router])

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Case</h1>
        <button
          className="rounded border px-4 py-2"
          onClick={() => router.push('/cases')}
          type="button"
        >
          Back
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded border p-4">Error: {error}</div>
      ) : null}

      {caseRow ? (
        <div className="mt-6 rounded border p-4">
          <div className="font-semibold">
            Title: <span className="font-normal">{caseRow.title}</span>
          </div>
          <div className="mt-2 font-semibold">
            State: <span className="font-normal">{caseRow.state_code}</span>
          </div>
          <div className="mt-2 font-semibold">
            Status: <span className="font-normal">{caseRow.status}</span>
          </div>
          <div className="mt-2 font-semibold">
            Created:{' '}
            <span className="font-normal">
              {new Date(caseRow.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-bold">Documents</h2>
          <div className="text-sm text-gray-500">
            Availability for <span className="font-semibold">{caseRow?.state_code}</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {docs.map((d) => {
            const draft = draftMap.get(d.document_type_id)
            const href = `/cases/${caseId}/documents/${d.document_type_id}`
            const cta = draft ? (draft.status === 'generated' ? "View / Regenerate" : "Continue") : "Start"

            return (
              <Link
                key={d.document_type_id}
                href={href}
                className="block rounded border p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{d.doc_name}</div>
                  <div className="flex items-center gap-2">
                    {draft?.status === 'generated' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Generated</span>
                          {draft.generated_at ? (
                            <span className="text-xs text-muted-foreground">{new Date(draft.generated_at).toLocaleString()}</span>
                          ) : null}
                        </div>
                      ) : draft ? (
                        <DraftBadge />
                      ) : null}
                    <CoverageBadge status={d.status} />
                    <span className="inline-flex items-center rounded border px-2 py-1 text-xs">
                      {cta}
                    </span>
                  </div>
                </div>

                {draft ? (
                  <div className="mt-2 text-xs text-gray-600">
                    Last saved: {new Date(draft.updated_at).toLocaleString()}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-600">No draft yet.</div>
                )}
              </Link>
            )
          })}

          {docs.length === 0 ? (
            <div className="text-sm text-gray-600">No documents found for this state.</div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        Signed in as: <span className="font-semibold">{userEmail ?? 'Unknown'}</span>
      </div>
    </div>
  )
}



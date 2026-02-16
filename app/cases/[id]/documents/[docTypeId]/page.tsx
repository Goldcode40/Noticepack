'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

type DocType = { id: string; name: string }
type Coverage = { status: 'implemented' | 'guided' | 'not_available' }
type CaseRow = { state_code: string }

type CaseDocRow = {
  id: string
  status: 'draft' | 'generated' | 'final'
  data: Record<string, any>
}

export default function DocumentWizardPage() {
  const params = useParams<{ id: string; docTypeId: string }>()
  const router = useRouter()

  const caseId = useMemo(() => String(params?.id ?? ''), [params])
  const docTypeId = useMemo(() => String(params?.docTypeId ?? ''), [params])

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const [docType, setDocType] = useState<DocType | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)

  const [caseDoc, setCaseDoc] = useState<CaseDocRow | null>(null)

  // simple v1 fields (we'll replace per doc type later)
  const [landlordName, setLandlordName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [rentAmount, setRentAmount] = useState('')

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        setMsg(null)

        const supabase = supabaseClient()

        // auth (client session)
        const { data: s, error: sErr } = await supabase.auth.getSession()
        if (sErr) throw sErr
        if (!s.session?.user) {
          router.replace(`/login?next=${encodeURIComponent(`/cases/${caseId}/documents/${docTypeId}`)}`)
          return
        }

        const userId = s.session.user.id
        if (!alive) return
        setEmail(s.session.user.email ?? null)

        // case -> state
        const { data: c, error: cErr } = await supabase
          .from('cases')
          .select('state_code')
          .eq('id', caseId)
          .single()
        if (cErr) throw cErr

        // doc type
        const { data: dt, error: dtErr } = await supabase
          .from('document_types')
          .select('id,name')
          .eq('id', docTypeId)
          .single()
        if (dtErr) throw dtErr

        // coverage
        const { data: cov, error: covErr } = await supabase
          .from('coverage_matrix')
          .select('status')
          .eq('state_code', (c as CaseRow).state_code)
          .eq('document_type_id', docTypeId)
          .single()
        if (covErr) throw covErr

        if (!alive) return
        setDocType(dt as DocType)
        setCoverage(cov as Coverage)

        // find existing draft (unique index on case_id + document_type_id)
        const { data: existing, error: exErr } = await supabase
          .from('case_documents')
          .select('id,status,data')
          .eq('case_id', caseId)
          .eq('document_type_id', docTypeId)
          .maybeSingle()
        if (exErr) throw exErr

        let row: CaseDocRow | null = (existing as any) ?? null

        // create if missing
        if (!row) {
          const { data: created, error: crErr } = await supabase
            .from('case_documents')
            .insert([
              {
                user_id: userId,
                case_id: caseId,
                document_type_id: docTypeId,
                status: 'draft',
                data: {},
              },
            ])
            .select('id,status,data')
            .single()

          if (crErr) throw crErr
          row = created as any
        }

        if (!alive) return
        setCaseDoc(row)

        // hydrate fields from saved data (if present)
        const d = (row?.data ?? {}) as any
        setLandlordName(d.landlord_name ?? '')
        setTenantName(d.tenant_name ?? '')
        setRentAmount(d.rent_amount ?? '')

        setLoading(false)
      } catch (e: any) {
        if (!alive) return
        setMsg(e?.message ?? String(e))
        setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [caseId, docTypeId, router])

  const badge = (status: Coverage['status']) => {
    if (status === 'implemented') return 'Implemented'
    if (status === 'guided') return 'Guided'
    return 'Not available'
  }

  const onSave = async () => {
    if (!caseDoc) return
    setMsg(null)
    try {
      const supabase = supabaseClient()
      const payload = {
        landlord_name: landlordName,
        tenant_name: tenantName,
        rent_amount: rentAmount,
      }

      const { data, error } = await supabase
        .from('case_documents')
        .update({ data: payload })
        .eq('id', caseDoc.id)
        .select('id,status,data')
        .single()

      if (error) throw error
      setCaseDoc(data as any)
      setMsg('Saved.')
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    }
  }

  return (
    <main className="p-8 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Document Wizard</h1>
        <Link href={`/cases/${caseId}`} className="rounded border px-3 py-2 text-sm">
          Back
        </Link>
      </div>

      {loading && <p>Loading…</p>}
      {msg && <p className="text-sm">{msg}</p>}

      {!loading && docType && coverage && (
        <div className="rounded border p-4 space-y-2">
          <div><b>User:</b> {email}</div>
          <div><b>Document:</b> {docType.name}</div>
          <div><b>Coverage:</b> {badge(coverage.status)}</div>
          <div><b>Draft ID:</b> {caseDoc?.id}</div>
        </div>
      )}

      {!loading && caseDoc && (
        <div className="rounded border p-4 space-y-3">
          <div className="font-semibold">Wizard Fields (v1)</div>

          <div>
            <label className="text-sm">Landlord name</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={landlordName}
              onChange={(e) => setLandlordName(e.target.value)}
              placeholder="e.g. John Landlord"
            />
          </div>

          <div>
            <label className="text-sm">Tenant name</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="e.g. Jane Tenant"
            />
          </div>

          <div>
            <label className="text-sm">Rent amount</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              placeholder="e.g. 1200"
            />
          </div>

          <button className="rounded bg-black text-white px-4 py-2" onClick={onSave}>
            Save Draft
          </button>
        </div>
      )}
    </main>
  )
}
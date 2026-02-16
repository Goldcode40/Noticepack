'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

type DraftRow = {
  id: string
  case_id: string
  document_type_id: string
  status: string
  data: any
  created_at: string
  updated_at: string
}

type DocTypeRow = {
  id: string
  name: string
}

type CaseRow = {
  id: string
  title: string
  state_code: string
  status: string
  created_at: string
}

type CoverageStatus = 'implemented' | 'guided' | 'not_available' | 'unknown'

function CoverageBadge({ status }: { status: CoverageStatus }) {
  const map: Record<CoverageStatus, { label: string }> = {
    implemented: { label: 'Implemented' },
    guided: { label: 'Guided' },
    not_available: { label: 'Not available' },
    unknown: { label: 'Unknown' },
  }
  return <span className="inline-block rounded border px-2 py-1 text-xs">{map[status].label}</span>
}

export default function DocumentWizardPage() {
  const params = useParams<{ id: string; docTypeId: string }>()
  const router = useRouter()
  const supabase = useMemo(() => supabaseClient(), [])

  const caseId = params?.id
  const docTypeId = params?.docTypeId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [userEmail, setUserEmail] = useState<string>('')
  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [docType, setDocType] = useState<DocTypeRow | null>(null)
  const [coverage, setCoverage] = useState<CoverageStatus>('unknown')

  const [draft, setDraft] = useState<DraftRow | null>(null)
  const [savedMsg, setSavedMsg] = useState<string>('')

  // Wizard fields (v1)
  const [landlordName, setLandlordName] = useState<string>('John Landlord')
  const [tenantName, setTenantName] = useState<string>('Jane Tenant')
  const [rentAmount, setRentAmount] = useState<string>('1200')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)

        // 1) Auth required
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          const next = `/cases/${caseId}/documents/${docTypeId}`
          router.replace(`/login?next=${encodeURIComponent(next)}`)
          return
        }
        if (cancelled) return
        setUserEmail(user.email ?? '')

        // 2) Load case + doc type
        const [caseRes, docRes] = await Promise.all([
          supabase.from('cases').select('id,title,state_code,status,created_at').eq('id', caseId).single(),
          supabase.from('document_types').select('id,name').eq('id', docTypeId).single(),
        ])

        if (caseRes.error) throw caseRes.error
        if (docRes.error) throw docRes.error

        if (cancelled) return
        setCaseRow(caseRes.data as CaseRow)
        setDocType(docRes.data as DocTypeRow)

        // 3) Coverage status for this state/doc
        const covRes = await supabase
          .from('coverage_matrix')
          .select('status')
          .eq('state_code', caseRes.data.state_code)
          .eq('document_type_id', docTypeId)
          .maybeSingle()

        if (!cancelled) {
          const s = (covRes.data?.status ?? 'unknown') as CoverageStatus
          setCoverage(s)
        }

        // 4) Load existing draft (prefill)
        const draftRes = await supabase
          .from('case_documents')
          .select('id,case_id,document_type_id,status,data,created_at,updated_at')
          .eq('case_id', caseId)
          .eq('document_type_id', docTypeId)
          .maybeSingle()

        if (draftRes.error) throw draftRes.error

        if (!cancelled && draftRes.data) {
          const d = draftRes.data as DraftRow
          setDraft(d)

          const data = d.data || {}
          if (typeof data.landlord_name === 'string') setLandlordName(data.landlord_name)
          if (typeof data.tenant_name === 'string') setTenantName(data.tenant_name)
          if (data.rent_amount !== undefined && data.rent_amount !== null) setRentAmount(String(data.rent_amount))
        }

        if (!cancelled) setLoading(false)
      } catch (e: any) {
        if (!cancelled) {
          setLoading(false)
          setSavedMsg(`Error: ${e?.message ?? 'Unknown error'}`)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [supabase, router, caseId, docTypeId])

  async function saveDraft() {
    try {
      setSaving(true)
      setSavedMsg('')

      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        const next = `/cases/${caseId}/documents/${docTypeId}`
        router.replace(`/login?next=${encodeURIComponent(next)}`)
        return
      }

      const payload = {
        landlord_name: landlordName.trim(),
        tenant_name: tenantName.trim(),
        rent_amount: rentAmount.trim(),
      }

      const upsertRes = await supabase
        .from('case_documents')
        .upsert(
          {
            user_id: user.id,
            case_id: caseId,
            document_type_id: docTypeId,
            status: 'draft',
            data: payload,
          },
          { onConflict: 'case_id,document_type_id' }
        )
        .select('id,case_id,document_type_id,status,data,created_at,updated_at')
        .single()

      if (upsertRes.error) throw upsertRes.error

      setDraft(upsertRes.data as DraftRow)
      setSavedMsg('Saved.')
    } catch (e: any) {
      setSavedMsg(`Error: ${e?.message ?? 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Document Wizard</h1>
        <Link
          className="rounded border px-3 py-2 text-sm"
          href={`/cases/${caseId}`}
        >
          Back
        </Link>
      </div>

      {savedMsg ? <div className="text-sm">{savedMsg}</div> : null}

      <div className="rounded border p-4 space-y-2">
        <div><b>User:</b> {userEmail}</div>
        <div><b>Document:</b> {docType?.name ?? docTypeId}</div>
        <div className="flex items-center gap-2">
          <b>Coverage:</b> <CoverageBadge status={coverage} />
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <div><b>Draft ID:</b> {draft?.id ?? 'None yet'}</div>
          <div><b>Last saved:</b> {draft?.updated_at ? new Date(draft.updated_at).toLocaleString() : '—'}</div>
        </div>

        <div className="text-sm text-gray-600">
          Wizard UI comes next (guided questions + PDF generation). For now this confirms routing + auth + draft persistence.
        </div>
      </div>

      <div className="rounded border p-4 space-y-4">
        <h2 className="font-semibold">Wizard Fields (v1)</h2>

        <div className="space-y-2">
          <label className="block text-sm">Landlord name</label>
          <input
            className="w-full rounded border p-2"
            value={landlordName}
            onChange={(e) => setLandlordName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm">Tenant name</label>
          <input
            className="w-full rounded border p-2"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm">Rent amount</label>
          <input
            className="w-full rounded border p-2"
            inputMode="numeric"
            value={rentAmount}
            onChange={(e) => setRentAmount(e.target.value)}
          />
        </div>

        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={saveDraft}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
      </div>
    </div>
  )
}
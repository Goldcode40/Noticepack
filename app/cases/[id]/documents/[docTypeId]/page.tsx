'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'
import { getWizardSchema, FieldSchema } from '@/lib/documents/wizardSchemas'

type CoverageStatus = 'implemented' | 'guided' | 'not_available'

type CaseRow = {
  id: string
  title: string
  state_code: string
}

type DocTypeRow = {
  id: string
  name: string // we normalize into this field even if DB uses a different column name
}

type DraftRow = {
  id: string
  data: any
  updated_at: string
}

function pickDocName(row: any): string {
  return String(row?.name ?? row?.name ?? row?.title ?? '').trim()
}

function toInputValue(type: FieldSchema['type'], value: any): string {
  if (value === null || value === undefined) return ''
  if (type === 'date') {
    try {
      const d = new Date(value)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    } catch {}
  }
  return String(value)
}

function normalizeForSave(type: FieldSchema['type'], value: string): any {
  if (type === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (type === 'date') {
    if (!value) return null
    const d = new Date(value + 'T00:00:00.000Z')
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return value
}

export default function DocumentWizardPage() {
  const router = useRouter()
  const params = useParams() as { id?: string; docTypeId?: string }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const [email, setEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  const [caseRow, setCaseRow] = useState<CaseRow | null>(null)
  const [docType, setDocType] = useState<DocTypeRow | null>(null)
  const [coverage, setCoverage] = useState<CoverageStatus>('guided')

  const [draft, setDraft] = useState<DraftRow | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  const schema = useMemo(() => getWizardSchema(docType?.name), [docType?.name])

  useEffect(() => {
    let mounted = true

    async function run() {
      setLoading(true)
      setError(null)
      setSavedMsg(null)

      try {
        if (!params?.id || !params?.docTypeId) throw new Error('Missing route params.')

        const supabase = supabaseClient()

        const { data: sessionData, error: sessErr } = await supabase.auth.getSession()
        if (sessErr) throw sessErr
        const session = sessionData.session
        if (!session) {
          router.replace('/login')
          return
        }

        const uid = session.user.id
        const mail = session.user.email ?? ''

        if (!mounted) return
        setUserId(uid)
        setEmail(mail)

        // load case
        const { data: c, error: cErr } = await supabase
          .from('cases')
          .select('id,title,state_code')
          .eq('id', params.id)
          .single()
        if (cErr) throw cErr
        if (!mounted) return
        setCaseRow(c)

        // load doc type (schema-safe: select *)
        const { data: dtRaw, error: dtErr } = await supabase
          .from('document_types')
          .select('*')
          .eq('id', params.docTypeId)
          .single()
        if (dtErr) throw dtErr

        const normalizedDocType: DocTypeRow = {
          id: dtRaw.id,
          name: pickDocName(dtRaw) || '(unknown)',
        }

        if (!mounted) return
        setDocType(normalizedDocType)

        // coverage matrix (best-effort; default guided)
        const { data: cov, error: covErr } = await supabase
          .from('coverage_matrix')
          .select('status')
          .eq('state_code', c.state_code)
          .eq('document_type_id', normalizedDocType.id)
          .maybeSingle()

        if (!covErr && cov?.status) setCoverage(cov.status as CoverageStatus)
        else setCoverage('guided')

        // load draft (if exists)
        const { data: d, error: dErr } = await supabase
          .from('case_documents')
          .select('id,data,updated_at')
          .eq('case_id', c.id)
          .eq('document_type_id', normalizedDocType.id)
          .maybeSingle()

        if (dErr) throw dErr
        if (!mounted) return

        if (d) {
          setDraft(d)
          const nextForm: Record<string, string> = {}
          for (const f of schema.fields) nextForm[f.key] = toInputValue(f.type, d.data?.[f.key])
          setForm(nextForm)
        } else {
          const nextForm: Record<string, string> = {}
          for (const f of schema.fields) nextForm[f.key] = ''
          setForm(nextForm)
          setDraft(null)
        }

        setLoading(false)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message ?? 'Unknown error')
        setLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id, params?.docTypeId, router, docType?.name])

  function onChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const missingRequired = useMemo(() => {
    const missing: string[] = []
    for (const f of schema.fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) missing.push(f.key)
    }
    return missing
  }, [form, schema.fields])

  async function saveDraft() {
    setSaving(true)
    setError(null)
    setSavedMsg(null)

    try {
      if (!caseRow || !docType || !userId) throw new Error('Missing context.')
      const supabase = supabaseClient()

      const payload: Record<string, any> = {}
      for (const f of schema.fields) {
        payload[f.key] = normalizeForSave(f.type, String(form[f.key] ?? ''))
      }

      const { data, error: upErr } = await supabase
        .from('case_documents')
        .upsert(
          {
            user_id: userId,
            case_id: caseRow.id,
            document_type_id: docType.id,
            status: 'draft',
            data: payload,
          },
          { onConflict: 'case_id,document_type_id' }
        )
        .select('id,data,updated_at')
        .single()

      if (upErr) throw upErr

      setDraft(data)
      setSavedMsg('Saved.')
    } catch (e: any) {
      setError(e?.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Document Wizard</h1>
        <button className="rounded border px-3 py-2 text-sm" onClick={() => router.back()}>
          Back
        </button>
      </div>

      {savedMsg && <div className="mt-2 text-sm">{savedMsg}</div>}

      {error && (
        <div className="mt-4 rounded border p-3 text-sm">
          <div className="font-semibold">Error</div>
          <div>{error}</div>
        </div>
      )}

      <div className="mt-6 rounded border p-4">
        <div className="font-semibold">
          User: <span className="font-normal">{email}</span>
        </div>
        <div className="mt-2 font-semibold">
          Document: <span className="font-normal">{docType?.name ?? '(unknown)'}</span>
        </div>
        <div className="mt-2 font-semibold">
          Coverage:{' '}
          <span className="inline-block rounded border px-2 py-1 text-xs font-normal">
            {coverage === 'implemented' ? 'Implemented' : coverage === 'guided' ? 'Guided' : 'Not available'}
          </span>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          {draft ? (
            <>
              Draft ID: <span className="text-gray-900">{draft.id}</span>
              <br />
              Last saved: <span className="text-gray-900">{new Date(draft.updated_at).toLocaleString()}</span>
            </>
          ) : (
            <>No draft yet.</>
          )}
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Wizard UI comes next (guided questions + PDF generation). For now this confirms routing + auth + draft persistence.
        </div>
      </div>

      <div className="mt-6 rounded border p-4">
        <div className="font-semibold">{schema.title} — Fields (v1)</div>

        {missingRequired.length > 0 && (
          <div className="mt-2 text-sm text-red-600">Missing required: {missingRequired.join(', ')}</div>
        )}

        <div className="mt-4 space-y-4">
          {schema.fields.map((f) => (
            <div key={f.key}>
              <div className="text-sm font-medium">
                {f.label} {f.required ? <span className="text-red-600">*</span> : null}
              </div>

              {f.type === 'textarea' ? (
                <textarea
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                  placeholder={f.placeholder ?? ''}
                  value={form[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              ) : (
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  placeholder={f.placeholder ?? ''}
                  value={form[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}

              {f.help ? <div className="mt-1 text-xs text-gray-500">{f.help}</div> : null}
            </div>
          ))}
        </div>

        <div className="mt-5">
          <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" onClick={saveDraft} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>

          <Link className="ml-3 text-sm underline" href={`/cases/${params.id}`}>
            Back to case
          </Link>
        </div>
      </div>
    </div>
  )
}

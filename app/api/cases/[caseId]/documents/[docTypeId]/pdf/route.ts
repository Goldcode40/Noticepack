import { NextRequest, NextResponse } from 'next/server'
import { buildCaNoticeOfNonRenewalSections } from "@/lib/templates/ca/notice_of_non_renewal"
import { buildCaItemizedDeductionsSections } from "@/lib/templates/ca/itemized_deductions_statement"
import { renderPdfFromSections } from "@/lib/pdf/render"
import { createClient } from '@supabase/supabase-js'

type Ctx = { params: Promise<{ caseId: string; docTypeId: string }> }

function getBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h)
  return m?.[1] ?? null
}


// Simple word-wrap for PDF lines (monospace-ish approximation)
function wrapLine(line: string, maxChars: number): string[] {
  const s = String(line ?? '')
  if (s.length <= maxChars) return [s]

  const out: string[] = []
  let rest = s

  while (rest.length > maxChars) {
    // Try to break on last space within maxChars
    let cut = rest.lastIndexOf(' ', maxChars)
    if (cut < 20) cut = maxChars // if no good space, hard cut
    out.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }

  if (rest.length) out.push(rest)
  return out
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      { status: 500 }
    )
  }

  const { caseId, docTypeId } = await ctx.params

  // Require auth token (keeps endpoint protected)
  const token = getBearer(req)
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })

  const { data: caseRow, error: caseErr } = await supabase
    .from('cases')
    .select('id,state_code')
    .eq('id', caseId)
    .single()
  if (caseErr) {
    return NextResponse.json({ ok: false, error: caseErr.message }, { status: 404 })
  }
  // Fetch the draft + doc name (best-effort, shape depends on your Supabase relationship)
  const { data: cd, error: cdErr } = await supabase
    .from('case_documents')
    .select('id,status,generated_at,data,document_types(name)')
    .eq('case_id', caseId)
    .eq('document_type_id', docTypeId)
    .single()

  if (cdErr) {
    return NextResponse.json({ ok: false, error: cdErr.message }, { status: 404 })
  }

  const docName = (cd as any)?.document_types?.name ?? 'Unknown document'
  const draft = ((cd as any)?.data ?? {}) as Record<string, any>

  const safe = (k: string) => {
    const v = draft?.[k]
    if (v === null || v === undefined) return ''
    return String(v)
  }
  function formatDate(v: any): string {
    if (!v) return ''
    try {
      const d = new Date(String(v))
      if (isNaN(d.getTime())) return String(v)
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    } catch {
      return String(v)
    }
  }

  const lines: string[] = []
  lines.push('NoticePack PDF (draft-aware stub)')
  lines.push('')
  lines.push('case_id: ' + caseId)
  lines.push('document_type_id: ' + docTypeId)
  lines.push('document_name: ' + docName)
  lines.push('status: ' + String((cd as any)?.status ?? 'unknown'))
  lines.push('generated_at: ' + formatDate((cd as any)?.generated_at ?? ''))
  lines.push('')

  if (docName.toLowerCase().includes('non-renewal')) {
    lines.push('--- Notice of Non-Renewal Fields (from draft) ---')
    lines.push('tenant_name: ' + safe('tenant_name'))
    lines.push('property_address: ' + safe('property_address'))
    lines.push('notice_date: ' + formatDate(safe('notice_date') || safe('otice_date')))
    lines.push('move_out_date: ' + formatDate(safe('move_out_date')))
    lines.push('landlord_name: ' + safe('landlord_name'))
    lines.push('landlord_phone: ' + safe('landlord_phone'))
    lines.push('landlord_email: ' + safe('landlord_email'))
    lines.push('')
  } else {
    lines.push('--- Draft Keys Present (first 25) ---')
    const keys = Object.keys(draft || {}).slice(0, 25)
    lines.push(keys.length ? keys.join(', ') : '(no draft fields)')
    lines.push('')
  }

  lines.push('Next step: real template formatting + layout.')
  // Build PDF (template-driven)
  const stateCode = (caseRow as any)?.state_code ?? ''
  const lowerName = String(docName || '').toLowerCase()
  try {
    const sections = stateCode === 'CA' && lowerName.includes('non-renewal')
      ? buildCaNoticeOfNonRenewalSections({
          caseId,
          docTypeId,
          docName,
          status: String((cd as any)?.status ?? 'unknown'),
          generatedAt: (cd as any)?.generated_at ?? null,
          draft: ((cd as any)?.data ?? {}) as Record<string, any>,
        })
      : stateCode === 'CA' && lowerName.includes('itemized deductions')
        ? buildCaItemizedDeductionsSections({
          caseId,
          docTypeId,
          docName,
          status: String((cd as any)?.status ?? 'unknown'),
          generatedAt: (cd as any)?.generated_at ?? null,
          draft: ((cd as any)?.data ?? {}) as Record<string, any>,
        })
      : [{ title: docName, lines: lines }];

    const pdfBytes = await renderPdfFromSections(sections, { title: docName })

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="noticepack-${caseId}-${docTypeId}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('PDF_RENDER_ERROR', e)
    const msg = String((e as any)?.message ?? e ?? 'unknown error')
    const stack = String((e as any)?.stack ?? '')
    const body = 'PDF_RENDER_ERROR:\n\n' + msg + '\n\n' + stack
    return new NextResponse(body, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
}






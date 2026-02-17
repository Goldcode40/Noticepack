import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts } from 'pdf-lib'

async function makeSimplePdf(text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const fontSize = 12
  const margin = 50
  const maxWidth = 612 - margin * 2

  // naive wrap
  const words = text.split(/\s+/)
  let line = ''
  const lines: string[] = []
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(test, fontSize)
    if (width > maxWidth) {
      if (line) lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  let y = 792 - margin
  for (const ln of lines) {
    page.drawText(ln, { x: margin, y, size: fontSize, font })
    y -= fontSize + 4
    if (y < margin) break
  }

  return await pdfDoc.save()
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ caseId: string; docTypeId: string }> }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      { status: 500 }
    )
  }

  const { caseId, docTypeId } = await ctx.params

  // Auth: expect Supabase access token
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing bearer token' }, { status: 401 })
  }

  // Use token to fetch user (ensures the caller is authenticated)
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Optional: verify the case_document exists for this user (keeps it tight)
  const { data: cd, error: cdErr } = await supabase
    .from('case_documents')
    .select('id,status,generated_at')
    .eq('case_id', caseId)
    .eq('document_type_id', docTypeId)
    .single()

  if (cdErr) {
    return NextResponse.json({ ok: false, error: cdErr.message }, { status: 404 })
  }

  const text =
    `NoticePack PDF (stub)\n\n` +
    `case_id: ${caseId}\n` +
    `document_type_id: ${docTypeId}\n` +
    `status: ${cd?.status ?? 'unknown'}\n` +
    `generated_at: ${cd?.generated_at ?? 'n/a'}\n\n` +
    `Next step: real template rendering from draft JSON.\n`

  const pdfBytes = await makeSimplePdf(text)

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="noticepack-${caseId}-${docTypeId}.pdf"`,
    },
  })
}

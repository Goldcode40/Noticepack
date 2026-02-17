import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Minimal PDF generator (no deps): builds a 1-page PDF with a single line of text.
function makeSimplePdf(text: string): Uint8Array {
  // Basic PDF objects
  const lines = [
    "%PDF-1.4\n",
  ]

  const objects: string[] = []

  // Helper: escape parentheses in PDF strings
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

  // 1: Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
  // 2: Pages
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
  // 3: Page
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R " +
      "/Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  )
  // 4: Contents
  const content = `BT /F1 12 Tf 50 740 Td (${esc(text)}) Tj ET\n`
  objects.push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`)
  // 5: Font
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

  // Build xref
  // Track byte offsets
  let offset = 0
  const chunks: string[] = []
  const offsets: number[] = [0] // object 0 is special

  for (const head of lines) {
    chunks.push(head)
    offset += Buffer.byteLength(head, "utf8")
  }

  for (const obj of objects) {
    offsets.push(offset)
    chunks.push(obj)
    offset += Buffer.byteLength(obj, "utf8")
  }

  const xrefStart = offset
  let xref = "xref\n0 6\n"
  xref += "0000000000 65535 f \n"
  for (let i = 1; i <= 5; i++) {
    const off = String(offsets[i]).padStart(10, "0")
    xref += `${off} 00000 n \n`
  }

  const trailer =
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
    `${xrefStart}\n%%EOF\n`

  chunks.push(xref)
  chunks.push(trailer)

  const out = chunks.join("")
  return new TextEncoder().encode(out)
}

export async function GET(req: NextRequest, ctx: { params: { caseId: string; docTypeId: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" },
      { status: 500 }
    )
  }

  const { caseId, docTypeId } = ctx.params

  // Auth: expect Supabase access token (we'll wire the client next step).
  // For now we allow token via:
  // 1) Authorization: Bearer <token>
  // 2) ?token=<token> (DEV ONLY - remove later if you want)
  const authHeader = req.headers.get("authorization") || ""
  const headerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null
  const token = headerToken || req.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing access token" }, { status: 401 })
  }

  // Create an authed Supabase client by passing the token in headers
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  // Validate token
  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: userErr?.message ?? "Invalid token" }, { status: 401 })
  }

  // Load draft row (RLS enforced)
  const { data: draft, error: dErr } = await supabase
    .from("case_documents")
    .select("status,generated_at,updated_at")
    .eq("case_id", caseId)
    .eq("document_type_id", docTypeId)
    .maybeSingle()

  if (dErr) {
    return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 })
  }

  const stamp = draft?.generated_at || draft?.updated_at || new Date().toISOString()
  const text = `NoticePack PDF (stub)\ncase=${caseId}\ndocType=${docTypeId}\nstatus=${draft?.status ?? "none"}\ntime=${stamp}`

  const pdfBytes = makeSimplePdf(text)

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="noticepack-${caseId}-${docTypeId}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}

import { PdfSection } from "@/lib/pdf/render"

type FallbackInput = {
  caseId: string
  docTypeId: string
  docName: string
  status: string
  generatedAt: any
  stateCode?: string
  draft: Record<string, any>
}

function safe(draft: Record<string, any>, k: string): string {
  const v = draft?.[k]
  if (v === null || v === undefined) return ""
  return String(v)
}

function formatDate(v: any): string {
  if (!v) return ""
  try {
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return String(v)
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
  } catch {
    return String(v)
  }
}

export function buildFallbackSections(input: FallbackInput): PdfSection[] {
  const { caseId, docTypeId, docName, status, generatedAt, stateCode, draft } = input

  const title = docName || "Document"
  const meta: PdfSection = {
    title,
    lines: [
      "NoticePack — Generated PDF",
      "",
      `Case ID: ${caseId}`,
      `Document Type ID: ${docTypeId}`,
      stateCode ? `State: ${stateCode}` : "State: (unknown)",
      `Status: ${status}`,
      `Generated: ${formatDate(generatedAt)}`,
    ],
  }

  // Common “best effort” fields (won't break if missing)
  const parties: PdfSection = {
    title: "Parties / Property (best-effort)",
    lines: [
      `Tenant: ${safe(draft, "tenant_name")}`,
      `Landlord: ${safe(draft, "landlord_name")}`,
      `Property Address: ${safe(draft, "property_address")}`,
      `Notice Date: ${formatDate(safe(draft, "notice_date"))}`,
      `Move-out Date: ${formatDate(safe(draft, "move_out_date"))}`,
    ],
  }

  // Full dump (limited) for debugging / completeness without being ugly
  const keys = Object.keys(draft || {}).sort()
  const max = 40
  const shown = keys.slice(0, max)

  const details: PdfSection = {
    title: "Draft Fields (first 40)",
    lines: shown.length
      ? shown.map((k) => `${k}: ${safe(draft, k)}`)
      : ["(no draft fields)"],
  }

  if (keys.length > max) {
    details.lines.push("")
    details.lines.push(`(Showing ${max} of ${keys.length} keys)`)
  }

  return [meta, parties, details]
}

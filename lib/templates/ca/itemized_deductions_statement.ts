import type { PdfSection } from "@/lib/pdf/render"
import { formatDate } from "@/lib/pdf/render"

export type CaItemizedDeductionsInput = {
  caseId: string
  docTypeId: string
  docName: string
  status: string
  generatedAt: any
  draft: Record<string, any>
}

function safe(draft: Record<string, any>, k: string): string {
  const v = draft?.[k]
  if (v === null || v === undefined) return ""
  return String(v)
}

export function buildCaItemizedDeductionsSections(input: CaItemizedDeductionsInput): PdfSection[] {
  const { caseId, docTypeId, docName, status, generatedAt, draft } = input

  // NOTE: right now we only have a few keys in draft for this doc.
  // We'll expand fields + add deduction rows later.
  const noticeDate = formatDate(safe(draft, "notice_date"))
  const tenantName = safe(draft, "tenant_name")
  const landlordName = safe(draft, "landlord_name")
  const propertyAddress = safe(draft, "property_address")

  const header: PdfSection = {
    title: docName || "Itemized Deductions Statement",
    lines: [
      "NoticePack PDF (template: CA / Itemized Deductions Statement)",
      "",
      `case_id: ${caseId}`,
      `document_type_id: ${docTypeId}`,
      `status: ${status}`,
      `generated_at: ${formatDate(generatedAt)}`,
    ],
  }

  const partyInfo: PdfSection = {
    title: "Parties / Property",
    lines: [
      `tenant_name: ${tenantName}`,
      `landlord_name: ${landlordName}`,
      `property_address: ${propertyAddress}`,
      `notice_date: ${noticeDate}`,
    ],
  }

  const deductions: PdfSection = {
    title: "Deductions (placeholder)",
    lines: [
      "TODO: add itemized deduction rows (description + amount).",
      "TODO: add totals + remaining deposit.",
      "",
    ],
  }

  return [header, partyInfo, deductions]
}



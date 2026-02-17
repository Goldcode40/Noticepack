import type { PdfSection } from "../../pdf/render"
import { formatDate } from "../../pdf/render"

export function buildCaNoticeOfNonRenewalSections(args: {
  caseId: string
  docTypeId: string
  docName: string
  status?: string
  generatedAt?: any
  draft?: Record<string, any>
}): PdfSection[] {
  const { caseId, docTypeId, docName, status, generatedAt, draft } = args

  const safe = (k: string) => {
    const v = draft?.[k]
    if (v === null || v === undefined) return ""
    return String(v)
  }

  const noticeDate = safe("notice_date") || safe("otice_date")
  const moveOutDate = safe("move_out_date")

  return [
    {
      title: "Case + Document",
      lines: [
        `case_id: ${caseId}`,
        `document_type_id: ${docTypeId}`,
        `document_name: ${docName}`,
        `status: ${String(status ?? "unknown")}`,
        `generated_at: ${formatDate(generatedAt ?? "")}`,
      ],
    },
    {
      title: "Notice of Non-Renewal Fields (from draft)",
      lines: [
        `tenant_name: ${safe("tenant_name")}`,
        `property_address: ${safe("property_address")}`,
        `notice_date: ${formatDate(noticeDate)}`,
        `move_out_date: ${formatDate(moveOutDate)}`,
        `landlord_name: ${safe("landlord_name")}`,
        `landlord_phone: ${safe("landlord_phone")}`,
        `landlord_email: ${safe("landlord_email")}`,
      ],
    },
    {
      title: "Next step",
      lines: ["Real template formatting + layout."],
    },
  ]
}

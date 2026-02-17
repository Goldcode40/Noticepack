import { PDFDocument, StandardFonts } from "pdf-lib"

export type PdfSection = {
  title?: string
  lines: string[]
}

type RenderOptions = {
  title?: string
  filenameBase?: string
}

function wrapLine(text: string, maxLen = 110): string[] {
  const s = String(text ?? "")
  if (s.length <= maxLen) return [s]

  const words = s.split(/\s+/)
  const out: string[] = []
  let cur = ""

  for (const w of words) {
    const next = cur ? cur + " " + w : w
    if (next.length <= maxLen) {
      cur = next
    } else {
      if (cur) out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  return out
}

export function formatDate(v: any): string {
  if (!v) return ""
  try {
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return String(v)
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
  } catch {
    return String(v)
  }
}

export async function renderPdfFromSections(sections: PdfSection[], opts: RenderOptions = {}) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const fontSize = 11
  const leading = 16
  const left = 60
  let y = 740

  const draw = (text: string, size = fontSize) => {
    const rows = wrapLine(text, 110)
    for (const row of rows) {
      if (y < 60) break
      page.drawText(row, { x: left, y, size, font })
      y -= leading
    }
  }

  // Title
  if (opts.title) {
    page.drawText(opts.title, { x: left, y, size: 14, font })
    y -= 26
  }

  for (const sec of sections) {
    if (y < 80) break

    if (sec.title) {
      draw(sec.title, 12)
      y -= 6
    }

    for (const line of sec.lines) {
      if (y < 60) break
      draw(line, fontSize)
    }

    y -= 10
  }

  const bytes = await pdfDoc.save()
  return new Uint8Array(bytes)
}

import {
  type PlanForDoc, LESSON_TABLE_HEADER, textLines, planFileName, planTitle, planSubtitle, filledLessons,
  overviewRows, listSection, lessonHeading, lessonRows,
} from '@/lib/lessonPlanContent'

// Builds a Word (.docx) copy of a lesson plan laid out like the Ministry-style
// 5E unit plans teachers already use: a title, an overview table, general
// objectives and key formulae/vocabulary, then one table per lesson.

const A4_CONTENT_WIDTH = 9026 // A4 (11906) minus 1-inch margins, in DXA
const LABEL_FILL = 'E8EDF3'
const BORDER = { style: 'single' as const, size: 4, color: '9AA5B1' }

export async function buildLessonPlanDocument(plan: PlanForDoc) {
  const d = await import('docx')
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, HeadingLevel, BorderStyle } = d

  const borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }
  const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 }

  const para = (text: string, opts: { bold?: boolean; size?: number; bullet?: boolean; after?: number } = {}) =>
    new Paragraph({
      spacing: { after: opts.after ?? 60 },
      ...(opts.bullet ? { bullet: { level: 0 } } : {}),
      children: [new TextRun({ text, bold: opts.bold, size: opts.size })],
    })

  const cellParas = (text: string, bold = false) => {
    const ls = textLines(text)
    return (ls.length ? ls : ['']).map((l) => para(l, { bold }))
  }

  const makeCell = (text: string, width: number, opts: { label?: boolean; header?: boolean } = {}) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders,
      margins: cellMargins,
      shading: opts.label || opts.header ? { fill: LABEL_FILL, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      children: cellParas(text, opts.label || opts.header),
    })

  const twoColumnTable = (rows: [string, string][], widths: [number, number], header?: [string, string]) =>
    new Table({
      width: { size: widths[0] + widths[1], type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        ...(header ? [new TableRow({ tableHeader: true, children: [makeCell(header[0], widths[0], { header: true }), makeCell(header[1], widths[1], { header: true })] })] : []),
        ...rows.map(([label, value]) => new TableRow({ children: [makeCell(label, widths[0], { label: true }), makeCell(value, widths[1])] })),
      ],
    })

  const heading = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text, bold: true })] })

  // ---- title -----------------------------------------------------------------
  const lessons = filledLessons(plan)

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: planTitle(plan), bold: true, size: 32 })] }),
    new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '9AA5B1', space: 4 } }, children: [new TextRun({ text: planSubtitle(plan, lessons.length), size: 24 })] }),
    twoColumnTable(overviewRows(plan), [2600, A4_CONTENT_WIDTH - 2600]),
  ]

  // ---- general objectives + key content ---------------------------------------
  const addList = (title: string, text: string | null | undefined) => {
    const section = listSection(text)
    if (!section) return
    children.push(heading(title))
    section.items.forEach((item) => children.push(para(item, { bullet: section.bullets })))
  }
  addList('General Learning Objectives', plan.general_objectives)
  addList('Key Formulae and Vocabulary', plan.key_terms_formulae)

  // ---- lessons ---------------------------------------------------------------
  lessons.forEach((lesson, i) => {
    children.push(heading(lessonHeading(lesson, i)))
    const rows = lessonRows(lesson)
    if (rows.length > 0) children.push(twoColumnTable(rows, [2200, A4_CONTENT_WIDTH - 2200], LESSON_TABLE_HEADER))
    else children.push(para('No content yet.'))
  })

  return new Document({
    creator: 'Smart Assess Ja',
    title: `5E Lesson Plan – ${plan.topic}`,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Calibri' }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1, keepNext: true } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  })
}

// Browser-side: builds the document and saves it through a temporary link.
export async function downloadLessonPlanDocx(plan: PlanForDoc): Promise<void> {
  const { Packer } = await import('docx')
  const blob = await Packer.toBlob(await buildLessonPlanDocument(plan))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = planFileName(plan, 'docx')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

import {
  type PlanForDoc, LESSON_TABLE_HEADER, planFileName, planTitle, planSubtitle, filledLessons,
  overviewRows, listSection, lessonHeading, lessonRows,
} from '@/lib/lessonPlanContent'

// PDF copy of a lesson plan, laid out like the Word version. Uses pdfmake with
// its bundled Roboto font, which covers the maths symbols lesson plans use
// (×, ÷, ≤, ≥, √, π, ², ...), unlike the basic built-in PDF fonts.

const LABEL_FILL = '#E8EDF3'
const LINE = '#9AA5B1'
const CONTENT_WIDTH = 495 // A4 (595pt) minus 50pt margins

const tableLayout = {
  hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => LINE, vLineColor: () => LINE,
  paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4,
}

// Roboto has no arrow glyphs, and a missing glyph would print as nothing at
// all, so spell arrows out in plain characters.
const safe = (text: string) => text.replace(/↔/g, '<->').replace(/⇒/g, '=>').replace(/→/g, '->').replace(/←/g, '<-')

const labelCell = (text: string) => ({ text: safe(text), bold: true, fillColor: LABEL_FILL })
const heading = (text: string) => ({ text: safe(text), fontSize: 13, bold: true, margin: [0, 14, 0, 5], headlineLevel: 1 })

// Pure: builds the pdfmake document description (no library needed), so it can
// be tested without a browser.
export function buildLessonPlanPdfDefinition(plan: PlanForDoc) {
  const lessons = filledLessons(plan)
  const content: unknown[] = [
    { text: safe(planTitle(plan)), fontSize: 16, bold: true, margin: [0, 0, 0, 3] },
    { text: safe(planSubtitle(plan, lessons.length)), fontSize: 12, margin: [0, 0, 0, 4] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.75, lineColor: LINE }], margin: [0, 0, 0, 10] },
    { table: { widths: [125, '*'], body: overviewRows(plan).map(([label, value]) => [labelCell(label), { text: safe(value) }]) }, layout: tableLayout },
  ]

  const addList = (title: string, text: string | null | undefined) => {
    const section = listSection(text)
    if (!section) return
    content.push(heading(title))
    content.push(section.bullets ? { ul: section.items.map(safe), margin: [0, 0, 0, 4] } : { text: safe(section.items[0]), margin: [0, 0, 0, 4] })
  }
  addList('General Learning Objectives', plan.general_objectives)
  addList('Key Formulae and Vocabulary', plan.key_terms_formulae)

  lessons.forEach((lesson, i) => {
    content.push(heading(lessonHeading(lesson, i)))
    const rows = lessonRows(lesson)
    if (rows.length === 0) { content.push({ text: 'No content yet.' }); return }
    content.push({
      table: {
        headerRows: 1,
        widths: [105, '*'],
        body: [
          [labelCell(LESSON_TABLE_HEADER[0]), labelCell(LESSON_TABLE_HEADER[1])],
          ...rows.map(([label, value]) => [labelCell(label), { text: safe(value) }]),
        ],
      },
      layout: tableLayout,
    })
  })

  return {
    info: { title: `5E Lesson Plan – ${plan.topic}`, author: 'Smart Assess Ja', creator: 'Smart Assess Ja' },
    pageSize: 'A4',
    pageMargins: [50, 50, 50, 50],
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    content,
    // Never leave a heading stranded at the bottom of a page.
    pageBreakBefore: (node: { headlineLevel?: number }, followingNodesOnPage: unknown[]) => node.headlineLevel === 1 && followingNodesOnPage.length === 0,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [{ text: 'Smart Assess Ja', alignment: 'left' }, { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right' }],
      margin: [50, 12, 50, 0], fontSize: 8, color: '#6B7480',
    }),
  }
}

// Browser-side: builds the PDF (loading the library and fonts only now) and
// saves it.
export async function downloadLessonPlanPdf(plan: PlanForDoc): Promise<void> {
  const [pdfModule, fontsModule] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  const pdfMake = (pdfModule as { default?: typeof pdfModule.default }).default ?? (pdfModule as unknown as typeof pdfModule.default)
  const vfs = (fontsModule as { default?: Record<string, string> }).default ?? (fontsModule as unknown as Record<string, string>)
  pdfMake.addVirtualFileSystem(vfs)
  await pdfMake.createPdf(buildLessonPlanPdfDefinition(plan)).download(planFileName(plan, 'pdf'))
}

import { lessonsForPlan, LESSON_FIELDS, type Lesson } from '@/lib/lessonPlan'

// Builds a Word (.docx) copy of a lesson plan laid out like the Ministry-style
// 5E unit plans teachers already use: a title, an overview table, general
// objectives and key formulae/vocabulary, then one table per lesson.

export type PlanForDoc = {
  subject: string
  grade: string
  topic: string
  term?: string | null
  duration?: string | null
  unit_theme?: string | null
  focus_strand?: string | null
  focus_question?: string | null
  attainment_target?: string | null
  specific_objective?: string | null
  skills?: string | null
  prior_learning?: string | null
  materials?: string | null
  success_criteria?: string | null
  sub_topics?: string | null
  prerequisite_knowledge?: string | null
  four_cs?: string | null
  subject_practices?: string | null
  general_objectives?: string | null
  key_terms_formulae?: string | null
  lessons?: unknown
  engage?: string | null
  explore?: string | null
  explain?: string | null
  elaborate?: string | null
  evaluate?: string | null
}

const A4_CONTENT_WIDTH = 9026 // A4 (11906) minus 1-inch margins, in DXA
const LABEL_FILL = 'E8EDF3'
const BORDER = { style: 'single' as const, size: 4, color: '9AA5B1' }

const nonEmpty = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim().length > 0
const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
const stripMarker = (l: string) => l.replace(/^(\d+[.)]|[-•*])\s+/, '')

export function planFileName(plan: Pick<PlanForDoc, 'grade' | 'topic'>): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `${clean(plan.grade) || 'Grade'}_${clean(plan.topic) || 'Lesson'}_5E_Lesson_Plan.docx`
}

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
    const ls = lines(text)
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
  const lessons: Lesson[] = lessonsForPlan(plan).filter((l) => Object.values(l).some((v) => v.trim()))
  const lessonCount = lessons.length
  const subtitleParts = [`${plan.grade} ${plan.subject}`.trim()]
  if (nonEmpty(plan.duration)) subtitleParts.push(plan.duration.trim())
  else if (lessonCount > 1) subtitleParts.push(`${lessonCount} lessons`)

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `5E LESSON PLAN – ${plan.topic.toUpperCase()}`, bold: true, size: 32 })] }),
    new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '9AA5B1', space: 4 } }, children: [new TextRun({ text: subtitleParts.join(' | '), size: 24 })] }),
  ]

  // ---- overview --------------------------------------------------------------
  const practicesLabel = /math/i.test(plan.subject) ? 'Mathematical Practices' : 'Subject Practices'
  const overview: [string, string | null | undefined][] = [
    ['Topic', plan.topic],
    ['Sub-topics', plan.sub_topics],
    ['Grade', plan.grade],
    ['Term', plan.term],
    ['Duration', plan.duration],
    ['Unit & Theme', plan.unit_theme],
    ['Focus Strand', plan.focus_strand],
    ['Focus Question', plan.focus_question],
    ['Attainment Target', plan.attainment_target],
    ['Prerequisite Knowledge', plan.prerequisite_knowledge || plan.prior_learning],
    ['4Cs', plan.four_cs],
    [practicesLabel, plan.subject_practices],
    ['Specific Objective', plan.specific_objective],
    ['Skills', plan.skills],
    ['Materials', plan.materials],
    ['Success Criteria', plan.success_criteria],
  ]
  children.push(twoColumnTable(overview.filter(([, v]) => nonEmpty(v)) as [string, string][], [2600, A4_CONTENT_WIDTH - 2600]))

  // ---- general objectives + key content ---------------------------------------
  const listSection = (title: string, text: string | null | undefined) => {
    if (!nonEmpty(text)) return
    children.push(heading(title))
    const ls = lines(text)
    if (ls.length === 1) children.push(para(ls[0]))
    else ls.forEach((l) => children.push(para(stripMarker(l), { bullet: true })))
  }
  listSection('General Learning Objectives', plan.general_objectives)
  listSection('Key Formulae and Vocabulary', plan.key_terms_formulae)

  // ---- lessons ---------------------------------------------------------------
  lessons.forEach((lesson, i) => {
    children.push(heading(`Lesson ${i + 1}${lesson.title.trim() ? ` – ${lesson.title.trim()}` : ''}`))
    const rows = LESSON_FIELDS.filter(({ key }) => lesson[key].trim()).map(({ key, label }) => [label, lesson[key]] as [string, string])
    if (rows.length > 0) children.push(twoColumnTable(rows, [2200, A4_CONTENT_WIDTH - 2200], ['Component', 'Activities / Teaching and Learning']))
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
  a.download = planFileName(plan)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

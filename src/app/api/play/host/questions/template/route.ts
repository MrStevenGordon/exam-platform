import { getPlayTeacherId } from '@/lib/playAuth'
import { TEMPLATE_COLUMNS, TEMPLATE_ROWS, toCsv } from '@/lib/playQuestionImport'

// A ready-to-fill CSV with one example of each question type. The UTF-8 byte
// order mark makes Excel read symbols like ² and ÷ correctly.
export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  const csv = '\uFEFF' + toCsv([TEMPLATE_COLUMNS, ...TEMPLATE_ROWS]) + '\r\n'
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="game-questions-template.csv"',
      'Cache-Control': 'no-store',
    },
  })
}

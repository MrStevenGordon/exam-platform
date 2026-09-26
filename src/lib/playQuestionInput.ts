// Validation for teacher-authored game questions. Runs on the server for every
// create and edit; the form only mirrors these rules to give quicker feedback.

export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'short_answer'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export const WRITABLE_STATUSES = ['draft', 'approved', 'archived'] as const

export type ValidQuestion = {
  subject: string
  topic: string
  questionType: QuestionType
  questionText: string
  options: string[] | null
  correctAnswer: string
  points: number
  explanation: string | null
  status: (typeof WRITABLE_STATUSES)[number]
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

export function validateQuestionInput(body: any): { ok: true; value: ValidQuestion } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' }

  const subject = typeof body.subject === 'string' ? collapse(body.subject) : ''
  const topic = typeof body.topic === 'string' ? collapse(body.topic) : ''
  if (!subject || subject.length > 60) return { ok: false, error: 'Enter a subject (up to 60 characters).' }
  if (!topic || topic.length > 60) return { ok: false, error: 'Enter a topic (up to 60 characters).' }

  const questionType = body.questionType as QuestionType
  if (!QUESTION_TYPES.includes(questionType)) return { ok: false, error: 'Pick a question type.' }

  const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : ''
  if (!questionText) return { ok: false, error: 'Enter the question.' }
  if (questionText.length > 500) return { ok: false, error: 'The question is too long (500 characters at most).' }

  const points = Number(body.points)
  if (!Number.isInteger(points) || points < 1 || points > 5) return { ok: false, error: 'Points must be a whole number from 1 to 5.' }

  const explanationRaw = typeof body.explanation === 'string' ? body.explanation.trim() : ''
  if (explanationRaw.length > 500) return { ok: false, error: 'The explanation is too long (500 characters at most).' }
  const explanation = explanationRaw || null

  const status = body.status as ValidQuestion['status']
  if (!WRITABLE_STATUSES.includes(status)) return { ok: false, error: 'Pick a status.' }

  let options: string[] | null = null
  let correctAnswer = ''

  if (questionType === 'multiple_choice') {
    if (!Array.isArray(body.options)) return { ok: false, error: 'Add the answer choices.' }
    const cleaned = body.options.map((o: unknown) => (typeof o === 'string' ? o.trim() : ''))
    if (cleaned.some((o: string) => !o)) return { ok: false, error: 'Fill in every answer choice or remove the empty ones.' }
    if (cleaned.length < 2 || cleaned.length > 6) return { ok: false, error: 'Use between 2 and 6 answer choices.' }
    if (cleaned.some((o: string) => o.length > 120)) return { ok: false, error: 'An answer choice is too long (120 characters at most).' }
    if (new Set(cleaned.map((o: string) => o.toLowerCase())).size !== cleaned.length) return { ok: false, error: 'Answer choices must all be different.' }
    const answer = typeof body.correctAnswer === 'string' ? body.correctAnswer.trim() : ''
    const match = cleaned.find((o: string) => o.toLowerCase() === answer.toLowerCase())
    if (!match) return { ok: false, error: 'Mark which choice is correct.' }
    options = cleaned
    correctAnswer = match
  } else if (questionType === 'true_false') {
    const answer = typeof body.correctAnswer === 'string' ? body.correctAnswer.trim().toLowerCase() : ''
    if (answer !== 'true' && answer !== 'false') return { ok: false, error: 'Choose whether the statement is true or false.' }
    correctAnswer = answer
  } else {
    const answer = typeof body.correctAnswer === 'string' ? body.correctAnswer.trim() : ''
    if (!answer) return { ok: false, error: 'Enter the correct answer.' }
    if (answer.length > 100) return { ok: false, error: 'The correct answer is too long (100 characters at most).' }
    correctAnswer = answer
  }

  return { ok: true, value: { subject, topic, questionType, questionText, options, correctAnswer, points, explanation, status } }
}

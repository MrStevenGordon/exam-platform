export type MarkingPoint = { text: string; keywords: string[]; marks: number }

export type GradableQuestion = {
  question_type: string
  points: number
  correct_answer: string | null
  marking_points?: MarkingPoint[] | null
}

export function gradeMultiPoint(question: GradableQuestion, answers: string[]): number {
  if (!question.marking_points || question.marking_points.length === 0) return 0
  let totalAwarded = 0
  const maxMarks = question.points
  for (const point of question.marking_points) {
    if (!point.keywords || point.keywords.length === 0) continue
    const matched = answers.some((ans) => {
      const ansLower = ans.toLowerCase().trim()
      return point.keywords.some((kw: string) => ansLower.includes(kw.toLowerCase()))
    })
    if (matched) totalAwarded += point.marks
  }
  return Math.min(totalAwarded, maxMarks)
}

export function gradeAnswer(question: GradableQuestion, studentAnswer: string): number | null {
  const autoGradable = ['multiple_choice', 'true_false', 'short_answer', 'fill_blank']
  if (!autoGradable.includes(question.question_type)) return null

  if (question.marking_points && question.marking_points.length > 0) {
    const answers = studentAnswer.split('\n').map((a) => a.trim()).filter(Boolean)
    if (answers.length === 0) answers.push(studentAnswer)
    return gradeMultiPoint(question, answers)
  }

  if (!question.correct_answer) return 0
  return studentAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()
    ? question.points : 0
}

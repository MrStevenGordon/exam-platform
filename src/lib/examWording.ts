// What to call an item in the words a person reads: homework, assignments and group projects are tasks, quizzes and class tests are tests,
// everything else is an exam.
const TASK_KINDS = ['homework', 'assignment', 'group_project']
const TEST_KINDS = ['pop_quiz', 'class_test', 'weekly_test']

export type ExamNoun = 'task' | 'test' | 'exam'

export function examNoun(examKind: string | null | undefined): ExamNoun {
  if (examKind && TASK_KINDS.includes(examKind)) return 'task'
  if (examKind && TEST_KINDS.includes(examKind)) return 'test'
  return 'exam'
}

export function nounCapital(noun: ExamNoun): string {
  return noun.charAt(0).toUpperCase() + noun.slice(1)
}

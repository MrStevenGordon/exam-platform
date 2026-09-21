import { redirect } from 'next/navigation'

// HODs now use the same Tests page as teachers (they teach classes too), so the
// old pop-quiz-only list is retired. Kept as a redirect for old bookmarks.
export default function SupervisorExamsRedirect() {
  redirect('/teacher/tests')
}

import { redirect } from 'next/navigation'

// See ../page.tsx: creation now goes through the shared teacher builder.
export default function SupervisorNewExamRedirect() {
  redirect('/teacher/new?kind=test')
}

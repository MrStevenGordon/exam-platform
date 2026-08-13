import type { Metadata } from 'next'
import DemoExam from '@/components/DemoExam'

export const metadata: Metadata = {
  title: 'Try a Demo Exam — Smart Assess Ja',
  description: 'A short, interactive sample of the Smart Assess Ja exam-taking experience. No account needed.',
}

export default function DemoExamPage() {
  return <DemoExam />
}

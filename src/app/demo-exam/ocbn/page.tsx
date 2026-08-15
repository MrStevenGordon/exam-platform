import type { Metadata } from 'next'
import DemoExam, { type Question } from '@/components/DemoExam'

export const metadata: Metadata = {
  title: 'OCBN Demo Exam: Smart Assess Ja',
  description: 'A demo exam built for the One Caribbean Business Network, with real exam-integrity enforcement. No account needed.',
}

const OCBN_QUESTIONS: Question[] = [
  {
    id: 'ocbn1',
    type: 'true_false',
    text: 'OCBN stands for the One Caribbean Business Network.',
    correct: 'true',
    points: 1,
  },
  {
    id: 'ocbn2',
    type: 'multiple_choice',
    text: "In which Caribbean island did OCBN originate, first as the “Curaçao Business Network”?",
    options: ['Jamaica', 'Barbados', 'Curaçao', 'Aruba'],
    correct: 'Curaçao',
    points: 1,
  },
  {
    id: 'ocbn3',
    type: 'multiple_choice',
    text: 'Who co-founded OCBN alongside Suzette Louw?',
    options: ['Gaynel Watson', 'Ryan Davis', 'Farah Kabbara', 'Sandiford Edwards'],
    correct: 'Ryan Davis',
    points: 1,
    readAloud: true,
  },
  {
    id: 'ocbn4',
    type: 'true_false',
    text: 'Suzette Louw, co-founder of OCBN, is originally from South Africa.',
    correct: 'true',
    points: 1,
  },
  {
    id: 'ocbn5',
    type: 'true_false',
    text: 'Ryan Davis launched his first company at age 17.',
    correct: 'true',
    points: 1,
  },
  {
    id: 'ocbn6',
    type: 'multiple_choice',
    text: 'OCBN is officially structured as a:',
    options: ['Government agency', 'Publicly traded company', 'Foundation', 'Trade union'],
    correct: 'Foundation',
    points: 1,
  },
  {
    id: 'ocbn7',
    type: 'multiple_choice',
    text: "Which of these is NOT one of OCBN's three membership categories?",
    options: ['Builders & Innovators', 'Investors & Strategic Partners', 'Government Regulators', 'Economic Interest Groups & Ecosystem Leaders'],
    correct: 'Government Regulators',
    points: 1,
  },
  {
    id: 'ocbn8',
    type: 'true_false',
    text: "Gaynel Watson is OCBN's Ambassador for Jamaica.",
    correct: 'true',
    points: 1,
  },
  {
    id: 'ocbn9',
    type: 'multiple_choice',
    text: "OCBN's virtual networking program is called:",
    options: ['OCBN Connect Live', 'OCBN Global Connect', 'Caribbean Link', 'OCBN Bridge'],
    correct: 'OCBN Global Connect',
    points: 1,
  },
  {
    id: 'ocbn10',
    type: 'multiple_choice',
    text: 'OCBN was founded, and grew into its regional form, in:',
    options: ['2019', '2022', 'Early 2025', 'Late 2020'],
    correct: 'Early 2025',
    points: 1,
  },
]

export default function OcbnDemoExamPage() {
  return (
    <DemoExam
      questions={OCBN_QUESTIONS}
      examTitle="OCBN Demo Exam"
      introKicker="Smart Assess Ja × OCBN"
      introHeadline="How well do you know the One Caribbean Business Network?"
      introBody="Ten questions about OCBN itself, built on Smart Assess Ja — the same integrity monitoring a real exam uses. Switch tabs or exit fullscreen three times and this exam auto-submits, exactly like a real one would. Your answers are revealed at the end. Nothing here is saved, and this page doesn't need an account."
      enforceStrikes
      revealAnswers
      passcode="JAOCBN26"
      ctaHref="/build-my-school"
      ctaLabel="Get Smart Assess Ja for your school"
    />
  )
}

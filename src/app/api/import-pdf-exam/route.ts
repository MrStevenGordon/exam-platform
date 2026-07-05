import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, teacherId } = await req.json()

    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF data is required.' }, { status: 400 })
    }

    const prompt = `You are helping convert a PDF exam paper into a structured digital format. 
    
Carefully read this exam paper and extract ALL questions. For each question identify:
1. The question number and text
2. The question type (multiple_choice, true_false, short_answer, essay, fill_blank)
3. For multiple choice: all options (A, B, C, D) and the correct answer if shown
4. For true/false: the correct answer if shown
5. The point value if shown (default to 1 if not shown)
6. Any marking points for structured questions (e.g. "State THREE reasons" = 3 marking points)

Important rules:
- Extract questions EXACTLY as written — do not paraphrase
- If the correct answer is not shown (answer key not included), leave correct_answer as null
- For MCQ, include all options exactly as written
- For short answer questions that ask for multiple points (e.g. "State TWO disadvantages"), create marking_points array
- Ignore instructions pages, headers, footers, and school logos
- Number questions sequentially as they appear

Respond ONLY with valid JSON in this exact format, no other text or markdown:
{
  "title": "detected exam title or empty string",
  "subject": "detected subject or empty string", 
  "instructions": "main instructions text or empty string",
  "questions": [
    {
      "question_text": "full question text",
      "question_type": "multiple_choice|true_false|short_answer|essay|fill_blank",
      "options": ["A. option1", "B. option2", "C. option3", "D. option4"] or null,
      "correct_answer": "correct answer text or letter" or null,
      "points": 1,
      "marking_points": [{"text": "expected answer", "marks": 1}] or null
    }
  ]
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              }
            },
            {
              type: 'text',
              text: prompt,
            }
          ]
        }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', errText)
      return NextResponse.json({ error: 'AI processing failed. Please try again.' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const cleaned = text.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse AI response:', text)
      return NextResponse.json({ error: 'AI returned unexpected format. Try again.' }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (err: any) {
    console.error('PDF import error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

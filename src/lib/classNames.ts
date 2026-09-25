// How class names map to year groups at a school like Manchester High.
//
//   1-1, 1-2 ...   1st Form  = Grade 7      4-1 ...  4th Form = Grade 10
//   2-1 ...        2nd Form  = Grade 8      5-1 ...  5th Form = Grade 11
//   3-1 ...        3rd Form  = Grade 9      6B1 ...  Lower Sixth (Grade 12)
//                                           6A1 ...  Upper Sixth (Grade 12)

export const CLASS_GRADES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'] as const

const FORM_TO_GRADE: Record<string, number> = { '1': 7, '2': 8, '3': 9, '4': 10, '5': 11 }

// The student grade level a class implies, or null if the name isn't one of the patterns above.
export function gradeLevelFromClassName(name: string | null | undefined): number | null {
  const n = (name ?? '').trim().toUpperCase()
  const form = /^([1-5])-\d+$/.exec(n)
  if (form) return FORM_TO_GRADE[form[1]]
  if (/^6[AB]\d+$/.test(n)) return 12
  return null
}

// Sort key: form, then Lower Sixth before Upper Sixth, then the section number.
function sortKey(name: string): [number, number, number] {
  const n = name.trim().toUpperCase()
  const form = /^([1-5])-(\d+)$/.exec(n)
  if (form) return [Number(form[1]), 0, Number(form[2])]
  const sixth = /^6([AB])(\d+)$/.exec(n)
  if (sixth) return [6, sixth[1] === 'B' ? 0 : 1, Number(sixth[2])]
  return [99, 0, 0]
}

export function compareClassNames(a: string | null | undefined, b: string | null | undefined): number {
  const x = a ?? ''
  const y = b ?? ''
  const ka = sortKey(x)
  const kb = sortKey(y)
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || x.localeCompare(y, undefined, { numeric: true })
}

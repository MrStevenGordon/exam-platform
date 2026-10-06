import { supabase } from '@/lib/supabase'

let availability: Promise<boolean> | null = null

// Marking points for essays need migration 081. Until it is applied the editor is not offered, and nothing
// asks the database for the column (asking for a missing column would make a whole question list fail).
export function isEssayRubricAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.from('questions').select('essay_rubric').limit(1)
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}

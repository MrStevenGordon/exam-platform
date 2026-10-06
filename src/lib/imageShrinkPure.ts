// Deciding how to shrink a picture before it is uploaded. No browser, no network: the decisions can be tested
// (scripts/tests/image-shrink/imageShrinkPure.test.mjs). The browser part is in imageShrink.ts.
//
// Why: question pictures were uploaded exactly as a phone took them (2 to 8 MB) and every student sitting the exam downloaded the
// whole file. A picture on a screen never needs more than about 1600 pixels on its longest side.

export type ShrinkInput = { type: string; size: number; width: number; height: number }
export type ShrinkOptions = { maxSide: number; keepBelowBytes: number; quality: number }
export type ShrinkPlan =
  | { shrink: false; reason: 'not_a_picture' | 'animated_or_vector' | 'already_small' | 'bad_size' }
  | { shrink: true; width: number; height: number; mime: 'image/webp'; quality: number }

export const QUESTION_PICTURE: ShrinkOptions = { maxSide: 1600, keepBelowBytes: 200 * 1024, quality: 0.82 }
export const LOGO_PICTURE: ShrinkOptions = { maxSide: 600, keepBelowBytes: 60 * 1024, quality: 0.9 }

const KEEP_AS_IS = ['image/gif', 'image/svg+xml']   // animation and vector artwork would be ruined by redrawing

export function planShrink(input: ShrinkInput, opt: ShrinkOptions): ShrinkPlan {
  if (!input.type.startsWith('image/')) return { shrink: false, reason: 'not_a_picture' }
  if (KEEP_AS_IS.includes(input.type)) return { shrink: false, reason: 'animated_or_vector' }
  if (!(input.width > 0) || !(input.height > 0) || !(input.size > 0)) return { shrink: false, reason: 'bad_size' }
  const longest = Math.max(input.width, input.height)
  if (longest <= opt.maxSide && input.size <= opt.keepBelowBytes) return { shrink: false, reason: 'already_small' }
  const scale = Math.min(1, opt.maxSide / longest)
  return { shrink: true, width: Math.max(1, Math.round(input.width * scale)), height: Math.max(1, Math.round(input.height * scale)), mime: 'image/webp', quality: opt.quality }
}

// The shrunk picture is only used if it really is smaller and really came out as the format asked for (some older browsers quietly
// return a PNG instead, which can be bigger).
export function useShrunk(original: { size: number }, result: { size: number; type: string } | null, plan: Extract<ShrinkPlan, { shrink: true }>): boolean {
  return !!result && result.type === plan.mime && result.size > 0 && result.size < original.size
}

export const withWebpName = (name: string): string => (name.replace(/\.[^./\\]+$/, '') || 'picture') + '.webp'

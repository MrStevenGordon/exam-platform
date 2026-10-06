import { planShrink, useShrunk, withWebpName, type ShrinkOptions } from '@/lib/imageShrinkPure'

// Shrinks a picture in the browser before it is uploaded. Always safe to call: if anything goes wrong, or the result would not be
// smaller, the original file is returned untouched, so an upload never fails because of this.
export async function shrinkImage(file: File, options: ShrinkOptions): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
    // 'from-image' applies the photo's own rotation, so a phone photo taken sideways is not saved sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const plan = planShrink({ type: file.type, size: file.size, width: bitmap.width, height: bitmap.height }, options)
    if (!plan.shrink) { bitmap.close?.(); return file }
    const canvas = document.createElement('canvas')
    canvas.width = plan.width
    canvas.height = plan.height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height)
    bitmap.close?.()
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, plan.mime, plan.quality))
    if (!blob || !useShrunk(file, blob, plan)) return file
    return new File([blob], withWebpName(file.name), { type: plan.mime, lastModified: Date.now() })
  } catch {
    return file
  }
}

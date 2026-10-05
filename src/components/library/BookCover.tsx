// A flat cover drawn from the book's own colours, so the Library needs no cover images.
export default function BookCover({ title, author, bg, fg, width = 150, height }: { title: string; author: string; bg: string; fg: string; width?: number; height?: number }) {
  const h = height ?? Math.round(width * 1.4)
  return (
    <div className="lib-cover" style={{ width, height: h, background: bg, color: fg }} aria-hidden="true">
      <div className="lib-cover-a">{author}</div>
      <div className="lib-cover-t" style={{ fontSize: Math.max(12, Math.round(width * 0.1)) }}>{title}</div>
    </div>
  )
}

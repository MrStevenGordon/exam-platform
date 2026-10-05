import Link from 'next/link'
import BookCover from '@/components/library/BookCover'
import { LICENCE_LABEL, type LibraryFormat } from '@/lib/library'

type Props = {
  id: string
  title: string
  author: string
  coverBg: string
  coverFg: string
  formats?: LibraryFormat[]
  percent?: number | null
  note?: string
  licence?: string
}

export default function BookCard({ id, title, author, coverBg, coverFg, formats, percent, note, licence }: Props) {
  return (
    <Link href={`/learning/library/${id}`} className="lib-card" aria-label={`${title} by ${author}`}>
      <BookCover title={title} author={author} bg={coverBg} fg={coverFg} />
      <div className="lib-card-title">{title}</div>
      <div className="lib-card-author">{author}</div>
      {formats && formats.length > 0 && (
        <div>
          {formats.includes('read') && <span className="lib-fmt"><i className="ti ti-book-2" /> Read</span>}
          {formats.includes('listen') && <span className="lib-fmt"><i className="ti ti-headphones" /> Listen</span>}
        </div>
      )}
      {percent != null && (
        <>
          <div className="lib-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progress"><span style={{ width: `${percent}%` }} /></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{percent >= 100 ? 'Finished' : `${percent}% done`}</div>
        </>
      )}
      {note && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{note}</div>}
      {licence && <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, marginTop: 5 }}>{LICENCE_LABEL[licence] || licence}</div>}
    </Link>
  )
}

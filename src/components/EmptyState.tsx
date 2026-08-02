'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

type EmptyStateAction = { label: string; href?: string; onClick?: () => void }

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description?: string
  action?: EmptyStateAction
}) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ textAlign: 'center', padding: '40px 24px' }}
    >
      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.9 }}>{icon}</div>
      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: 16 }}>
          {action.href ? (
            <Link href={action.href}><button className="btn btn-primary">{action.label}</button></Link>
          ) : (
            <button className="btn btn-primary" onClick={action.onClick}>{action.label}</button>
          )}
        </div>
      )}
    </motion.div>
  )
}

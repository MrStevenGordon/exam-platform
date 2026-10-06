'use client'

import dynamic from 'next/dynamic'
import type { TrendPoint } from '@/components/ScoreTrendChart'

// Loads the chart only when it is shown. Until then (and while it downloads) a blank box of the same height holds the space, so
// nothing jumps.
const Chart = dynamic(() => import('@/components/ScoreTrendChart'), { ssr: false })

export default function ScoreTrendChartLazy({ data, height, left }: { data: TrendPoint[]; height: number; left: number }) {
  return <div style={{ height }}><Chart data={data} height={height} left={left} /></div>
}

'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

// The student's score trend line. It lives in its own file so the charting library (about 100 KB) is only downloaded when a chart is
// actually shown: pages load it with next/dynamic (see ScoreTrendChartLazy) instead of importing recharts directly.
export type TrendPoint = { name: string; pct: number; title: string }

export default function ScoreTrendChart({ data, height, left }: { data: TrendPoint[]; height: number; left: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 0, right: 0, left, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any, _: any, p: any) => [`${v}%`, p.payload.title]} />
        <ReferenceLine y={50} stroke="var(--danger)" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="pct" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

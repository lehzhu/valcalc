import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ValuationListItem } from '../types'

export default function ValueTrendLine({ valuations }: { valuations: ValuationListItem[] }) {
  if (valuations.length < 2) return null
  const sorted = [...valuations].sort((a, b) => a.version - b.version)
  const data = sorted.map(v => ({ name: `v${v.version}`, value: parseFloat(v.fair_value), date: new Date(v.created_at).toLocaleDateString() }))
  const formatTick = (v: number) => { if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`; if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`; return `$${(v / 1e3).toFixed(0)}K` }

  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip formatter={(v) => formatTick(Number(v))} labelFormatter={(_label, payload) => (payload as any[])[0]?.payload?.date || String(_label)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', r: 4 }} activeDot={{ fill: '#4f46e5', r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

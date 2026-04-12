import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { MethodResult } from '../types'

const METHOD_LABELS: Record<string, string> = { last_round_adjusted: 'Last Round', comps: 'Comps', dcf: 'DCF', manual: 'Manual' }
const COLORS = ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe']

export default function MethodComparisonChart({ results }: { results: MethodResult[] }) {
  if (results.length < 2) return null
  const data = results.map(r => ({ name: METHOD_LABELS[r.method] || r.method, value: parseFloat(r.value) }))
  const formatTick = (v: number) => { if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`; if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`; return `$${(v / 1e3).toFixed(0)}K` }

  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} width={80} />
          <Tooltip formatter={(v: number) => formatTick(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

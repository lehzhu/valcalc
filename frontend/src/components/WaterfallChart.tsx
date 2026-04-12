import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import type { ComputationStep } from '../types'

export default function WaterfallChart({ steps }: { steps: ComputationStep[] }) {
  if (steps.length < 2) return null
  const data: { name: string; value: number; fill: string }[] = []
  let running = 0
  for (const step of steps) {
    const raw = step.output.replace(/[^0-9.-]/g, '')
    const val = parseFloat(raw)
    if (isNaN(val)) continue
    const scaled = val >= 1e6 ? val / 1e6 : val
    const delta = scaled - running
    data.push({ name: step.description.length > 25 ? step.description.slice(0, 25) + '...' : step.description, value: delta, fill: delta >= 0 ? '#4f46e5' : '#ef4444' })
    running = scaled
  }
  if (data.length < 2) return null
  return (
    <div className="w-full h-48">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 10, right: 20 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} />
          <YAxis tickFormatter={(v: number) => `$${v.toFixed(0)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip formatter={(v) => `$${Number(v).toFixed(1)}M`} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>{data.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

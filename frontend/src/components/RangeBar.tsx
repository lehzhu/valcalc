interface RangeBarProps { low: number; mid: number; high: number }

export default function RangeBar({ low, mid, high }: RangeBarProps) {
  const range = high - low
  const midPos = range > 0 ? ((mid - low) / range) * 100 : 50
  const formatVal = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
    return `$${v.toFixed(0)}`
  }
  return (
    <div className="w-full">
      <div className="relative h-2.5 bg-[var(--color-surface-tertiary)] rounded-full">
        <div className="absolute h-full bg-gradient-to-r from-indigo-300 to-indigo-400 rounded-full" style={{ left: '5%', right: '5%' }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[var(--color-primary)] rounded-full border-2 border-white shadow-md" style={{ left: `${5 + midPos * 0.9}%`, transform: 'translate(-50%, -50%)' }} />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-[var(--color-text-tertiary)]"><span>{formatVal(low)}</span><span>{formatVal(high)}</span></div>
    </div>
  )
}

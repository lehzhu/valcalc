export default function CompletenessRing({ value, size = 48 }: { value: number; size?: number }) {
  const pct = Math.round(value * 100)
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value)
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{pct}%</span>
    </div>
  )
}

const CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'High' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Medium' },
  low: { bg: 'bg-red-50', text: 'text-red-700', label: 'Low' },
}

export default function ConfidenceIndicator({ level }: { level: string }) {
  const c = CONFIG[level] || CONFIG.low
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>
}

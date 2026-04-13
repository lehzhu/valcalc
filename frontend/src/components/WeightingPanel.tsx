import { useState, useEffect } from 'react'
import type { MethodResultOut } from '../types'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '--'
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

interface Props {
  methodResults: Partial<Record<string, MethodResultOut>>
  onWeightsChange: (weights: Record<string, number>) => void
}

export default function WeightingPanel({ methodResults, onWeightsChange }: Props) {
  const methods = Object.entries(methodResults).filter(([, r]) => r != null) as [string, MethodResultOut][]

  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    const equal = Math.round(100 / methods.length)
    methods.forEach(([key], i) => {
      initial[key] = i === methods.length - 1 ? 100 - equal * (methods.length - 1) : equal
    })
    return initial
  })

  // Recompute when methods change
  useEffect(() => {
    const keys = methods.map(([k]) => k)
    const currentKeys = Object.keys(weights)
    if (keys.length !== currentKeys.length || !keys.every(k => currentKeys.includes(k))) {
      const equal = Math.round(100 / keys.length)
      const newWeights: Record<string, number> = {}
      keys.forEach((key, i) => {
        newWeights[key] = i === keys.length - 1 ? 100 - equal * (keys.length - 1) : equal
      })
      setWeights(newWeights)
    }
  }, [methods.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0)

  const weightedValue = methods.reduce((sum, [key, r]) => {
    return sum + parseFloat(r.value) * (weights[key] || 0) / 100
  }, 0)

  const weightedLow = methods.reduce((sum, [key, r]) => {
    return sum + parseFloat(r.value_low) * (weights[key] || 0) / 100
  }, 0)

  const weightedHigh = methods.reduce((sum, [key, r]) => {
    return sum + parseFloat(r.value_high) * (weights[key] || 0) / 100
  }, 0)

  const handleWeightChange = (key: string, value: number) => {
    const newWeights = { ...weights, [key]: value }
    setWeights(newWeights)
    // Normalize to fractions for API
    const total = Object.values(newWeights).reduce((s, w) => s + w, 0)
    if (total > 0) {
      const normalized: Record<string, number> = {}
      for (const [k, w] of Object.entries(newWeights)) {
        normalized[k] = w / total
      }
      onWeightsChange(normalized)
    }
  }

  if (methods.length < 2) return null

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Method Reconciliation</h3>

      <div className="space-y-3 mb-4">
        {methods.map(([key, r]) => (
          <div key={key} className="flex items-center gap-4">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] w-20">{METHOD_LABELS[key] || key}</span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)] w-20">{formatCurrency(r.value)}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key] || 0}
              onChange={e => handleWeightChange(key, parseInt(e.target.value))}
              className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={weights[key] || 0}
              onChange={e => handleWeightChange(key, Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              className="w-14 px-2 py-1 rounded border border-[var(--color-border)] text-xs text-center bg-[var(--color-surface)]"
            />
            <span className="text-xs text-[var(--color-text-tertiary)] w-4">%</span>
          </div>
        ))}
      </div>

      {totalWeight !== 100 && (
        <p className="text-xs text-amber-600 mb-3">Weights sum to {totalWeight}% (should be 100%)</p>
      )}

      <div className="border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Weighted Fair Value</span>
          <div className="text-right">
            <p className="text-lg font-bold text-[var(--color-primary)]">{formatCurrency(weightedValue)}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              Range: {formatCurrency(weightedLow)} -- {formatCurrency(weightedHigh)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

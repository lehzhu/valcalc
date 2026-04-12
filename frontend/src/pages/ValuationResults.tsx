import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getValuation } from '../api/client'
import type { Valuation } from '../types'
import RangeBar from '../components/RangeBar'
import MethodComparisonChart from '../components/MethodComparisonChart'
import ExportMenu from '../components/ExportMenu'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round Adjusted', comps: 'Comparable Multiples',
  dcf: 'Discounted Cash Flow', manual: 'Manual Override',
  weighted_blend: 'Weighted Blend',
}

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

export default function ValuationResults() {
  const { id } = useParams<{ id: string }>()
  const [valuation, setValuation] = useState<Valuation | null>(null)
  const [showTrail, setShowTrail] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) getValuation(id).then(setValuation).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!valuation) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Valuation not found</div>

  const trail = valuation.audit_trail

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/companies/${valuation.company_id}`} className="text-sm text-[var(--color-primary)] hover:underline">
            {trail.input_snapshot.name as string}
          </Link>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">Valuation Results</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            v{valuation.version} &middot; {new Date(valuation.created_at).toLocaleDateString()} &middot; by {valuation.created_by}
          </p>
        </div>
        <ExportMenu valuationId={valuation.id} />
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-md)' }}>
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Fair Value Estimate</p>
          <p className="text-3xl font-bold text-[var(--color-primary)]">{formatCurrency(valuation.fair_value)}</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Range: {formatCurrency(valuation.fair_value_low)} -- {formatCurrency(valuation.fair_value_high)}
          </p>
        </div>

        <div className="mb-6">
          <RangeBar low={parseFloat(valuation.fair_value_low)} mid={parseFloat(valuation.fair_value)} high={parseFloat(valuation.fair_value_high)} />
        </div>

        <div className="flex gap-3 mb-6">
          <div className="px-3 py-1.5 rounded-lg bg-indigo-50 text-sm font-medium text-[var(--color-primary)]">
            {METHOD_LABELS[valuation.primary_method] || valuation.primary_method}
          </div>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{valuation.explanation}</p>
      </div>

      {valuation.method_results.length > 1 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Method Comparison</h2>
          <MethodComparisonChart results={valuation.method_results} />
        </div>
      )}

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <button onClick={() => setShowTrail(t => !t)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--color-surface-secondary)] transition-colors">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Audit Trail</h2>
          <span className="text-[var(--color-text-tertiary)] text-sm">{showTrail ? 'Hide' : 'Show'}</span>
        </button>

        {showTrail && (
          <div className="px-6 pb-6 space-y-5">
            <div className="border-l-2 border-[var(--color-primary)] pl-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">1. Input Snapshot</h3>
              <div className="space-y-1">
                {Object.entries(trail.input_snapshot).map(([key, val]) => (
                  <div key={key} className="flex text-xs">
                    <span className="text-[var(--color-text-tertiary)] w-36">{key.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--color-text-secondary)]">{val != null ? String(val) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-l-2 border-[var(--color-primary)] pl-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">2. Method Selection</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">{trail.method_selection_rationale}</p>
              <div className="mt-2 space-y-1">
                {trail.recommendations.map((rec, i) => (
                  <div key={i} className="text-xs text-[var(--color-text-tertiary)]">
                    {rec.is_primary ? '(Primary)' : '(Secondary)'} {METHOD_LABELS[rec.method] || rec.method}: {rec.rationale}
                  </div>
                ))}
              </div>
            </div>

            {valuation.method_results.map((mr, mi) => (
              <div key={mi} className="border-l-2 border-[var(--color-primary)] pl-4">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  {3 + mi}. {METHOD_LABELS[mr.method] || mr.method} {mr.is_primary ? '(Primary)' : ''}
                </h3>
                {mr.steps.map((step, si) => (
                  <div key={si} className="mb-3">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">{step.description}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] font-mono mt-0.5">{step.formula}</p>
                    <div className="flex gap-4 mt-0.5">
                      {Object.entries(step.inputs).map(([k, v]) => (
                        <span key={k} className="text-xs text-[var(--color-text-tertiary)]">{k}: <span className="text-[var(--color-text-secondary)]">{v}</span></span>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-[var(--color-text-primary)] mt-0.5">= {step.output}</p>
                  </div>
                ))}
                {mr.assumptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Assumptions:</p>
                    {mr.assumptions.map((a, ai) => (
                      <div key={ai} className="text-xs text-[var(--color-text-tertiary)] mb-0.5">
                        {a.name}: <span className="text-[var(--color-text-secondary)]">{a.value}</span> — {a.rationale}
                        {a.source && <span className="italic"> (src: {a.source})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="border-l-2 border-emerald-400 pl-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Metadata</h3>
              <div className="space-y-0.5 text-xs text-[var(--color-text-tertiary)]">
                <p>Engine: {trail.engine_version}</p>
                <p>Benchmark: {trail.benchmark_version || 'N/A'}</p>
                <p>Timestamp: {trail.timestamp}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getValuation } from '../api/client'
import type { Valuation } from '../types'
import RangeBar from '../components/RangeBar'
import MethodComparisonChart from '../components/MethodComparisonChart'
import ExportMenu from '../components/ExportMenu'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round Adjusted', comps: 'Comparable Multiples',
  manual: 'Manual Override', weighted_blend: 'Weighted Blend',
}

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  return `$${Math.round(num).toLocaleString('en-US')}`
}

function formatSnapshotValue(val: unknown): string {
  if (val == null) return '\u2014'
  if (typeof val === 'object') return JSON.stringify(val, null, 1)
  return String(val)
}

export default function ValuationResults() {
  const { id } = useParams<{ id: string }>()
  const [valuation, setValuation] = useState<Valuation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) getValuation(id).then(setValuation).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!valuation) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Valuation not found</div>

  const trail = valuation.audit_trail

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to={`/companies/${valuation.company_id}/workspace`} className="text-xs text-[var(--color-primary)] hover:underline mb-1 inline-block">
            &larr; {trail.input_snapshot.name as string}
          </Link>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Valuation Report</h1>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            Version {valuation.version} &middot; {new Date(valuation.created_at).toLocaleDateString()} &middot; {valuation.created_by}
          </p>
        </div>
        <ExportMenu valuationId={valuation.id} />
      </div>

      {/* Fair Value Summary */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-md)' }}>
        <div className="mb-5">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Fair Value Estimate</p>
          <p className="text-3xl font-bold text-[var(--color-primary)]">{formatCurrency(valuation.fair_value)}</p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Range: {formatCurrency(valuation.fair_value_low)} &ndash; {formatCurrency(valuation.fair_value_high)}
          </p>
        </div>

        <div className="mb-5">
          <RangeBar low={parseFloat(valuation.fair_value_low)} mid={parseFloat(valuation.fair_value)} high={parseFloat(valuation.fair_value_high)} />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-sm font-medium text-[var(--color-primary)]">
            {METHOD_LABELS[valuation.primary_method] || valuation.primary_method}
          </span>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{valuation.explanation}</p>
      </div>

      {/* Method Comparison */}
      {valuation.method_results.length > 1 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Method Comparison</h2>
          <MethodComparisonChart results={valuation.method_results} />
        </div>
      )}

      {/* Method Details (always visible) */}
      {valuation.method_results.map((mr, mi) => (
        <div key={mi} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {METHOD_LABELS[mr.method] || mr.method}
            </h2>
            {mr.is_primary && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-[var(--color-primary)]">Primary</span>
            )}
            <span className="ml-auto text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(mr.value)}</span>
          </div>

          {/* Steps */}
          <div className="space-y-3 mb-4">
            {mr.steps.map((step, si) => (
              <div key={si} className="border-l-2 border-[var(--color-border)] pl-3">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">{step.description}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] font-mono mt-0.5">{step.formula}</p>
                <div className="flex flex-wrap gap-3 mt-0.5">
                  {Object.entries(step.inputs).map(([k, v]) => (
                    <span key={k} className="text-[10px] text-[var(--color-text-tertiary)]">{k}: <span className="text-[var(--color-text-secondary)]">{v}</span></span>
                  ))}
                </div>
                <p className="text-xs font-medium text-[var(--color-text-primary)] mt-0.5">= {step.output}</p>
              </div>
            ))}
          </div>

          {/* Assumptions */}
          {mr.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Assumptions &amp; Justifications</p>
              <div className="grid grid-cols-2 gap-2">
                {mr.assumptions.map((a, ai) => (
                  <div key={ai} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2">
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{a.name}</p>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)]">{a.value}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{a.rationale}</p>
                    {a.source && <p className="text-[9px] text-[var(--color-text-tertiary)] italic mt-0.5">Source: {a.source}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Audit Trail */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Audit Trail</h2>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Method Selection</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{trail.method_selection_rationale}</p>
            <div className="mt-2 space-y-1">
              {trail.recommendations.map((rec, i) => (
                <div key={i} className="text-xs text-[var(--color-text-tertiary)]">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5 ${rec.is_primary ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {rec.is_primary ? 'Primary' : 'Secondary'}
                  </span>
                  {METHOD_LABELS[rec.method] || rec.method}: {rec.rationale}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Input Snapshot</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {Object.entries(trail.input_snapshot).map(([key, val]) => (
                <div key={key} className="flex text-xs py-0.5">
                  <span className="text-[var(--color-text-tertiary)] w-36 flex-shrink-0">{key.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--color-text-secondary)] break-all">{formatSnapshotValue(val)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-6 text-xs text-[var(--color-text-tertiary)] pt-2 border-t border-[var(--color-border)]">
            <span>Engine: {trail.engine_version}</span>
            <span>Benchmark: {trail.benchmark_version || 'N/A'}</span>
            <span>Timestamp: {trail.timestamp}</span>
          </div>
        </div>
      </div>

      {/* Bottom export CTA */}
      <div className="flex items-center justify-between py-4">
        <Link to={`/companies/${valuation.company_id}/workspace`}
          className="text-xs text-[var(--color-primary)] hover:underline">&larr; Back to Workspace</Link>
        <ExportMenu valuationId={valuation.id} />
      </div>
    </div>
  )
}

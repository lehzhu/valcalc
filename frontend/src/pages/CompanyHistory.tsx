import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCompany, listValuations, getValuation, exportXlsxUrl, exportJsonUrl } from '../api/client'
import type { Company, ValuationListItem, Valuation } from '../types'
import ValueTrendLine from '../components/ValueTrendLine'
import { formatLabel } from '../utils/labels'

const METHOD_LABELS: Record<string, string> = { last_round_adjusted: 'Last Round', comps: 'Comps', manual: 'Manual', weighted_blend: 'Weighted Blend' }

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  return `$${Math.round(num).toLocaleString('en-US')}`
}

export default function CompanyHistory() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [valuations, setValuations] = useState<ValuationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, Valuation>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getCompany(id), listValuations(id)])
      .then(([c, v]) => { setCompany(c); setValuations(v) })
      .finally(() => setLoading(false))
  }, [id])

  const toggleExpand = async (vid: string) => {
    if (expanded === vid) { setExpanded(null); return }
    setExpanded(vid)
    if (!details[vid]) {
      setLoadingDetail(vid)
      try {
        const v = await getValuation(vid)
        setDetails(prev => ({ ...prev, [vid]: v }))
      } catch { /* ignore */ }
      setLoadingDetail(null)
    }
  }

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!company) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Company not found</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{company.name}</h1>
        <div className="flex gap-4 mt-2 text-sm text-[var(--color-text-secondary)]">
          <span>{formatLabel(company.stage)}</span>
          <span className="text-[var(--color-text-tertiary)]">&middot;</span>
          <span>{formatLabel(company.sector)}</span>
          {company.current_revenue && (
            <><span className="text-[var(--color-text-tertiary)]">&middot;</span><span>{formatCurrency(company.current_revenue)} revenue</span></>
          )}
        </div>
      </div>

      {valuations.length >= 2 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 mb-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Value Trend</h2>
          <ValueTrendLine valuations={valuations} />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Valuation History</h2>
        <div className="flex gap-2">
          <Link to={`/companies/${id}/workspace`} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-indigo-50 transition-colors">Open Workspace</Link>
        </div>
      </div>

      {valuations.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm text-[var(--color-text-tertiary)]">No valuations yet for this company.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {valuations.map(v => {
            const isExpanded = expanded === v.id
            const detail = details[v.id]
            const isLoading = loadingDetail === v.id
            return (
              <div key={v.id} className={`bg-[var(--color-surface)] rounded-xl border ${isExpanded ? 'border-[var(--color-primary-light)]' : 'border-[var(--color-border)]'} transition-colors`} style={{ boxShadow: 'var(--shadow-sm)' }}>
                <button onClick={() => toggleExpand(v.id)} className="w-full p-4 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--color-text-tertiary)]">v{v.version}</span>
                      <span className="text-lg font-semibold text-[var(--color-text-primary)]">{formatCurrency(v.fair_value)}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">{METHOD_LABELS[v.primary_method] || v.primary_method}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-tertiary)]">{new Date(v.created_at).toLocaleDateString()} &middot; {v.created_by}</span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--color-border)] px-4 pb-4">
                    {isLoading ? (
                      <p className="text-sm text-[var(--color-text-tertiary)] py-4">Loading details...</p>
                    ) : detail ? (
                      <ValuationDetail valuation={detail} />
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ValuationDetail({ valuation }: { valuation: Valuation }) {
  return (
    <div className="pt-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Fair Value</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">{formatCurrency(valuation.fair_value)}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">{formatCurrency(valuation.fair_value_low)} &ndash; {formatCurrency(valuation.fair_value_high)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Method</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{METHOD_LABELS[valuation.primary_method] || valuation.primary_method}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">v{valuation.version} &middot; {valuation.created_by}</p>
        </div>
        <div className="flex items-start justify-end gap-2">
          <Link to={`/valuations/${valuation.id}`} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-indigo-50 transition-colors">View Report</Link>
          <a href={exportXlsxUrl(valuation.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors">Excel</a>
          <a href={exportJsonUrl(valuation.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors">JSON</a>
        </div>
      </div>

      {/* Explanation */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Explanation</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{valuation.explanation}</p>
      </div>

      {/* Method results */}
      {valuation.method_results.map((mr, idx) => (
        <div key={idx} className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">{METHOD_LABELS[mr.method] || mr.method}</span>
            {mr.is_primary && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">Primary</span>}
            <span className="text-xs text-[var(--color-text-tertiary)] ml-auto">{formatCurrency(mr.value)}</span>
          </div>

          {/* Steps */}
          {mr.steps.length > 0 && (
            <div className="space-y-1 mb-2">
              {mr.steps.map((step, si) => (
                <div key={si} className="flex items-start gap-2 text-xs">
                  <span className="text-[var(--color-text-tertiary)] w-4 text-right flex-shrink-0">{si + 1}.</span>
                  <span className="text-[var(--color-text-secondary)]">
                    <span className="font-medium">{step.description}</span> &rarr; {step.output}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Assumptions */}
          {mr.assumptions.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[var(--color-border)]">
              {mr.assumptions.map((a, ai) => (
                <div key={ai} className="text-xs">
                  <span className="text-[var(--color-text-tertiary)]">{a.name}: </span>
                  <span className="font-medium text-[var(--color-text-primary)]">{a.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

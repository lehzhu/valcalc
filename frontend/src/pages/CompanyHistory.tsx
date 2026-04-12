import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCompany, listValuations } from '../api/client'
import type { Company, ValuationListItem } from '../types'
import ValueTrendLine from '../components/ValueTrendLine'
import { formatLabel } from '../utils/labels'

const METHOD_LABELS: Record<string, string> = { last_round_adjusted: 'Last Round', comps: 'Comps', dcf: 'DCF', manual: 'Manual', weighted_blend: 'Weighted Blend' }

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  return `$${num.toLocaleString()}`
}

export default function CompanyHistory() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [valuations, setValuations] = useState<ValuationListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getCompany(id), listValuations(id)])
      .then(([c, v]) => { setCompany(c); setValuations(v) })
      .finally(() => setLoading(false))
  }, [id])

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
          <Link to="/valuations/new" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors">New Valuation</Link>
        </div>
      </div>

      {valuations.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-sm text-[var(--color-text-tertiary)]">No valuations yet for this company.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {valuations.map(v => (
            <Link key={v.id} to={`/valuations/${v.id}`} className="block bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary-light)] transition-colors" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[var(--color-text-tertiary)]">v{v.version}</span>
                  <span className="text-lg font-semibold text-[var(--color-text-primary)]">{formatCurrency(v.fair_value)}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">{METHOD_LABELS[v.primary_method] || v.primary_method}</span>
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)]">{new Date(v.created_at).toLocaleDateString()} &middot; {v.created_by}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

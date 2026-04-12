import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCompanies } from '../api/client'
import type { CompanyListItem } from '../types'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
  dcf: 'DCF',
  manual: 'Manual',
}

function formatCurrency(value: string | undefined): string {
  if (!value) return '—'
  const num = parseFloat(value)
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

export default function Dashboard() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    listCompanies().then(setCompanies).finally(() => setLoading(false))
  }, [])

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Valuations</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
            {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent w-56"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-12 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-[var(--color-text-secondary)] mb-4">
            {search ? 'No companies match your search.' : 'No valuations yet.'}
          </p>
          {!search && (
            <Link
              to="/valuations/new"
              className="inline-flex px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Create your first valuation
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Company</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Stage</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Sector</th>
                <th className="text-right text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Fair Value</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3">Method</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(company => (
                <tr key={company.id} className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-surface-secondary)] transition-colors">
                  <td className="px-5 py-3.5">
                    <Link to={`/companies/${company.id}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {company.stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {company.sector.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-right text-[var(--color-text-primary)]">
                    {formatCurrency(company.latest_valuation)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {company.latest_method ? METHOD_LABELS[company.latest_method] || company.latest_method : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

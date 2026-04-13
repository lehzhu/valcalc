import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { listCompanies } from '../api/client'
import type { CompanyListItem } from '../types'
import { formatLabel } from '../utils/labels'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
  dcf: 'DCF',
  manual: 'Manual',
  weighted_blend: 'Weighted Blend',
}

const STAGE_ORDER: Record<string, number> = {
  pre_seed: 0, seed: 1, series_a: 2, series_b: 3, series_c_plus: 4, late_pre_ipo: 5,
}

type SortKey = 'name' | 'stage' | 'sector' | 'fair_value' | 'method'
type SortDir = 'asc' | 'desc'

function formatCurrency(value: string | undefined): string {
  if (!value) return '—'
  const num = parseFloat(value)
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex flex-col ml-1 -space-y-1 leading-none ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-60'}`}>
      <span className={`text-[8px] ${active && dir === 'asc' ? '' : 'opacity-30'}`}>&#9650;</span>
      <span className={`text-[8px] ${active && dir === 'desc' ? '' : 'opacity-30'}`}>&#9660;</span>
    </span>
  )
}

export default function Dashboard() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fair_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    listCompanies().then(setCompanies).finally(() => setLoading(false))
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'fair_value' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const filtered = companies.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'stage':
          cmp = (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99)
          break
        case 'sector':
          cmp = formatLabel(a.sector).localeCompare(formatLabel(b.sector))
          break
        case 'fair_value':
          cmp = parseFloat(a.latest_valuation || '0') - parseFloat(b.latest_valuation || '0')
          break
        case 'method': {
          const ma = a.latest_method ? (METHOD_LABELS[a.latest_method] || a.latest_method) : ''
          const mb = b.latest_method ? (METHOD_LABELS[b.latest_method] || b.latest_method) : ''
          cmp = ma.localeCompare(mb)
          break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [companies, search, sortKey, sortDir])

  const thClass = 'text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-5 py-3 cursor-pointer select-none group transition-colors hover:text-[var(--color-text-secondary)]'

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
      ) : sorted.length === 0 ? (
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
                <th className={`text-left ${thClass}`} onClick={() => handleSort('name')}>
                  Company<SortIcon active={sortKey === 'name'} dir={sortDir} />
                </th>
                <th className={`text-left ${thClass}`} onClick={() => handleSort('stage')}>
                  Stage<SortIcon active={sortKey === 'stage'} dir={sortDir} />
                </th>
                <th className={`text-left ${thClass}`} onClick={() => handleSort('sector')}>
                  Sector<SortIcon active={sortKey === 'sector'} dir={sortDir} />
                </th>
                <th className={`text-right ${thClass}`} onClick={() => handleSort('fair_value')}>
                  Fair Value<SortIcon active={sortKey === 'fair_value'} dir={sortDir} />
                </th>
                <th className={`text-left ${thClass}`} onClick={() => handleSort('method')}>
                  Method<SortIcon active={sortKey === 'method'} dir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(company => (
                <tr key={company.id} className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-surface-secondary)] transition-colors">
                  <td className="px-5 py-3.5">
                    <Link to={`/companies/${company.id}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {formatLabel(company.stage)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--color-text-secondary)]">
                    {formatLabel(company.sector)}
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

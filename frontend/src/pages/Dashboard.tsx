import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCompanies, uploadBatch, batchTemplateUrl, batchExportUrl, batchRevalue } from '../api/client'
import type { CompanyListItem } from '../types'
import type { BatchResult } from '../api/client'
import { formatLabel } from '../utils/labels'

const METHOD_LABELS: Record<string, string> = {
  last_round_adjusted: 'Last Round',
  comps: 'Comps',
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
  if (isNaN(num)) return '—'
  return `$${Math.round(num).toLocaleString('en-US')}`
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
  const [uploading, setUploading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [revaluing, setRevaluing] = useState(false)
  const navigate = useNavigate()

  const loadCompanies = useCallback(() => {
    listCompanies().then(setCompanies).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadCompanies() }, [loadCompanies])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'fair_value' ? 'desc' : 'asc')
    }
  }

  const handleBatchUpload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    setBatchResult(null)
    try {
      const result = await uploadBatch(file)
      setBatchResult(result)
      loadCompanies() // Refresh the list
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleBatchUpload(file)
    e.target.value = '' // Reset so same file can be re-uploaded
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleBatchUpload(file)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map(c => c.id)))
  }

  const handleBatchRevalue = async () => {
    if (selected.size === 0) return
    setRevaluing(true)
    setBatchResult(null)
    setUploadError('')
    try {
      const user = localStorage.getItem('vc-audit-user') || 'Auditor'
      const result = await batchRevalue({
        company_ids: Array.from(selected),
        created_by: user,
      })
      setBatchResult(result)
      loadCompanies()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Re-valuation failed')
    } finally {
      setRevaluing(false)
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
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Portfolio Valuations</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
            {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent w-56"
          />
          <a
            href={batchExportUrl(selected.size > 0 ? Array.from(selected) : undefined)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            Export {selected.size > 0 ? `(${selected.size})` : 'All'}
          </a>
          <Link
            to="/valuations/new"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            + Manual Entry
          </Link>
        </div>
      </div>

      {/* ── Batch Action Bar ──────────────────────────── */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
          <span className="text-xs font-medium text-indigo-700">{selected.size} selected</span>
          <button onClick={handleBatchRevalue} disabled={revaluing}
            className="px-3 py-1 rounded text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
            {revaluing ? 'Re-valuing...' : 'Re-value Selected'}
          </button>
          <button onClick={() => setSelected(new Set())}
            className="px-3 py-1 rounded text-xs text-indigo-600 hover:text-indigo-800 transition-colors">
            Clear
          </button>
        </div>
      )}

      {/* ── Batch Upload Zone ──────────────────────────── */}
      <div
        className={`mb-6 rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        } p-6`}
        style={{ boxShadow: 'var(--shadow-sm)' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">
            <svg className="w-8 h-8 mx-auto text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Upload portfolio spreadsheet
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
            Drop an Excel or CSV file with company data. Each row becomes a company with automated Last Round + Comps analysis.
          </p>
          <div className="flex items-center justify-center gap-3">
            <label className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer">
              {uploading ? 'Processing...' : 'Choose File'}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" disabled={uploading} />
            </label>
            <a
              href={batchTemplateUrl}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              Download Template
            </a>
          </div>
        </div>
      </div>

      {/* ── Upload Error ───────────────────────────────── */}
      {uploadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      {/* ── Batch Results ──────────────────────────────── */}
      {batchResult && (
        <div className="mb-6 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Batch Import Complete
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-600">{batchResult.succeeded} succeeded</span>
              {batchResult.failed > 0 && <span className="text-red-500">{batchResult.failed} failed</span>}
              <button onClick={() => setBatchResult(null)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">Dismiss</button>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {batchResult.results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  r.status === 'ok'
                    ? 'bg-emerald-50 border border-emerald-100'
                    : 'bg-red-50 border border-red-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'ok' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <span className="font-medium text-[var(--color-text-primary)]">{r.company_name}</span>
                  {r.primary_method && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {METHOD_LABELS[r.primary_method] || r.primary_method}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {r.fair_value && (
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {formatCurrency(r.fair_value)}
                    </span>
                  )}
                  {r.methods_run && r.methods_run.length > 1 && (
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      +{r.methods_run.length - 1} cross-check{r.methods_run.length > 2 ? 's' : ''}
                    </span>
                  )}
                  {r.status === 'ok' && r.company_id && (
                    <button
                      onClick={() => navigate(`/companies/${r.company_id}/workspace`)}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Open
                    </button>
                  )}
                  {r.error && <span className="text-xs text-red-600">{r.error}</span>}
                </div>
              </div>
            ))}
          </div>
          {batchResult.warnings && batchResult.warnings.length > 0 && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <p className="text-xs font-medium text-amber-700 mb-2">
                {batchResult.warnings.length} validation warning{batchResult.warnings.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {batchResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded bg-amber-50 border border-amber-100 text-xs">
                    <span className="font-medium text-amber-800 whitespace-nowrap">Row {w.row}</span>
                    <span className="text-amber-700">{w.field}: {w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Company Table ──────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-12 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <p className="text-[var(--color-text-secondary)] mb-2">
            {search ? 'No companies match your search.' : 'No companies yet.'}
          </p>
          {!search && (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Upload a portfolio spreadsheet above to get started, or add a company manually.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={toggleAll}
                    className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                </th>
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
                  <td className="px-3 py-3.5 w-8">
                    <input type="checkbox" checked={selected.has(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Link to={`/companies/${company.id}/workspace`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
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

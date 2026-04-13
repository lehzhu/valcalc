import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCompany, updateCompany, runMethod, runValuation, listSectors } from '../api/client'
import type { ParsedImport } from '../api/client'
import type { Company, MethodResultOut, BenchmarkSector, FundingRound, CompanyCreate } from '../types'
import DocumentUpload from '../components/DocumentUpload'

const METHOD_TABS = [
  { key: 'last_round_adjusted', label: 'Last Round' },
  { key: 'comps', label: 'Comps' },
] as const

type TabKey = typeof METHOD_TABS[number]['key']

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '--'
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

function parseAssumptionValue(value: string): number | null {
  const pctMatch = value.match(/^-?(\d+(?:\.\d+)?)%/)
  if (pctMatch) return parseFloat(pctMatch[1]) / 100
  const xMatch = value.match(/^(\d+(?:\.\d+)?)x$/)
  if (xMatch) return parseFloat(xMatch[1])
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

function getOverrideKey(name: string): string | null {
  const map: Record<string, string> = {
    'Revenue multiple': 'revenue_multiple',
    'DLOM (illiquidity discount)': 'dlom',
    'Time decay rate': 'time_decay_rate',
    'Sector trend adjustment': 'sector_trend',
    'Market/sector adjustment': 'sector_trend',
  }
  return map[name] || null
}

/* ------------------------------------------------------------------ */
/*  Waterfall chart for calibration steps                             */
/* ------------------------------------------------------------------ */
function CalibrationWaterfall({ steps }: { steps: MethodResultOut['steps'] }) {
  if (steps.length < 2) return null

  // Extract values from steps (forward order: anchor → conclusion)
  const bars: { label: string; value: number; delta: number }[] = []
  let prevValue = 0

  for (const step of steps) {
    const raw = step.output.replace(/[^0-9.BMK$-]/g, '')
    let value = 0
    if (step.output.includes('B')) value = parseFloat(raw) * 1e9
    else if (step.output.includes('M')) value = parseFloat(raw) * 1e6
    else if (step.output.includes('K')) value = parseFloat(raw) * 1e3
    else value = parseFloat(raw) || 0

    if (step.description.includes('(noted') || step.description.includes('Calibrated fair value')) continue

    const delta = bars.length === 0 ? value : value - prevValue
    bars.push({ label: step.description.replace(/:.*/,'').trim(), value, delta })
    prevValue = value
  }

  if (bars.length === 0) return null
  const maxVal = Math.max(...bars.map(b => b.value))

  return (
    <div className="space-y-1.5">
      {bars.map((bar, i) => {
        const isAnchor = i === 0
        const pct = maxVal > 0 ? (bar.value / maxVal) * 100 : 0
        const isPositiveDelta = bar.delta >= 0
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--color-text-tertiary)] w-32 text-right truncate">{bar.label}</span>
            <div className="flex-1 h-6 relative">
              <div
                className={`h-full rounded-r transition-all ${isAnchor ? 'bg-indigo-400' : isPositiveDelta ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)] w-16 text-right">
              {isAnchor ? '' : (bar.delta >= 0 ? '+' : '')}{isAnchor ? '' : formatCurrency(bar.delta)}
            </span>
            <span className="text-[11px] font-semibold text-[var(--color-text-primary)] w-16 text-right">{formatCurrency(bar.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Method comparison bar chart                                       */
/* ------------------------------------------------------------------ */
function MethodComparisonBars({ results }: { results: Record<string, MethodResultOut> }) {
  const entries = Object.entries(results)
  if (entries.length < 2) return null

  const maxVal = Math.max(...entries.map(([, r]) => parseFloat(r.value_high)))
  const colors: Record<string, string> = {
    last_round_adjusted: 'bg-indigo-500',
    comps: 'bg-emerald-500',
  }
  const labels: Record<string, string> = {
    last_round_adjusted: 'Last Round',
    comps: 'Comps',
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Cross-check Comparison</h4>
      {entries.map(([method, r]) => {
        const val = parseFloat(r.value)
        const low = parseFloat(r.value_low)
        const high = parseFloat(r.value_high)
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
        const lowPct = maxVal > 0 ? (low / maxVal) * 100 : 0
        const highPct = maxVal > 0 ? (high / maxVal) * 100 : 0
        return (
          <div key={method} className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-secondary)] w-20">{labels[method] || method}</span>
            <div className="flex-1 h-5 relative bg-[var(--color-surface-tertiary)] rounded">
              {/* Range band */}
              <div className="absolute h-full rounded opacity-20" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%`, background: 'currentColor' }} />
              {/* Value bar */}
              <div className={`h-full rounded ${colors[method] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-[var(--color-text-primary)] w-16 text-right">{formatCurrency(val)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Workspace                                                    */
/* ------------------------------------------------------------------ */
export default function ValuationWorkspace() {
  const { companyId } = useParams<{ companyId: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [sectors, setSectors] = useState<BenchmarkSector[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('last_round_adjusted')
  const [debug, setDebug] = useState(false)
  const [loading, setLoading] = useState(true)
  const [methodResults, setMethodResults] = useState<Record<string, MethodResultOut>>({})
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')

  // Company detail editing state
  const [editStage, setEditStage] = useState('')
  const [editSector, setEditSector] = useState('')
  const [editRevenueStatus, setEditRevenueStatus] = useState('')
  const [editRevenue, setEditRevenue] = useState('')
  const [editRoundDate, setEditRoundDate] = useState('')
  const [editPreMoney, setEditPreMoney] = useState('')
  const [editAmountRaised, setEditAmountRaised] = useState('')
  const [editLeadInvestor, setEditLeadInvestor] = useState('')

  // Assumption editing
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Toggle debug with Ctrl+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === 'd') { e.preventDefault(); setDebug(d => !d) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-save debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingChanges = useRef(false)

  useEffect(() => {
    if (!companyId) return
    Promise.all([getCompany(companyId), listSectors()])
      .then(([c, s]) => {
        setCompany(c)
        setSectors(s)
        // Init edit state
        setEditStage(c.stage)
        setEditSector(c.sector)
        setEditRevenueStatus(c.revenue_status)
        setEditRevenue(c.current_revenue ?? '')
        setEditRoundDate(c.last_round_date ?? '')
        setEditPreMoney(c.last_round_valuation ?? '')
        setEditAmountRaised(c.last_round_amount ?? '')
        setEditLeadInvestor(c.last_round_investor ?? '')
      })
      .finally(() => setLoading(false))
  }, [companyId])

  // Schedule auto-save + recompute 5s after a field change
  const scheduleAutoSave = useCallback(() => {
    pendingChanges.current = true
    setAutoSaveStatus('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      pendingChanges.current = false
      doSave()
    }, 5000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save company data + run method preview (no committed valuation)
  const doSave = useCallback(async () => {
    if (!companyId || !company) return
    setAutoSaveStatus('saving')
    setError('')
    try {
      const update: Partial<CompanyCreate> = {
        stage: editStage,
        sector: editSector,
        revenue_status: editRevenueStatus,
        current_revenue: editRevenue || undefined,
      }
      if (editRoundDate && editPreMoney) {
        update.last_round = {
          date: editRoundDate,
          pre_money_valuation: editPreMoney,
          amount_raised: editAmountRaised || '0',
          lead_investor: editLeadInvestor || undefined,
        }
      }
      const updated = await updateCompany(companyId, update)
      setCompany(updated)

      // Run active method for preview only — no valuation record created
      const res = await runMethod(companyId, activeTab, {
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      }).catch(() => null)

      if (res) {
        setMethodResults(prev => ({ ...prev, [activeTab]: res }))
      }

      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setAutoSaveStatus('idle')
    }
  }, [companyId, company, editStage, editSector, editRevenueStatus, editRevenue, editRoundDate, editPreMoney, editAmountRaised, editLeadInvestor, activeTab, overrides])

  // Manual run — saves company data, runs preview, AND commits a valuation record
  const handleRun = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setRunning(true)
    await doSave()
    // Commit a versioned valuation record
    const user = localStorage.getItem('vc-audit-user') || 'Auditor'
    await runValuation(companyId!, {
      created_by: user,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    }).catch(() => {})
    setRunning(false)
  }

  // Handle field changes — schedule auto-save
  const onFieldChange = useCallback((setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value)
    scheduleAutoSave()
  }, [scheduleAutoSave])

  const handleOverrideChange = useCallback((key: string, value: number) => {
    setOverrides(prev => {
      const next = { ...prev, [key]: value }
      return next
    })
    scheduleAutoSave()
  }, [scheduleAutoSave])

  const handleImport = useCallback(async (data: ParsedImport) => {
    if (!companyId) return
    const update: Partial<CompanyCreate> = {}
    if (data.current_revenue) { update.current_revenue = data.current_revenue; setEditRevenue(data.current_revenue) }
    if (data.stage) { update.stage = data.stage; setEditStage(data.stage) }
    if (data.sector) { update.sector = data.sector; setEditSector(data.sector) }
    if (data.revenue_status) { update.revenue_status = data.revenue_status; setEditRevenueStatus(data.revenue_status) }
    if (data.last_round) {
      update.last_round = data.last_round as FundingRound
      setEditRoundDate(data.last_round.date)
      setEditPreMoney(data.last_round.pre_money_valuation)
      setEditAmountRaised(data.last_round.amount_raised)
      if (data.last_round.lead_investor) setEditLeadInvestor(data.last_round.lead_investor)
    }
    if (data.projections) update.projections = data.projections
    if (data.financials) update.financials = data.financials
    if (data.qualitative) update.qualitative = data.qualitative
    if (data.cap_table) update.cap_table = data.cap_table
    if (data.external_mapping) update.external_mapping = data.external_mapping
    if (Object.keys(update).length > 0) {
      const updated = await updateCompany(companyId, update)
      setCompany(updated)
    }
    scheduleAutoSave()
  }, [companyId, scheduleAutoSave])

  const startEdit = (name: string, value: string) => {
    const key = getOverrideKey(name)
    if (!key) return
    const num = parseAssumptionValue(value)
    if (num === null) return
    setEditingKey(key)
    setEditValue(value.includes('%') ? String(Math.round(num * 100)) : String(num))
  }

  const commitEdit = (_name: string, originalValue: string) => {
    if (editingKey === null) return
    let numValue = parseFloat(editValue)
    if (isNaN(numValue)) { setEditingKey(null); return }
    if (originalValue.includes('%')) numValue = numValue / 100
    handleOverrideChange(editingKey, numValue)
    setEditingKey(null)
  }

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!company) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Company not found</div>

  const result = methodResults[activeTab]
  const hasResult = !!result
  const hasSufficientData = activeTab === 'last_round_adjusted' ? !!(editRoundDate && editPreMoney) :
    activeTab === 'comps' ? !!editRevenue : false

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1"

  const STAGES = [
    { value: 'pre_seed', label: 'Pre-Seed' },
    { value: 'seed', label: 'Seed' },
    { value: 'series_a', label: 'Series A' },
    { value: 'series_b', label: 'Series B' },
    { value: 'series_c_plus', label: 'Series C+' },
    { value: 'late_pre_ipo', label: 'Late / Pre-IPO' },
  ]
  const REVENUE_STATUSES = [
    { value: 'pre_revenue', label: 'Pre-Revenue' },
    { value: 'early_revenue', label: 'Early (<$1M)' },
    { value: 'growing_revenue', label: 'Growing ($1-10M)' },
    { value: 'scaled_revenue', label: 'Scaled (>$10M)' },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link to="/" className="text-xs text-[var(--color-primary)] hover:underline mb-1 inline-block">&larr; Dashboard</Link>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            {autoSaveStatus === 'pending' && <span className="text-[10px] text-amber-500">Unsaved changes</span>}
            {autoSaveStatus === 'saving' && <span className="text-[10px] text-[var(--color-text-tertiary)]">Saving...</span>}
            {autoSaveStatus === 'saved' && <span className="text-[10px] text-emerald-600">Saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DocumentUpload onParsed={handleImport} compact />
          {debug && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Debug</span>
              <div className={`relative w-8 h-[18px] rounded-full bg-[var(--color-primary)]`}>
                <span className="absolute top-[2px] left-[16px] w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
              </div>
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* ── Left: Company Details (always visible) ──── */}
        <div className="space-y-5">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Company Details</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Stage</label>
                <select value={editStage} onChange={onFieldChange(setEditStage)} className={inputClass}>
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Sector</label>
                <select value={editSector} onChange={onFieldChange(setEditSector)} className={inputClass}>
                  {sectors.map(s => <option key={s.key} value={s.key}>{s.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Revenue Status</label>
                <select value={editRevenueStatus} onChange={onFieldChange(setEditRevenueStatus)} className={inputClass}>
                  {REVENUE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Current Annual Revenue ($)</label>
                <input type="number" value={editRevenue} onChange={onFieldChange(setEditRevenue)} className={inputClass} placeholder="e.g., 5000000" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Last Funding Round</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Round Date</label>
                <input type="date" value={editRoundDate} onChange={onFieldChange(setEditRoundDate)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Pre-Money Valuation ($)</label>
                <input type="number" value={editPreMoney} onChange={onFieldChange(setEditPreMoney)} className={inputClass} placeholder="30000000" />
              </div>
              <div>
                <label className={labelClass}>Amount Raised ($)</label>
                <input type="number" value={editAmountRaised} onChange={onFieldChange(setEditAmountRaised)} className={inputClass} placeholder="10000000" />
              </div>
              <div>
                <label className={labelClass}>Lead Investor</label>
                <input type="text" value={editLeadInvestor} onChange={onFieldChange(setEditLeadInvestor)} className={inputClass} placeholder="e.g., Sequoia" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Valuation ──────────────────────────── */}
        <div className="space-y-5">
          {/* Fair value hero */}
          {hasResult ? (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Fair Value Estimate</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{formatCurrency(result.value)}</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {formatCurrency(result.value_low)} &ndash; {formatCurrency(result.value_high)} range
              </p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] border-dashed p-6 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
              {hasSufficientData ? (
                <>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">Ready to compute</p>
                  <button onClick={handleRun} disabled={running}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
                    {running ? 'Computing...' : 'Run Valuation'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">Pending additional information</p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          {/* Method tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {METHOD_TABS.map(t => {
              const r = methodResults[t.key]
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === t.key
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {t.label}
                  {r && <span className="ml-1.5 text-xs text-[var(--color-text-tertiary)]">{formatCurrency(r.value)}</span>}
                </button>
              )
            })}
          </div>

          {/* Calibration waterfall chart */}
          {hasResult && result.steps.length > 2 && (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Calibration Waterfall</h4>
              <CalibrationWaterfall steps={result.steps} />
            </div>
          )}

          {/* Audit trail — plain language */}
          {hasResult && result.steps.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">How we got here</h4>
              <div className="space-y-2">
                {[...result.steps].reverse().map((step, i) => {
                  if (step.description.includes('Calibrated fair value')) return null
                  const val = step.output
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)] flex-shrink-0" />
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        <span className="font-medium text-[var(--color-text-primary)]">{step.description}</span>
                        {' '}&rarr; {val}
                        {debug && <span className="text-[10px] text-[var(--color-text-tertiary)] ml-2 font-mono">{step.formula}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Assumptions — first-class cards */}
          {hasResult && result.assumptions.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">Key Assumptions</h4>
              <div className="grid grid-cols-2 gap-3">
                {result.assumptions.map((a, i) => {
                  const overrideKey = getOverrideKey(a.name)
                  const isOverridden = overrideKey ? overrideKey in overrides : false
                  const isEditing = editingKey === overrideKey
                  return (
                    <div key={i} className={`rounded-lg border px-3 py-2.5 ${isOverridden ? 'border-amber-300 bg-amber-50' : 'border-[var(--color-border)] bg-[var(--color-surface-secondary)]'}`}>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] mb-0.5">{a.name}</p>
                      {isEditing ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number" step="any" value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(a.name, a.value); if (e.key === 'Escape') setEditingKey(null) }}
                            onBlur={() => commitEdit(a.name, a.value)}
                            className="w-20 px-2 py-0.5 rounded border border-[var(--color-primary)] text-sm bg-white focus:outline-none"
                            autoFocus
                          />
                          <span className="text-xs text-[var(--color-text-tertiary)]">{a.value.includes('%') ? '%' : ''}</span>
                        </span>
                      ) : (
                        <p
                          className={`text-sm font-semibold ${a.overrideable ? 'cursor-pointer hover:text-[var(--color-primary)]' : ''} ${isOverridden ? 'text-amber-700' : 'text-[var(--color-text-primary)]'}`}
                          onClick={() => a.overrideable && startEdit(a.name, a.value)}
                          title={a.overrideable ? 'Click to override' : undefined}
                        >
                          {a.value}
                          {isOverridden && <span className="ml-1 text-[10px] font-normal text-amber-600">(override)</span>}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2">{a.rationale}</p>
                      {debug && a.source && <p className="text-[9px] text-[var(--color-text-tertiary)] italic mt-0.5">{a.source}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Method comparison chart (when 2+ methods have results) */}
          {Object.keys(methodResults).length >= 2 && (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <MethodComparisonBars results={methodResults} />
            </div>
          )}

          {/* Sources — debug only */}
          {debug && hasResult && result.sources.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-tertiary)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <h4 className="font-medium uppercase tracking-wider mb-2">Sources</h4>
              {result.sources.map((s, i) => (
                <p key={i}>{s.name} &middot; {s.version} &middot; {s.effective_date}</p>
              ))}
            </div>
          )}

          {/* Run button — if result exists, show re-run */}
          {hasResult && (
            <div className="flex justify-end">
              <button onClick={handleRun} disabled={running}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors disabled:opacity-40">
                {running ? 'Recomputing...' : 'Recompute Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCompany, updateCompany, runMethod, runValuation, listSectors, runSensitivity } from '../api/client'
import type { SensitivityResult, ParsedImport } from '../api/client'
import type { Company, MethodResultOut, BenchmarkSector, FundingRound, ProjectionPeriod } from '../types'
import RangeBar from '../components/RangeBar'
import SensitivityTable from '../components/SensitivityTable'
import WeightingPanel from '../components/WeightingPanel'
import DocumentUpload from '../components/DocumentUpload'
import { formatLabel } from '../utils/labels'

const METHOD_TABS = [
  { key: 'last_round_adjusted', label: 'Last Round' },
  { key: 'comps', label: 'Comps' },
  { key: 'dcf', label: 'DCF' },
  { key: 'manual', label: 'Manual' },
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

/* ------------------------------------------------------------------ */
/*  Override-aware assumption display                                  */
/* ------------------------------------------------------------------ */
function parseAssumptionValue(value: string): number | null {
  // Try to extract a numeric value from assumption strings like "20%", "-5%", "8.2x", "0.75"
  const pctMatch = value.match(/^-?(\d+(?:\.\d+)?)%$/)
  if (pctMatch) return parseFloat(pctMatch[1]) / 100
  const negPctMatch = value.match(/^-(\d+(?:\.\d+)?)%$/)
  if (negPctMatch) return parseFloat(negPctMatch[1]) / 100
  const xMatch = value.match(/^(\d+(?:\.\d+)?)x$/)
  if (xMatch) return parseFloat(xMatch[1])
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

function getOverrideKey(assumptionName: string): string | null {
  const map: Record<string, string> = {
    'Discount rate (WACC)': 'discount_rate',
    'Terminal growth rate': 'terminal_growth_rate',
    'EBITDA-to-FCF conversion': 'ebitda_to_fcf',
    'Revenue multiple': 'revenue_multiple',
    'DLOM (illiquidity discount)': 'dlom',
    'Time decay rate': 'time_decay_rate',
    'Sector trend adjustment': 'sector_trend',
  }
  return map[assumptionName] || null
}


/* ------------------------------------------------------------------ */
/*  Result display (shared across tabs)                               */
/* ------------------------------------------------------------------ */
function MethodResultDisplay({
  result, debug, overrides, onOverrideChange,
}: {
  result: MethodResultOut
  debug: boolean
  overrides: Record<string, number>
  onOverrideChange: (key: string, value: number) => void
}) {
  const [stepsOpen, setStepsOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (name: string, value: string) => {
    const key = getOverrideKey(name)
    if (!key) return
    const num = parseAssumptionValue(value)
    if (num === null) return
    setEditingKey(key)
    // Show as percentage or multiplier depending on context
    if (value.includes('%')) {
      setEditValue(String(Math.round(num * 100)))
    } else if (value.includes('x')) {
      setEditValue(String(num))
    } else {
      setEditValue(String(num))
    }
  }

  const commitEdit = (_name: string, originalValue: string) => {
    if (editingKey === null) return
    let numValue = parseFloat(editValue)
    if (isNaN(numValue)) { setEditingKey(null); return }
    // Convert % to decimal
    if (originalValue.includes('%')) numValue = numValue / 100
    onOverrideChange(editingKey, numValue)
    setEditingKey(null)
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="bg-indigo-50 rounded-xl p-5">
        <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Fair Value Estimate</p>
        <p className="text-2xl font-bold text-[var(--color-primary)]">{formatCurrency(result.value)}</p>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          Range: {formatCurrency(result.value_low)} -- {formatCurrency(result.value_high)}
        </p>
        <div className="mt-3">
          <RangeBar low={parseFloat(result.value_low)} mid={parseFloat(result.value)} high={parseFloat(result.value_high)} />
        </div>
      </div>

      {/* Reasoning Trace (reversed: conclusion first, then derivation) */}
      {result.steps.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <button onClick={() => setStepsOpen(o => !o)} className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-secondary)] transition-colors">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Reasoning Trace</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{stepsOpen ? 'Collapse' : 'Expand'}</span>
          </button>
          {stepsOpen && (
            <div className="px-4 pb-4 space-y-2">
              {[...result.steps].reverse().map((step, i, arr) => {
                const isConclusion = i === 0
                const stepNum = arr.length - i
                // A "set equation" has operators like =, ×, ÷, /, +, Σ or →
                const isEquation = /[=×÷+\-*/Σ→∑]/.test(step.formula) && !step.formula.startsWith('sector')
                return (
                  <div key={i} className={`rounded-lg px-3 py-2.5 ${isConclusion ? 'bg-indigo-50 border border-indigo-200' : ''}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isConclusion
                          ? 'bg-[var(--color-primary)] text-white'
                          : isEquation
                            ? 'bg-indigo-100 text-[var(--color-primary)]'
                            : 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-tertiary)]'
                      }`}>
                        {isConclusion ? '✓' : stepNum}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-medium ${isConclusion ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                            {step.description}
                          </p>
                          {!isConclusion && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              isEquation
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {isEquation ? 'equation' : 'working'}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-mono mt-0.5 ${isEquation ? 'text-indigo-500' : 'text-[var(--color-text-tertiary)]'}`}>{step.formula}</p>
                        <div className="flex flex-wrap gap-3 mt-0.5">
                          {Object.entries(step.inputs).map(([k, v]) => (
                            <span key={k} className="text-xs text-[var(--color-text-tertiary)]">{k}: <span className="text-[var(--color-text-secondary)]">{v}</span></span>
                          ))}
                        </div>
                        <p className={`text-xs font-semibold mt-0.5 ${isConclusion ? 'text-[var(--color-primary)] text-sm' : 'text-[var(--color-text-primary)]'}`}>= {step.output}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Assumptions — editable when overrideable */}
      {result.assumptions.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Assumptions</h4>
            {Object.keys(overrides).length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {Object.keys(overrides).length} override{Object.keys(overrides).length > 1 ? 's' : ''} applied
              </span>
            )}
          </div>
          <div className="space-y-2">
            {result.assumptions.map((a, i) => {
              const overrideKey = getOverrideKey(a.name)
              const isOverridden = overrideKey ? overrideKey in overrides : false
              const isEditing = editingKey === overrideKey
              return (
                <div key={i} className={`flex items-start gap-2 text-xs rounded-md px-1.5 py-1 ${isOverridden ? 'bg-amber-50' : ''}`}>
                  <span className="font-medium text-[var(--color-text-secondary)] min-w-[120px]">{a.name}</span>
                  {isEditing ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(a.name, a.value); if (e.key === 'Escape') setEditingKey(null) }}
                        onBlur={() => commitEdit(a.name, a.value)}
                        className="w-16 px-1.5 py-0.5 rounded border border-[var(--color-primary)] text-xs bg-white focus:outline-none"
                        autoFocus
                      />
                      <span className="text-[var(--color-text-tertiary)]">{a.value.includes('%') ? '%' : a.value.includes('x') ? 'x' : ''}</span>
                    </span>
                  ) : (
                    <span
                      className={`${a.overrideable ? 'cursor-pointer hover:text-[var(--color-primary)] hover:underline' : ''} ${isOverridden ? 'text-amber-700 font-semibold' : 'text-[var(--color-text-primary)]'}`}
                      onClick={() => a.overrideable && startEdit(a.name, a.value)}
                      title={a.overrideable ? 'Click to override' : undefined}
                    >
                      {a.value}
                      {isOverridden && <span className="ml-1 text-[9px] text-amber-600">(override)</span>}
                    </span>
                  )}
                  <span className="text-[var(--color-text-tertiary)] flex-1">-- {a.rationale}</span>
                  {a.source && <span className="text-[var(--color-text-tertiary)] italic text-[10px]">{a.source}</span>}
                  {debug && (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-100 text-[var(--color-primary)] text-[9px] font-bold cursor-help" title={`Overrideable: ${a.overrideable ? 'Yes' : 'No'}${a.source ? ` | Source: ${a.source}` : ''}`}>i</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="text-xs text-[var(--color-text-tertiary)]">
          Sources: {result.sources.map(s => `${s.name} v${s.version} (${s.effective_date})`).join(', ')}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Last Round tab                                                    */
/* ------------------------------------------------------------------ */
function LastRoundTab({ company, debug, onCompanyUpdate, onResult }: { company: Company; debug: boolean; onCompanyUpdate: (c: Company) => void; onResult: (method: string, result: MethodResultOut) => void }) {
  const [roundDate, setRoundDate] = useState(company.last_round_date ?? '')
  const [preMoneyVal, setPreMoneyVal] = useState(company.last_round_valuation ?? '')
  const [amountRaised, setAmountRaised] = useState(company.last_round_amount ?? '')
  const [leadInvestor, setLeadInvestor] = useState(company.last_round_investor ?? '')
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<MethodResultOut | null>(null)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const saveAndRun = async (overrideValues?: Record<string, number>) => {
    setRunning(true)
    setError('')
    try {
      const lastRound: FundingRound = {
        date: roundDate,
        pre_money_valuation: preMoneyVal,
        amount_raised: amountRaised || '0',
        lead_investor: leadInvestor || undefined,
      }
      const updated = await updateCompany(company.id, { last_round: lastRound })
      onCompanyUpdate(updated)
      const activeOverrides = overrideValues ?? overrides
      const res = await runMethod(company.id, 'last_round_adjusted', {
        overrides: Object.keys(activeOverrides).length > 0 ? activeOverrides : undefined,
      })
      setResult(res)
      onResult('last_round_adjusted', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run method')
    } finally {
      setRunning(false)
    }
  }

  const handleOverrideChange = (key: string, value: number) => {
    const newOverrides = { ...overrides, [key]: value }
    setOverrides(newOverrides)
    saveAndRun(newOverrides)
  }

  const saveInputs = async () => {
    setSaving(true)
    try {
      const lastRound: FundingRound = {
        date: roundDate,
        pre_money_valuation: preMoneyVal,
        amount_raised: amountRaised || '0',
        lead_investor: leadInvestor || undefined,
      }
      const updated = await updateCompany(company.id, { last_round: lastRound })
      onCompanyUpdate(updated)
    } catch {
      /* silent */
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1"

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div><label className={labelClass}>Round Date</label><input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} onBlur={saveInputs} className={inputClass} /></div>
        <div><label className={labelClass}>Lead Investor</label><input type="text" value={leadInvestor} onChange={e => setLeadInvestor(e.target.value)} onBlur={saveInputs} className={inputClass} placeholder="e.g., Sequoia" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div><label className={labelClass}>Pre-Money Valuation ($)</label><input type="number" value={preMoneyVal} onChange={e => setPreMoneyVal(e.target.value)} onBlur={saveInputs} className={inputClass} placeholder="e.g., 30000000" /></div>
        <div><label className={labelClass}>Amount Raised ($)</label><input type="number" value={amountRaised} onChange={e => setAmountRaised(e.target.value)} onBlur={saveInputs} className={inputClass} placeholder="e.g., 10000000" /></div>
      </div>

      <button onClick={() => saveAndRun()} disabled={running || !roundDate || !preMoneyVal}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
        {running ? 'Running...' : saving ? 'Saving...' : 'Run Last Round'}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && <MethodResultDisplay result={result} debug={debug} overrides={overrides} onOverrideChange={handleOverrideChange} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Comps tab                                                         */
/* ------------------------------------------------------------------ */
function CompsTab({ company, debug, sectors, onCompanyUpdate, onResult }: { company: Company; debug: boolean; sectors: BenchmarkSector[]; onCompanyUpdate: (c: Company) => void; onResult: (method: string, result: MethodResultOut) => void }) {
  const [revenue, setRevenue] = useState(company.current_revenue ?? '')
  const [sector, setSector] = useState(company.sector)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MethodResultOut | null>(null)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const saveAndRun = async (overrideValues?: Record<string, number>) => {
    setRunning(true)
    setError('')
    try {
      const updated = await updateCompany(company.id, { current_revenue: revenue || undefined, sector })
      onCompanyUpdate(updated)
      const activeOverrides = overrideValues ?? overrides
      const res = await runMethod(company.id, 'comps', {
        overrides: Object.keys(activeOverrides).length > 0 ? activeOverrides : undefined,
      })
      setResult(res)
      onResult('comps', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run method')
    } finally {
      setRunning(false)
    }
  }

  const handleOverrideChange = (key: string, value: number) => {
    const newOverrides = { ...overrides, [key]: value }
    setOverrides(newOverrides)
    saveAndRun(newOverrides)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1"

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div><label className={labelClass}>Current Annual Revenue ($)</label><input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} className={inputClass} placeholder="e.g., 5000000" /></div>
        <div><label className={labelClass}>Sector</label>
          <select value={sector} onChange={e => setSector(e.target.value)} className={inputClass}>
            {sectors.map(s => <option key={s.key} value={s.key}>{s.display_name}</option>)}
          </select>
        </div>
      </div>

      <button onClick={() => saveAndRun()} disabled={running}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
        {running ? 'Running...' : 'Run Comps'}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && <MethodResultDisplay result={result} debug={debug} overrides={overrides} onOverrideChange={handleOverrideChange} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DCF tab                                                           */
/* ------------------------------------------------------------------ */
function DCFTab({ company, debug, onCompanyUpdate, onResult }: { company: Company; debug: boolean; onCompanyUpdate: (c: Company) => void; onResult: (method: string, result: MethodResultOut) => void }) {
  const currentYear = new Date().getFullYear()
  const existingPeriods = (company.projections as { periods?: ProjectionPeriod[] } | undefined)?.periods

  const [rows, setRows] = useState<{ year: number; revenue: string; ebitda: string; growth_rate: string }[]>(() => {
    if (existingPeriods && existingPeriods.length > 0) {
      return existingPeriods.map(p => ({
        year: p.year,
        revenue: p.revenue ?? '',
        ebitda: p.ebitda ?? '',
        growth_rate: p.growth_rate != null ? String(Math.round(p.growth_rate * 100)) : '',
      }))
    }
    return [
      { year: currentYear + 1, revenue: '', ebitda: '', growth_rate: '' },
      { year: currentYear + 2, revenue: '', ebitda: '', growth_rate: '' },
      { year: currentYear + 3, revenue: '', ebitda: '', growth_rate: '' },
    ]
  })
  const [notes, setNotes] = useState(company.auditor_notes ?? '')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MethodResultOut | null>(null)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [sensitivity, setSensitivity] = useState<SensitivityResult | null>(null)
  const [loadingSens, setLoadingSens] = useState(false)

  const updateRow = (index: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const addRow = () => {
    const lastYear = rows.length > 0 ? rows[rows.length - 1].year : currentYear
    setRows(prev => [...prev, { year: lastYear + 1, revenue: '', ebitda: '', growth_rate: '' }])
  }

  const removeRow = (index: number) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const saveAndRun = async (overrideValues?: Record<string, number>) => {
    setRunning(true)
    setError('')
    try {
      const periods = rows.filter(r => r.revenue).map(r => ({
        year: r.year,
        revenue: r.revenue,
        ebitda: r.ebitda || undefined,
        growth_rate: r.growth_rate ? parseFloat(r.growth_rate) / 100 : undefined,
      }))
      const updated = await updateCompany(company.id, {
        projections: { periods },
        auditor_notes: notes || undefined,
      })
      onCompanyUpdate(updated)
      const activeOverrides = overrideValues ?? overrides
      const res = await runMethod(company.id, 'dcf', {
        overrides: Object.keys(activeOverrides).length > 0 ? activeOverrides : undefined,
      })
      setResult(res)
      onResult('dcf', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run method')
    } finally {
      setRunning(false)
    }
  }

  const handleOverrideChange = (key: string, value: number) => {
    const newOverrides = { ...overrides, [key]: value }
    setOverrides(newOverrides)
    saveAndRun(newOverrides)
  }

  const loadSensitivity = async () => {
    setLoadingSens(true)
    try {
      const sens = await runSensitivity(company.id)
      setSensitivity(sens)
    } catch {
      /* silent */
    } finally {
      setLoadingSens(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1"

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass}>Projected Financials</label>
          {rows.length < 5 && (
            <button type="button" onClick={addRow} className="text-xs text-[var(--color-primary)] hover:underline">+ Add year</button>
          )}
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[80px_1fr_1fr_1fr_32px] gap-2 text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-1">
            <span>Year</span><span>Revenue ($)</span><span>EBITDA ($)</span><span>Growth %</span><span />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_1fr_1fr_32px] gap-2 items-center">
              <input type="number" value={row.year} onChange={e => updateRow(i, 'year', e.target.value)} className={inputClass} />
              <input type="number" value={row.revenue} onChange={e => updateRow(i, 'revenue', e.target.value)} className={inputClass} placeholder="Revenue" />
              <input type="number" value={row.ebitda} onChange={e => updateRow(i, 'ebitda', e.target.value)} className={inputClass} placeholder="EBITDA" />
              <input type="number" value={row.growth_rate} onChange={e => updateRow(i, 'growth_rate', e.target.value)} className={inputClass} placeholder="%" />
              <button type="button" onClick={() => removeRow(i)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] text-sm" title="Remove row">&times;</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <label className={labelClass}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inputClass} h-20 resize-none`} placeholder="Additional context..." />
      </div>

      <div className="flex gap-2">
        <button onClick={() => saveAndRun()} disabled={running}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
          {running ? 'Running...' : 'Run DCF'}
        </button>
        {result && (
          <button onClick={loadSensitivity} disabled={loadingSens}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-indigo-50 transition-colors disabled:opacity-40">
            {loadingSens ? 'Loading...' : sensitivity ? 'Refresh Sensitivity' : 'Sensitivity Analysis'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && <MethodResultDisplay result={result} debug={debug} overrides={overrides} onOverrideChange={handleOverrideChange} />}

      {sensitivity && (
        <div className="mt-5 border border-[var(--color-border)] rounded-lg p-4">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Sensitivity Analysis: WACC vs Terminal Growth</h4>
          <SensitivityTable data={sensitivity} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Manual tab                                                        */
/* ------------------------------------------------------------------ */
function ManualTab({ company }: { company: Company }) {
  const [fairValue, setFairValue] = useState('')
  const [justification, setJustification] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateCompany(company.id, {
        auditor_notes: `MANUAL OVERRIDE: $${fairValue} -- ${justification}`,
      })
      setSaved(true)
    } catch {
      /* silent */
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1"

  return (
    <div>
      <div className="mb-4">
        <label className={labelClass}>Fair Value ($)</label>
        <input type="number" value={fairValue} onChange={e => setFairValue(e.target.value)} className={inputClass} placeholder="e.g., 50000000" />
      </div>
      <div className="mb-5">
        <label className={labelClass}>Justification</label>
        <textarea value={justification} onChange={e => setJustification(e.target.value)} className={`${inputClass} h-28 resize-none`} placeholder="Explain the rationale for this manual override..." />
      </div>
      <button onClick={handleSave} disabled={saving || !fairValue || !justification}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
        {saving ? 'Saving...' : 'Set Manual Override'}
      </button>
      {saved && <p className="mt-3 text-sm text-[var(--color-success)]">Manual override saved.</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Workspace                                                    */
/* ------------------------------------------------------------------ */
export default function ValuationWorkspace() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<Company | null>(null)
  const [sectors, setSectors] = useState<BenchmarkSector[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('last_round_adjusted')
  const [debug, setDebug] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingValuation, setSavingValuation] = useState(false)

  // Track results per method for summary bar and weighting
  const [methodResults, setMethodResults] = useState<Partial<Record<string, MethodResultOut>>>({})
  const [methodWeights, setMethodWeights] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!companyId) return
    Promise.all([getCompany(companyId), listSectors()])
      .then(([c, s]) => { setCompany(c); setSectors(s) })
      .finally(() => setLoading(false))
  }, [companyId])

  const handleCompanyUpdate = useCallback((c: Company) => { setCompany(c) }, [])

  const handleMethodResult = useCallback((method: string, result: MethodResultOut) => {
    setMethodResults(prev => ({ ...prev, [method]: result }))
  }, [])

  const handleImport = useCallback(async (data: ParsedImport) => {
    if (!companyId) return
    const update: Record<string, unknown> = {}
    if (data.current_revenue) update.current_revenue = data.current_revenue
    if (data.last_round) update.last_round = data.last_round
    if (data.projections) update.projections = data.projections
    if (data.stage) update.stage = data.stage
    if (data.sector) update.sector = data.sector
    if (data.revenue_status) update.revenue_status = data.revenue_status
    if (Object.keys(update).length > 0) {
      const updated = await updateCompany(companyId, update as Partial<import('../types').CompanyCreate>)
      setCompany(updated)
    }
  }, [companyId])

  const handleSaveValuation = async () => {
    if (!companyId) return
    setSavingValuation(true)
    try {
      const user = localStorage.getItem('vc-audit-user') || 'Auditor'
      const valuation = await runValuation(companyId, {
        created_by: user,
        method_weights: methodWeights ?? undefined,
      })
      navigate(`/valuations/${valuation.id}`)
    } catch (err) {
      console.error(err)
      setSavingValuation(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!company) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Company not found</div>

  const runMethodCount = Object.keys(methodResults).length

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/" className="text-xs text-[var(--color-primary)] hover:underline mb-1 inline-block">Back to Dashboard</Link>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{company.name}</h1>
          <div className="flex gap-2 mt-1.5">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">{formatLabel(company.stage)}</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]">{formatLabel(company.sector)}</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-[var(--color-primary)]">{formatLabel(company.revenue_status)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DocumentUpload onParsed={handleImport} compact />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Debug</span>
            <button
              onClick={() => setDebug(d => !d)}
              className={`relative w-8 h-[18px] rounded-full transition-colors ${debug ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-tertiary)] border border-[var(--color-border)]'}`}
            >
              <span className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${debug ? 'left-[16px]' : 'left-[2px]'}`} />
            </button>
          </label>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex gap-4 mb-5 text-xs">
        {METHOD_TABS.filter(t => t.key !== 'manual').map(t => {
          const r = methodResults[t.key]
          return (
            <div key={t.key} className="flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
              <span className="font-medium">{t.label}:</span>
              <span className={r ? 'text-[var(--color-text-primary)] font-semibold' : ''}>{r ? formatCurrency(r.value) : '--'}</span>
            </div>
          )
        })}
      </div>

      {/* Method Tabs */}
      <div className="flex border-b border-[var(--color-border)] mb-0">
        {METHOD_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[var(--color-surface)] rounded-b-xl border border-t-0 border-[var(--color-border)] p-6" style={{ boxShadow: 'var(--shadow-md)', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
        {activeTab === 'last_round_adjusted' && <LastRoundTab company={company} debug={debug} onCompanyUpdate={handleCompanyUpdate} onResult={handleMethodResult} />}
        {activeTab === 'comps' && <CompsTab company={company} debug={debug} sectors={sectors} onCompanyUpdate={handleCompanyUpdate} onResult={handleMethodResult} />}
        {activeTab === 'dcf' && <DCFTab company={company} debug={debug} onCompanyUpdate={handleCompanyUpdate} onResult={handleMethodResult} />}
        {activeTab === 'manual' && <ManualTab company={company} />}
      </div>

      {/* Method Reconciliation (when 2+ methods have results) */}
      {runMethodCount >= 2 && (
        <div className="mt-6">
          <WeightingPanel
            methodResults={methodResults}
            onWeightsChange={setMethodWeights}
          />
        </div>
      )}

      {/* Save as Valuation */}
      <div className="mt-6 flex justify-end">
        <button onClick={handleSaveValuation} disabled={savingValuation}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50">
          {savingValuation ? 'Saving...' : methodWeights ? 'Save Weighted Valuation' : 'Save as Valuation'}
        </button>
      </div>
    </div>
  )
}

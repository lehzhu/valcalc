import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getCompany, updateCompany, runMethod, runValuation, listSectors } from '../api/client'
import type { Company, MethodResultOut, BenchmarkSector, FundingRound, ProjectionPeriod } from '../types'
import RangeBar from '../components/RangeBar'

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

const LABEL_OVERRIDES: Record<string, string> = {
  ai_ml: 'AI / ML',
  series_a_plus: 'Series A+',
  pre_seed: 'Pre-Seed',
  mature_private: 'Mature Private',
  b2b_saas: 'B2B SaaS',
  healthcare_biotech: 'Healthcare / Biotech',
  hardware_iot: 'Hardware / IoT',
  ecommerce_marketplace: 'E-commerce / Marketplace',
  climate_cleantech: 'Climate / Clean Tech',
  pre_revenue: 'Pre-Revenue',
  early_revenue: 'Early Revenue',
  meaningful_revenue: 'Meaningful Revenue',
}

function formatLabel(s: string): string {
  if (LABEL_OVERRIDES[s]) return LABEL_OVERRIDES[s]
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/* ------------------------------------------------------------------ */
/*  Result display (shared across tabs)                               */
/* ------------------------------------------------------------------ */
function MethodResultDisplay({ result, debug }: { result: MethodResultOut; debug: boolean }) {
  const [stepsOpen, setStepsOpen] = useState(false)

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

      {/* Computation Steps */}
      {result.steps.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <button onClick={() => setStepsOpen(o => !o)} className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-secondary)] transition-colors">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Computation Steps ({result.steps.length})</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{stepsOpen ? 'Collapse' : 'Expand'}</span>
          </button>
          {stepsOpen && (
            <div className="px-4 pb-4 space-y-3">
              {result.steps.map((step, i) => (
                <div key={i} className="border-l-2 border-[var(--color-primary)] pl-3">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]"
                    title={debug ? `Formula: ${step.formula} | Inputs: ${JSON.stringify(step.inputs)}` : undefined}
                  >
                    {i + 1}. {step.description}
                    {debug && <span className="ml-1.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-100 text-[var(--color-primary)] text-[9px] font-bold cursor-help" title={`${step.formula}\n\nInputs: ${Object.entries(step.inputs).map(([k, v]) => `${k} = ${v}`).join(', ')}`}>i</span>}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] font-mono mt-0.5">{step.formula}</p>
                  <div className="flex flex-wrap gap-3 mt-0.5">
                    {Object.entries(step.inputs).map(([k, v]) => (
                      <span key={k} className="text-xs text-[var(--color-text-tertiary)]">{k}: <span className="text-[var(--color-text-secondary)]">{v}</span></span>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)] mt-0.5">= {step.output}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assumptions */}
      {result.assumptions.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-lg p-4">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Assumptions</h4>
          <div className="space-y-2">
            {result.assumptions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="font-medium text-[var(--color-text-secondary)] min-w-[100px]">{a.name}</span>
                <span className="text-[var(--color-text-primary)]">{a.value}</span>
                <span className="text-[var(--color-text-tertiary)] flex-1">-- {a.rationale}</span>
                {a.source && <span className="text-[var(--color-text-tertiary)] italic text-[10px]">{a.source}</span>}
                {debug && (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-100 text-[var(--color-primary)] text-[9px] font-bold cursor-help" title={`Overrideable: ${a.overrideable ? 'Yes' : 'No'}${a.source ? ` | Source: ${a.source}` : ''}`}>i</span>
                )}
              </div>
            ))}
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

  const saveAndRun = async () => {
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
      const res = await runMethod(company.id, 'last_round_adjusted')
      setResult(res)
      onResult('last_round_adjusted', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run method')
    } finally {
      setRunning(false)
    }
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

      <button onClick={saveAndRun} disabled={running || !roundDate || !preMoneyVal}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
        {running ? 'Running...' : saving ? 'Saving...' : 'Run Last Round'}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && <MethodResultDisplay result={result} debug={debug} />}
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

  const saveAndRun = async () => {
    setRunning(true)
    setError('')
    try {
      const updated = await updateCompany(company.id, { current_revenue: revenue || undefined, sector })
      onCompanyUpdate(updated)
      const res = await runMethod(company.id, 'comps')
      setResult(res)
      onResult('comps', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run method')
    } finally {
      setRunning(false)
    }
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

      <button onClick={saveAndRun} disabled={running}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
        {running ? 'Running...' : 'Run Comps'}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && <MethodResultDisplay result={result} debug={debug} />}
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

  const saveAndRun = async () => {
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
      const res = await runMethod(company.id, 'dcf')
      setResult(res)
      onResult('dcf', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run method')
    } finally {
      setRunning(false)
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

      <button onClick={saveAndRun} disabled={running}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
        {running ? 'Running...' : 'Run DCF'}
      </button>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && <MethodResultDisplay result={result} debug={debug} />}
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

  // Track results per method for summary bar
  const [methodResults, setMethodResults] = useState<Partial<Record<string, MethodResultOut>>>({})

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

  const handleSaveValuation = async () => {
    if (!companyId) return
    setSavingValuation(true)
    try {
      const user = localStorage.getItem('vc-audit-user') || 'Auditor'
      const valuation = await runValuation(companyId, { created_by: user })
      navigate(`/valuations/${valuation.id}`)
    } catch (err) {
      console.error(err)
      setSavingValuation(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!company) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Company not found</div>

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

      {/* Save as Valuation */}
      <div className="mt-6 flex justify-end">
        <button onClick={handleSaveValuation} disabled={savingValuation}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50">
          {savingValuation ? 'Saving...' : 'Save as Valuation'}
        </button>
      </div>
    </div>
  )
}

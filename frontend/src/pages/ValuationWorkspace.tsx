import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCompany, updateCompany, runMethod, runValuation, overrideValuation, listSectors, listValuations, exportXlsxUrl, exportJsonUrl } from '../api/client'
import type { ParsedImport } from '../api/client'
import type { Company, MethodResultOut, BenchmarkSector, FundingRound, CompanyCreate } from '../types'
import DocumentUpload from '../components/DocumentUpload'

/* ── Constants ─────────────────────────────────────────────────── */

const METHOD_TABS = [
  { key: 'last_round_adjusted', label: 'Last Round' },
  { key: 'comps', label: 'Comps' },
] as const
type TabKey = typeof METHOD_TABS[number]['key']

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

const OVERRIDE_KEY_MAP: Record<string, string> = {
  'Revenue multiple': 'revenue_multiple',
  'DLOM (illiquidity discount)': 'dlom',
  'Time decay rate': 'time_decay_rate',
  'Sector trend adjustment': 'sector_trend',
  'Market/sector adjustment': 'sector_trend',
  'Performance adjustment': 'performance_adjustment',
  'Qualitative adjustment': 'qualitative_adjustment',
  'Growth adjustment': 'growth_adjustment',
}

/* ── Helpers ───────────────────────────────────────────────────── */

function fmt(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '--'
  return `$${Math.round(num).toLocaleString('en-US')}`
}

function parseAssumptionValue(value: string): number | null {
  const pct = value.match(/^-?(\d+(?:\.\d+)?)%/)
  if (pct) return parseFloat(pct[1]) / 100
  const x = value.match(/^(\d+(?:\.\d+)?)x$/)
  if (x) return parseFloat(x[1])
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

/* ── Shared styles ─────────────────────────────────────────────── */

const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
const cardClass = "bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4"
const sectionTitle = "text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3"

/* ── Small inline components ───────────────────────────────────── */

function parseOutputValue(output: string): number {
  // Extract the dollar amount from strings like "$30,000,000" or "$30,000,000 (some note)"
  const match = output.match(/\$([0-9,]+(?:\.\d+)?)/)
  if (match) return parseFloat(match[1].replace(/,/g, ''))
  // Fallback: try parsing any number
  const num = parseFloat(output.replace(/[^0-9.-]/g, ''))
  return isNaN(num) ? 0 : num
}

function WaterfallChart({ steps }: { steps: MethodResultOut['steps'] }) {
  const bars: { label: string; value: number; delta: number }[] = []
  let prev = 0
  for (const step of steps) {
    if (step.description.includes('(noted') || step.description.includes('Calibrated fair value')) continue
    // Only include dollar-denominated steps — skip multiples (e.g., "12.0x")
    if (!step.output.includes('$')) continue
    const value = parseOutputValue(step.output)
    if (value === 0) continue
    bars.push({ label: step.description.replace(/:.*/,'').trim(), value, delta: bars.length === 0 ? value : value - prev })
    prev = value
  }
  if (bars.length < 2) return null
  const max = Math.max(...bars.map(b => b.value))
  return (
    <div className="space-y-1.5">
      {bars.map((bar, i) => {
        const pct = max > 0 ? (bar.value / max) * 100 : 0
        const anchor = i === 0
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--color-text-tertiary)] w-40 text-right truncate flex-shrink-0">{bar.label}</span>
            <div className="flex-1 h-6 relative min-w-0">
              <div className={`h-full rounded-r transition-all ${anchor ? 'bg-indigo-400' : bar.delta >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)] text-right whitespace-nowrap flex-shrink-0">
              {anchor ? '' : `${bar.delta >= 0 ? '+' : ''}${fmt(bar.delta)}`}
            </span>
            <span className="text-[11px] font-semibold text-[var(--color-text-primary)] text-right whitespace-nowrap flex-shrink-0">{fmt(bar.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

function ComparisonBars({ results }: { results: Record<string, MethodResultOut> }) {
  const entries = Object.entries(results)
  if (entries.length < 2) return null
  const max = Math.max(...entries.map(([, r]) => parseFloat(r.value_high)))
  const colors: Record<string, string> = { last_round_adjusted: 'bg-indigo-500', comps: 'bg-emerald-500' }
  const labels: Record<string, string> = { last_round_adjusted: 'Last Round', comps: 'Comps' }
  return (
    <div className="space-y-2">
      <h4 className={sectionTitle}>Cross-check Comparison</h4>
      {entries.map(([method, r]) => {
        const val = parseFloat(r.value)
        const pct = max > 0 ? (val / max) * 100 : 0
        return (
          <div key={method} className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-secondary)] w-20">{labels[method] || method}</span>
            <div className="flex-1 h-5 bg-[var(--color-surface-tertiary)] rounded">
              <div className={`h-full rounded ${colors[method] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-[var(--color-text-primary)] w-16 text-right">{fmt(val)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Main component ────────────────────────────────────────────── */

export default function ValuationWorkspace() {
  const { companyId } = useParams<{ companyId: string }>()

  // Core state
  const [company, setCompany] = useState<Company | null>(null)
  const [sectors, setSectors] = useState<BenchmarkSector[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('last_round_adjusted')
  const [methodResults, setMethodResults] = useState<Record<string, MethodResultOut>>({})
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [latestValuationId, setLatestValuationId] = useState<string | null>(null)
  const [autoSave, setAutoSave] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')

  // Company fields (flat for easy binding)
  const [fields, setFields] = useState({
    stage: '', sector: '', revenue_status: '', revenue: '',
    round_date: '', pre_money: '', amount_raised: '', lead_investor: '',
  })

  // Calibration fields (optional)
  const [showCalibration, setShowCalibration] = useState(false)
  const [calib, setCalib] = useState({
    revenue_at_round: '', gross_margin: '', runway: '',
    board_plan: '', cust_concentration: '', reg_risk: '',
    security_type: '', liq_pref: '', option_pool: '',
    index_movement: '',
  })

  // Override form
  const [showOverride, setShowOverride] = useState(false)
  const [overrideFairValue, setOverrideFairValue] = useState('')
  const [overrideJustification, setOverrideJustification] = useState('')
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)

  // Inline assumption editing
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Auto-save timer
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Load data ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!companyId) return
    Promise.all([getCompany(companyId), listSectors()])
      .then(([c, s]) => {
        setCompany(c)
        setSectors(s)
        const fin = (c.financials || {}) as Record<string, string>
        const qual = (c.qualitative || {}) as Record<string, string>
        const cap = (c.cap_table || {}) as Record<string, string>
        const ext = (c.external_mapping || {}) as Record<string, string>
        setFields({
          stage: c.stage, sector: c.sector, revenue_status: c.revenue_status,
          revenue: c.current_revenue ?? '',
          round_date: c.last_round_date ?? '', pre_money: c.last_round_valuation ?? '',
          amount_raised: c.last_round_amount ?? '', lead_investor: c.last_round_investor ?? '',
        })
        setCalib({
          revenue_at_round: fin.revenue_at_last_round ?? '', gross_margin: fin.gross_margin ?? '',
          runway: fin.runway_months ?? '', board_plan: qual.board_plan_status ?? '',
          cust_concentration: qual.customer_concentration ?? '', reg_risk: qual.regulatory_risk ?? '',
          security_type: cap.security_type ?? '', liq_pref: cap.liquidation_preferences ?? '',
          option_pool: cap.option_pool_pct ?? '', index_movement: ext.index_movement_pct ?? '',
        })
        // Load latest valuation ID (for export buttons)
        listValuations(companyId).then(vs => {
          if (vs.length) setLatestValuationId(vs[0].id)
        }).catch(() => {})
        // Auto-run method previews if data is sufficient
        const hasLastRound = !!(c.last_round_date && c.last_round_valuation)
        const hasComps = !!c.current_revenue
        const previews: Promise<void>[] = []
        if (hasLastRound) {
          previews.push(
            runMethod(companyId, 'last_round_adjusted').then(r => {
              if (r) setMethodResults(prev => ({ ...prev, last_round_adjusted: r }))
            }).catch(() => {})
          )
        }
        if (hasComps) {
          previews.push(
            runMethod(companyId, 'comps').then(r => {
              if (r) setMethodResults(prev => ({ ...prev, comps: r }))
            }).catch(() => {})
          )
        }
        return Promise.all(previews)
      })
      .finally(() => setLoading(false))
  }, [companyId])

  /* ── Field change handler (schedules auto-save) ──────────── */

  const scheduleAutoSave = useCallback(() => {
    setAutoSave('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(), 5000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFields(f => ({ ...f, [key]: e.target.value }))
    scheduleAutoSave()
  }

  const updateCalib = (key: keyof typeof calib) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCalib(c => ({ ...c, [key]: e.target.value }))
    scheduleAutoSave()
  }

  /* ── Save (company data + method preview, no valuation) ──── */

  const doSave = useCallback(async () => {
    if (!companyId || !company) return
    setAutoSave('saving')
    setError('')
    try {
      const update: Partial<CompanyCreate> = {
        stage: fields.stage, sector: fields.sector,
        revenue_status: fields.revenue_status,
        current_revenue: fields.revenue || undefined,
      }
      if (fields.round_date && fields.pre_money) {
        update.last_round = {
          date: fields.round_date, pre_money_valuation: fields.pre_money,
          amount_raised: fields.amount_raised || '0',
          lead_investor: fields.lead_investor || undefined,
        }
      }

      // Pack calibration into JSON blobs
      const fin: Record<string, string> = {}
      if (calib.revenue_at_round) fin.revenue_at_last_round = calib.revenue_at_round
      if (calib.gross_margin) fin.gross_margin = calib.gross_margin
      if (calib.runway) fin.runway_months = calib.runway
      if (Object.keys(fin).length) update.financials = fin

      const qual: Record<string, string> = {}
      if (calib.board_plan) qual.board_plan_status = calib.board_plan
      if (calib.cust_concentration) qual.customer_concentration = calib.cust_concentration
      if (calib.reg_risk) qual.regulatory_risk = calib.reg_risk
      if (Object.keys(qual).length) update.qualitative = qual

      const cap: Record<string, string> = {}
      if (calib.security_type) cap.security_type = calib.security_type
      if (calib.liq_pref) cap.liquidation_preferences = calib.liq_pref
      if (calib.option_pool) cap.option_pool_pct = calib.option_pool
      if (Object.keys(cap).length) update.cap_table = cap

      const ext: Record<string, string> = {}
      if (calib.index_movement) ext.index_movement_pct = calib.index_movement
      if (Object.keys(ext).length) update.external_mapping = ext

      const updated = await updateCompany(companyId, update)
      setCompany(updated)

      // Preview the active method (no committed record)
      const res = await runMethod(companyId, activeTab, {
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      }).catch(() => null)
      if (res) setMethodResults(prev => ({ ...prev, [activeTab]: res }))

      setAutoSave('saved')
      setTimeout(() => setAutoSave('idle'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setAutoSave('idle')
    }
  }, [companyId, company, fields, calib, activeTab, overrides])

  /* ── Run: save + commit a valuation record ───────────────── */

  const handleRun = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setRunning(true)
    await doSave()
    const user = localStorage.getItem('vc-audit-user') || 'Auditor'
    try {
      const val = await runValuation(companyId!, {
        created_by: user,
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      })
      setLatestValuationId(val.id)
    } catch { /* ignore */ }
    setRunning(false)
  }

  /* ── Manual override ─────────────────────────────────────── */

  const handleOverrideSubmit = async () => {
    if (!latestValuationId || !overrideFairValue || !overrideJustification) return
    setOverrideSubmitting(true)
    const user = localStorage.getItem('vc-audit-user') || 'Auditor'
    try {
      await overrideValuation(latestValuationId, {
        fair_value: overrideFairValue, justification: overrideJustification, created_by: user,
      })
      setShowOverride(false)
      setOverrideFairValue('')
      setOverrideJustification('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed')
    }
    setOverrideSubmitting(false)
  }

  /* ── Document import ─────────────────────────────────────── */

  const handleImport = useCallback(async (data: ParsedImport) => {
    if (!companyId) return
    const update: Partial<CompanyCreate> = {}
    if (data.current_revenue) { update.current_revenue = data.current_revenue; setFields(f => ({ ...f, revenue: data.current_revenue! })) }
    if (data.stage) { update.stage = data.stage; setFields(f => ({ ...f, stage: data.stage! })) }
    if (data.sector) { update.sector = data.sector; setFields(f => ({ ...f, sector: data.sector! })) }
    if (data.revenue_status) { update.revenue_status = data.revenue_status; setFields(f => ({ ...f, revenue_status: data.revenue_status! })) }
    if (data.last_round) {
      update.last_round = data.last_round as FundingRound
      setFields(f => ({
        ...f, round_date: data.last_round!.date, pre_money: data.last_round!.pre_money_valuation,
        amount_raised: data.last_round!.amount_raised, lead_investor: data.last_round!.lead_investor || f.lead_investor,
      }))
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

  /* ── Inline assumption editing ───────────────────────────── */

  const startEdit = (name: string, value: string) => {
    const key = OVERRIDE_KEY_MAP[name]
    if (!key) return
    const num = parseAssumptionValue(value)
    if (num === null) return
    setEditingKey(key)
    setEditValue(value.includes('%') ? String(Math.round(num * 100)) : String(num))
  }

  const commitEdit = (originalValue: string) => {
    if (!editingKey) return
    let v = parseFloat(editValue)
    if (isNaN(v)) { setEditingKey(null); return }
    if (originalValue.includes('%')) v = v / 100
    setOverrides(prev => ({ ...prev, [editingKey!]: v }))
    scheduleAutoSave()
    setEditingKey(null)
  }

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Loading...</div>
  if (!company) return <div className="text-center py-16 text-[var(--color-text-tertiary)]">Company not found</div>

  const result = methodResults[activeTab]
  const hasResult = !!result
  const hasSufficientData = activeTab === 'last_round_adjusted'
    ? !!(fields.round_date && fields.pre_money)
    : !!fields.revenue

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link to="/" className="text-xs text-[var(--color-primary)] hover:underline mb-1 inline-block">&larr; Dashboard</Link>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            {autoSave === 'pending' && <span className="text-[10px] text-amber-500">Unsaved changes</span>}
            {autoSave === 'saving' && <span className="text-[10px] text-[var(--color-text-tertiary)]">Saving...</span>}
            {autoSave === 'saved' && <span className="text-[10px] text-emerald-600">Saved</span>}
          </div>
        </div>
        <DocumentUpload onParsed={handleImport} compact />
      </div>

      {/* ── Inputs: horizontal strip ─────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Company details */}
        <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h3 className={sectionTitle}>Company Details</h3>
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Stage</label>
              <select value={fields.stage} onChange={updateField('stage')} className={inputClass}>
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sector</label>
              <select value={fields.sector} onChange={updateField('sector')} className={inputClass}>
                {sectors.map(s => <option key={s.key} value={s.key}>{s.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Revenue Status</label>
              <select value={fields.revenue_status} onChange={updateField('revenue_status')} className={inputClass}>
                {REVENUE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Current Annual Revenue ($)</label>
              <input type="number" value={fields.revenue} onChange={updateField('revenue')} className={inputClass} placeholder="e.g., 5000000" />
            </div>
          </div>
        </div>

        {/* Last funding round */}
        <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
          <h3 className={sectionTitle}>Last Funding Round</h3>
          <div className="space-y-2">
            <div>
              <label className={labelClass}>Round Date</label>
              <input type="date" value={fields.round_date} onChange={updateField('round_date')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Pre-Money Valuation ($)</label>
              <input type="number" value={fields.pre_money} onChange={updateField('pre_money')} className={inputClass} placeholder="30000000" />
            </div>
            <div>
              <label className={labelClass}>Amount Raised ($)</label>
              <input type="number" value={fields.amount_raised} onChange={updateField('amount_raised')} className={inputClass} placeholder="10000000" />
            </div>
            <div>
              <label className={labelClass}>Lead Investor</label>
              <input type="text" value={fields.lead_investor} onChange={updateField('lead_investor')} className={inputClass} placeholder="e.g., Sequoia" />
            </div>
          </div>
        </div>

        {/* Calibration data */}
        <div className={`${cardClass} !p-0 self-start`} style={{ boxShadow: 'var(--shadow-sm)' }}>
          <button onClick={() => setShowCalibration(s => !s)} className="w-full px-4 py-3 flex items-center justify-between text-left">
            <div>
              <h3 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">Calibration Data</h3>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">Optional: financials, qualitative factors, cap table</p>
            </div>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{showCalibration ? 'Hide' : 'Show'}</span>
          </button>
          {showCalibration && (
            <div className="px-4 pb-4 space-y-4">
              <CalibSection title="Financials">
                <LabeledInput label="Revenue at Last Round ($)" type="number" value={calib.revenue_at_round} onChange={updateCalib('revenue_at_round')} placeholder="e.g., 2500000" />
                <LabeledInput label="Gross Margin (0-1)" type="number" step="0.01" value={calib.gross_margin} onChange={updateCalib('gross_margin')} placeholder="e.g., 0.72" />
                <LabeledInput label="Runway (months)" type="number" value={calib.runway} onChange={updateCalib('runway')} placeholder="e.g., 18" />
              </CalibSection>
              <CalibSection title="Qualitative">
                <LabeledSelect label="Board Plan Status" value={calib.board_plan} onChange={updateCalib('board_plan')} options={['', 'exceeded', 'met', 'missed']} labels={['--', 'Exceeded', 'Met', 'Missed']} />
                <LabeledSelect label="Customer Concentration" value={calib.cust_concentration} onChange={updateCalib('cust_concentration')} options={['', 'low', 'moderate', 'high']} labels={['--', 'Low', 'Moderate', 'High']} />
                <LabeledSelect label="Regulatory Risk" value={calib.reg_risk} onChange={updateCalib('reg_risk')} options={['', 'low', 'moderate', 'high']} labels={['--', 'Low', 'Moderate', 'High']} />
              </CalibSection>
              <CalibSection title="Cap Table">
                <LabeledSelect label="Security Type" value={calib.security_type} onChange={updateCalib('security_type')}
                  options={['', 'Common Stock', 'Series Seed Preferred', 'Series A Preferred', 'Series B Preferred', 'Series C Preferred', 'SAFE', 'Convertible Note']}
                  labels={['--', 'Common Stock', 'Series Seed Preferred', 'Series A Preferred', 'Series B Preferred', 'Series C Preferred', 'SAFE', 'Convertible Note']} />
                <LabeledSelect label="Liquidation Preferences" value={calib.liq_pref} onChange={updateCalib('liq_pref')}
                  options={['', 'None', '1x non-participating', '1x participating', '1x participating (3x cap)', '2x non-participating', '2x participating']}
                  labels={['--', 'None', '1x Non-Participating', '1x Participating', '1x Participating (3x Cap)', '2x Non-Participating', '2x Participating']} />
                <LabeledInput label="Option Pool %" type="number" value={calib.option_pool} onChange={updateCalib('option_pool')} placeholder="e.g., 15" />
              </CalibSection>
              <CalibSection title="Market Data">
                <LabeledInput label="Sector Index Movement (%)" type="number" step="0.1" value={calib.index_movement} onChange={updateCalib('index_movement')} placeholder="e.g., 5 for +5%" />
              </CalibSection>
            </div>
          )}
        </div>
      </div>

      {/* ── Full-width results ───────────────────────────── */}
      <div className="space-y-5">

        {/* Fair value hero */}
        {hasResult ? (
          <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className={sectionTitle + ' !mb-1'}>Fair Value Estimate</p>
                <p className="text-3xl font-bold text-[var(--color-text-primary)]">{fmt(result.value)}</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{fmt(result.value_low)} &ndash; {fmt(result.value_high)} range</p>
              </div>
              {latestValuationId && (
                <div className="flex gap-1.5">
                  <a href={exportXlsxUrl(latestValuationId)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors">Excel</a>
                  <a href={exportJsonUrl(latestValuationId)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors">JSON</a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${cardClass} border-dashed text-center`} style={{ boxShadow: 'var(--shadow-sm)' }}>
            {hasSufficientData ? (
              <>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">All required inputs are set</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-3">You can optionally add calibration data before running.</p>
                <button onClick={handleRun} disabled={running}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
                  {running ? 'Computing...' : 'Run Valuation'}
                </button>
              </>
            ) : (
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">Enter company data to begin</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {activeTab === 'last_round_adjusted'
                    ? 'Last Round requires a round date and pre-money valuation.'
                    : 'Comps requires current annual revenue.'}
                </p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        {/* Method tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {METHOD_TABS.map(t => {
            const r = methodResults[t.key]
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === t.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}>
                {t.label}
                {r && <span className="ml-1.5 text-xs text-[var(--color-text-tertiary)]">{fmt(r.value)}</span>}
              </button>
            )
          })}
        </div>

        {/* Waterfall */}
        {hasResult && result.steps.length > 2 && (
          <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h4 className={sectionTitle}>Calibration Waterfall</h4>
            <WaterfallChart steps={result.steps} />
          </div>
        )}

        {/* Step-by-step trail */}
        {hasResult && result.steps.length > 0 && (
          <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h4 className={sectionTitle}>How we got here</h4>
            <div className="space-y-2">
              {[...result.steps].reverse().map((step, i) => {
                if (step.description.includes('Calibrated fair value')) return null
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-text-tertiary)] flex-shrink-0" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      <span className="font-medium text-[var(--color-text-primary)]">{step.description}</span>
                      {' '}&rarr; {step.output}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Key assumptions (click to override) */}
        {hasResult && result.assumptions.length > 0 && (
          <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h4 className={sectionTitle}>Key Assumptions</h4>
            <div className="grid grid-cols-3 gap-3">
              {result.assumptions.map((a, i) => {
                const key = OVERRIDE_KEY_MAP[a.name]
                const overridden = key ? key in overrides : false
                const editing = editingKey === key
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 ${overridden ? 'border-amber-300 bg-amber-50' : 'border-[var(--color-border)] bg-[var(--color-surface-secondary)]'}`}>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mb-0.5">{a.name}</p>
                    {editing ? (
                      <span className="flex items-center gap-1">
                        <input type="number" step="any" value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(a.value); if (e.key === 'Escape') setEditingKey(null) }}
                          onBlur={() => commitEdit(a.value)}
                          className="w-20 px-2 py-0.5 rounded border border-[var(--color-primary)] text-sm bg-white focus:outline-none"
                          autoFocus />
                        <span className="text-xs text-[var(--color-text-tertiary)]">{a.value.includes('%') ? '%' : ''}</span>
                      </span>
                    ) : (
                      <p className={`text-sm font-semibold ${a.overrideable ? 'cursor-pointer hover:text-[var(--color-primary)]' : ''} ${overridden ? 'text-amber-700' : 'text-[var(--color-text-primary)]'}`}
                        onClick={() => a.overrideable && startEdit(a.name, a.value)}
                        title={a.overrideable ? 'Click to override' : undefined}>
                        {a.value}
                        {overridden && <span className="ml-1 text-[10px] font-normal text-amber-600">(override)</span>}
                      </p>
                    )}
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-2">{a.rationale}</p>
                    {a.source && <p className="text-[9px] text-[var(--color-text-tertiary)] italic mt-0.5 line-clamp-1">Source: {a.source}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cross-method comparison */}
        {Object.keys(methodResults).length >= 2 && (
          <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
            <ComparisonBars results={methodResults} />
          </div>
        )}

        {/* Data sources */}
        {hasResult && result.sources.length > 0 && (
          <div className={cardClass} style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h4 className={sectionTitle}>Data Sources</h4>
            <div className="space-y-1.5">
              {result.sources.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 w-1 h-1 rounded-full bg-[var(--color-text-tertiary)] flex-shrink-0" />
                  <div>
                    <span className="font-medium text-[var(--color-text-secondary)]">{s.name}</span>
                    <span className="text-[var(--color-text-tertiary)]"> ({s.version}, effective {s.effective_date})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {hasResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[var(--color-text-tertiary)]">Change inputs or assumptions above, then recompute.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowOverride(o => !o)} disabled={!latestValuationId}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40">
                  Manual Override
                </button>
                <button onClick={handleRun} disabled={running}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40">
                  {running ? 'Saving...' : 'Save & Recompute'}
                </button>
              </div>
            </div>

            {/* Override form */}
            {showOverride && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-medium text-amber-800 uppercase tracking-wider">Manual Override</h4>
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1">Fair Value ($)</label>
                  <input type="number" value={overrideFairValue} onChange={e => setOverrideFairValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g., 35000000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1">Justification</label>
                  <textarea value={overrideJustification} onChange={e => setOverrideJustification(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    rows={2} placeholder="Reason for override..." />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowOverride(false)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-tertiary)]">Cancel</button>
                  <button onClick={handleOverrideSubmit} disabled={overrideSubmitting || !overrideFairValue || !overrideJustification}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-40">
                    {overrideSubmitting ? 'Applying...' : 'Apply Override'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Tiny reusable pieces (same file, no separate imports) ──── */

function CalibSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function LabeledInput(props: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { label, ...rest } = props
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input {...rest} className={inputClass} />
    </div>
  )
}

function LabeledSelect(props: { label: string; options: string[]; labels: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { label, options, labels, ...rest } = props
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select {...rest} className={inputClass}>
        {options.map((v, i) => <option key={v} value={v}>{labels[i]}</option>)}
      </select>
    </div>
  )
}

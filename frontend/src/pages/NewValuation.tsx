import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { createCompany, runValuation, listSectors } from '../api/client'
import { STAGES, REVENUE_STATUSES } from '../types'
import type { BenchmarkSector } from '../types'

interface FormData {
  name: string
  stage: string
  sector: string
  revenue_status: string
  current_revenue: string
  last_round_date: string
  last_round_valuation: string
  last_round_amount: string
  last_round_investor: string
  projection_years: { year: number; revenue: string; ebitda: string; growth_rate: string }[]
  auditor_notes: string
}

const STEPS = ['Company Basics', 'Funding History', 'Financials', 'Notes', 'Review']

export default function NewValuation() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sectors, setSectors] = useState<BenchmarkSector[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { register, watch, handleSubmit } = useForm<FormData>({
    defaultValues: {
      stage: 'seed',
      revenue_status: 'pre_revenue',
      projection_years: [
        { year: new Date().getFullYear() + 1, revenue: '', ebitda: '', growth_rate: '' },
        { year: new Date().getFullYear() + 2, revenue: '', ebitda: '', growth_rate: '' },
        { year: new Date().getFullYear() + 3, revenue: '', ebitda: '', growth_rate: '' },
      ],
    },
  })

  const revenueStatus = watch('revenue_status')
  const stage = watch('stage')
  const isPreRevenue = revenueStatus === 'pre_revenue'
  const showProjections = !isPreRevenue && ['growth', 'mature_private'].includes(stage)

  useEffect(() => { listSectors().then(setSectors) }, [])

  const activeSteps = STEPS.filter((_s, i) => {
    if (i === 1) return true
    if (i === 2) return !isPreRevenue
    return true
  })

  const currentStepName = activeSteps[step]
  const isLastStep = step === activeSteps.length - 1
  const progress = ((step + 1) / activeSteps.length) * 100

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const user = localStorage.getItem('vc-audit-user') || 'Auditor'
      const hasRound = data.last_round_date && data.last_round_valuation
      const hasProjections = showProjections && data.projection_years.some(p => p.revenue)

      const company = await createCompany({
        name: data.name,
        stage: data.stage,
        sector: data.sector,
        revenue_status: data.revenue_status,
        current_revenue: !isPreRevenue && data.current_revenue ? data.current_revenue : undefined,
        last_round: hasRound ? {
          date: data.last_round_date,
          pre_money_valuation: data.last_round_valuation,
          amount_raised: data.last_round_amount || '0',
          lead_investor: data.last_round_investor || undefined,
        } : undefined,
        projections: hasProjections ? {
          periods: data.projection_years
            .filter(p => p.revenue)
            .map(p => ({
              year: p.year,
              revenue: p.revenue,
              ebitda: p.ebitda || undefined,
              growth_rate: p.growth_rate ? parseFloat(p.growth_rate) / 100 : undefined,
            })),
        } : undefined,
        auditor_notes: data.auditor_notes || undefined,
        created_by: user,
      })

      const valuation = await runValuation(company.id, { created_by: user })
      navigate(`/valuations/${valuation.id}`)
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
  const sectionClass = "space-y-5"

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">New Valuation</h1>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-6">Enter company details to generate a valuation.</p>

      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {activeSteps.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)}
              className={`text-xs font-medium transition-colors ${
                i === step ? 'text-[var(--color-primary)]' :
                i < step ? 'text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-primary)]' :
                'text-[var(--color-text-tertiary)]'
              }`}>{s}</button>
          ))}
        </div>
        <div className="h-1 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6" style={{ boxShadow: 'var(--shadow-md)' }}>
          {currentStepName === 'Company Basics' && (
            <div className={sectionClass}>
              <div><label className={labelClass}>Company Name</label><input {...register('name', { required: true })} className={inputClass} placeholder="e.g., Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Stage</label><select {...register('stage')} className={inputClass}>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                <div><label className={labelClass}>Sector</label><select {...register('sector')} className={inputClass}>{sectors.map(s => <option key={s.key} value={s.key}>{s.display_name}</option>)}</select></div>
              </div>
              <div>
                <label className={labelClass}>Revenue Status</label>
                <div className="flex gap-2">
                  {REVENUE_STATUSES.map(rs => (
                    <label key={rs.value} className={`flex-1 px-3 py-2 rounded-lg border text-center text-sm cursor-pointer transition-all ${revenueStatus === rs.value ? 'border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)] font-medium' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)]'}`}>
                      <input type="radio" {...register('revenue_status')} value={rs.value} className="sr-only" />{rs.label}
                    </label>
                  ))}
                </div>
              </div>
              {!isPreRevenue && <div><label className={labelClass}>Current Annual Revenue ($)</label><input {...register('current_revenue')} className={inputClass} placeholder="e.g., 5000000" type="number" /></div>}
            </div>
          )}

          {currentStepName === 'Funding History' && (
            <div className={sectionClass}>
              <p className="text-sm text-[var(--color-text-tertiary)]">Optional — enter details from the most recent funding round.</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Round Date</label><input {...register('last_round_date')} className={inputClass} type="date" /></div>
                <div><label className={labelClass}>Lead Investor</label><input {...register('last_round_investor')} className={inputClass} placeholder="e.g., Sequoia" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Pre-Money Valuation ($)</label><input {...register('last_round_valuation')} className={inputClass} placeholder="e.g., 30000000" type="number" /></div>
                <div><label className={labelClass}>Amount Raised ($)</label><input {...register('last_round_amount')} className={inputClass} placeholder="e.g., 10000000" type="number" /></div>
              </div>
            </div>
          )}

          {currentStepName === 'Financials' && (
            <div className={sectionClass}>
              <p className="text-sm text-[var(--color-text-tertiary)]">{showProjections ? 'Enter financial projections for DCF analysis.' : 'Revenue data will be used for comparable company valuation.'}</p>
              {showProjections && (
                <div><label className={labelClass}>Projected Financials</label>
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="grid grid-cols-4 gap-3">
                        <input {...register(`projection_years.${i}.year` as const, { valueAsNumber: true })} className={inputClass} placeholder="Year" type="number" />
                        <input {...register(`projection_years.${i}.revenue` as const)} className={inputClass} placeholder="Revenue ($)" type="number" />
                        <input {...register(`projection_years.${i}.ebitda` as const)} className={inputClass} placeholder="EBITDA ($)" type="number" />
                        <input {...register(`projection_years.${i}.growth_rate` as const)} className={inputClass} placeholder="Growth %" type="number" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStepName === 'Notes' && (
            <div className={sectionClass}>
              <div><label className={labelClass}>Auditor Notes (optional)</label>
                <textarea {...register('auditor_notes')} className={`${inputClass} h-32 resize-none`} placeholder="Any additional context, observations, or supporting information..." />
              </div>
            </div>
          )}

          {currentStepName === 'Review' && (
            <div className={sectionClass}>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Review your inputs</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]"><span className="text-[var(--color-text-tertiary)]">Company</span><span className="font-medium">{watch('name')}</span></div>
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]"><span className="text-[var(--color-text-tertiary)]">Stage</span><span>{STAGES.find(s => s.value === watch('stage'))?.label}</span></div>
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]"><span className="text-[var(--color-text-tertiary)]">Sector</span><span>{sectors.find(s => s.key === watch('sector'))?.display_name}</span></div>
                <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]"><span className="text-[var(--color-text-tertiary)]">Revenue Status</span><span>{REVENUE_STATUSES.find(r => r.value === revenueStatus)?.label}</span></div>
                {watch('current_revenue') && <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]"><span className="text-[var(--color-text-tertiary)]">Revenue</span><span>${Number(watch('current_revenue')).toLocaleString()}</span></div>}
                {watch('last_round_date') && <div className="flex justify-between py-1.5 border-b border-[var(--color-border-light)]"><span className="text-[var(--color-text-tertiary)]">Last Round</span><span>${Number(watch('last_round_valuation')).toLocaleString()} pre-money on {watch('last_round_date')}</span></div>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${step === 0 ? 'invisible' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-tertiary)]'}`}>Back</button>
          {isLastStep ? (
            <button type="submit" disabled={submitting}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50">
              {submitting ? 'Running valuation...' : 'Run Valuation'}
            </button>
          ) : (
            <button type="button" onClick={() => setStep(s => Math.min(activeSteps.length - 1, s + 1))}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors">Continue</button>
          )}
        </div>
      </form>
    </div>
  )
}

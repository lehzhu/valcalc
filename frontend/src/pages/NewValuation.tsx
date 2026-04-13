import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { createCompany, listSectors } from '../api/client'
import type { ParsedImport } from '../api/client'
import { STAGES, REVENUE_STATUSES } from '../types'
import type { BenchmarkSector } from '../types'
import DocumentUpload from '../components/DocumentUpload'

interface FormData {
  name: string
  stage: string
  sector: string
  revenue_status: string
}

export default function NewValuation() {
  const navigate = useNavigate()
  const [sectors, setSectors] = useState<BenchmarkSector[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [importedData, setImportedData] = useState<ParsedImport | null>(null)
  const { register, watch, handleSubmit, setValue } = useForm<FormData>({
    defaultValues: {
      stage: 'seed',
      revenue_status: 'pre_revenue',
    },
  })

  const revenueStatus = watch('revenue_status')

  useEffect(() => { listSectors().then(setSectors).catch(() => {}) }, [])

  const handleImport = (data: ParsedImport) => {
    setImportedData(data)
    if (data.name) setValue('name', data.name)
    if (data.stage) setValue('stage', data.stage)
    if (data.sector) setValue('sector', data.sector)
    if (data.revenue_status) setValue('revenue_status', data.revenue_status)
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    setError('')
    try {
      const user = localStorage.getItem('vc-audit-user') || 'Auditor'
      const company = await createCompany({
        name: data.name,
        stage: data.stage,
        sector: data.sector,
        revenue_status: data.revenue_status,
        current_revenue: importedData?.current_revenue,
        last_round: importedData?.last_round,
        projections: importedData?.projections,
        financials: importedData?.financials,
        qualitative: importedData?.qualitative,
        cap_table: importedData?.cap_table,
        external_mapping: importedData?.external_mapping,
        created_by: user,
      })
      navigate(`/companies/${company.id}/workspace`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to create company')
      setSubmitting(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm bg-[var(--color-surface)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-transparent"
  const labelClass = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">New Company</h1>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-6">Import from a document or enter the basics manually.</p>

      <div className="mb-6">
        <DocumentUpload onParsed={handleImport} />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 space-y-5" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div>
            <label className={labelClass}>Company Name</label>
            <input {...register('name', { required: true })} className={inputClass} placeholder="e.g., Acme Corp" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Stage</label>
              <select {...register('stage')} className={inputClass}>
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sector</label>
              <select {...register('sector')} className={inputClass}>
                {sectors.map(s => <option key={s.key} value={s.key}>{s.display_name}</option>)}
              </select>
            </div>
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
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={submitting}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create & Open'}
          </button>
        </div>
      </form>
    </div>
  )
}

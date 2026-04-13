import type {
  User, Company, CompanyCreate, CompanyListItem,
  Valuation, ValuationListItem, BenchmarkSector, MethodResultOut,
} from '../types'

const BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error ${resp.status}: ${body}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

// Users
export const listUsers = () => request<User[]>('/users')
export const createUser = (data: { name: string; email: string }) =>
  request<User>('/users', { method: 'POST', body: JSON.stringify(data) })

// Companies
export const listCompanies = () => request<CompanyListItem[]>('/companies')
export const getCompany = (id: string) => request<Company>(`/companies/${id}`)
export const createCompany = (data: CompanyCreate) =>
  request<Company>('/companies', { method: 'POST', body: JSON.stringify(data) })
export const updateCompany = (id: string, data: Partial<CompanyCreate>) =>
  request<Company>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteCompany = (id: string) =>
  request<void>(`/companies/${id}`, { method: 'DELETE' })

// Per-method
export const runMethod = (companyId: string, method: string, data?: { valuation_date?: string; overrides?: Record<string, number> }) =>
  request<MethodResultOut>(`/companies/${companyId}/methods/${method}`, { method: 'POST', body: JSON.stringify(data ?? {}) })

// Valuations
export const runValuation = (companyId: string, data: { created_by: string; valuation_date?: string; method_weights?: Record<string, number>; overrides?: Record<string, number> }) =>
  request<Valuation>(`/companies/${companyId}/valuations`, { method: 'POST', body: JSON.stringify(data) })
export const listValuations = (companyId: string) =>
  request<ValuationListItem[]>(`/companies/${companyId}/valuations`)
export const getValuation = (id: string) => request<Valuation>(`/valuations/${id}`)
export const overrideValuation = (id: string, data: { fair_value: string; justification: string; created_by: string }) =>
  request<Valuation>(`/valuations/${id}/override`, { method: 'POST', body: JSON.stringify(data) })

// Exports
export const exportJsonUrl = (id: string) => `${BASE}/valuations/${id}/export/json`
export const exportXlsxUrl = (id: string) => `${BASE}/valuations/${id}/export/xlsx`
export const exportPdfUrl = (id: string) => `${BASE}/valuations/${id}/export/pdf`

// Import / Document upload
export interface ParsedImport {
  name?: string
  stage?: string
  sector?: string
  revenue_status?: string
  current_revenue?: string
  last_round?: {
    date: string
    pre_money_valuation: string
    amount_raised: string
    lead_investor?: string
  }
  projections?: {
    periods: { year: number; revenue: string; ebitda?: string; growth_rate?: number }[]
  }
}

export async function uploadDocument(file: File): Promise<ParsedImport> {
  const form = new FormData()
  form.append('file', file)
  const resp = await fetch(`${BASE}/import/parse`, { method: 'POST', body: form })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(body.detail || `Upload failed (${resp.status})`)
  }
  return resp.json()
}

export const importTemplateUrl = `${BASE}/import/template`
export const batchTemplateUrl = `${BASE}/import/batch-template`

export interface BatchResultItem {
  company_name: string
  company_id?: string
  status: string
  fair_value?: string
  fair_value_low?: string
  fair_value_high?: string
  primary_method?: string
  explanation?: string
  methods_run?: { method: string; value: string; value_low: string; value_high: string }[]
  valuation_id?: string
  error?: string
}

export interface BatchResult {
  total: number
  succeeded: number
  failed: number
  results: BatchResultItem[]
}

export async function uploadBatch(file: File): Promise<BatchResult> {
  const form = new FormData()
  form.append('file', file)
  const resp = await fetch(`${BASE}/import/batch`, { method: 'POST', body: form })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(body.detail || `Batch upload failed (${resp.status})`)
  }
  return resp.json()
}

// Benchmarks
export const listSectors = () => request<BenchmarkSector[]>('/benchmarks/sectors')

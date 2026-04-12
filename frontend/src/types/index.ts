export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface FundingRound {
  date: string
  pre_money_valuation: string
  amount_raised: string
  lead_investor?: string
}

export interface ProjectionPeriod {
  year: number
  revenue: string
  ebitda?: string
  growth_rate?: number
}

export interface FinancialProjections {
  periods: ProjectionPeriod[]
  discount_rate?: number
}

export interface CompanyCreate {
  name: string
  stage: string
  sector: string
  revenue_status: string
  current_revenue?: string
  last_round?: FundingRound
  projections?: FinancialProjections
  auditor_notes?: string
  created_by: string
}

export interface Company {
  id: string
  name: string
  stage: string
  sector: string
  revenue_status: string
  current_revenue?: string
  last_round_date?: string
  last_round_valuation?: string
  last_round_amount?: string
  last_round_investor?: string
  projections?: Record<string, unknown>
  auditor_notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CompanyListItem {
  id: string
  name: string
  stage: string
  sector: string
  revenue_status: string
  created_at: string
  latest_valuation?: string
  latest_method?: string
}

export interface ComputationStep {
  description: string
  formula: string
  inputs: Record<string, string>
  output: string
}

export interface Assumption {
  name: string
  value: string
  rationale: string
  source?: string
  overrideable: boolean
}

export interface MethodResult {
  method: string
  value: string
  value_low: string
  value_high: string
  steps: ComputationStep[]
  assumptions: Assumption[]
  sources: { name: string; version: string; effective_date: string }[]
  is_primary: boolean
}

export interface AuditTrail {
  input_snapshot: Record<string, unknown>
  method_selection_rationale: string
  recommendations: { method: string; is_primary: boolean; rationale: string }[]
  method_results: MethodResult[]
  overrides: Record<string, unknown>[]
  benchmark_version?: string
  engine_version: string
  timestamp: string
}

export interface Valuation {
  id: string
  company_id: string
  version: number
  primary_method: string
  fair_value: string
  fair_value_low: string
  fair_value_high: string
  confidence: string
  data_completeness: number
  explanation: string
  method_results: MethodResult[]
  audit_trail: AuditTrail
  overrides?: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface ValuationListItem {
  id: string
  version: number
  primary_method: string
  fair_value: string
  confidence: string
  created_by: string
  created_at: string
}

export interface BenchmarkSector {
  key: string
  display_name: string
}

export const STAGES = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a_plus', label: 'Series A+' },
  { value: 'growth', label: 'Growth' },
  { value: 'mature_private', label: 'Mature Private' },
] as const

export const REVENUE_STATUSES = [
  { value: 'pre_revenue', label: 'Pre-Revenue' },
  { value: 'early_revenue', label: 'Early Revenue' },
  { value: 'meaningful_revenue', label: 'Meaningful Revenue' },
] as const

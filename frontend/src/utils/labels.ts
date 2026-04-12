/** Maps raw enum values to display labels for stages, sectors, and revenue statuses. */
const LABEL_OVERRIDES: Record<string, string> = {
  // Stages
  pre_seed: 'Pre-Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  series_c_plus: 'Series C+',
  late_pre_ipo: 'Late / Pre-IPO',
  // Sectors
  ai_ml: 'AI / ML',
  b2b_saas: 'B2B SaaS',
  healthcare_biotech: 'Healthcare / Biotech',
  hardware_iot: 'Hardware / IoT',
  ecommerce_marketplace: 'E-commerce / Marketplace',
  climate_cleantech: 'Climate / Clean Tech',
  // Revenue status
  pre_revenue: 'Pre-Revenue',
  early_revenue: 'Early (<$1M)',
  growing_revenue: 'Growing ($1-10M)',
  scaled_revenue: 'Scaled (>$10M)',
}

export function formatLabel(s: string): string {
  if (LABEL_OVERRIDES[s]) return LABEL_OVERRIDES[s]
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

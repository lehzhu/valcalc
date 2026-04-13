import React, { useState, useCallback, useRef } from 'react'
import { uploadDocument, importTemplateUrl } from '../api/client'
import type { ParsedImport } from '../api/client'

interface Props {
  onParsed: (data: ParsedImport) => void
  compact?: boolean
}

export default function DocumentUpload({ onParsed, compact }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<ParsedImport | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    setPending(null)
    try {
      const data = await uploadDocument(file)
      setPending(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const confirmImport = useCallback(() => {
    if (pending) {
      onParsed(pending)
      setPending(null)
    }
  }, [pending, onParsed])

  const cancelImport = useCallback(() => {
    setPending(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const fieldCount = pending ? Object.keys(pending).length : 0
  const projCount = pending?.projections?.periods?.length ?? 0

  if (compact) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
          >
            {uploading ? 'Parsing...' : 'Import from file'}
          </button>
          {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
        </div>

        {/* Confirmation panel */}
        {pending && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 max-w-lg">
            <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">Review imported fields before applying</h4>
            <ImportPreview data={pending} />
            <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-amber-200">
              <button onClick={cancelImport} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:bg-amber-100">Discard</button>
              <button onClick={confirmImport} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors">
                Apply {fieldCount} field{fieldCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" />

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all
          ${dragging
            ? 'border-[var(--color-primary)] bg-indigo-50'
            : 'border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:bg-[var(--color-surface-secondary)]'
          }
          ${uploading ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
          {uploading ? 'Parsing document...' : 'Drop a file here or click to browse'}
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Excel (.xlsx) or CSV with company data, funding rounds, or projections
        </p>
      </div>

      {error && (
        <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>
      )}

      {pending && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">Review imported fields before applying</h4>
          <ImportPreview data={pending} />
          <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-amber-200">
            <button onClick={cancelImport} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:bg-amber-100">Discard</button>
            <button onClick={confirmImport} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors">
              Apply {fieldCount} field{fieldCount !== 1 ? 's' : ''}
              {projCount > 0 && ` + ${projCount} projection year${projCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 text-right">
        <a
          href={importTemplateUrl}
          className="text-xs text-[var(--color-primary)] hover:underline"
          onClick={e => e.stopPropagation()}
        >
          Download template
        </a>
      </div>
    </div>
  )
}

function ImportPreview({ data }: { data: ParsedImport }) {
  const rows: { label: string; value: string; category: string }[] = []

  if (data.name) rows.push({ label: 'Company Name', value: data.name, category: 'Company' })
  if (data.stage) rows.push({ label: 'Stage', value: data.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), category: 'Company' })
  if (data.sector) rows.push({ label: 'Sector', value: data.sector.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), category: 'Company' })
  if (data.revenue_status) rows.push({ label: 'Revenue Status', value: data.revenue_status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), category: 'Company' })
  if (data.current_revenue) rows.push({ label: 'Current Revenue', value: `$${Number(data.current_revenue).toLocaleString()}`, category: 'Company' })

  if (data.last_round) {
    rows.push({ label: 'Round Date', value: data.last_round.date, category: 'Funding Round' })
    rows.push({ label: 'Pre-Money Valuation', value: `$${Number(data.last_round.pre_money_valuation).toLocaleString()}`, category: 'Funding Round' })
    rows.push({ label: 'Amount Raised', value: `$${Number(data.last_round.amount_raised).toLocaleString()}`, category: 'Funding Round' })
    if (data.last_round.lead_investor) rows.push({ label: 'Lead Investor', value: data.last_round.lead_investor, category: 'Funding Round' })
  }

  if (data.financials) {
    for (const [k, v] of Object.entries(data.financials)) {
      rows.push({ label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: String(v), category: 'Financials' })
    }
  }
  if (data.qualitative) {
    for (const [k, v] of Object.entries(data.qualitative)) {
      rows.push({ label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: String(v), category: 'Qualitative' })
    }
  }
  if (data.cap_table) {
    for (const [k, v] of Object.entries(data.cap_table)) {
      rows.push({ label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: String(v), category: 'Cap Table' })
    }
  }

  if (data.projections?.periods?.length) {
    rows.push({ label: 'Projections', value: `${data.projections.periods.length} years (${data.projections.periods.map(p => p.year).join(', ')})`, category: 'Projections' })
  }

  // Group by category
  const categories: string[] = []
  rows.forEach(r => { if (!categories.includes(r.category)) categories.push(r.category) })

  return (
    <div className="space-y-2">
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wider mb-1">{cat}</p>
          <div className="space-y-0.5">
            {rows.filter(r => r.category === cat).map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-amber-600 font-medium w-36 flex-shrink-0">{r.label}</span>
                <span className="text-amber-900">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

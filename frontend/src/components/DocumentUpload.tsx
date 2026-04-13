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
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    setParsed(null)
    try {
      const data = await uploadDocument(file)
      setParsed(data)
      onParsed(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onParsed])

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

  const fieldCount = parsed ? Object.keys(parsed).length : 0
  const projCount = parsed?.projections?.periods?.length ?? 0

  if (compact) {
    return (
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
        {parsed && (
          <span className="text-xs text-emerald-600 font-medium">
            Imported {fieldCount} field{fieldCount !== 1 ? 's' : ''}
            {projCount > 0 && ` + ${projCount} projection year${projCount !== 1 ? 's' : ''}`}
          </span>
        )}
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
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

      {parsed && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800 mb-2">
            Extracted {fieldCount} field{fieldCount !== 1 ? 's' : ''}
            {projCount > 0 && ` + ${projCount} projection year${projCount !== 1 ? 's' : ''}`}
          </p>
          <div className="space-y-0.5 text-xs text-emerald-700">
            {parsed.name && <p>Company: {parsed.name}</p>}
            {parsed.stage && <p>Stage: {parsed.stage}</p>}
            {parsed.sector && <p>Sector: {parsed.sector}</p>}
            {parsed.current_revenue && <p>Revenue: ${Number(parsed.current_revenue).toLocaleString()}</p>}
            {parsed.last_round && <p>Last round: ${Number(parsed.last_round.pre_money_valuation).toLocaleString()} on {parsed.last_round.date}</p>}
            {projCount > 0 && <p>Projections: {parsed.projections!.periods.map(p => p.year).join(', ')}</p>}
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

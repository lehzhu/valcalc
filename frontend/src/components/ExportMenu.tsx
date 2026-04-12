import { useState, useRef, useEffect } from 'react'
import { exportPdfUrl, exportXlsxUrl, exportJsonUrl } from '../api/client'

export default function ExportMenu({ valuationId }: { valuationId: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { label: 'Export PDF', href: exportPdfUrl(valuationId) },
    { label: 'Export Excel', href: exportXlsxUrl(valuationId) },
    { label: 'Export JSON', href: exportJsonUrl(valuationId) },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="px-3.5 py-1.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors">Export</button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] py-1 z-10" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {items.map(item => (
            <a key={item.label} href={item.href} className="block px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] transition-colors" onClick={() => setOpen(false)}>{item.label}</a>
          ))}
        </div>
      )}
    </div>
  )
}

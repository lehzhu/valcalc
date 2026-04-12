import type { SensitivityResult } from '../api/client'

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return 'N/A'
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`
  return `$${num.toFixed(0)}`
}

export default function SensitivityTable({ data }: { data: SensitivityResult }) {
  const { wacc_values, tg_values, grid, base_wacc, base_tg } = data

  // Find base indices for highlighting
  const baseWaccIdx = wacc_values.findIndex(w => Math.abs(w - base_wacc) < 0.001)
  const baseTgIdx = tg_values.findIndex(t => Math.abs(t - base_tg) < 0.001)

  // Get numeric values for color scaling
  const allValues = grid.flat().filter(v => v !== 'N/A').map(v => parseFloat(v))
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)

  function getCellColor(val: string, isBase: boolean): string {
    if (val === 'N/A') return 'var(--color-surface-tertiary)'
    const num = parseFloat(val)
    const ratio = maxVal > minVal ? (num - minVal) / (maxVal - minVal) : 0.5
    if (isBase) return 'rgb(224, 231, 255)' // indigo-100
    // Green-ish for high, red-ish for low
    const r = Math.round(254 - ratio * 70)
    const g = Math.round(226 + ratio * 26)
    const b = Math.round(226 + ratio * 10)
    return `rgb(${r}, ${g}, ${b})`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-[var(--color-text-tertiary)] font-medium border border-[var(--color-border)]">
              WACC \ TG
            </th>
            {tg_values.map((tg, j) => (
              <th
                key={j}
                className={`p-2 text-center font-medium border border-[var(--color-border)] ${
                  j === baseTgIdx ? 'text-[var(--color-primary)] bg-indigo-50' : 'text-[var(--color-text-tertiary)]'
                }`}
              >
                {(tg * 100).toFixed(0)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, i) => (
            <tr key={i}>
              <td
                className={`p-2 font-medium border border-[var(--color-border)] ${
                  i === baseWaccIdx ? 'text-[var(--color-primary)] bg-indigo-50' : 'text-[var(--color-text-tertiary)]'
                }`}
              >
                {(wacc_values[i] * 100).toFixed(0)}%
              </td>
              {row.map((val, j) => {
                const isBase = i === baseWaccIdx && j === baseTgIdx
                return (
                  <td
                    key={j}
                    className={`p-2 text-center font-mono border border-[var(--color-border)] ${
                      isBase ? 'font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                    style={{ backgroundColor: getCellColor(val, isBase) }}
                  >
                    {val === 'N/A' ? 'N/A' : formatCurrency(val)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2">
        Highlighted cell = base case (WACC {(base_wacc * 100).toFixed(0)}%, Terminal Growth {(base_tg * 100).toFixed(0)}%)
      </p>
    </div>
  )
}

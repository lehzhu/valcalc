import { BrowserRouter, Routes, Route } from 'react-router-dom'

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--color-text-tertiary)] text-lg">{name} — coming soon</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="/valuations/new" element={<Placeholder name="New Valuation" />} />
        <Route path="/valuations/:id" element={<Placeholder name="Valuation Results" />} />
        <Route path="/companies/:id" element={<Placeholder name="Company History" />} />
      </Routes>
    </BrowserRouter>
  )
}

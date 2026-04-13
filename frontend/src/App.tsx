import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewValuation from './pages/NewValuation'
import CompanyHistory from './pages/CompanyHistory'
import ValuationWorkspace from './pages/ValuationWorkspace'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/valuations/new" element={<NewValuation />} />
          <Route path="/companies/:companyId/workspace" element={<ValuationWorkspace />} />
          <Route path="/companies/:id" element={<CompanyHistory />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

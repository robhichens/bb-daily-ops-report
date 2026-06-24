import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/AppShell'
import { Login } from '@/pages/Login'
import { Report } from '@/pages/Report'
import { Dashboard } from '@/pages/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/report" element={<Report />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
          <Route path="/" element={<Navigate to="/report" replace />} />
          <Route path="*" element={<Navigate to="/report" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/AppShell'
import { Login } from '@/pages/Login'

// Code-split the heavy authed pages (form + dashboard + Firestore/Framer usage).
const Report = lazy(() => import('@/pages/Report').then((m) => ({ default: m.Report })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))

function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <img src="/brand/bb-tree.png" alt="Loading" className="size-12 animate-pulse object-contain" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
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
              <Route
                path="/report"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Report />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <Dashboard />
                  </Suspense>
                }
              />
            </Route>
            <Route path="/" element={<Navigate to="/report" replace />} />
            <Route path="*" element={<Navigate to="/report" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

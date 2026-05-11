import { AppLayout } from '@/components/layout/AppLayout'
import { ConfigPage } from '@/pages/ConfigPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { HomePage } from '@/pages/HomePage'
import { InterviewPage } from '@/pages/InterviewPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { useAuthStore } from '@/stores/auth.store'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }
  
  return <>{children}</>
}

export default function App() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (token && !user) {
      useAuthStore.getState().checkAuth()
    }
  }, [token, user])

  return (
    <AppLayout>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/config"
          element={
            <ProtectedRoute>
              <ConfigPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <InterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:id"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AppLayout>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import AuthGuard from '@/components/auth/AuthGuard'
import Landing from '@/pages/Landing'
import Dashboard from '@/pages/Dashboard'
import CreateGroup from '@/pages/CreateGroup'
import GroupDetail from '@/pages/GroupDetail'
import AddExpense from '@/pages/AddExpense'
import JoinGroup from '@/pages/JoinGroup'
import AuthConfirm from '@/pages/AuthConfirm'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-osps-cream">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-osps-red">O$P$</h1>
          <p className="text-osps-gray mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/join/:inviteCode" element={<JoinGroup />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected */}
      <Route element={<AuthGuard />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreateGroup />} />
        <Route path="/group/:groupId" element={<GroupDetail />} />
        <Route path="/group/:groupId/add" element={<AddExpense />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-osps-cream">
        <AppRoutes />
      </div>
    </AuthProvider>
  )
}
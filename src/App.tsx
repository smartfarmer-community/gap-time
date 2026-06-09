import { useAuth } from './hooks/useAuth'
import LoginPage from './components/auth/LoginPage'
import EmployeeDashboard from './components/employee/EmployeeDashboard'
import ManagerDashboard from './components/manager/ManagerDashboard'
import AdminPanel from './components/admin/AdminPanel'
import { Leaf } from 'lucide-react'

export default function App() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-900 to-stone-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            <Leaf className="w-7 h-7 text-brand-300" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-brand-200 font-medium">Loading GAP-TIME…</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (role === 'admin') return <AdminPanel />
  if (role === 'manager') return <ManagerDashboard />
  return <EmployeeDashboard />
}

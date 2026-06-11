import { Leaf, LogOut, User, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface HeaderProps {
  isOffline?: boolean
}

const roleLabels: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'HR / Admin',
}

const roleBadgeColor: Record<string, string> = {
  employee: 'bg-sky-100 text-sky-700 border-sky-200',
  manager: 'bg-violet-100 text-violet-700 border-violet-200',
  admin: 'bg-amber-100 text-amber-700 border-amber-200',
}

export default function Header({ isOffline }: HeaderProps) {
  const { profile, role, signOut } = useAuth()

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center">
            <img src="/logo.png" alt="GAP-TIME" className="w-8 h-8 object-contain" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-stone-800 text-sm tracking-tight">GAP-TIME</span>
            <span className="text-stone-400 text-xs ml-2">Log Sheet</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Offline indicator */}
          {isOffline !== undefined && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isOffline ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
              {isOffline ? 'Offline' : 'Online'}
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
              <User className="w-4 h-4 text-brand-700" />
            </div>
            <div className="hidden md:block text-right">
              <p className="text-xs font-semibold text-stone-700 leading-none">{profile?.name}</p>
              <p className="text-xs text-stone-400 mt-0.5">{profile?.department ?? 'No department'}</p>
            </div>
            {role && (
              <span className={`badge hidden sm:inline-flex ${roleBadgeColor[role]}`}>
                {roleLabels[role]}
              </span>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={signOut}
            className="btn-secondary py-1.5 px-3 text-xs"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

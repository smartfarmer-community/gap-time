import { useState, useEffect, useCallback } from 'react'
import { Users, MapPin, FileDown, Plus, Trash2, RefreshCw, CheckCircle, AlertTriangle, Edit2, X, Save } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { formatDate, formatTime, formatDuration, workModeLabel, statusColor } from '../../lib/utils'
import type { Profile, GeofenceHub, TimeLog, CorrectionRequest, WorkMode, AppRole } from '../../types'
import Header from '../shared/Header'

type EnrichedLog = TimeLog & { profileData?: Profile }
type EnrichedCorrection = CorrectionRequest & { profileData?: Profile }

export default function AdminPanel() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'hubs' | 'logs' | 'corrections'>('users')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [hubs, setHubs] = useState<GeofenceHub[]>([])
  const [logs, setLogs] = useState<EnrichedLog[]>([])
  const [corrections, setCorrections] = useState<EnrichedCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMsg = (type: 'success' | 'error', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000) }

  const fetchData = useCallback(async () => {
    setLoading(true)

    // All queries SEPARATE — no joins, no foreign key dependency
    const [{ data: pData }, { data: hData }, { data: lData }, { data: cData }, { data: roleData }] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('geofence_hubs').select('*').order('location_name'),
      supabase.from('time_logs').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('correction_requests').select('*').order('created_at', { ascending: false }),
      supabase.rpc('get_all_user_roles'),
    ])

    const profileMap: Record<string, Profile> = {}
    const roleMap: Record<string, AppRole> = {}

    ;(roleData ?? []).forEach((r: any) => { roleMap[r.user_id] = r.role })
    ;(pData ?? []).forEach((p: Profile) => {
      profileMap[p.user_id] = { ...p, role: roleMap[p.user_id] ?? 'employee' }
    })

    setProfiles(Object.values(profileMap))
    if (hData) setHubs(hData)
    if (lData) setLogs((lData as TimeLog[]).map(l => ({ ...l, profileData: profileMap[l.user_id] })))
    if (cData) setCorrections((cData as CorrectionRequest[]).map(c => ({ ...c, profileData: profileMap[c.user_id] })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const exportCSV = () => {
    const hubMap: Record<string, string> = {}
    hubs.forEach(h => { hubMap[h.id] = h.location_name })

    const rows = [
      ['Employee', 'Position', 'Department', 'Date', 'Work Mode', 'Clock In', 'Clock Out', 'Duration', 'Geofence Verified', 'Location / Hub', 'Distance (m)', 'Status', 'Achievements'],
      ...logs.map(l => [
        l.profileData?.name ?? '',
        l.profileData?.position ?? '',
        l.profileData?.department ?? '',
        l.log_date,
        workModeLabel(l.work_mode),
        formatTime(l.clock_in_time),
        formatTime(l.clock_out_time),
        l.clock_in_time && l.clock_out_time ? formatDuration(l.clock_in_time, l.clock_out_time) : '',
        l.geofence_verified ? 'Yes' : 'No',
        (l.hub_id && hubMap[l.hub_id]) ? hubMap[l.hub_id] : '',
        l.distance_meters !== null ? String(Math.round(l.distance_meters)) : '',
        l.status,
        (l.daily_summary_notes ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `gap-time-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'hubs', label: 'Geofence Hubs', icon: MapPin },
    { id: 'logs', label: 'All Logs', icon: FileDown },
    { id: 'corrections', label: 'Corrections', icon: CheckCircle },
  ] as const

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {msg && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: profiles.length, color: 'text-brand-700' },
            { label: 'Active Hubs', value: hubs.length, color: 'text-sky-600' },
            { label: 'Total Logs', value: logs.length, color: 'text-violet-600' },
            { label: 'Pending Corrections', value: corrections.filter(c => c.status === 'pending').length, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-stone-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex border-b border-stone-100 overflow-x-auto">
            {tabs.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${activeTab === t.id ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
                  <Icon className="w-4 h-4" />{t.label}
                </button>
              )
            })}
          </div>
          <div className="p-5">
            {activeTab === 'users' && <UsersTab profiles={profiles} onRefresh={fetchData} showMsg={showMsg} />}
            {activeTab === 'hubs' && <HubsTab hubs={hubs} onRefresh={fetchData} showMsg={showMsg} />}
            {activeTab === 'logs' && <LogsTab logs={logs} hubs={hubs} loading={loading} onExport={exportCSV} onRefresh={fetchData} />}
            {activeTab === 'corrections' && <CorrectionsTab corrections={corrections} onRefresh={fetchData} showMsg={showMsg} adminId={user!.id} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- USERS TAB ----
function UsersTab({ profiles, onRefresh, showMsg }: { profiles: Profile[]; onRefresh: () => void; showMsg: (t: 'success' | 'error', m: string) => void }) {
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', dept: '', position: '', role: 'employee' as AppRole, mode: 'on_site' as WorkMode })
  const [saving, setSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editingPosition, setEditingPosition] = useState<string | null>(null)
  const [customPosition, setCustomPosition] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { name: form.name, department: form.dept, position: form.position, default_work_mode: form.mode } }
    })
    if (error) { showMsg('error', error.message); setSaving(false); return }
    if (data.user && form.role !== 'employee') {
      await supabase.from('user_roles').delete().eq('user_id', data.user.id)
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: form.role })
    }
    showMsg('success', `Account created for ${form.name}.`)
    setShowInvite(false)
    setForm({ name: '', email: '', password: '', dept: '', position: '', role: 'employee', mode: 'on_site' })
    setSaving(false); setTimeout(onRefresh, 1000)
  }

  const handleChangeRole = async (userId: string, newRole: AppRole) => {
    await supabase.from('user_roles').delete().eq('user_id', userId)
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole })
    if (error) showMsg('error', error.message)
    else { showMsg('success', 'Role updated.'); setEditingRole(null); onRefresh() }
  }

  const handleToggleActive = async (profile: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !profile.is_active }).eq('id', profile.id)
    if (error) showMsg('error', error.message)
    else { showMsg('success', `User ${profile.is_active ? 'deactivated' : 'activated'}.`); onRefresh() }
  }

  const handleChangePosition = async (profile: Profile, newPosition: string) => {
    if (!newPosition.trim()) return
    const { error } = await supabase.from('profiles').update({ position: newPosition.trim() }).eq('id', profile.id)
    if (error) showMsg('error', error.message)
    else { showMsg('success', 'Position updated.'); setEditingPosition(null); setCustomPosition(''); onRefresh() }
  }

  const POSITION_OPTIONS = [
    'CEO',
    'Administrative Lead',
    'Human Resource Manager',
    'Operations Officer',
    'Project Lead',
    'Farms Officer',
    'Capital & Partnership Officer',
    'Sales Lead',
    'Sales Associate',
    'Assist. Administrator',
    'Marketing Officer',
    'Field Officer',
    '__custom__',
  ]

  const roleColors: Record<AppRole, string> = {
    employee: 'bg-sky-100 text-sky-700 border-sky-200',
    manager: 'bg-violet-100 text-violet-700 border-violet-200',
    admin: 'bg-amber-100 text-amber-700 border-amber-200',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-700">Team Members ({profiles.length})</h3>
        <button onClick={() => setShowInvite(v => !v)} className="btn-primary py-2 px-4 text-xs"><Plus className="w-3.5 h-3.5" />Create Account</button>
      </div>

      {showInvite && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-brand-200 bg-brand-50/30 p-5 space-y-3">
          <h4 className="font-semibold text-stone-700 text-sm">New Account</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Full Name', key: 'name', placeholder: 'Kwame Mensah', type: 'text' },
              { label: 'Email', key: 'email', placeholder: 'kwame@company.com', type: 'email' },
              { label: 'Password', key: 'password', placeholder: 'Temporary password', type: 'password' },
              { label: 'Department', key: 'dept', placeholder: 'Field Agronomy', type: 'text' },
              { label: 'Job Position', key: 'position', placeholder: 'Capital & Partnership Officer', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input type={f.type} className="input" placeholder={f.placeholder} value={(form as any)[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} required={f.key !== 'dept'} />
              </div>
            ))}
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(v => ({ ...v, role: e.target.value as AppRole }))}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">HR / Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Default Work Mode</label>
              <select className="input" value={form.mode} onChange={e => setForm(v => ({ ...v, mode: e.target.value as WorkMode }))}>
                <option value="on_site">On-Site</option>
                <option value="field">Field</option>
                <option value="remote">Remote</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary py-2 text-xs">{saving ? 'Creating…' : <><Save className="w-3.5 h-3.5" />Create Account</>}</button>
            <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary py-2 text-xs"><X className="w-3.5 h-3.5" />Cancel</button>
          </div>
        </form>
      )}

      <div className="divide-y divide-stone-100">
        {profiles.map(p => (
          <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2.5">
            {/* Name + email */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs sm:text-sm shrink-0">{p.name.charAt(0)}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-700 truncate">{p.name}</p>
                <p className="text-[11px] text-stone-400 truncate">{p.email} · {p.department ?? 'No department set'}</p>
              </div>
            </div>

            {/* Position + access + active — wraps on mobile */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pl-10 sm:pl-0">
              {/* POSITION — primary, editable */}
              {editingPosition === p.user_id ? (
                <div className="flex flex-wrap gap-1.5 items-center w-full sm:w-auto">
                  <select
                    className="input py-1 text-[11px] w-full sm:w-40"
                    defaultValue={POSITION_OPTIONS.includes(p.position ?? '') ? p.position! : '__custom__'}
                    onChange={e => {
                      if (e.target.value === '__custom__') { setCustomPosition(p.position ?? ''); return }
                      handleChangePosition(p, e.target.value)
                    }}
                  >
                    {POSITION_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt === '__custom__' ? 'Custom…' : opt}</option>
                    ))}
                  </select>
                  {(customPosition || !POSITION_OPTIONS.includes(p.position ?? '')) && (
                    <input
                      className="input py-1 text-[11px] w-full sm:w-36"
                      placeholder="Type position…"
                      defaultValue={p.position ?? ''}
                      onChange={e => setCustomPosition(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleChangePosition(p, customPosition) }}
                    />
                  )}
                  <button onClick={() => handleChangePosition(p, customPosition || p.position || '')} className="p-1 text-emerald-600 hover:text-emerald-700" title="Save"><Save className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setEditingPosition(null); setCustomPosition('') }} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-0.5 max-w-[150px] sm:max-w-none truncate">{p.position ?? 'No position set'}</span>
                  <button onClick={() => { setEditingPosition(p.user_id); setCustomPosition('') }} className="p-1 text-stone-400 hover:text-stone-600 shrink-0" title="Change job position"><Edit2 className="w-3.5 h-3.5" /></button>
                </>
              )}

              {/* ACCESS LEVEL — secondary, small */}
              {editingRole === p.user_id ? (
                <div className="flex gap-1 items-center">
                  <select className="input py-1 text-[10px] w-24" defaultValue={p.role} onChange={e => handleChangeRole(p.user_id, e.target.value as AppRole)}>
                    <option value="employee">Access: Staff</option>
                    <option value="manager">Access: Manager</option>
                    <option value="admin">Access: Admin</option>
                  </select>
                  <button onClick={() => setEditingRole(null)} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <button onClick={() => setEditingRole(p.user_id)} title="Change system access level"
                  className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium opacity-70 hover:opacity-100 transition ${roleColors[p.role ?? 'employee']}`}>
                  {p.role ?? 'employee'}
                </button>
              )}

              <button onClick={() => handleToggleActive(p)}
                className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border font-medium transition shrink-0 ${p.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                {p.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- HUBS TAB ----
function HubsTab({ hubs, onRefresh, showMsg }: { hubs: GeofenceHub[]; onRefresh: () => void; showMsg: (t: 'success' | 'error', m: string) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState(''); const [lat, setLat] = useState(''); const [lng, setLng] = useState(''); const [radius, setRadius] = useState('150')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('geofence_hubs').insert({ location_name: name.trim(), latitude: parseFloat(lat), longitude: parseFloat(lng), radius_meters: parseInt(radius) })
    if (error) showMsg('error', error.message)
    else { showMsg('success', 'Hub added.'); setShowForm(false); setName(''); setLat(''); setLng(''); setRadius('150'); onRefresh() }
    setSaving(false)
  }

  const handleDelete = async (id: string, hubName: string) => {
    if (!confirm(`Delete "${hubName}"?`)) return
    const { error } = await supabase.from('geofence_hubs').delete().eq('id', id)
    if (error) showMsg('error', error.message)
    else { showMsg('success', 'Hub deleted.'); onRefresh() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-700">Geofence Hubs ({hubs.length})</h3>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary py-2 px-4 text-xs"><Plus className="w-3.5 h-3.5" />Add Hub</button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-brand-200 bg-brand-50/30 p-5 space-y-3">
          <h4 className="font-semibold text-stone-700 text-sm">New Geofence Hub</h4>
          <div>
            <label className="label">Location Name</label>
            <input className="input" placeholder="Kumasi Administrative Studio" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Latitude</label><input className="input font-mono" placeholder="6.71282" value={lat} onChange={e => setLat(e.target.value)} required type="number" step="any" /></div>
            <div><label className="label">Longitude</label><input className="input font-mono" placeholder="-1.59829" value={lng} onChange={e => setLng(e.target.value)} required type="number" step="any" /></div>
            <div><label className="label">Radius (m)</label><input className="input font-mono" placeholder="150" value={radius} onChange={e => setRadius(e.target.value)} required type="number" min="10" /></div>
          </div>
          <p className="text-xs text-stone-400">Get exact coordinates from <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="underline">Google Maps</a> → right-click your location → copy numbers shown.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary py-2 text-xs">{saving ? 'Saving…' : <><Save className="w-3.5 h-3.5" />Save Hub</>}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary py-2 text-xs"><X className="w-3.5 h-3.5" />Cancel</button>
          </div>
        </form>
      )}
      <div className="space-y-3">
        {hubs.map(hub => (
          <div key={hub.id} className="flex items-center justify-between rounded-xl border border-stone-200 p-4 bg-white hover:bg-stone-50 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center"><MapPin className="w-4 h-4 text-brand-700" /></div>
              <div>
                <p className="font-semibold text-sm text-stone-700">{hub.location_name}</p>
                <p className="text-xs text-stone-400 font-mono">{hub.latitude.toFixed(5)}, {hub.longitude.toFixed(5)} · radius {hub.radius_meters}m</p>
              </div>
            </div>
            <button onClick={() => handleDelete(hub.id, hub.location_name)} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- LOGS TAB ----
function LogsTab({ logs, hubs, loading, onExport, onRefresh }: { logs: EnrichedLog[]; hubs: GeofenceHub[]; loading: boolean; onExport: () => void; onRefresh: () => void }) {
  const [search, setSearch] = useState('')
  const hubMap: Record<string, string> = {}
  hubs.forEach(h => { hubMap[h.id] = h.location_name })
  const filtered = logs.filter(l => !search || l.profileData?.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-semibold text-stone-700">All Time Logs ({logs.length})</h3>
        <input className="input py-1.5 text-xs w-48" placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 ml-auto">
          <button onClick={onRefresh} className="btn-secondary py-1.5 px-3 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={onExport} className="btn-primary py-1.5 px-3 text-xs"><FileDown className="w-3.5 h-3.5" />Export CSV</button>
        </div>
      </div>
      {loading ? <div className="text-center py-10 text-stone-400 text-sm">Loading…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                {['Employee', 'Date', 'Mode', 'In', 'Out', 'Duration', 'Geofence', 'Location', 'Dist', 'Status', 'Achievements'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wider py-2.5 px-2 first:pl-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(log => (
                <tr key={log.id} className={`hover:bg-stone-50 ${log.status === 'flagged' ? 'bg-red-50/30' : ''}`}>
                  <td className="py-3 px-2 first:pl-0">
                    <p className="font-medium text-stone-700 whitespace-nowrap">{log.profileData?.name ?? '—'}</p>
                    <p className="text-xs text-stone-400">{log.profileData?.position ?? log.profileData?.department}</p>
                  </td>
                  <td className="py-3 px-2 text-xs text-stone-500 whitespace-nowrap">{formatDate(log.log_date)}</td>
                  <td className="py-3 px-2"><span className="badge bg-stone-100 text-stone-600 border-stone-200 text-xs">{workModeLabel(log.work_mode)}</span></td>
                  <td className="py-3 px-2 font-mono text-xs whitespace-nowrap">{formatTime(log.clock_in_time)}</td>
                  <td className="py-3 px-2 font-mono text-xs whitespace-nowrap">{formatTime(log.clock_out_time)}</td>
                  <td className="py-3 px-2 font-mono text-xs text-stone-500 whitespace-nowrap">
                    {log.clock_in_time && log.clock_out_time ? formatDuration(log.clock_in_time, log.clock_out_time) : '—'}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`badge ${log.geofence_verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {log.geofence_verified ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-xs text-stone-500 whitespace-nowrap">
                    {log.hub_id ? (hubMap[log.hub_id] ?? '—') : '—'}
                  </td>
                  <td className="py-3 px-2 text-xs text-stone-400 whitespace-nowrap">
                    {log.distance_meters !== null ? `${Math.round(log.distance_meters)}m` : '—'}
                  </td>
                  <td className="py-3 px-2"><span className={`badge ${statusColor(log.status)}`}>{log.status}</span></td>
                  <td className="py-3 px-2 text-xs text-stone-500 max-w-[200px]">
                    <p className="truncate" title={log.daily_summary_notes ?? ''}>{log.daily_summary_notes ?? '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- CORRECTIONS TAB ----
function CorrectionsTab({ corrections, onRefresh, showMsg, adminId }: {
  corrections: EnrichedCorrection[]
  onRefresh: () => void
  showMsg: (t: 'success' | 'error', m: string) => void
  adminId: string
}) {
  const [actionId, setActionId] = useState<string | null>(null)

  const handle = async (id: string, status: 'approved' | 'rejected') => {
    setActionId(id)
    const { error } = await supabase.from('correction_requests').update({ status, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (error) showMsg('error', error.message)
    else { showMsg('success', `Request ${status}.`); onRefresh() }
    setActionId(null)
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-stone-700">All Correction Requests ({corrections.length})</h3>
      {corrections.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm">No correction requests found.</div>
      ) : corrections.map(c => (
        <div key={c.id} className={`rounded-2xl border p-4 ${c.status === 'pending' ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200 bg-white'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-stone-700">{c.profileData?.name ?? 'Unknown'}</p>
              <p className="text-xs text-stone-400">{formatDate(c.request_date)} · {workModeLabel(c.requested_work_mode)}</p>
              <p className="text-xs text-stone-500 mt-1.5 max-w-lg">{c.justification}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`badge ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{c.status}</span>
              {c.status === 'pending' && (
                <div className="flex gap-1.5">
                  <button onClick={() => handle(c.id, 'approved')} disabled={actionId === c.id} className="btn-primary py-1.5 px-3 text-xs">Approve</button>
                  <button onClick={() => handle(c.id, 'rejected')} disabled={actionId === c.id} className="btn-danger py-1.5 px-3 text-xs">Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

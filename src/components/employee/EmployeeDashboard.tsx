import { useState, useEffect, useCallback } from 'react'
import {
  Play, Square, Clock, History, FileText, MapPin,
  AlertTriangle, CheckCircle, WifiOff, Send,
  Navigation, AlertCircle, RefreshCw, Wifi
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useGPS } from '../../hooks/useGPS'
import { supabase } from '../../lib/supabase'
import {
  getNearestHub, formatDistance, formatDuration,
  formatTime, formatDate, workModeLabel, statusColor
} from '../../lib/utils'
import type { GeofenceHub, TimeLog, CorrectionRequest, WorkMode } from '../../types'
import GISMap from '../shared/GISMap'
import Header from '../shared/Header'

export default function EmployeeDashboard() {
  const { user, profile } = useAuth()
  const { position, permissionState, error: gpsError, requestPermission } = useGPS()

  const [hubs, setHubs] = useState<GeofenceHub[]>([])
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'clock' | 'history' | 'correction'>('clock')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // Clock state
  const [summaryNotes, setSummaryNotes] = useState('')
  const [clockingOut, setClockingOut] = useState(false)
  const [clockingIn, setClockingIn] = useState(false)
  const [workMode, setWorkMode] = useState<WorkMode>('on_site')
  const [elapsed, setElapsed] = useState('')

  // Correction form
  const [corrDate, setCorrDate] = useState(new Date().toISOString().split('T')[0])
  const [corrMode, setCorrMode] = useState<WorkMode>('on_site')
  const [corrIn, setCorrIn] = useState('08:00')
  const [corrOut, setCorrOut] = useState('17:00')
  const [corrReason, setCorrReason] = useState('')
  const [corrSaving, setCorrSaving] = useState(false)
  const [corrSuccess, setCorrSuccess] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Offline queue
  const [offlineQueue, setOfflineQueue] = useState<TimeLog[]>(() => {
    try { return JSON.parse(localStorage.getItem('gap_offline_queue') || '[]') } catch { return [] }
  })

  useEffect(() => {
    const goOnline = () => { setIsOffline(false); syncOfflineQueue() }
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  const syncOfflineQueue = async () => {
    const queue: TimeLog[] = JSON.parse(localStorage.getItem('gap_offline_queue') || '[]')
    if (!queue.length) return
    for (const log of queue) {
      await supabase.from('time_logs').upsert({ ...log, is_offline_cached: false })
    }
    localStorage.removeItem('gap_offline_queue')
    setOfflineQueue([])
    await fetchLogs()
  }

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: hubData }, { data: logData }, { data: corrData }] = await Promise.all([
      supabase.from('geofence_hubs').select('*').order('location_name'),
      supabase.from('time_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(60),
      supabase.from('correction_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    if (hubData) setHubs(hubData)
    if (logData) setLogs(logData)
    if (corrData) setCorrections(corrData)
    setLoading(false)
  }, [user])

  const fetchLogs = async () => {
    if (!user) return
    const { data } = await supabase.from('time_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(60)
    if (data) setLogs(data)
  }

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (profile) setWorkMode(profile.default_work_mode) }, [profile])

  const activeLog = logs.find(l => l.clock_in_time && !l.clock_out_time)

  // Live elapsed timer
  useEffect(() => {
    if (!activeLog) { setElapsed(''); return }
    const tick = () => setElapsed(formatDuration(activeLog.clock_in_time!))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeLog?.id])

  const nearestHub = position ? getNearestHub(position, hubs) : null

  const showMsg = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text })
    setTimeout(() => setActionMsg(null), 4500)
  }

  const handleClockIn = async () => {
    if (permissionState === 'denied') return
    if (!position) { showMsg('error', 'Waiting for GPS signal — please wait a moment and try again.'); return }
    setClockingIn(true)

    const geofenceVerified = workMode === 'on_site' ? (nearestHub?.isInside ?? false) : true
    const distanceMeters = nearestHub?.distance ?? null
    const hubId = nearestHub?.hub.id ?? null

    let flaggedReason: string | null = null
    if (workMode === 'on_site' && !geofenceVerified && nearestHub) {
      flaggedReason = `Clocked in ${formatDistance(nearestHub.distance)} from ${nearestHub.hub.location_name} — outside geofence radius.`
    }

    const newLog = {
      user_id: user!.id,
      log_date: new Date().toISOString().split('T')[0],
      work_mode: workMode,
      hub_id: hubId,
      clock_in_time: new Date().toISOString(),
      clock_in_lat: position.lat,
      clock_in_long: position.lng,
      clock_in_accuracy: position.accuracy,
      geofence_verified: geofenceVerified,
      distance_meters: distanceMeters,
      status: flaggedReason ? 'flagged' : 'pending',
      flagged_reason: flaggedReason,
      is_offline_cached: isOffline,
    }

    if (isOffline) {
      const tempLog = {
        ...newLog, id: `offline_${Date.now()}`,
        clock_out_time: null, clock_out_lat: null, clock_out_long: null, clock_out_accuracy: null,
        daily_summary_notes: null, correction_notes: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      } as TimeLog
      setLogs(prev => [tempLog, ...prev])
      const q = [...offlineQueue, tempLog]
      setOfflineQueue(q)
      localStorage.setItem('gap_offline_queue', JSON.stringify(q))
      showMsg('success', 'Clocked in (offline — will sync when reconnected)')
    } else {
      const { data, error } = await supabase.from('time_logs').insert(newLog).select().single()
      if (error) showMsg('error', 'Failed to clock in: ' + error.message)
      else {
        setLogs(prev => [data, ...prev])
        showMsg('success', flaggedReason ? '⚠ Clocked in — flagged for manager review (out of range)' : '✓ Clocked in successfully!')
      }
    }
    setClockingIn(false)
  }

  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeLog || !position) return
    if (!summaryNotes.trim()) { showMsg('error', 'Daily Log Sheet Achievements are required before clocking out.'); return }
    setClockingOut(true)

    const updates = {
      clock_out_time: new Date().toISOString(),
      clock_out_lat: position.lat,
      clock_out_long: position.lng,
      clock_out_accuracy: position.accuracy,
      daily_summary_notes: summaryNotes.trim(),
      is_offline_cached: isOffline,
    }

    if (isOffline) {
      setLogs(prev => prev.map(l => l.id === activeLog.id ? { ...l, ...updates } : l))
      showMsg('success', 'Clocked out (offline — will sync when reconnected)')
    } else {
      const { error } = await supabase.from('time_logs').update(updates).eq('id', activeLog.id)
      if (error) showMsg('error', 'Failed to clock out: ' + error.message)
      else { await fetchLogs(); showMsg('success', '✓ Clocked out and log submitted. Have a great rest!') }
    }
    setSummaryNotes('')
    setClockingOut(false)
  }

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!corrReason.trim()) return
    setCorrSaving(true)
    const { error } = await supabase.from('correction_requests').insert({
      user_id: user!.id,
      request_date: corrDate,
      requested_work_mode: corrMode,
      requested_in_time: new Date(`${corrDate}T${corrIn}:00`).toISOString(),
      requested_out_time: new Date(`${corrDate}T${corrOut}:00`).toISOString(),
      justification: corrReason.trim(),
    })
    if (error) showMsg('error', error.message)
    else {
      setCorrReason('')
      setCorrSuccess(true)
      setTimeout(() => setCorrSuccess(false), 4000)
      const { data } = await supabase.from('correction_requests').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })
      if (data) setCorrections(data)
    }
    setCorrSaving(false)
  }

  const tabs = [
    { id: 'clock' as const, label: 'Clock & Shift', icon: Clock },
    { id: 'history' as const, label: 'My Timesheet', icon: History },
    { id: 'correction' as const, label: 'Corrections', icon: FileText },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <Header isOffline={isOffline} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* GPS denied banner */}
        {permissionState === 'denied' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Location access is required to clock in.</p>
              <p className="text-xs mt-1">Please enable GPS in your browser settings, then{' '}
                <button onClick={requestPermission} className="underline font-semibold">tap here to retry</button>.
              </p>
            </div>
          </div>
        )}

        {/* Offline sync notice */}
        {offlineQueue.length > 0 && !isOffline && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800 text-sm">
            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" />{offlineQueue.length} offline log(s) pending sync</span>
            <button onClick={syncOfflineQueue} className="btn-primary py-1.5 px-3 text-xs bg-amber-600 hover:bg-amber-700">Sync Now</button>
          </div>
        )}

        {/* Toast */}
        {actionMsg && (
          <div className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium border ${actionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {actionMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {actionMsg.text}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT: Map + GPS */}
          <div className="lg:col-span-2 space-y-4">
            <GISMap position={position} hubs={hubs} nearestHub={nearestHub} height="280px" />

            <div className="card p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" /> GPS Status
              </h3>

              {permissionState === 'loading' && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <span className="w-3 h-3 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  Acquiring location…
                </div>
              )}

              {permissionState === 'granted' && position && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Coordinates</span>
                    <span className="font-mono text-stone-700">{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Accuracy</span>
                    <span className={`font-semibold ${position.accuracy > 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      ±{Math.round(position.accuracy)}m {position.accuracy > 50 ? '⚠ Weak signal' : '✓ Good'}
                    </span>
                  </div>
                  {nearestHub && (
                    <div className={`rounded-xl px-3 py-2 text-xs font-medium border ${nearestHub.isInside ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      <MapPin className="w-3.5 h-3.5 inline mr-1" />
                      {nearestHub.isInside ? '✓ Inside' : '✗ Outside'} {nearestHub.hub.location_name}
                      {' · '}{formatDistance(nearestHub.distance)} away
                    </div>
                  )}
                </div>
              )}

              {gpsError && permissionState !== 'denied' && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />{gpsError}
                </p>
              )}

              {/* Connectivity */}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${isOffline ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                {isOffline ? 'Offline mode — logs will sync when reconnected' : 'Online'}
              </div>
            </div>
          </div>

          {/* RIGHT: Tabs */}
          <div className="lg:col-span-3">
            <div className="card overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-stone-100">
                {tabs.map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3.5 text-xs font-semibold border-b-2 transition-all ${activeTab === t.id ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="p-5">

                {/* ── CLOCK TAB ── */}
                {activeTab === 'clock' && (
                  <div className="space-y-5">
                    {/* Active shift banner */}
                    {activeLog && (
                      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Shift Active</p>
                          <p className="font-mono text-2xl font-bold text-brand-800 mt-0.5">{elapsed}</p>
                          <p className="text-xs text-brand-600 mt-1">
                            Clocked in at {formatTime(activeLog.clock_in_time)} · {workModeLabel(activeLog.work_mode)}
                            {activeLog.status === 'flagged' && (
                              <span className="ml-2 badge bg-red-100 text-red-700 border-red-200">⚠ Flagged</span>
                            )}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-brand-200 flex items-center justify-center">
                          <Clock className="w-6 h-6 text-brand-700" />
                        </div>
                      </div>
                    )}

                    {!activeLog ? (
                      /* ── CLOCK IN ── */
                      <div className="space-y-4">
                        <div>
                          <label className="label">Work Mode</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['on_site', 'field', 'remote'] as WorkMode[]).map(m => (
                              <button key={m} onClick={() => setWorkMode(m)}
                                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${workMode === m ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
                                {workModeLabel(m)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Proximity indicator */}
                        {nearestHub && workMode === 'on_site' && (
                          <div className={`rounded-xl px-4 py-3 text-sm font-medium border flex items-center gap-2 ${nearestHub.isInside ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            <MapPin className="w-4 h-4 shrink-0" />
                            {nearestHub.isInside
                              ? `✓ You are ${formatDistance(nearestHub.distance)} from ${nearestHub.hub.location_name} — Within Range`
                              : `You are ${formatDistance(nearestHub.distance)} from ${nearestHub.hub.location_name} — Out of Range`
                            }
                          </div>
                        )}

                        {nearestHub && workMode !== 'on_site' && (
                          <div className="rounded-xl px-4 py-3 text-sm text-stone-500 bg-stone-50 border border-stone-200 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            GPS captured · {formatDistance(nearestHub.distance)} from {nearestHub.hub.location_name}
                          </div>
                        )}

                        <button onClick={handleClockIn}
                          disabled={clockingIn || permissionState === 'denied'}
                          className="btn-primary w-full py-4 text-base">
                          {clockingIn
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Clocking in…</>
                            : <><Play className="w-5 h-5" /> Clock In — {workModeLabel(workMode)}</>
                          }
                        </button>

                        {workMode === 'on_site' && nearestHub && !nearestHub.isInside && (
                          <p className="text-xs text-center text-stone-400">
                            ⚠ Out-of-range clock-in is allowed but will be flagged for manager review
                          </p>
                        )}
                      </div>
                    ) : (
                      /* ── CLOCK OUT ── */
                      <form onSubmit={handleClockOut} className="space-y-4">
                        <div>
                          <label className="label">
                            Daily Log Sheet Achievements <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            className="input min-h-[160px] resize-none"
                            placeholder="Describe your achievements today: tasks completed, fields visited, meetings attended, issues resolved, metrics recorded…"
                            value={summaryNotes}
                            onChange={e => setSummaryNotes(e.target.value)}
                            required
                          />
                          <p className="text-xs text-stone-400 mt-1">This is required before clocking out. Be specific — managers review this daily.</p>
                        </div>

                        <button type="submit"
                          disabled={clockingOut || !summaryNotes.trim()}
                          className="btn-danger w-full py-4 text-base">
                          {clockingOut
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Clocking out…</>
                            : <><Square className="w-5 h-5" /> Clock Out & Submit Log</>
                          }
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ── HISTORY TAB ── */}
                {activeTab === 'history' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-stone-700">My Timesheet History</h3>
                      <button onClick={fetchLogs} className="btn-secondary py-1.5 px-3 text-xs">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                      </button>
                    </div>
                    {loading ? (
                      <div className="text-center py-8 text-stone-400 text-sm">Loading logs…</div>
                    ) : logs.length === 0 ? (
                      <div className="text-center py-8 text-stone-400 text-sm">No logs yet. Clock in to start tracking.</div>
                    ) : (
                      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                        {logs.map(log => (
                          <div key={log.id} className="rounded-xl border border-stone-200 p-3.5 bg-white hover:bg-stone-50 transition">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-stone-700">{formatDate(log.log_date)}</p>
                                <p className="text-xs text-stone-500 mt-0.5">
                                  {formatTime(log.clock_in_time)} – {formatTime(log.clock_out_time)}
                                  {log.clock_in_time && log.clock_out_time && (
                                    <span className="ml-2 font-mono text-stone-600">{formatDuration(log.clock_in_time, log.clock_out_time)}</span>
                                  )}
                                </p>
                                {log.clock_in_lat && (
                                  <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {log.clock_in_lat.toFixed(4)}, {log.clock_in_long?.toFixed(4)}
                                    {log.distance_meters && ` · ${Math.round(log.distance_meters)}m from hub`}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`badge ${statusColor(log.status)}`}>{log.status}</span>
                                <span className="text-xs text-stone-400">{workModeLabel(log.work_mode)}</span>
                                {log.geofence_verified
                                  ? <span className="text-xs text-emerald-600">✓ GPS verified</span>
                                  : <span className="text-xs text-red-500">✗ Unverified</span>
                                }
                              </div>
                            </div>
                            {log.daily_summary_notes && (
                              <p className="text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100 line-clamp-2">{log.daily_summary_notes}</p>
                            )}
                            {log.flagged_reason && (
                              <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{log.flagged_reason}</p>
                            )}
                            {log.is_offline_cached && (
                              <span className="badge bg-amber-50 text-amber-700 border-amber-200 mt-1"><WifiOff className="w-3 h-3" />Offline cached</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── CORRECTION TAB ── */}
                {activeTab === 'correction' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-semibold text-stone-700">Request Time Correction</h3>
                      <p className="text-xs text-stone-500 mt-0.5">Submit a correction for a missed or incorrect clock-in/out. Your manager will review it.</p>
                    </div>

                    {corrSuccess && (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm">
                        <CheckCircle className="w-4 h-4" /> Request submitted! Your manager will review it shortly.
                      </div>
                    )}

                    <form onSubmit={handleCorrectionSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Date</label>
                          <input type="date" className="input" value={corrDate}
                            onChange={e => setCorrDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]} required />
                        </div>
                        <div>
                          <label className="label">Work Mode</label>
                          <select className="input" value={corrMode} onChange={e => setCorrMode(e.target.value as WorkMode)}>
                            <option value="on_site">On-Site</option>
                            <option value="field">Field</option>
                            <option value="remote">Remote</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Correct Clock In Time</label>
                          <input type="time" className="input" value={corrIn} onChange={e => setCorrIn(e.target.value)} required />
                        </div>
                        <div>
                          <label className="label">Correct Clock Out Time</label>
                          <input type="time" className="input" value={corrOut} onChange={e => setCorrOut(e.target.value)} required />
                        </div>
                      </div>
                      <div>
                        <label className="label">Justification <span className="text-red-500">*</span></label>
                        <textarea className="input min-h-[100px] resize-none"
                          placeholder="Explain why this correction is needed (e.g. forgot to clock in, phone died, system error)…"
                          value={corrReason} onChange={e => setCorrReason(e.target.value)} required />
                      </div>
                      <button type="submit" disabled={corrSaving || !corrReason.trim()} className="btn-primary w-full">
                        {corrSaving
                          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</>
                          : <><Send className="w-4 h-4" />Submit Correction Request</>
                        }
                      </button>
                    </form>

                    {corrections.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Past Requests</h4>
                        <div className="space-y-2 max-h-[320px] overflow-y-auto">
                          {corrections.map(c => (
                            <div key={c.id} className="rounded-xl border border-stone-200 p-3 bg-white text-xs">
                              <div className="flex justify-between">
                                <span className="font-semibold">{formatDate(c.request_date)}</span>
                                <span className={`badge ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                  {c.status}
                                </span>
                              </div>
                              <p className="text-stone-500 mt-1 line-clamp-2">{c.justification}</p>
                              {c.review_notes && <p className="text-stone-400 mt-1 italic">Review note: {c.review_notes}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

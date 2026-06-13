import { useState, useEffect, useCallback } from 'react'
import {
  Users, CheckCircle, AlertTriangle, Clock,
  MapPin, RefreshCw, ThumbsUp, ThumbsDown, Filter
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { formatDate, formatTime, formatDuration, workModeLabel, statusColor } from '../../lib/utils'
import type { TimeLog, CorrectionRequest, Profile } from '../../types'
import Header from '../shared/Header'

type EnrichedLog = TimeLog & { profileData?: Profile }
type EnrichedCorrection = CorrectionRequest & { profileData?: Profile }

export default function ManagerDashboard() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<EnrichedLog[]>([])
  const [corrections, setCorrections] = useState<EnrichedCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'logs' | 'corrections'>('logs')
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStatus, setFilterStatus] = useState('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 3500) }

  const fetchData = useCallback(async () => {
    setLoading(true)
    // Fetch logs and profiles SEPARATELY — no join needed
    const [{ data: logData }, { data: corrData }, { data: profileData }] = await Promise.all([
      supabase.from('time_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('correction_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])

    const profileMap: Record<string, Profile> = {}
    ;(profileData ?? []).forEach((p: Profile) => { profileMap[p.user_id] = p })

    if (logData) setLogs((logData as TimeLog[]).map(l => ({ ...l, profileData: profileMap[l.user_id] })))
    if (corrData) setCorrections((corrData as CorrectionRequest[]).map(c => ({ ...c, profileData: profileMap[c.user_id] })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const todayLogs = logs.filter(l => l.log_date === filterDate)
  const present = todayLogs.filter(l => l.clock_in_time).length
  const flagged = todayLogs.filter(l => l.status === 'flagged').length
  const pendingCorrections = corrections.filter(c => c.status === 'pending').length

  const filteredLogs = logs.filter(l => {
    if (filterDate && l.log_date !== filterDate) return false
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    return true
  })

  const handleApproveLog = async (logId: string) => {
    setActionLoading(logId)
    await supabase.from('time_logs').update({ status: 'verified' }).eq('id', logId)
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'verified' } : l))
    setActionLoading(null); showMsg('Log verified.')
  }

  const handleFlagLog = async (logId: string) => {
    setActionLoading(logId)
    await supabase.from('time_logs').update({ status: 'flagged' }).eq('id', logId)
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'flagged' } : l))
    setActionLoading(null); showMsg('Log flagged.')
  }

  const handleApproveCorrection = async (corrId: string) => {
    setActionLoading(corrId)
    await supabase.from('correction_requests').update({ status: 'approved', reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq('id', corrId)
    setCorrections(prev => prev.map(c => c.id === corrId ? { ...c, status: 'approved' } : c))
    setActionLoading(null); showMsg('Correction approved.')
  }

  const handleRejectCorrection = async (corrId: string, notes: string) => {
    setActionLoading(corrId)
    await supabase.from('correction_requests').update({ status: 'rejected', reviewed_by: user!.id, reviewed_at: new Date().toISOString(), review_notes: notes }).eq('id', corrId)
    setCorrections(prev => prev.map(c => c.id === corrId ? { ...c, status: 'rejected' } : c))
    setActionLoading(null); showMsg('Correction rejected.')
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {msg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4" />{msg}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Present Today', value: present, icon: Users, color: 'text-brand-700', bg: 'bg-brand-50 border-brand-200' },
            { label: 'Flagged Logs', value: flagged, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: 'Pending Corrections', value: pendingCorrections, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Total Logs Today', value: todayLogs.length, icon: CheckCircle, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className={`card p-4 border ${stat.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium">{stat.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 opacity-30 ${stat.color}`} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card overflow-hidden">
          <div className="flex border-b border-stone-100">
            {[
              { id: 'logs', label: 'Team Logs', icon: Clock },
              { id: 'corrections', label: `Corrections${pendingCorrections ? ` (${pendingCorrections})` : ''}`, icon: CheckCircle },
            ].map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id as 'logs' | 'corrections')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all ${activeTab === t.id ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}>
                  <Icon className="w-4 h-4" />{t.label}
                </button>
              )
            })}
          </div>

          <div className="p-5">
            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Filter className="w-4 h-4 text-stone-400" />
                  <input type="date" className="input py-1.5 w-auto" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                  <select className="input py-1.5 w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="flagged">Flagged</option>
                    <option value="corrected">Corrected</option>
                  </select>
                  <button onClick={fetchData} className="btn-secondary py-1.5 px-3 text-xs ml-auto">
                    <RefreshCw className="w-3.5 h-3.5" />Refresh
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-10 text-stone-400 text-sm">Loading team logs…</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 text-sm">No logs found for selected filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-100">
                          {['Employee', 'Date', 'Mode', 'Clock In', 'Clock Out', 'Duration', 'Status', 'Location', 'Actions'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wider py-2.5 px-2 first:pl-0">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {filteredLogs.map(log => (
                          <tr key={log.id} className={`hover:bg-stone-50 transition ${log.status === 'flagged' ? 'bg-red-50/40' : ''}`}>
                            <td className="py-3 px-2 first:pl-0">
                              <p className="font-medium text-stone-700">{log.profileData?.name ?? '—'}</p>
                              <p className="text-xs text-stone-400">{log.profileData?.position ?? log.profileData?.department}</p>
                            </td>
                            <td className="py-3 px-2 text-xs text-stone-500 whitespace-nowrap">{formatDate(log.log_date)}</td>
                            <td className="py-3 px-2">
                              <span className="badge bg-stone-100 text-stone-600 border-stone-200">{workModeLabel(log.work_mode)}</span>
                            </td>
                            <td className="py-3 px-2 font-mono text-xs">{formatTime(log.clock_in_time)}</td>
                            <td className="py-3 px-2 font-mono text-xs">{formatTime(log.clock_out_time)}</td>
                            <td className="py-3 px-2 font-mono text-xs text-stone-500">
                              {log.clock_in_time && log.clock_out_time ? formatDuration(log.clock_in_time, log.clock_out_time) : '—'}
                            </td>
                            <td className="py-3 px-2">
                              <div className="space-y-1">
                                <span className={`badge ${statusColor(log.status)}`}>{log.status}</span>
                                {log.status === 'flagged' && log.flagged_reason && (
                                  <p className="text-xs text-red-500 max-w-[140px] truncate" title={log.flagged_reason}>
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />{log.flagged_reason}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2 text-xs text-stone-400">
                              {log.clock_in_lat ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {log.clock_in_lat.toFixed(4)}, {log.clock_in_long?.toFixed(4)}
                                  {log.distance_meters && <span className="ml-1 text-stone-300">({log.distance_meters}m)</span>}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-3 px-2">
                              {log.status === 'pending' || log.status === 'flagged' ? (
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleApproveLog(log.id)} disabled={actionLoading === log.id}
                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200" title="Verify">
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleFlagLog(log.id)} disabled={actionLoading === log.id}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" title="Flag">
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : <span className="text-xs text-stone-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'corrections' && (
              <div className="space-y-3">
                <h3 className="font-semibold text-stone-700">Correction Requests</h3>
                {corrections.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 text-sm">No correction requests.</div>
                ) : corrections.map(c => (
                  <CorrectionCard key={c.id} correction={c} actionLoading={actionLoading}
                    onApprove={() => handleApproveCorrection(c.id)}
                    onReject={(notes) => handleRejectCorrection(c.id, notes)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CorrectionCard({ correction, actionLoading, onApprove, onReject }: {
  correction: EnrichedCorrection
  actionLoading: string | null
  onApprove: () => void
  onReject: (notes: string) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  return (
    <div className={`rounded-2xl border p-4 ${correction.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-700 text-sm">{correction.profileData?.name ?? 'Unknown'}</p>
          <p className="text-xs text-stone-400">{formatDate(correction.request_date)} · {workModeLabel(correction.requested_work_mode)}</p>
          <p className="text-xs text-stone-500 mt-1.5">{correction.justification}</p>
        </div>
        <span className={`badge shrink-0 ${correction.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : correction.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {correction.status}
        </span>
      </div>
      {correction.status === 'pending' && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          {!rejecting ? (
            <div className="flex gap-2">
              <button onClick={onApprove} disabled={actionLoading === correction.id} className="btn-primary py-1.5 px-4 text-xs">
                <ThumbsUp className="w-3.5 h-3.5" />Approve
              </button>
              <button onClick={() => setRejecting(true)} className="btn-danger py-1.5 px-4 text-xs">
                <ThumbsDown className="w-3.5 h-3.5" />Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input className="input text-xs py-2" placeholder="Reason for rejection (optional)…" value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => { onReject(rejectNote); setRejecting(false) }} disabled={actionLoading === correction.id} className="btn-danger py-1.5 px-4 text-xs">Confirm Reject</button>
                <button onClick={() => setRejecting(false)} className="btn-secondary py-1.5 px-4 text-xs">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {correction.review_notes && <p className="text-xs text-stone-400 mt-2 italic">Note: {correction.review_notes}</p>}
    </div>
  )
}

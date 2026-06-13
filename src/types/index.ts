export type AppRole = 'employee' | 'manager' | 'admin'
export type WorkMode = 'on_site' | 'field' | 'remote'
export type LogStatus = 'pending' | 'verified' | 'flagged' | 'corrected'
export type CorrectionStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  user_id: string
  name: string
  email: string
  department: string | null
  default_work_mode: WorkMode
  default_hub_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  position: string | null
  role?: AppRole
}

export interface GeofenceHub {
  id: string
  location_name: string
  latitude: number
  longitude: number
  radius_meters: number
  created_at: string
  updated_at: string
}

export interface TimeLog {
  id: string
  user_id: string
  log_date: string
  work_mode: WorkMode
  hub_id: string | null
  clock_in_time: string | null
  clock_out_time: string | null
  clock_in_lat: number | null
  clock_in_long: number | null
  clock_in_accuracy: number | null
  clock_out_lat: number | null
  clock_out_long: number | null
  clock_out_accuracy: number | null
  geofence_verified: boolean
  distance_meters: number | null
  daily_summary_notes: string | null
  status: LogStatus
  correction_notes: string | null
  is_offline_cached: boolean
  flagged_reason: string | null
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface CorrectionRequest {
  id: string
  user_id: string
  log_id: string | null
  request_date: string
  requested_work_mode: WorkMode
  requested_in_time: string | null
  requested_out_time: string | null
  justification: string
  status: CorrectionStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  profile?: Profile
}

export interface GPSPosition {
  lat: number
  lng: number
  accuracy: number
}

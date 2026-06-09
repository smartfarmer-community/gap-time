import type { GeofenceHub, GPSPosition } from '../types'

// Haversine formula — accounts for Earth's curvature, reliable to ~1m
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getNearestHub(
  pos: GPSPosition,
  hubs: GeofenceHub[]
): { hub: GeofenceHub; distance: number; isInside: boolean } | null {
  if (!hubs.length) return null
  let nearest: GeofenceHub | null = null
  let minDist = Infinity
  for (const hub of hubs) {
    const d = haversineDistance(pos.lat, pos.lng, hub.latitude, hub.longitude)
    if (d < minDist) { minDist = d; nearest = hub }
  }
  if (!nearest) return null
  return {
    hub: nearest,
    distance: Math.round(minDist),
    isInside: minDist <= nearest.radius_meters,
  }
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres}m`
  return `${(metres / 1000).toFixed(2)}km`
}

export function formatDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const ms = Math.max(0, end - start)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatTime(iso: string | null): string {
  if (!iso) return '--:--'
  return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function workModeLabel(mode: string): string {
  return mode === 'on_site' ? 'On-Site' : mode === 'field' ? 'Field' : 'Remote'
}

export function statusColor(status: string): string {
  switch (status) {
    case 'verified':  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    case 'flagged':   return 'text-red-700 bg-red-50 border-red-200'
    case 'corrected': return 'text-blue-700 bg-blue-50 border-blue-200'
    default:          return 'text-amber-700 bg-amber-50 border-amber-200'
  }
}

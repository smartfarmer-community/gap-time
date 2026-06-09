import { useEffect, useRef } from 'react'
import type { GeofenceHub, GPSPosition } from '../../types'
import { formatDistance } from '../../lib/utils'

interface GISMapProps {
  position: GPSPosition | null
  hubs: GeofenceHub[]
  nearestHub?: { hub: GeofenceHub; distance: number; isInside: boolean } | null
  height?: string
}

export default function GISMap({ position, hubs, nearestHub, height = '280px' }: GISMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const accuracyCircleRef = useRef<any>(null)
  const initialised = useRef(false)

  // Init map once
  useEffect(() => {
    if (initialised.current || !mapRef.current) return
    initialised.current = true

    import('leaflet').then(L => {
      if (!mapRef.current || mapInstance.current) return

      // Default to Kumasi if no GPS yet
      const center: [number, number] = position
        ? [position.lat, position.lng]
        : [6.71282, -1.59829]

      const map = L.map(mapRef.current, {
        center,
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      mapInstance.current = map

      // Draw geofence hubs
      hubs.forEach(hub => {
        // Boundary circle
        L.circle([hub.latitude, hub.longitude], {
          radius: hub.radius_meters,
          color: '#15803d',
          fillColor: '#22c55e',
          fillOpacity: 0.10,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map)

        // Centre dot
        L.circleMarker([hub.latitude, hub.longitude], {
          radius: 5,
          color: '#15803d',
          fillColor: '#16a34a',
          fillOpacity: 1,
          weight: 2,
        }).bindPopup(`<b>${hub.location_name}</b><br>Radius: ${hub.radius_meters}m`)
          .addTo(map)

        // Label
        L.marker([hub.latitude, hub.longitude], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:white;border:1.5px solid #15803d;border-radius:6px;padding:2px 7px;font-size:10px;font-family:sans-serif;color:#15803d;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.15)">${hub.location_name}</div>`,
            iconAnchor: [0, -18],
          }),
        }).addTo(map)
      })

      // User position marker
      if (position) {
        userMarkerRef.current = L.circleMarker([position.lat, position.lng], {
          radius: 9, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3,
        }).bindPopup('You are here').addTo(map)

        accuracyCircleRef.current = L.circle([position.lat, position.lng], {
          radius: position.accuracy,
          color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1,
        }).addTo(map)

        map.setView([position.lat, position.lng], 16)
      }
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        userMarkerRef.current = null
        accuracyCircleRef.current = null
        initialised.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubs.length]) // re-init if hubs change

  // Live update position
  useEffect(() => {
    if (!mapInstance.current || !position) return
    import('leaflet').then(L => {
      const map = mapInstance.current
      if (!map) return

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([position.lat, position.lng])
      } else {
        userMarkerRef.current = L.circleMarker([position.lat, position.lng], {
          radius: 9, color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3,
        }).bindPopup('You are here').addTo(map)
      }

      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([position.lat, position.lng])
        accuracyCircleRef.current.setRadius(position.accuracy)
      } else {
        accuracyCircleRef.current = L.circle([position.lat, position.lng], {
          radius: position.accuracy,
          color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1,
        }).addTo(map)
      }
    })
  }, [position?.lat, position?.lng, position?.accuracy])

  return (
    <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-100" style={{ height }}>
      {/* Overlay bar */}
      <div className="absolute z-10 top-2 left-2 right-2 pointer-events-none">
        <div className="bg-white/90 backdrop-blur rounded-xl px-3 py-1.5 text-xs flex items-center justify-between shadow-sm border border-stone-200">
          <span className="font-semibold text-stone-500 uppercase tracking-wider text-[10px]">Live GIS Boundary Map</span>
          {nearestHub ? (
            <span className={`font-semibold ${nearestHub.isInside ? 'text-emerald-600' : 'text-red-600'}`}>
              {nearestHub.isInside ? '✓' : '✗'} {formatDistance(nearestHub.distance)} from {nearestHub.hub.location_name.split(' ')[0]}
            </span>
          ) : (
            <span className="text-stone-400">Acquiring GPS…</span>
          )}
        </div>
      </div>
      <div ref={mapRef} style={{ height, width: '100%' }} />
    </div>
  )
}

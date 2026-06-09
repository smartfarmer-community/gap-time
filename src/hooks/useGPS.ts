import { useEffect, useState, useRef } from 'react'
import type { GPSPosition } from '../types'

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'loading'

export function useGPS() {
  const [position, setPosition] = useState<GPSPosition | null>(null)
  const [permissionState, setPermissionState] = useState<PermissionState>('loading')
  const [error, setError] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)

  const start = () => {
    if (!navigator.geolocation) {
      setPermissionState('denied')
      setError('Geolocation is not supported by this browser.')
      return
    }
    setPermissionState('loading')
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setPermissionState('granted')
        setError(null)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied')
          setError('Location access was denied. Please enable GPS in your browser settings.')
        } else {
          setError(err.message || 'Location unavailable.')
          setPermissionState('granted')
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    )
  }

  useEffect(() => {
    start()
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }
  }, [])

  return { position, permissionState, error, requestPermission: start }
}

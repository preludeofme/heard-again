import { task, metadata, logger as triggerLogger } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'

export interface GeocodePlacesTaskPayload {
  familyspaceId: string
}

export interface GeocodePlacesTaskOutput {
  uniquePlaces: number
  geocoded: number
  failed: number
  eventsUpdated: number
}

interface GeocodeResult {
  lat: number
  lng: number
}

interface GoogleGeocodeResponse {
  status: string
  results: Array<{
    geometry: {
      location: { lat: number; lng: number }
    }
  }>
}

async function geocodePlace(place: string, apiKey: string): Promise<GeocodeResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', place)
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) return null

  const data = (await res.json()) as GoogleGeocodeResponse
  if (data.status !== 'OK' || !data.results[0]) return null

  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng }
}

const DELAY_MS = 110 // ~9 QPS — well under the 50 QPS limit but safe for free tier

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const geocodePlacesTask = task({
  id: 'geocode-places',
  maxDuration: 3600,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: GeocodePlacesTaskPayload): Promise<GeocodePlacesTaskOutput> => {
    const { familyspaceId } = payload

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      triggerLogger.warn('GOOGLE_MAPS_API_KEY not set — skipping geocoding', { familyspaceId })
      return { uniquePlaces: 0, geocoded: 0, failed: 0, eventsUpdated: 0 }
    }

    // Find all unique place strings that have no coordinates yet
    const rows = await prisma.personEvent.findMany({
      where: {
        person: { familyspaceId },
        place: { not: null },
        latitude: null,
      },
      select: { place: true },
      distinct: ['place'],
    })

    const uniquePlaces = rows.map((r) => r.place as string)
    triggerLogger.info('Starting geocoding', { familyspaceId, uniquePlaces: uniquePlaces.length })
    metadata.set('phase', 'geocoding')
    metadata.set('total', uniquePlaces.length)

    let geocoded = 0
    let failed = 0
    let eventsUpdated = 0

    // Build a cache: place string → coordinates
    const cache = new Map<string, GeocodeResult>()

    for (let i = 0; i < uniquePlaces.length; i++) {
      const place = uniquePlaces[i]
      metadata.set('progress', { done: i, total: uniquePlaces.length })

      const result = await geocodePlace(place, apiKey)

      if (result) {
        cache.set(place, result)
        geocoded++

        const { count } = await prisma.personEvent.updateMany({
          where: {
            person: { familyspaceId },
            place,
            latitude: null,
          },
          data: {
            latitude: result.lat,
            longitude: result.lng,
          },
        })
        eventsUpdated += count
        triggerLogger.info(`Geocoded "${place}" → ${result.lat}, ${result.lng} (${count} events)`)
      } else {
        failed++
        triggerLogger.warn(`Failed to geocode "${place}"`)
      }

      // Rate-limit: don't hammer the API
      if (i < uniquePlaces.length - 1) {
        await sleep(DELAY_MS)
      }
    }

    metadata.set('phase', 'complete')
    triggerLogger.info('Geocoding complete', { familyspaceId, geocoded, failed, eventsUpdated })

    return { uniquePlaces: uniquePlaces.length, geocoded, failed, eventsUpdated }
  },
})

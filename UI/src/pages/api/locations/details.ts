import { apiHandler, Errors, successResponse } from '@/lib/api-helpers'

interface AddressComponent {
  longText: string
  shortText: string
  types: string[]
}

interface NewPlaceDetailsResponse {
  location?: { latitude: number; longitude: number }
  addressComponents?: AddressComponent[]
  error?: { message: string; status: string }
}

interface LocationDetails {
  city: string
  state: string
  lat: number
  lng: number
}

export default apiHandler(
  {
    GET: async (req, res): Promise<void> => {
      const placeId = typeof req.query.placeId === 'string' ? req.query.placeId.trim() : ''

      if (!placeId) {
        throw Errors.badRequest('placeId is required')
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        throw Errors.internal('Location service not configured')
      }

      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'location,addressComponents',
        },
      })

      if (!response.ok) {
        throw Errors.internal('Location service unavailable')
      }

      const data = (await response.json()) as NewPlaceDetailsResponse
      if (data.error || !data.location) {
        throw Errors.notFound('Place')
      }

      const components = data.addressComponents ?? []
      const locality = components.find((c) => c.types.includes('locality'))
      const militaryInstall = components.find((c) => c.types.includes('military_installation'))
      const colloquial = components.find((c) => c.types.includes('colloquial_area'))
      const sublocality = components.find((c) => c.types.includes('sublocality'))
      const neighborhood = components.find((c) => c.types.includes('neighborhood'))
      const establishment = components.find((c) => c.types.includes('establishment'))
      const adminArea = components.find((c) => c.types.includes('administrative_area_level_1'))

      let cityText = locality?.longText ?? ''
      if (!cityText) {
        if (militaryInstall) {
          cityText = militaryInstall.longText
        } else if (colloquial) {
          cityText = colloquial.longText
        } else if (sublocality) {
          cityText = sublocality.longText
        } else if (neighborhood) {
          cityText = neighborhood.longText
        } else if (establishment) {
          cityText = establishment.longText
        } else if (components.length > 0) {
          const first = components[0]
          if (
            !first.types.includes('country') &&
            !first.types.includes('administrative_area_level_1') &&
            !first.types.includes('postal_code')
          ) {
            cityText = first.longText
          }
        }
      }

      const details: LocationDetails = {
        city: cityText,
        state: adminArea?.shortText ?? '',
        lat: data.location.latitude,
        lng: data.location.longitude,
      }

      return successResponse<LocationDetails>(res, details)
    },
  },
  { csrf: false }
)

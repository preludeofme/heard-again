import { apiHandler, Errors, successResponse } from '@/lib/api-helpers'

interface PlacePredictionText {
  text: string
}

interface StructuredFormat {
  mainText: PlacePredictionText
  secondaryText: PlacePredictionText
}

interface PlacePrediction {
  placeId: string
  text: PlacePredictionText
  structuredFormat: StructuredFormat
}

interface Suggestion {
  placePrediction: PlacePrediction
}

interface NewPlacesAutocompleteResponse {
  suggestions?: Suggestion[]
  error?: { message: string; status: string }
}

interface LocationSuggestion {
  placeId: string
  displayText: string
  city: string
  state: string
}

interface AutocompleteResult {
  suggestions: LocationSuggestion[]
}

function parseSuggestion(s: Suggestion): LocationSuggestion {
  const pred = s.placePrediction
  const city = pred.structuredFormat?.mainText?.text ?? ''
  // secondaryText is typically "IL, USA" — grab the first part before the comma
  const secondary = pred.structuredFormat?.secondaryText?.text ?? ''
  const state = secondary.split(',')[0]?.trim() ?? ''
  return {
    placeId: pred.placeId,
    displayText: pred.text?.text ?? '',
    city,
    state,
  }
}

export default apiHandler(
  {
    GET: async (req, res): Promise<void> => {
      const input = typeof req.query.input === 'string' ? req.query.input.trim() : ''

      if (input.length < 2) {
        return successResponse<AutocompleteResult>(res, { suggestions: [] })
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        return successResponse<AutocompleteResult>(res, { suggestions: [] })
      }

      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
          input,
          // No includedPrimaryTypes filter — accepts cities, military bases, landmarks, neighborhoods, etc.
          languageCode: 'en',
        }),
      })

      if (!response.ok) {
        throw Errors.internal('Location service unavailable')
      }

      const data = (await response.json()) as NewPlacesAutocompleteResponse
      if (data.error) {
        throw Errors.internal('Location service error')
      }

      const suggestions = (data.suggestions ?? []).map(parseSuggestion)
      return successResponse<AutocompleteResult>(res, { suggestions })
    },
  },
  { csrf: false }
)

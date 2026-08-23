// =====================================
// MODULE: Google Places Provider
// Purpose: Otel koordinat/adres/puan/yorum sayisi icin 1. tercih saglayici
// Dependencies: config/env, core/logger, core/retry, hotelData/types
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { optionalEnv } from '../config/env.js';
import { Logger } from '../core/logger.js';
import { withRetry } from '../core/retry.js';
import { TIMEOUTS } from '../config/constants.js';
import type { HotelDataProvider, HotelFacts } from './types.js';

interface FindPlaceResponse {
  candidates?: Array<{ place_id: string }>;
  status: string;
}

interface PlaceDetailsResponse {
  result?: {
    geometry?: { location?: { lat: number; lng: number } };
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
  };
  status: string;
}

async function findPlaceId(apiKey: string, query: string): Promise<string | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
  if (!response.ok) throw new Error(`Places findplacefromtext HTTP ${response.status}`);

  const data = (await response.json()) as FindPlaceResponse;
  return data.candidates?.[0]?.place_id ?? null;
}

async function fetchDetails(apiKey: string, placeId: string): Promise<PlaceDetailsResponse['result']> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'geometry,formatted_address,rating,user_ratings_total');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
  if (!response.ok) throw new Error(`Places details HTTP ${response.status}`);

  const data = (await response.json()) as PlaceDetailsResponse;
  return data.result;
}

export const googlePlacesProvider: HotelDataProvider = {
  name: 'Google Places',

  async fetchFacts(hotelName: string, city: string): Promise<Partial<HotelFacts>> {
    const apiKey = optionalEnv('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      Logger.debug('GOOGLE_PLACES_API_KEY tanimli degil - Google Places atlaniyor');
      return {};
    }

    try {
      const facts: Partial<HotelFacts> = {};
      const now = new Date().toISOString();

      const placeId = await withRetry(() => findPlaceId(apiKey, `${hotelName} ${city}`), {
        label: 'Google Places findPlace',
      });
      if (!placeId) {
        Logger.warn(`Google Places: "${hotelName}" icin place bulunamadi`);
        return {};
      }

      const details = await withRetry(() => fetchDetails(apiKey, placeId), { label: 'Google Places details' });
      if (!details) return {};

      if (details.geometry?.location) {
        facts.lat = { value: details.geometry.location.lat, source: 'Google Places', fetchedAt: now };
        facts.lon = { value: details.geometry.location.lng, source: 'Google Places', fetchedAt: now };
      }
      if (details.formatted_address) {
        facts.address = { value: details.formatted_address, source: 'Google Places', fetchedAt: now };
      }
      if (typeof details.rating === 'number') {
        facts.rating = { value: details.rating, source: 'Google Places', fetchedAt: now };
      }
      if (typeof details.user_ratings_total === 'number') {
        facts.reviewCount = { value: details.user_ratings_total, source: 'Google Places', fetchedAt: now };
      }

      Logger.success(`Google Places: ${Object.keys(facts).length} alan dolduruldu (${hotelName})`);
      return facts;
    } catch (error) {
      Logger.warn(`Google Places basarisiz (${hotelName}) - zincirde ilerleniyor`, error);
      return {};
    }
  },
};

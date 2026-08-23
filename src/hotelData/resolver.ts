// =====================================
// MODULE: Hotel Data Resolver
// Purpose: Saglayici zincirini sirayla dener, ilk dolduran alani kazanir, 30 gun cache'ler
// Dependencies: core/db, core/logger, config/constants, hotelData/*
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { HOTEL_DATA } from '../config/constants.js';
import { googlePlacesProvider } from './googlePlaces.js';
import { holidaycheckProvider } from './holidaycheckScraper.js';
import { bookingProvider } from './bookingScraper.js';
import { manualSheetProvider } from './manualSheet.js';
import type { HotelDataProvider, HotelFacts, HotelFactKey } from './types.js';

/**
 * Alan bazli oncelik sirasi (plandaki tablo, EK "Bilinmesi gereken kısıtlar" B2):
 * Google Places -> HolidayCheck -> Booking.com -> elle. Her saglayici tum zinciri
 * dener ama sadece BOS alanlari doldurur - daha once dolan bir alanin uzerine yazmaz.
 */
const CHAIN: HotelDataProvider[] = [googlePlacesProvider, holidaycheckProvider, bookingProvider, manualSheetProvider];

interface HotelRow {
  id: number;
  name: string;
  place_key: string;
  lat: number | null;
  lon: number | null;
  fields_json: string;
  fetched_at: string;
}

function placeKey(hotelName: string, city: string): string {
  return `${hotelName.toLowerCase().trim()}|${city.toLowerCase().trim()}`;
}

function isFresh(fetchedAt: string): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs < HOTEL_DATA.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function mergeFacts(base: HotelFacts, addition: Partial<HotelFacts>): HotelFacts {
  const merged = { ...base };
  for (const [key, value] of Object.entries(addition) as Array<[HotelFactKey, HotelFacts[HotelFactKey]]>) {
    if (value === undefined) continue;
    if (merged[key] !== undefined) continue; // ilk dolduran kazanir - sonraki saglayici uzerine yazmaz
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/**
 * Bir otel icin bilinen tum gercekleri dondurur: once DB cache (30 gun taze),
 * yoksa saglayici zincirini sirayla dener ve sonucu DB'ye yazar.
 * @param hotelName Otel adi (kullanicidan/batch girdisinden)
 * @param city Sehir - arama sorgusuna eklenir
 * @returns Eksik alanlar hic yer almaz - ekranda uydurma deger basilmasin diye
 */
export async function resolveHotelFacts(hotelName: string, city: string): Promise<HotelFacts> {
  const db = getDb();
  const key = placeKey(hotelName, city);

  const existing = db.prepare('SELECT * FROM hotel WHERE place_key = ?').get(key) as HotelRow | undefined;
  if (existing && isFresh(existing.fetched_at)) {
    Logger.debug(`Otel verisi cache'den (${HOTEL_DATA.CACHE_TTL_DAYS} gun taze): ${hotelName}`);
    return JSON.parse(existing.fields_json) as HotelFacts;
  }

  Logger.info(`Otel verisi cekiliyor: ${hotelName}, ${city}`);

  let facts: HotelFacts = existing ? (JSON.parse(existing.fields_json) as HotelFacts) : {};
  const missingBefore = Object.keys(facts).length;

  for (const provider of CHAIN) {
    try {
      const partial = await provider.fetchFacts(hotelName, city);
      facts = mergeFacts(facts, partial);
    } catch (error) {
      Logger.warn(`${provider.name} beklenmedik hata verdi - zincirde ilerleniyor`, error);
    }
  }

  const filledCount = Object.keys(facts).length;
  Logger.success(
    `Otel verisi tamam: ${hotelName} - ${filledCount} alan dolu (onceki: ${missingBefore})`,
  );

  const lat = facts.lat?.value ?? existing?.lat ?? null;
  const lon = facts.lon?.value ?? existing?.lon ?? null;

  if (existing) {
    db.prepare('UPDATE hotel SET fields_json=?, lat=?, lon=?, fetched_at=datetime(?) WHERE id=?').run(
      JSON.stringify(facts),
      lat,
      lon,
      new Date().toISOString(),
      existing.id,
    );
  } else {
    db.prepare(
      'INSERT INTO hotel (name, place_key, lat, lon, fields_json, fetched_at) VALUES (?, ?, ?, ?, ?, datetime(?))',
    ).run(hotelName, key, lat, lon, JSON.stringify(facts), new Date().toISOString());
  }

  return facts;
}

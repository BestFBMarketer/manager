// =====================================
// MODULE: Manual Sheet Provider
// Purpose: API/scraper ikisi de doldurmadiginda son care - elle girilmis degerler
// Dependencies: core/logger, hotelData/types
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import { readFile } from 'node:fs/promises';
import { Logger } from '../core/logger.js';
import type { HotelDataProvider, HotelFacts, HotelFactKey } from './types.js';

const MANUAL_SHEET_PATH = process.env.HOTEL_MANUAL_SHEET_PATH ?? 'data/hotelManual.json';

type RawManualEntry = Partial<Record<HotelFactKey, number | string | boolean>>;
type ManualSheet = Record<string, RawManualEntry>;

function placeKey(hotelName: string, city: string): string {
  return `${hotelName}|${city}`.toLowerCase().trim();
}

async function loadSheet(): Promise<ManualSheet> {
  try {
    const raw = await readFile(MANUAL_SHEET_PATH, 'utf-8');
    return JSON.parse(raw) as ManualSheet;
  } catch {
    return {};
  }
}

/**
 * Elle giris kaynagi - `data/hotelManual.json`'a `{ "otel adi|sehir": { "roomCount": 42, ... } }`
 * seklinde satir eklenerek doldurulur (kucuk harfe cevrilmis anahtar). API/scraper zincirinin
 * dolduramadigi alanlar icin son care; UI'dan degil dosyadan okunur (kucuk ekip icin yeterli).
 */
export const manualSheetProvider: HotelDataProvider = {
  name: 'Elle girildi',

  async fetchFacts(hotelName: string, city: string): Promise<Partial<HotelFacts>> {
    const sheet = await loadSheet();
    const entry = sheet[placeKey(hotelName, city)];
    if (!entry) return {};

    const now = new Date().toISOString();
    const facts: Partial<HotelFacts> = {};

    for (const [key, value] of Object.entries(entry)) {
      if (value === undefined || value === null) continue;
      (facts as Record<string, unknown>)[key] = { value, source: 'Elle girildi', fetchedAt: now };
    }

    Logger.success(`Elle giris: ${Object.keys(facts).length} alan bulundu (${hotelName})`);
    return facts;
  },
};

// =====================================
// MODULE: Booking.com Scraper
// Purpose: Oda sayisi/kapasite icin fallback (HolidayCheck doldurmadiysa denenir)
// Dependencies: core/logger, core/retry, config/constants, hotelData/types
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import * as cheerio from 'cheerio';
import { Logger } from '../core/logger.js';
import { withRetry } from '../core/retry.js';
import { TIMEOUTS, HOTEL_DATA } from '../config/constants.js';
import type { HotelDataProvider, HotelFacts } from './types.js';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; shorts-factory-bot/0.1)' },
  });
  if (!response.ok) throw new Error(`Booking.com HTTP ${response.status}`);
  return response.text();
}

export const bookingProvider: HotelDataProvider = {
  name: 'Booking.com',

  async fetchFacts(hotelName: string, city: string): Promise<Partial<HotelFacts>> {
    try {
      const searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(`${hotelName} ${city}`)}`;
      const searchHtml = await withRetry(() => fetchHtml(searchUrl), { label: 'Booking.com arama' });
      const $search = cheerio.load(searchHtml);

      const firstResultHref = $search('a[data-testid="title-link"]').first().attr('href');
      if (!firstResultHref) {
        Logger.warn(`Booking.com: "${hotelName}" icin sonuc bulunamadi`);
        return {};
      }

      await delay(HOTEL_DATA.SCRAPE_DELAY_MS);

      const detailUrl = firstResultHref.startsWith('http') ? firstResultHref : `https://www.booking.com${firstResultHref}`;
      const detailHtml = await withRetry(() => fetchHtml(detailUrl), { label: 'Booking.com detay' });
      const $ = cheerio.load(detailHtml);
      const bodyText = $('body').text();

      const facts: Partial<HotelFacts> = {};
      const now = new Date().toISOString();

      // Booking property sayfalarinda oda sayisi genelde "X rooms" seklinde gecer -
      // yapi degisirse eslesme olmaz, facts bos kalir (uydurma yok).
      const roomMatch = bodyText.match(/(\d+)\s*rooms?\b/i);
      if (roomMatch?.[1]) {
        facts.roomCount = { value: Number(roomMatch[1]), source: 'Booking.com', fetchedAt: now };
      }

      const guestMatch = bodyText.match(/(?:max(?:imum)?|fits?)\s*(\d+)\s*(?:guests?|people|persons?)/i);
      if (guestMatch?.[1]) {
        facts.capacity = { value: Number(guestMatch[1]), source: 'Booking.com', fetchedAt: now };
      }

      if (/all[\s-]?inclusive/i.test(bodyText)) {
        facts.allInclusive = { value: true, source: 'Booking.com', fetchedAt: now };
      }

      Logger.success(`Booking.com: ${Object.keys(facts).length} alan dolduruldu (${hotelName})`);
      return facts;
    } catch (error) {
      Logger.warn(`Booking.com scraper basarisiz (${hotelName}) - zincirde ilerleniyor`, error);
      return {};
    }
  },
};

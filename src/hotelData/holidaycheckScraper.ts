// =====================================
// MODULE: HolidayCheck Scraper
// Purpose: Puan/yorum/oneri orani/oda sayisi/her sey dahil icin 2. tercih (Google Places'ta yok)
// Dependencies: core/logger, core/retry, config/constants, hotelData/types
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

import * as cheerio from 'cheerio';
import { Logger } from '../core/logger.js';
import { withRetry } from '../core/retry.js';
import { TIMEOUTS, HOTEL_DATA } from '../config/constants.js';
import type { HotelDataProvider, HotelFacts } from './types.js';

const SEARCH_URL = 'https://www.holidaycheck.de/search';

/**
 * HolidayCheck sayfa yapisi resmi bir API degil - siteyi degistirebilirler,
 * bu adapter o an sessizce bos donmeli, tum zinciri cokertmemeli (Rule 11).
 * robots.txt'e uyum + rate-limit icin istekler arasi HOTEL_DATA.SCRAPE_DELAY_MS beklenir.
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; shorts-factory-bot/0.1)' },
  });
  if (!response.ok) throw new Error(`HolidayCheck HTTP ${response.status}`);
  return response.text();
}

function parseGermanNumber(text: string): number | null {
  const cleaned = text.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export const holidaycheckProvider: HotelDataProvider = {
  name: 'HolidayCheck',

  async fetchFacts(hotelName: string, city: string): Promise<Partial<HotelFacts>> {
    try {
      const searchUrl = `${SEARCH_URL}?q=${encodeURIComponent(`${hotelName} ${city}`)}`;
      const searchHtml = await withRetry(() => fetchHtml(searchUrl), { label: 'HolidayCheck arama' });
      const $search = cheerio.load(searchHtml);

      const firstResultHref = $search('a[href*="/hi/"]').first().attr('href');
      if (!firstResultHref) {
        Logger.warn(`HolidayCheck: "${hotelName}" icin sonuc bulunamadi`);
        return {};
      }

      await delay(HOTEL_DATA.SCRAPE_DELAY_MS);

      const detailUrl = firstResultHref.startsWith('http') ? firstResultHref : `https://www.holidaycheck.de${firstResultHref}`;
      const detailHtml = await withRetry(() => fetchHtml(detailUrl), { label: 'HolidayCheck detay' });
      const $ = cheerio.load(detailHtml);

      const facts: Partial<HotelFacts> = {};
      const now = new Date().toISOString();

      // Site yapisi degisirse bu secici hicbir sey bulamaz - facts bos kalir,
      // resolver zincirdeki bir sonraki saglayiciya veya elle girise duser.
      const ratingText = $('[data-testid="hotel-rating-value"]').first().text().trim();
      const rating = parseGermanNumber(ratingText);
      if (rating !== null) facts.rating = { value: rating, source: 'HolidayCheck', fetchedAt: now };

      const reviewText = $('[data-testid="hotel-review-count"]').first().text().trim();
      const reviewMatch = reviewText.match(/[\d.]+/);
      if (reviewMatch) {
        const reviewCount = parseGermanNumber(reviewMatch[0]);
        if (reviewCount !== null) facts.reviewCount = { value: reviewCount, source: 'HolidayCheck', fetchedAt: now };
      }

      const recommendText = $('[data-testid="hotel-recommend-percent"]').first().text().trim();
      const recommendMatch = recommendText.match(/(\d+)\s*%/);
      if (recommendMatch?.[1]) {
        facts.recommendPercent = { value: Number(recommendMatch[1]), source: 'HolidayCheck', fetchedAt: now };
      }

      const bodyText = $('body').text();
      const roomMatch = bodyText.match(/(\d+)\s*Zimmer/i);
      if (roomMatch?.[1]) {
        facts.roomCount = { value: Number(roomMatch[1]), source: 'HolidayCheck', fetchedAt: now };
      }

      if (/all[\s-]?inclusive/i.test(bodyText)) {
        facts.allInclusive = { value: true, source: 'HolidayCheck', fetchedAt: now };
      }

      Logger.success(`HolidayCheck: ${Object.keys(facts).length} alan dolduruldu (${hotelName})`);
      return facts;
    } catch (error) {
      Logger.warn(`HolidayCheck scraper basarisiz (${hotelName}) - zincirde ilerleniyor`, error);
      return {};
    }
  },
};

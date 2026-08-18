// =====================================
// MODULE: Wikidata
// Purpose: POI'ler icin kisa, kaynakli aciklama metni ceker (ucretsiz)
// Dependencies: config/constants, core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { TIMEOUTS } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import type { PointOfInterest } from './types.js';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIPEDIA_API = 'https://tr.wikipedia.org/api/rest_v1/page/summary';

/** Ekran karti icin metin siniri - uzun metin okunmuyor. */
const MAX_DESCRIPTION_CHARS = 140;

interface WikidataResponse {
  entities?: Record<string, { descriptions?: Record<string, { value?: string }>; sitelinks?: Record<string, { title?: string }> }>;
}

interface WikipediaSummary {
  extract?: string;
}

function trim(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_DESCRIPTION_CHARS) return clean;

  // Cumle sonunda kes - yarim kalan cumle ekranda kotu durur.
  const cut = clean.slice(0, MAX_DESCRIPTION_CHARS);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastStop > 40 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}...`;
}

/**
 * POI'ye kisa aciklama ekler. Once Wikipedia ozeti, yoksa Wikidata aciklamasi denenir.
 * Hicbiri yoksa POI aciklamasiz kalir (uydurma metin uretilmez).
 * @param poi Wikidata kimligi olan ilgi noktasi
 * @returns Aciklama eklenmis kopya
 */
export async function enrichWithDescription(poi: PointOfInterest): Promise<PointOfInterest> {
  if (!poi.wikidataId) return poi;

  try {
    const wdResponse = await fetch(
      `${WIKIDATA_API}?action=wbgetentities&ids=${poi.wikidataId}&props=descriptions|sitelinks&languages=tr|en&format=json&origin=*`,
      { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) },
    );
    if (!wdResponse.ok) return poi;

    const wdData = (await wdResponse.json()) as WikidataResponse;
    const entity = wdData.entities?.[poi.wikidataId];

    // 1. tercih: Turkce Wikipedia ozeti (daha zengin metin)
    const trTitle = entity?.sitelinks?.trwiki?.title;
    if (trTitle) {
      const wpResponse = await fetch(`${WIKIPEDIA_API}/${encodeURIComponent(trTitle)}`, {
        signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
      });
      if (wpResponse.ok) {
        const summary = (await wpResponse.json()) as WikipediaSummary;
        if (summary.extract) {
          return { ...poi, description: trim(summary.extract), descriptionSource: 'Vikipedi' };
        }
      }
    }

    // 2. tercih: Wikidata kisa aciklamasi
    const description = entity?.descriptions?.tr?.value ?? entity?.descriptions?.en?.value;
    if (description) {
      return { ...poi, description: trim(description), descriptionSource: 'Wikidata' };
    }

    return poi;
  } catch (error) {
    Logger.debug(`Aciklama alinamadi: ${poi.name}`, error);
    return poi;
  }
}

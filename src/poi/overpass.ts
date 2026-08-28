// =====================================
// MODULE: Overpass
// Purpose: OpenStreetMap'ten bolgedeki ilgi noktalarini ceker (ucretsiz, anahtar gerektirmez)
// Dependencies: config/constants, core/logger, core/retry
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { POI, TIMEOUTS } from '../config/constants.js';
import { Logger } from '../core/logger.js';
import { withRetry } from '../core/retry.js';
import type { PoiKind, PointOfInterest } from './types.js';

const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

/** OSM etiketi -> ic kategori eslemesi. */
const KIND_QUERIES: Record<PoiKind, string[]> = {
  waterfall: ['["waterway"="waterfall"]'],
  historic: ['["historic"~"^(ruins|archaeological_site|castle|monument|memorial|city_gate|tower)$"]'],
  viewpoint: ['["tourism"="viewpoint"]'],
  natural: ['["natural"~"^(cave_entrance|peak|gorge|spring|cliff)$"]', '["waterway"="river"]'],
  beach: ['["natural"="beach"]', '["leisure"="beach_resort"]'],
  hotel: ['["tourism"="hotel"]'],
};

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Sinir kutusunu her yonde genisletir - ucus izinin biraz disini da tarar. */
export function padBox(box: BoundingBox, km: number): BoundingBox {
  const latDelta = km / 111;
  const midLat = (box.minLat + box.maxLat) / 2;
  const lonDelta = km / (111 * Math.max(0.1, Math.cos((midLat * Math.PI) / 180)));

  return {
    minLat: box.minLat - latDelta,
    maxLat: box.maxLat + latDelta,
    minLon: box.minLon - lonDelta,
    maxLon: box.maxLon + lonDelta,
  };
}

function buildQuery(box: BoundingBox, kinds: PoiKind[]): string {
  const bbox = `${box.minLat},${box.minLon},${box.maxLat},${box.maxLon}`;
  const clauses = kinds.flatMap((kind) =>
    KIND_QUERIES[kind].flatMap((filter) => [
      `node${filter}(${bbox});`,
      `way${filter}(${bbox});`,
    ]),
  );

  return [
    `[out:json][timeout:${Math.floor(TIMEOUTS.HTTP_REQUEST_MS / 1000)}];`,
    '(',
    ...clauses,
    ');',
    `out center ${POI.MAX_RESULTS};`,
  ].join('\n');
}

function toPoi(
  element: OverpassElement,
  kinds: PoiKind[],
  languages: string[],
): PointOfInterest | null {
  const tags = element.tags ?? {};
  // Isim once kanal dilinde aranir (OSM cok dilli isim etiketleri tutar),
  // yoksa yerel isme dusulur.
  const name =
    languages.map((lang) => tags[`name:${lang}`]).find((value) => value) ?? tags.name;
  // Isimsiz noktalar ekranda anlamli bir not uretmez.
  if (!name) return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  const kind = detectKind(tags, kinds);
  if (!kind) return null;

  const poi: PointOfInterest = {
    id: `${element.type ?? 'node'}/${element.id ?? 0}`,
    kind,
    name,
    lat,
    lon,
  };
  if (tags.wikidata) poi.wikidataId = tags.wikidata;
  return poi;
}

function detectKind(tags: Record<string, string>, requested: PoiKind[]): PoiKind | null {
  if (tags.waterway === 'waterfall') return 'waterfall';
  if (tags.historic) return 'historic';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'hotel') return 'hotel';
  if (tags.natural === 'beach' || tags.leisure === 'beach_resort') return 'beach';
  if (tags.natural) return 'natural';
  return requested[0] ?? null;
}

/**
 * Verilen sinir kutusundaki ilgi noktalarini dondurur.
 * @param box Ucus izinden turetilmis sinir kutusu
 * @param kinds Aranacak kategoriler
 * @returns Isimlendirilmis POI listesi (hata durumunda bos dizi)
 */
export async function fetchPois(
  box: BoundingBox,
  kinds: PoiKind[],
  languages: string[] = ['en'],
): Promise<PointOfInterest[]> {
  const query = buildQuery(box, kinds);

  try {
    const response = await withRetry(
      async () => {
        const result = await fetch(OVERPASS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
        });
        // Overpass yogunlukta 429/504 doner - yeniden denemeye deger.
        if (!result.ok) throw new Error(`Overpass HTTP ${result.status}`);
        return result;
      },
      { label: 'Overpass sorgusu' },
    );

    const payload = (await response.json()) as OverpassResponse;
    const pois = (payload.elements ?? [])
      .map((element) => toPoi(element, kinds, languages))
      .filter((poi): poi is PointOfInterest => poi !== null);

    // Ayni yer hem node hem way olarak gelebilir - isme gore tekillestir.
    const unique = new Map<string, PointOfInterest>();
    for (const poi of pois) {
      const key = `${poi.kind}:${poi.name.toLowerCase()}`;
      if (!unique.has(key)) unique.set(key, poi);
    }

    Logger.success(`Overpass: ${unique.size} isimli ilgi noktasi bulundu`);
    return [...unique.values()];
  } catch (error) {
    Logger.warn('Overpass sorgusu basarisiz - POI katmani atlanacak', error);
    return [];
  }
}

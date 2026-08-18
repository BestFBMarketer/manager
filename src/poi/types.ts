// =====================================
// MODULE: POI Types
// Purpose: Ucus bolgesindeki ilgi noktalari icin ortak yapi
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

export type PoiKind =
  | 'waterfall'
  | 'historic'
  | 'viewpoint'
  | 'natural'
  | 'beach'
  | 'hotel';

export interface PointOfInterest {
  /** OSM tipi + id (orn. "node/123456") */
  id: string;
  kind: PoiKind;
  name: string;
  lat: number;
  lon: number;
  /** Wikidata kimligi - kisa aciklama bunun uzerinden gelir */
  wikidataId?: string;
  /** Ekranda gosterilecek 1-2 cumlelik not */
  description?: string;
  /** Aciklamanin kaynagi - ekranda atif olarak basilir */
  descriptionSource?: string;
}

/** POI'nin videoda ne zaman gosterilecegi. */
export interface PoiCue {
  poi: PointOfInterest;
  /** Klip icinde kartin belirecegi an (saniye) */
  atSec: number;
  /** Kartin ekranda kalma suresi */
  durationSec: number;
  /** Drone'un o andaki POI'ye uzakligi (metre) */
  distanceM: number;
}

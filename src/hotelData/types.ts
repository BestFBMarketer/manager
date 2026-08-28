// =====================================
// MODULE: Hotel Data Types
// Purpose: Saglayici zincirinin ortak sozlesmesi - her alan {value, source, fetchedAt}
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

export interface SourcedValue<T> {
  value: T;
  /** Ekranda "Kaynak: ..." atfi olarak gosterilir */
  source: string;
  fetchedAt: string;
}

/**
 * Otel hakkinda bilinen gercekler - her alan opsiyonel ve kaynakli.
 * Bir alan hicbir saglayicidan gelmezse objede hic yer almaz (uydurma yok, Rule 11).
 */
export interface HotelFacts {
  lat?: SourcedValue<number>;
  lon?: SourcedValue<number>;
  address?: SourcedValue<string>;
  rating?: SourcedValue<number>;
  reviewCount?: SourcedValue<number>;
  recommendPercent?: SourcedValue<number>;
  roomCount?: SourcedValue<number>;
  capacity?: SourcedValue<number>;
  allInclusive?: SourcedValue<boolean>;
  airportDistanceKm?: SourcedValue<number>;
  airportDurationMin?: SourcedValue<number>;
}

export type HotelFactKey = keyof HotelFacts;

/** Her saglayici bu arayuzu uygular - resolver.ts sirayla dener, ilk dolduran kazanir. */
export interface HotelDataProvider {
  name: string;
  fetchFacts(hotelName: string, city: string): Promise<Partial<HotelFacts>>;
}

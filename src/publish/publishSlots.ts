// =====================================
// MODULE: Publish Slots
// Purpose: ABD ve Avrupa prime time'ina gore yayin saatlerini UTC'ye cevirir
// Dependencies: core/logger
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Logger } from '../core/logger.js';

/**
 * Slotlar UTC olarak degil, HEDEF BOLGENIN kendi saatiyle tanimlanir.
 * Sebep: ABD ve Avrupa yaz saati gecislerini farkli tarihlerde yapar
 * (ABD mart 2. pazar, AB mart son pazar). Sabit UTC saati kullanmak,
 * yilda iki kez birkac haftaligina prime time'i kacirir.
 */
export interface PrimeTimeSlot {
  id: string;
  /** IANA saat dilimi - yaz saati otomatik dogru hesaplanir */
  timeZone: string;
  hour: number;
  minute: number;
  label: string;
}

/** Ranking kanali icin gunluk 3 slot. */
export const RANKING_SLOTS: PrimeTimeSlot[] = [
  {
    id: 'usa-prime',
    timeZone: 'America/New_York',
    hour: 20,
    minute: 0,
    label: 'ABD prime time (ET 20:00)',
  },
  {
    id: 'eu-prime',
    timeZone: 'Europe/Berlin',
    hour: 20,
    minute: 0,
    label: 'Avrupa prime time (CET 20:00)',
  },
  {
    id: 'usa-morning',
    timeZone: 'America/New_York',
    hour: 8,
    minute: 30,
    label: 'ABD sabah yogunlugu (ET 08:30)',
  },
];

/** Referans bolgeler - bir slotun diger pazarlarda saat kacina denk geldigini gostermek icin. */
const REFERENCE_ZONES: Array<{ zone: string; short: string }> = [
  { zone: 'America/Los_Angeles', short: 'PT' },
  { zone: 'America/New_York', short: 'ET' },
  { zone: 'Europe/London', short: 'UK' },
  { zone: 'Europe/Berlin', short: 'CET' },
  { zone: 'Europe/Istanbul', short: 'TRT' },
];

/**
 * Bir saat diliminin verilen andaki UTC farkini milisaniye olarak dondurur.
 * Yaz saati durumu tarihe gore otomatik degisir.
 */
function zoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  // Intl 24:00 dondurebilir; gun basi olarak normalize edilir.
  const hour = Number(parts.hour) % 24;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

/**
 * Hedef bolgedeki yerel tarih/saati gercek UTC anina cevirir.
 * Iki gecisli hesap, yaz saati sinirinda da dogru sonuc verir.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(naive - zoneOffsetMs(timeZone, new Date(naive)));
  // Ikinci gecis: ilk tahminin kendi ofsetiyle duzeltilir.
  return new Date(naive - zoneOffsetMs(timeZone, firstGuess));
}

/** Bir UTC aninin referans bolgelerdeki yerel saatini "ET 20:00" bicimiyle dondurur. */
export function describeAcrossZones(instant: Date): string {
  return REFERENCE_ZONES.map(({ zone, short }) => {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).format(instant);
    return `${short} ${time}`;
  }).join(' | ');
}

/**
 * Verilen andan sonraki yayin zamanlarini uretir.
 *
 * @param slots Kullanilacak prime time slotlari
 * @param count Kac yayin zamani istendigi
 * @param from Baslangic ani (varsayilan: simdi)
 * @returns Kronolojik sirali UTC yayin anlari
 */
export function nextPublishTimes(
  slots: PrimeTimeSlot[],
  count: number,
  from: Date = new Date(),
): Array<{ slot: PrimeTimeSlot; publishAt: Date }> {
  const results: Array<{ slot: PrimeTimeSlot; publishAt: Date }> = [];
  const MAX_DAYS_AHEAD = 30;

  for (let dayOffset = 0; dayOffset <= MAX_DAYS_AHEAD && results.length < count; dayOffset += 1) {
    const day = new Date(from.getTime() + dayOffset * 86_400_000);

    const candidates = slots
      .map((slot) => {
        // Slotun kendi bolgesindeki takvim gunu esas alinir.
        const local = new Intl.DateTimeFormat('en-CA', {
          timeZone: slot.timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(day);
        const [year, month, date] = local.split('-').map(Number);

        return {
          slot,
          publishAt: zonedTimeToUtc(year!, month!, date!, slot.hour, slot.minute, slot.timeZone),
        };
      })
      .filter((candidate) => candidate.publishAt.getTime() > from.getTime())
      .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());

    for (const candidate of candidates) {
      if (results.length >= count) break;
      // Ayni an iki kez eklenmesin (bolge gunu kaymalarinda olabilir).
      if (results.some((r) => r.publishAt.getTime() === candidate.publishAt.getTime())) continue;
      results.push(candidate);
    }
  }

  Logger.info(`${results.length} yayin zamani planlandi`);
  return results;
}

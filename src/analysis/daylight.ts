// =====================================
// MODULE: Daylight
// Purpose: Cekimin gunun hangi isik kosulunda yapildigini belirler
// Dependencies: yok (ag gerektirmez)
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

/**
 * Isik kosulu. Sabit saat araliklari yerine gercek gunes yuksekligi kullanilir:
 * Antalya'da agustosta 20:00 hala gunduzken, ocakta gece olur.
 */
export type LightCondition = 'day' | 'goldenHour' | 'blueHour' | 'night';

export interface SunPosition {
  /** Ufka gore gunes yuksekligi (derece); negatif = ufkun altinda */
  elevationDeg: number;
  condition: LightCondition;
}

const DEG = Math.PI / 180;

/** Gunes yuksekligi esikleri (derece). */
const THRESHOLDS = {
  DAY: 10,
  GOLDEN: 0,
  BLUE: -6,
} as const;

function toJulian(date: Date): number {
  return date.getTime() / 86_400_000 - 0.5 + 2_440_588;
}

/**
 * Verilen an ve konum icin gunes yuksekligini hesaplar.
 *
 * NOAA'nin dusuk hassasiyetli formulu kullanilir; birkac dakikalik sapma
 * bu kullanim icin onemsizdir (amac gunduz/altin saat/gece ayrimi).
 *
 * @param date Cekim ani (UTC)
 * @param lat Enlem
 * @param lon Boylam
 */
export function sunPosition(date: Date, lat: number, lon: number): SunPosition {
  const days = toJulian(date) - 2_451_545;

  // Ortalama anomali ve ekliptik boylam
  const meanAnomaly = (357.5291 + 0.98560028 * days) * DEG;
  const center =
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly)) *
    DEG;
  const eclipticLon = meanAnomaly + center + 102.9372 * DEG + Math.PI;

  // Deklinasyon ve sag acikligin turetilmesi
  const obliquity = 23.4397 * DEG;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLon));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLon),
    Math.cos(eclipticLon),
  );

  // Yildiz zamani ve saat acisi
  const siderealTime = (280.16 + 360.9856235 * days) * DEG - lon * DEG * -1;
  const hourAngle = siderealTime - rightAscension;

  const latRad = lat * DEG;
  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(declination) +
      Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle),
  );

  const elevationDeg = elevation / DEG;

  let condition: LightCondition;
  if (elevationDeg > THRESHOLDS.DAY) condition = 'day';
  else if (elevationDeg > THRESHOLDS.GOLDEN) condition = 'goldenHour';
  else if (elevationDeg > THRESHOLDS.BLUE) condition = 'blueHour';
  else condition = 'night';

  return { elevationDeg, condition };
}

/** Iki isik kosulunun gunduz-gece karsitligi olusturup olusturmadigi. */
export function isDayNightContrast(a: LightCondition, b: LightCondition): boolean {
  const bright = new Set<LightCondition>(['day', 'goldenHour']);
  const dark = new Set<LightCondition>(['night', 'blueHour']);
  return (bright.has(a) && dark.has(b)) || (dark.has(a) && bright.has(b));
}

/**
 * Goruntu parlakligindan isik kosulunu dogrular.
 *
 * Telemetride saat yoksa veya saat yanlissa (drone saati ayarsiz olabilir)
 * bu, tek basina karar verebilecek bir yedek sinyaldir.
 *
 * @param averageLuma FFmpeg signalstats YAVG degeri (0-255)
 */
export function conditionFromLuma(averageLuma: number): LightCondition {
  if (averageLuma > 110) return 'day';
  if (averageLuma > 70) return 'goldenHour';
  if (averageLuma > 35) return 'blueHour';
  return 'night';
}

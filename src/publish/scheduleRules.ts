// =====================================
// MODULE: Schedule Rules
// Purpose: Genellestirilmis yayin sikligi kurallari - haftaici listesi,
//          N gunde bir, M ayda N video. Saf fonksiyonlar, DB'ye bagimli degil.
// Dependencies: yok
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

export type ScheduleRule =
  | { kind: 'weekday_list'; weekdays: number[] }
  | { kind: 'every_n_days'; intervalDays: number; anchor: Date }
  | { kind: 'count_per_period'; countPerPeriod: number; periodMonths: number; anchor: Date };

const MS_PER_DAY = 86_400_000;

/** Iki tarih arasindaki tam gun farki (yerel takvim gunu, saat bilgisi yok sayilir). */
function daysBetween(a: Date, b: Date): number {
  const dayStart = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((dayStart(b) - dayStart(a)) / MS_PER_DAY);
}

/**
 * Verilen gunun kurala gore yayina uygun bir gun olup olmadigini soyler.
 *
 * `count_per_period` bu fonksiyona uymaz (tek bir gun icin evet/hayir degil,
 * "donem icinde hangi gunler" sorusudur) - onun icin `countPerPeriodDays` kullanilir.
 *
 * @param rule Zamanlama kurali
 * @param date Kontrol edilecek takvim gunu
 */
export function isEligibleDay(rule: ScheduleRule, date: Date): boolean {
  switch (rule.kind) {
    case 'weekday_list':
      return rule.weekdays.includes(date.getDay());

    case 'every_n_days': {
      const diff = daysBetween(rule.anchor, date);
      if (diff < 0) return false;
      return diff % rule.intervalDays === 0;
    }

    case 'count_per_period':
      // Bu kural turu gun-gun degil, donem bazli dagitim gerektirir.
      throw new Error("isEligibleDay 'count_per_period' icin kullanilamaz - countPerPeriodDays kullanin");
  }
}

/**
 * "M ayda N video" kuralini, `from` anini iceren/onu takip eden donem
 * penceresine esit araliklarla dagitilmis takvim gunlerine cevirir.
 *
 * @param rule count_per_period kurali
 * @param from Baslangic ani - bu andan sonraki ilk uygun donem bulunur
 * @returns Donem icindeki yayin gunleri (saat bilgisi yok, sadece takvim gunu)
 */
export function countPerPeriodDays(
  rule: Extract<ScheduleRule, { kind: 'count_per_period' }>,
  from: Date,
): Date[] {
  const anchor = rule.anchor;
  const periodMs = rule.periodMonths * 30 * MS_PER_DAY; // yaklasik - ay uzunlugu degisken

  // from'u iceren donemin baslangicini bul: anchor'dan itibaren kac tam donem gecmis.
  const elapsed = from.getTime() - anchor.getTime();
  const periodsElapsed = elapsed <= 0 ? 0 : Math.floor(elapsed / periodMs);
  const periodStart = new Date(anchor.getTime() + periodsElapsed * periodMs);

  const days: Date[] = [];
  const stepMs = periodMs / rule.countPerPeriod;

  for (let i = 0; i < rule.countPerPeriod; i += 1) {
    const day = new Date(periodStart.getTime() + i * stepMs);
    // Donem baslangici gecmiste kaldiysa ve bu gun de gecmisteyse bir sonraki
    // donemin ayni sirasina atlanir - "bugunden sonraki ilk uygun gun" garantisi.
    if (day.getTime() < from.getTime() - MS_PER_DAY) {
      days.push(new Date(day.getTime() + periodMs));
    } else {
      days.push(day);
    }
  }

  return days.sort((a, b) => a.getTime() - b.getTime());
}

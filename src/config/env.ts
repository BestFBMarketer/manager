// =====================================
// MODULE: Env
// Purpose: .env okuma ve tip guvenli erisim; eksik anahtarlar sessizce gecilmez
// Dependencies: dotenv
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import 'dotenv/config';

/** Opsiyonel anahtar: yoksa undefined doner, cagiran taraf karar verir. */
export function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Zorunlu anahtar: yoksa net bir hata firlatir (Rule 11: sessiz hata yok). */
export function requireEnv(key: string): string {
  const value = optionalEnv(key);
  if (!value) {
    throw new Error(`Eksik ortam degiskeni: ${key} (.env.example dosyasina bak)`);
  }
  return value;
}

export function hasEnv(key: string): boolean {
  return optionalEnv(key) !== undefined;
}

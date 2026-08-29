// =====================================
// MODULE: Platform Adapter Types
// Purpose: Instagram/TikTok/Facebook ortak sözleşmesi - publish_target satırından beslenir
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { requireEnv } from '../../config/env.js';

export interface PublishTargetRow {
  id: number;
  channel_id: string;
  platform: string;
  /** Instagram: business account id. Facebook: grup id. TikTok: kullanılmıyor (token scope yeterli) */
  external_channel_ref: string | null;
  enabled: number;
  /** .env içindeki access token değişkeninin adı - manuel bağlantı yolu, geriye dönük uyumluluk için durur */
  credentials_env_key: string | null;
  /** OAuth akışından (panel/routes/oauth.ts) gelen token - varsa credentials_env_key'e göre önceliklidir */
  access_token: string | null;
  account_label: string | null;
  config_json: string;
}

/** DB'deki OAuth token'ini, yoksa .env pointer'ini kullanir - iki baglanti yolunu tek yerden cozer. */
export function resolveAccessToken(target: PublishTargetRow): string {
  if (target.access_token) return target.access_token;
  if (target.credentials_env_key) return requireEnv(target.credentials_env_key);
  throw new Error(`${target.platform}: bağlantı yok (ne OAuth token ne .env pointer)`);
}

export interface CrossPostInput {
  target: PublishTargetRow;
  /** Yerel dosya yolu - adapter gerekiyorsa publicMediaHost ile geçici public URL üretir */
  filePath: string;
  title: string;
  description: string;
}

export interface CrossPostResult {
  externalId: string;
  url: string;
}

export interface PlatformAdapter {
  platform: string;
  isConfigured(target: PublishTargetRow): boolean;
  publish(input: CrossPostInput): Promise<CrossPostResult>;
}

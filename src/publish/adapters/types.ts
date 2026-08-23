// =====================================
// MODULE: Platform Adapter Types
// Purpose: Instagram/TikTok/Facebook ortak sözleşmesi - publish_target satırından beslenir
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

export interface PublishTargetRow {
  id: number;
  channel_id: string;
  platform: string;
  /** Instagram: business account id. TikTok: kullanılmıyor (token scope yeterli) */
  external_channel_ref: string | null;
  enabled: number;
  /** .env içindeki access token değişkeninin adı - sır burada değil, sadece anahtar adı tutulur */
  credentials_env_key: string | null;
  config_json: string;
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

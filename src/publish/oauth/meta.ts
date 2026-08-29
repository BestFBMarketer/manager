// =====================================
// MODULE: Meta OAuth
// Purpose: Facebook Login for Business ile OAuth - kanal basina Facebook grubu/
//          sayfasi ve Instagram Business hesabina baglanmak icin
// Dependencies: config/env, core/logger, config/constants
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { requireEnv } from '../../config/env.js';
import { Logger } from '../../core/logger.js';
import { TIMEOUTS } from '../../config/constants.js';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Sadece kendi yonettigimiz sayfa/Instagram hesaplarina yayin yapmak icin -
// App Review gerektirmez, hesap bu app'te Tester/Admin rolunde olmali (Development Mode).
//
// Not: groups_access_member_info/publish_to_groups kasitli olarak yok - Meta
// Groups API'yi self-servis basvurudan kaldirmis gorunuyor (iki farkli app'te de
// "Invalid Scopes" hatasi verdi, use case olarak hic eklenemedi). Facebook grubuna
// postlama bu yuzden su an mumkun degil - Sayfa + Instagram ile devam ediliyor.
const SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

export interface MetaTokenResult {
  accessToken: string;
  expiresInSec?: number;
}

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccountId?: string;
}

function appId(): string {
  return requireEnv('FACEBOOK_APP_ID');
}

function appSecret(): string {
  return requireEnv('FACEBOOK_APP_SECRET');
}

/**
 * Facebook'un yetkilendirme dialogu icin URL uretir.
 * @param redirectUri Bu app'te "Gultige OAuth Redirect URIs" listesine eklenmis olmali
 * @param state CSRF korumasi + hangi kanal/platform icin oldugunu tasir (panel encode/decode eder)
 */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
    response_type: 'code',
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message: string };
}

/** Yetkilendirme kodunu kisa omurlu access token'a cevirir. */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<MetaTokenResult> {
  const params = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    redirect_uri: redirectUri,
    code,
  });
  const response = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(`Facebook token degisimi basarisiz: ${data.error?.message ?? response.status}`);
  }
  return { accessToken: data.access_token, expiresInSec: data.expires_in };
}

/**
 * Kisa omurlu token'i ~60 gunluk uzun omurlu token'a cevirir - Facebook Login
 * akisindan gelen token varsayilan olarak birkac saatte dolar, bu adim atlanirsa
 * kullanici her seferinde yeniden baglanmak zorunda kalir.
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResult> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: shortLivedToken,
  });
  const response = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS),
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(`Uzun omurlu token alinamadi: ${data.error?.message ?? response.status}`);
  }
  return { accessToken: data.access_token, expiresInSec: data.expires_in };
}

interface PagesResponse {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string };
  }>;
  error?: { message: string };
}

/** Kullanicinin yonettigi Facebook Sayfalarini (+baglanmis Instagram Business hesabini) listeler. */
export async function listPages(accessToken: string): Promise<MetaPage[]> {
  const url =
    `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST_MS) });
  const data = (await response.json()) as PagesResponse;
  if (!response.ok) {
    Logger.warn(`Facebook sayfa listesi alinamadi: ${data.error?.message ?? response.status}`);
    return [];
  }
  return (data.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    instagramBusinessAccountId: p.instagram_business_account?.id,
  }));
}

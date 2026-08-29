// =====================================
// MODULE: Panel OAuth Router
// Purpose: Facebook Login for Business akisi - Sayfa/Instagram hesabi secip
//          publish_target'a token yazar (Connections.tsx bunu kullanir)
// Dependencies: express, core/db, publish/oauth/meta
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../core/db.js';
import { Logger } from '../../core/logger.js';
import { getChannel } from '../../config/channels.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listPages,
  type MetaPage,
} from '../../publish/oauth/meta.js';

// Bekleyen (henuz picker'da onaylanmamis) Facebook baglantilari - kanal basina
// tek girdi, bellek-ici. Express-session yerine burada tutulur cunku Facebook'un
// callback'e geri yonlendirmesi (cross-site top-level redirect) tarayicinin
// panel session cookie'sini guvenilir sekilde tasimadigi gozlemlendi - session'a
// bagimli olsaydi bu akis SameSite ayarindan bagimsiz kirilgan kalirdi. Tek
// operatorlu, tek process'li bu yerel panel icin bellek-ici state yeterlidir;
// process yeniden baslarsa bekleyen (henuz secilmemis) baglantilar kaybolur,
// kullanici "Facebook ile bagla"yi tekrar tiklar.
const pendingConnections = new Map<string, { pages: MetaPage[]; createdAt: number }>();
const PENDING_TTL_MS = 10 * 60 * 1000;

function redirectUriFor(req: Request): string {
  // Facebook'a kayitli "Gultige OAuth Redirect URI" ile birebir eslesmeli -
  // istegin geldigi host'tan uretilir, boylece localhost test / gercek domain
  // ayrimi icin kod degismez, sadece Facebook app'inde ilgili URI kayitli olmali.
  return `${req.protocol}://${req.get('host')}/api/oauth/facebook/callback`;
}

/** Panelde giris yapilmis olmayi gerektiren uclar - "Facebook ile bagla" butonu ve picker. */
export function oauthRouter(): Router {
  const router = Router();

  router.get('/oauth/facebook/start', (req: Request, res: Response) => {
    const channelId = typeof req.query.channelId === 'string' ? req.query.channelId : '';
    try {
      getChannel(channelId);
    } catch {
      res.status(404).json({ error: `kanal bulunamadi: ${channelId}` });
      return;
    }

    const state = Buffer.from(JSON.stringify({ channelId, ts: Date.now() })).toString('base64url');
    res.redirect(buildAuthorizeUrl(redirectUriFor(req), state));
  });

  /** Callback'ten sonra bekleyen sayfa listesini dondurur - Connections.tsx bunu picker icin kullanir. */
  router.get('/channels/:id/oauth/facebook/pending', (req: Request<{ id: string }>, res: Response) => {
    const pending = pendingConnections.get(req.params.id);
    if (!pending || Date.now() - pending.createdAt > PENDING_TTL_MS) {
      pendingConnections.delete(req.params.id);
      res.json({ pages: [] });
      return;
    }
    res.json({ pages: pending.pages });
  });

  /**
   * Kullanici picker'dan bir Sayfa secince (facebook: sayfanin kendisine, instagram:
   * sayfaya bagli Instagram Business hesabina) token+ref'i publish_target'a kalici
   * olarak yazar, bekleyen bellek-ici veriyi temizler.
   */
  router.post('/channels/:id/oauth/facebook/finalize', (req: Request<{ id: string }>, res: Response) => {
    const pending = pendingConnections.get(req.params.id);
    if (!pending) {
      res.status(400).json({ error: 'bekleyen bir Facebook baglantisi yok - once "Facebook ile bagla"yi tekrar dene' });
      return;
    }

    const platform = req.body?.platform === 'instagram' ? 'instagram' : 'facebook';
    const pageId = typeof req.body?.externalId === 'string' ? req.body.externalId : '';
    const page = pending.pages.find((p) => p.id === pageId);
    if (!page) {
      res.status(400).json({ error: 'secilen sayfa bekleyen listede yok' });
      return;
    }

    let externalId: string;
    if (platform === 'instagram') {
      if (!page.instagramBusinessAccountId) {
        res.status(400).json({ error: 'secilen sayfaya bagli bir Instagram Business hesabi yok' });
        return;
      }
      externalId = page.instagramBusinessAccountId;
    } else {
      externalId = page.id;
    }

    try {
      const db = getDb();
      const existing = db
        .prepare('SELECT id FROM publish_target WHERE channel_id = ? AND platform = ?')
        .get(req.params.id, platform) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          'UPDATE publish_target SET access_token=?, external_channel_ref=?, account_label=?, enabled=1 WHERE id=?',
        ).run(page.accessToken, externalId, page.name, existing.id);
      } else {
        db.prepare(
          `INSERT INTO publish_target (channel_id, platform, access_token, external_channel_ref, account_label, enabled)
           VALUES (?, ?, ?, ?, ?, 1)`,
        ).run(req.params.id, platform, page.accessToken, externalId, page.name);
      }

      pendingConnections.delete(req.params.id);
      Logger.success(`[oauth] ${req.params.id}/${platform}: "${page.name}" olarak baglandi`);
      const row = db
        .prepare('SELECT * FROM publish_target WHERE channel_id = ? AND platform = ?')
        .get(req.params.id, platform);
      res.json(row);
    } catch (error) {
      Logger.error('[oauth] Baglanti kaydedilemedi', error);
      res.status(500).json({ error: 'baglanti kaydedilemedi' });
    }
  });

  return router;
}

/**
 * Facebook'un geri yonlendirdigi callback - kasitli olarak requireAuth'un DISINDA
 * kayitlidir ve panel session'ina hic bakmaz (yukaridaki not). CSRF korumasi:
 * Facebook redirect_uri'yi tam eslesme ile dogrular + state 10 dakika icinde
 * uretilmis olmali; tek operatorlu yerel bir arac icin yeterli.
 */
export function oauthCallbackRouter(): Router {
  const router = Router();

  router.get('/oauth/facebook/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !stateRaw) {
      res.status(400).send('Facebook yetkilendirme kodu veya state eksik');
      return;
    }

    let channelId: string;
    try {
      const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) as {
        channelId: string;
        ts: number;
      };
      if (Date.now() - state.ts > PENDING_TTL_MS) throw new Error('state suresi dolmus');
      channelId = state.channelId;
    } catch {
      res.status(400).send('Gecersiz state - baglanti suresi dolmus olabilir, tekrar dene');
      return;
    }

    try {
      const shortLived = await exchangeCodeForToken(code, redirectUriFor(req));
      const longLived = await exchangeForLongLivedToken(shortLived.accessToken);
      const pages = await listPages(longLived.accessToken);

      pendingConnections.set(channelId, { pages, createdAt: Date.now() });
      Logger.success(`[oauth] ${channelId}: Facebook baglantisi alindi (${pages.length} sayfa)`);
      res.redirect(`/channels/${channelId}?connected=facebook`);
    } catch (error) {
      Logger.error('[oauth] Facebook token degisimi basarisiz', error);
      res.status(500).send('Facebook baglantisi basarisiz - panel loglarina bak');
    }
  });

  return router;
}

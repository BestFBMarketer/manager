// =====================================
// MODULE: Panel Server
// Purpose: Panel API + derlenmis Vite/React arayuzunu sunar - FFmpeg/Remotion'i
//          asla senkron calistirmaz, sadece hafif DB okuma/yazma yapar
// Dependencies: express, express-session, core/db, core/logger, panel/auth,
//               panel/sessionStore, panel/routes/channels
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { requireEnv, optionalEnv } from '../config/env.js';
import { getDb } from '../core/db.js';
import { Logger } from '../core/logger.js';
import { authRouter, requireAuth } from './auth.js';
import { channelsRouter } from './routes/channels.js';
import { reviewRouter } from './routes/review.js';
import { storyReferencesRouter } from './routes/storyReferences.js';
import { batchRouter } from './routes/batch.js';
import { SqliteSessionStore } from './sessionStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = join(__dirname, '../../panel-web/dist');

function createApp(): express.Express {
  const app = express();

  // Reverse proxy (nginx/Caddy) arkasinda calisacagi icin secure cerez tespiti buna gore yapilir.
  app.set('trust proxy', 1);
  app.use(express.json());

  app.use(
    session({
      store: new SqliteSessionStore(),
      secret: requireEnv('PANEL_SESSION_SECRET'),
      name: 'panel.sid',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use('/api', authRouter());
  app.use('/api', requireAuth, channelsRouter());
  app.use('/api', requireAuth, reviewRouter());
  app.use('/api', requireAuth, storyReferencesRouter());
  app.use('/api', requireAuth, batchRouter());

  if (existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
    // Express 5'te bare '*' path-to-regexp'te gecersiz - path'siz catch-all middleware kullanilir.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(join(FRONTEND_DIST, 'index.html'));
    });
  } else {
    Logger.warn(`Derlenmis panel arayuzu bulunamadi (${FRONTEND_DIST}) - sadece API aktif`);
  }

  // Rule 11: sessiz hata yok - yakalanmamis rota hatalari burada loglanip 500 doner.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    Logger.error('Panel istegi basarisiz', error);
    res.status(500).json({ error: 'beklenmeyen sunucu hatasi' });
  });

  return app;
}

function main(): void {
  getDb(); // sema + migrasyonlari baslangicta uygula, ilk istekte degil
  const app = createApp();
  const port = Number(optionalEnv('PANEL_PORT') ?? 4000);

  app.listen(port, () => {
    Logger.success(`Panel API hazir: http://localhost:${port}`);
  });
}

main();

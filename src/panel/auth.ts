// =====================================
// MODULE: Panel Auth
// Purpose: Tek paylasilan sifreyle oturum acma - bcrypt karsilastirma + rate limit
// Dependencies: express, express-rate-limit, bcryptjs, core/logger, core/env
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { requireEnv } from '../config/env.js';
import { Logger } from '../core/logger.js';

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
  }
}

const LOGIN_RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000,
  MAX_ATTEMPTS: 10,
} as const;

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT.WINDOW_MS,
  limit: LOGIN_RATE_LIMIT.MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'cok fazla giris denemesi, biraz sonra tekrar dene' },
});

/** Oturum acilmamis istekleri 401 ile keser - kanal/zamanlama API'lerinin tumu bunun arkasinda. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: 'oturum acilmamis' });
}

export function authRouter(): Router {
  const router = Router();

  router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    try {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const hash = requireEnv('PANEL_PASSWORD_HASH');

      const valid = password.length > 0 && (await bcrypt.compare(password, hash));
      if (!valid) {
        res.status(401).json({ error: 'sifre hatali' });
        return;
      }

      req.session.authenticated = true;
      res.json({ ok: true });
    } catch (error) {
      Logger.error('Panel girisi basarisiz', error);
      res.status(500).json({ error: 'giris islenemedi' });
    }
  });

  router.post('/logout', (req: Request, res: Response) => {
    req.session.destroy((error) => {
      if (error) {
        Logger.error('Panel oturumu kapatilamadi', error);
        res.status(500).json({ error: 'cikis islenemedi' });
        return;
      }
      res.json({ ok: true });
    });
  });

  router.get('/me', (req: Request, res: Response) => {
    res.json({ authenticated: Boolean(req.session.authenticated) });
  });

  return router;
}

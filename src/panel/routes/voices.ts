// =====================================
// MODULE: Panel Voices Router
// Purpose: Voicebox + Piper seslerini listeler/onizler - kanal "Ses" sekmesi bunu kullanir
// Dependencies: express, tts/providers/voicebox, tts/providers/piper
// Author: BestMarketer Team
// Last Modified: 2026-08-29
// =====================================

import { Router, type Request, type Response } from 'express';
import { Logger } from '../../core/logger.js';
import { listVoiceboxProfiles, fetchVoiceboxPreviewAudio } from '../../tts/providers/voicebox.js';
import { listPiperVoices, synthesizePiperPreview } from '../../tts/providers/piper.js';

export function voicesRouter(): Router {
  const router = Router();

  router.get('/voices', async (_req: Request, res: Response) => {
    const [voiceboxResult, piperResult] = await Promise.allSettled([listVoiceboxProfiles(), listPiperVoices()]);

    res.json({
      voicebox:
        voiceboxResult.status === 'fulfilled'
          ? { available: true, profiles: voiceboxResult.value }
          : { available: false, profiles: [], error: 'Voicebox çalışmıyor - açık olduğundan emin ol' },
      piper: piperResult.status === 'fulfilled' ? piperResult.value : [],
    });
  });

  router.get('/voices/voicebox/:profileId/preview', async (req: Request<{ profileId: string }>, res: Response) => {
    try {
      const { bytes, contentType } = await fetchVoiceboxPreviewAudio(req.params.profileId);
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(bytes));
    } catch (error) {
      Logger.warn('Voicebox onizleme alinamadi', error);
      res.status(502).json({ error: error instanceof Error ? error.message : 'onizleme alinamadi' });
    }
  });

  router.get('/voices/piper/preview', async (req: Request, res: Response) => {
    const modelPath = typeof req.query.modelPath === 'string' ? req.query.modelPath : '';
    const language = typeof req.query.language === 'string' ? req.query.language : 'en';
    if (!modelPath) {
      res.status(400).json({ error: 'modelPath gerekli' });
      return;
    }
    try {
      const bytes = await synthesizePiperPreview(modelPath, language);
      res.setHeader('Content-Type', 'audio/wav');
      res.send(Buffer.from(bytes));
    } catch (error) {
      Logger.warn('Piper onizleme uretilemedi', error);
      res.status(502).json({ error: error instanceof Error ? error.message : 'onizleme uretilemedi' });
    }
  });

  return router;
}

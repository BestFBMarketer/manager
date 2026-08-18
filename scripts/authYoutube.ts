// =====================================
// MODULE: YouTube OAuth Setup
// Purpose: Tek seferlik yetkilendirme - refresh token uretir, .env'e eklenir
// Dependencies: googleapis, node:http
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================
//
// KULLANIM: Bu script TARAYICISI OLAN bir makinede (kendi bilgisayarinizda)
// calistirilir - VPS'te degil. Uretilen refresh token bir kez alinir ve
// sonsuza kadar VPS'in .env dosyasinda kalir; bu script'i VPS'te calistirmaya
// gerek yoktur.
//
//   npx tsx scripts/authYoutube.ts shorts
//   npx tsx scripts/authYoutube.ts travel
//
// Onkosul: Google Cloud Console'da bir OAuth 2.0 istemcisi ("Desktop app"
// tipi) olusturulmus, YOUTUBE_CLIENT_ID ve YOUTUBE_CLIENT_SECRET .env'e
// girilmis olmali. YouTube Data API v3 projede etkin olmali.

import 'dotenv/config';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';
import { requireEnv } from '../src/config/env.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

const CALLBACK_PORT = Number(process.env.OAUTH_CALLBACK_PORT ?? 53_682);
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/oauth2callback`;

/** Yerel bir HTTP sunucusu acip Google'in yonlendirdigi yetkilendirme kodunu yakalar. */
function waitForAuthCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.end('Yetkilendirme reddedildi. Bu sekmeyi kapatip terminale donebilirsiniz.');
        server.close();
        reject(new Error(`OAuth reddedildi: ${error}`));
        return;
      }

      if (code) {
        res.end('Yetkilendirme tamamlandi. Bu sekmeyi kapatip terminale donebilirsiniz.');
        server.close();
        resolve(code);
        return;
      }

      res.statusCode = 400;
      res.end('Beklenmeyen istek.');
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      console.log(`Yerel geri cagirma sunucusu hazir: ${REDIRECT_URI}`);
    });
  });
}

async function main(): Promise<void> {
  const channelArg = process.argv[2];
  if (!channelArg) {
    console.error('Kullanim: npx tsx scripts/authYoutube.ts <kanal-etiketi>');
    console.error('  orn: npx tsx scripts/authYoutube.ts shorts');
    console.error('  orn: npx tsx scripts/authYoutube.ts travel');
    process.exit(1);
  }

  const clientId = requireEnv('YOUTUBE_CLIENT_ID');
  const clientSecret = requireEnv('YOUTUBE_CLIENT_SECRET');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    // prompt=consent olmadan Google ikinci yetkilendirmede refresh_token
    // dondurmeyebilir (once yetkilendirilmis uygulamalar icin).
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\nAsagidaki linki tarayicida acin ve Google hesabinizla giris yapin:\n');
  console.log(authUrl);
  console.log('');

  const code = await waitForAuthCode(CALLBACK_PORT);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      '\nrefresh_token gelmedi. Google hesabinizin "Bagli uygulamalar" ' +
        'listesinden bu uygulamanin erisimini kaldirip tekrar deneyin ' +
        '(Google, bir uygulamaya ikinci kez izin verildiginde refresh_token ' +
        'dondurmeyebilir).',
    );
    process.exit(1);
  }

  const envKey = `YOUTUBE_REFRESH_TOKEN_${channelArg.toUpperCase()}`;
  console.log(`\n${envKey} icin refresh token alindi. .env dosyaniza ekleyin:\n`);
  console.log(`${envKey}=${tokens.refresh_token}\n`);
}

main().catch((error: unknown) => {
  console.error('Yetkilendirme basarisiz:', error);
  process.exit(1);
});

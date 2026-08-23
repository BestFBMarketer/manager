// =====================================
// MODULE: PM2 Ecosystem Config
// Purpose: Panel server'i surekli ayakta tutar, worker'i cron ile periyodik tetikler
// Kullanim: pm2 start ecosystem.config.cjs
// Author: BestMarketer Team
// Last Modified: 2026-08-23
// =====================================

module.exports = {
  apps: [
    {
      // Panel API + arayuz - crash olursa pm2 otomatik yeniden baslatir.
      name: 'shorts-factory-panel',
      script: 'npx',
      args: 'tsx src/panel/server.ts',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    {
      // Worker - tek seferlik calisir (processQueue() bitince process kapanir),
      // pm2'nin cron_restart + autorestart:false kombinasyonuyla "zamanlanmis
      // gorev" gibi davranir. WORKER.BATCH_SIZE=1 oldugu icin her tetiklemede
      // en fazla bir is islenir - uzun bir render sonraki turu bloklamaz.
      name: 'shorts-factory-worker',
      script: 'npx',
      args: 'tsx src/worker/runQueue.ts',
      cwd: __dirname,
      autorestart: false,
      cron_restart: '*/5 * * * *',
      env: { NODE_ENV: 'production' },
    },
  ],
};

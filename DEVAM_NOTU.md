# Devam Notu

**Durum:** Çekirdek hat kodlandı ve test edildi (LLM router, DJI/GoPro telemetri,
hız optimizasyonu, gündüz-gece eşleştirme, müzik seçimi, Remotion kompozisyonları,
YouTube publish). Henüz gerçek kimlik bilgileriyle uçtan uca denenmedi.

**Repo:** `BestFBMarketer/manager` → branch `claude/youtube-shorts-automation-plan-779kjx`

## PC'de yapılacaklar (sırayla)

1. `git clone -b claude/youtube-shorts-automation-plan-779kjx https://github.com/BestFBMarketer/manager.git && npm install`
2. `.env.example` → `.env`, LLM + YouTube anahtarlarını doldur
3. `npx tsx scripts/authYoutube.ts shorts` ve `... travel` (tarayıcı açılır, refresh token `.env`'e)
4. `npm run pipeline -- --stage doctor` — her şey yeşil mi kontrol et
5. Gerçek bir DJI Neo klibiyle `--stage srt`, `--stage speed`, `--stage cluster` dene

Detaylı komutlar ve mimari: `README.md`. Sorun çıkarsa oturuma devam edip birlikte bakarız.

**Sıradaki VPS kurulumu için:** Node 22, ffmpeg/ffprobe, Chromium (Remotion), Whisper (Python) — kurulumdan hemen önce netleştiririz.

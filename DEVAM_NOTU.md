# Devam Notu

**Durum (2026-08-23):** M0'dan M6'ya kadar tüm milestone'lar kodlandı, typecheck +
panel-web build temiz, worker'ın atomik kuyruk mantığı (claim/sweep/review_item yazımı/
çifte-onay koruması) gerçek bir SQLite dosyasına karşı elle test edildi. **Ama gerçek
render hiç çalıştırılmadı** — o sandbox'ta ffmpeg/ffprobe/yt-dlp yok, gerçek LLM/YouTube/
Instagram/TikTok/Google Places anahtarı yok.

**Güncelleme (2026-08-28, Windows PC):** `npm install` çalışıyor (better-sqlite3
`^11.5.0` → `^13.0.3`'e yükseltildi, Node 24 için prebuilt binary getiriyor — VS Build
Tools gerekmiyor). `typecheck` temiz. `ffmpeg`/`ffprobe`/`yt-dlp` winget ile kuruldu ve
gerçek bir test encode ile doğrulandı (çalışıyor). `npm run pipeline -- --stage doctor`
üçünü de yeşil gösteriyor. Küçük bir kod hatası da düzeltildi: `src/core/exec.ts`
`isAvailable()` tüm ikili dosyaları `-version` (tek tire) ile kontrol ediyordu — ffmpeg/
ffprobe'da çalışır ama yt-dlp `-version`'ı kısa bayrak dizisi sanıp patlıyordu
(`--version`'a çevrildi + Windows'ta bazı ffmpeg derlemelerinin sürüm bayrağıyla tek
başına çağrıldığında verdiği tuhaf çıkış koduna karşı stderr içeriğine bakan bir yedek
kontrol eklendi — gerçek kesim/kodlama işlemleri zaten sorunsuz çalışıyor, sadece bu
kontrol yanılıyordu). Yani "kod doğru mu" sorusuna evet, "gerçek bir video üretip
yayınladı mı" sorusuna henüz hayır — `.env` doldurulup ilk gerçek deneme PC'den yapılacak
(aşağıdaki "PC'de test" bölümü).

**Repo:** `BestFBMarketer/shorts-factory` (private) → branch `main`

**Plan degisikligi (2026-08-28):** Ilk plan VPS'e (Ubuntu) kurup oradan test etmekti.
Son dakika karari: once Windows PC'de calistirip test edilecek, VPS kurulumu bu asamada
ertelendi. Asagidaki "VPS kurulumu" bolumu ileride VPS'e gecerken hala gecerli - ama
simdilik "PC'de test" adimlarini takip et.

## Ne var, ne yok (dürüst özet)

**Tam çalışır durumda (kod seviyesinde doğrulandı):**
- Panel: giriş, kanal CRUD, zamanlama editörü, gerçek takvim, onay kuyruğu (Review.tsx),
  stok üretim (BatchProducer/BatchProgress), Instagram/TikTok bağlantı ekranı
- Worker: atomik iş kapma, crash recovery (stale claim sweep), review_item yazımı,
  çifte-onay koruması — hepsi gerçek DB'ye karşı test edildi
- HotelTour: telemetri → hız planı → kurgu → POI → müzik → seslendirme → miksaj →
  Remotion render → thumbnail → onay zinciri kodlandı (gerçek drone klibi ile denenmedi)
- StoryNarrative: transkript → olgu özeti → yeni senaryo → sahne bazlı görsel kaynaklama →
  render zinciri kodlandı (gerçek referans video ile denenmedi)
- ShortsDerivative (auto-repurpose): yayınlanan uzun videodan otomatik kesit planlama
- Instagram/TikTok adapter'ları gerçek API sözleşmelerine göre yazıldı (Graph API /
  Content Posting API v2) — gerçek token'la hiç çağrılmadı

**Bilinen boşluklar / yapılmadı:**
- FunnyRanking (komik Shorts) — discovery/curation (kaynak video keşfi) hiç yazılmadı,
  bu kanal için batch job'ları elle sourceRef vermeden çalışmaz, worker stage'i her
  zaman "not yet implemented" ile başarısız olur
- Facebook adapter — stub, gerçek kod yok (kullanıcı Instagram+TikTok istedi, Facebook değil)
- TikTok adapter tek parça yükleme ile sınırlı (64MB) — daha büyük videolar için
  çok parçalı yükleme eklenmedi
- Instagram cross-post, PUBLIC_MEDIA_BASE_URL (VPS'te nginx/Caddy ile açılan herkese
  açık bir adres) olmadan çalışmaz — bu bir kurulum adımı, kod eksikliği değil

## PC'de test — sırayla (şu anki öncelik)

1. **Temel kurulum — YAPILDI:** `npm install`, `ffmpeg`/`ffprobe`/`yt-dlp` (winget),
   `typecheck` temiz, `--stage doctor` ikili dosyalar için yeşil.
2. **`.env` doldur** — VPS listesindeki aynı alanlar geçerli (LLM anahtarı, `NOTIFY_SMTP_*`,
   `PANEL_PASSWORD_HASH`+`PANEL_SESSION_SECRET`, gezi kanalı için YouTube OAuth). PC'den
   çalıştırdığın için `authYoutube.ts` adımı zaten sorunsuz (tarayıcı burada).
3. **DB'yi kur:** `npx tsx scripts/migrateChannelsToDb.ts`, sonra
   `npm run pipeline -- --stage doctor` ile LLM/TTS anahtarlarını da doğrula.
4. **Panel + worker'ı elle çalıştır** (pm2/systemd yok, README'nin "Isletim" bölümündeki
   "PC'den test icin" kutusuna bak): iki terminal, `npm run panel:server` +
   `npm run worker`.
5. **İlk gerçek deneme** — VPS listesindeki 5. adımla aynı sıra (önce gezi/HotelTour,
   sonra hikaye kanalı), sadece worker'ı elle tetikliyorsun.
6. Instagram/TikTok cross-post PC'den test edilemez (`PUBLIC_MEDIA_BASE_URL` herkese açık
   bir adres ister) — bu adım VPS'e geçince sırada.

**Not:** PC'de sadece elle/tek seferlik test için çalıştırılıyor, sürekli/otomatik
zamanlanmış yayın (cron/pm2) burada kurulmuyor — o VPS aşamasının işi.

## VPS kurulumu — sırayla (ileride, PC testleri bitince)

1. **Temel kurulum**
   ```bash
   git clone https://github.com/BestFBMarketer/shorts-factory.git
   cd shorts-factory && npm install
   sudo apt install ffmpeg yt-dlp   # veya dagitimina uygun paket yoneticisi
   cp .env.example .env
   ```

2. **`.env`'i doldur** — hangi bölüm hangi özellik için gerekli, `.env.example`
   içinde her biri açıklamalı. Minimum çalışır sistem için:
   - En az bir LLM sağlayıcı anahtarı (Gemini/DeepSeek ücretsiz, hızlı başlamak için iyi)
   - `NOTIFY_SMTP_*` + `NOTIFY_EMAIL_TO` (hata/başarı bildirimleri için)
   - `PANEL_PASSWORD_HASH` (`npm run panel:hash-password -- '<şifre>'` ile üret) + `PANEL_SESSION_SECRET`
   - Gezi kanalı için: `YOUTUBE_CLIENT_ID/SECRET` + kanal başına refresh token
     (`npx tsx scripts/authYoutube.ts travel` — tarayıcı gerektirir, VPS'te değil
     kendi bilgisayarında çalıştır, çıkan token'ı `.env`'e yapıştır)

3. **DB'yi kur ve doğrula**
   ```bash
   npx tsx scripts/migrateChannelsToDb.ts   # shorts/travel kanallarını tohumlar (tek seferlik)
   npm run pipeline -- --stage doctor       # ffmpeg/ffprobe/yt-dlp/LLM/TTS durumunu gösterir
   ```

4. **Panel + worker'ı ayağa kaldır** — `README.md`'deki "Isletim" bölümü pm2 ve
   systemd için iki ayrı yol veriyor, hangisi VPS'te daha rahatsa onu seç.

5. **İlk gerçek deneme (önerilen sıra)**
   - Önce panelden **gezi (travel)** kanalına tek bir drone klibiyle (`HotelTourLandscape`,
     otel adı/şehir opsiyonel) tek video için batch oluştur, worker'ı bir tur çalıştır
     (`npm run worker` elle, ya da cron'un ilk tetiklemesini bekle), onay kuyruğunda
     çıktıyı incele. Bu, en az bağımlılığı olan yol (discovery gerektirmiyor).
   - Sonra **hikaye kanalı**'nı dene: önce panelden en az bir referans kanal ekle
     (Ayarlar → Referans kanallar), sonra "Stok üret" — otomatik konu keşfi
     `YOUTUBE_API_KEY` gerektirir (OAuth değil, düz API key).
   - Onaylanan ilk videoda YouTube Studio'da gerçekten `private` + doğru `publishAt`
     ile göründüğünü doğrula, sonra elle sil (kanalda test çöpü kalmasın).

6. **Instagram/TikTok bağlantısı (opsiyonel, hazır olunca)**
   - Instagram: Meta for Developers'ta App Review süreci var, Instagram Business
     hesabı gerekir. `PUBLIC_MEDIA_BASE_URL`'i VPS'in nginx/Caddy'sinden `/public-media`
     path'ine yönlendirerek ayarla (README'nin "Isletim" bölümünde neden gerektiği anlatılıyor).
   - TikTok: TikTok for Developers'ta Content Posting API başvurusu gerekir.
   - İkisi de hazır olunca panelde kanal sayfasındaki "Bağlantılar" bölümünden
     `.env` değişken adını gir (gerçek token'ı değil).

## Bilinen riskler / dikkat edilecekler

- **Maliyet:** LLM router ücretsiz katmanı önceliklendiriyor ama hikaye kanalı
  (`factBrief`/`narrativeScript`) ve `shortsPlan` kalite-kritik olduğu için doğrudan
  Claude ile başlıyor — `npm run cost -- --month` ile aylık harcamayı takip et.
  `DAILY_PAID_BUDGET_USD` aşılırsa router otomatik ücretsiz katmana düşer.
- **Telif:** Hikaye kanalında iki aşamalı özgünleştirme (factBrief → scriptWriter,
  transkript ikinci aşamaya hiç geçmiyor) riski azaltıyor ama sıfırlamıyor — özellikle
  tanınabilir gerçek kişiler konu olduğunda editoryal gözden geçirme hâlâ senin işin.
- **Otel verisi:** `hotelData/` zinciri (Google Places → HolidayCheck → Booking → elle)
  en iyi çaba prensibiyle çalışır; scraper'lar site yapısı değişince sessizce boş
  dönebilir (crash etmez, sadece o alan eksik kalır) — `data/hotelManual.json` ile
  elle doldurabilirsin.

Detaylı mimari, tüm CLI komutları ve "Isletim" (pm2/systemd/yedekleme/health check)
bölümü: `README.md`. Sorun çıkarsa oturuma devam edip birlikte bakarız.

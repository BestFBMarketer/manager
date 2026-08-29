# AUDIT.md — shorts-factory

> Her projede kök dizine kopyala, doldur. Tarih + oturum bazlı satır ekle, üzerine yazma.

---

## 2026-08-29 — İlk gerçek uçtan uca render (HotelTour, drone klip) + hız/doğruluk düzeltmeleri

### Yapılan iş özeti

Gerçek bir DJI drone klibiyle (`DJI_20260516135216_0008_D.MP4`, GPS telemetrili, 106sn)
HotelTour worker stage'i ilk kez gerçek şekilde uçtan uca çalıştırıldı: telemetri parse →
hız planı → kesim → ses miksajı (Piper TTS) → LLM metadata → Remotion render → thumbnail →
onay kuyruğu. Süreçte **9 gerçek kod hatası** bulunup düzeltildi (detay: commit `1429822`,
mesajında tek tek listelendi). Özet:

1. `isAvailable()` yt-dlp'yi yanlış bayrakla (`-version`) kontrol ediyordu → yanlış negatif.
2. Piper TTS shell pipe üzerinden çağrılıyordu, Windows path'lerindeki ters slash'lar
   POSIX shell'de kaçış karakteri sayılıp yolu bozuyordu → stdin'e doğrudan yazmaya geçildi.
3. `audioMix.ts`: müziksiz durumda `asplit` filtresinin bir çıkışı kullanılmıyordu →
   ffmpeg filtergraph hatası. Müzik yoksa split hiç yapılmıyor artık.
4. `npx` Windows'ta `.cmd` dosyası, `spawn()` `shell:true` olmadan ENOENT/EINVAL veriyor.
5. Remotion'a mutlak/göreli yerel dosya yolu verilemiyor (public-dir tüm proje kökünü
   GB'larca kopyalıyor, kopyalama bitmeden istek gelirse 404) → `renderRemotion.ts` artık
   kendi hafif HTTP asset sunucusunu açıyor, dosyaları talep üzerine (kopyasız) sunuyor.
6. **`HotelTourLandscape`/`HotelTourVertical` composition'ı `durationInFrames`'i sabit
   60sn/30sn'ye kilitlemişti** (diğer tüm composition'larda `calculateMetadata` ile
   dinamik hesaplanıyordu, HotelTour'da unutulmuş) → 106sn'lik gerçek video 60sn'ye
   kırpılıyordu. `totalDurationSec` prop'u + `calculateMetadata` eklendi.
7. **TTS'e her zaman sabit Türkçe metin veriliyordu**, kanal dili ne olursa olsun (mevcut
   kanalların ikisi de de/en) → Almanca ses modeliyle Türkçe metin okutulunca bozuk/robotik
   çıkıyordu. `writeIntroNarration()` eklendi (writeVideoMetadata ile aynı desende),
   anlatım artık kanalın dilinde LLM'den geliyor.
8. **Asıl render-hızı darboğazı GPU değil çözünürlüktü**: 4K drone kaynağı, hedef 1080p
   olduğu halde olduğu gibi Remotion'a veriliyordu — OffthreadVideo 4 kat fazla piksel
   decode ediyordu. `applySpeedPlan.ts`'e `targetWidth/targetHeight` eklendi, kesim
   adımında 1080p'ye indirgeniyor. Sonuç: 4K+concurrency=1 → 1118.6sn render;
   1080p+concurrency=10+NVENC → 248.6sn (**~4.5x hızlanma**), kalite kaybı yok (zaten
   hedef 1080p).
9. Tamamen düşük irtifada seyreden gerçek bir klip `speedPlanner.ts`'de tüm bölümleri
   "yerde" sayıp atıyor, `applySpeedPlan` "kurgulanacak görüntü kalmadı" ile hard-fail
   oluyordu → tüm bölümler atılırsa artık ham klip fallback'i devreye giriyor (telemetri-yok
   yolundakiyle aynı mantık).

Ayrıca: `videoEncoder.ts` (yeni) — `VIDEO_HW_ENCODER=h264_nvenc` ile bu makinenin
RTX 3060'ı opsiyonel olarak devreye alınabiliyor (VPS'te boş bırakılırsa CPU/libx264
kalır, davranış değişmez). `REMOTION_CONCURRENCY` de aynı şekilde opsiyonel/env-driven.

### Test/doğrulama

- **Gerçek, tam uçtan uca başarılı render** (2 kez, biri düzeltilmiş anlatımla): 1920x1080,
  106.03sn (kaynakla birebir), ses+görüntü doğru, thumbnail üretildi, onay kuyruğuna düştü.
- LLM metadata + anlatım: gerçek Gemini çağrısıyla doğru Almanca çıktı doğrulandı.
- `npm run typecheck` ve `panel-web` build temiz.
- Kullanıcıya iki örnek video gönderildi (ilk sürüm: yanlış süre+dil; düzeltilmiş sürüm:
  doğru süre+dil) — görsel/işitsel olarak doğrudan doğrulandı.

### Açık riskler / bilinen eksikler

- Müzik kütüphanesi (`data/music/library.json`) hâlâ boş — video şu an müziksiz üretiliyor
  (nazikçe atlanıyor, crash etmiyor, ama gerçek yayın için müzik dosyaları eklenmeli).
- Piper (CPU TTS) ses kalitesi Voicebox'a (GPU, kurulu değil) göre daha robotik — dil hatası
  düzeltildi ama ses tonu kalitesi ayrı bir konu, kullanıcı henüz yeni sesi değerlendirmedi.
- Bu oturumda job'u elle `pending`'e resetleyip tekrar tekrar test etmek `render` tablosunun
  `(job_id, status)` unique index'ine bir kez çarptı (aynı job için ikinci "done" satırı) —
  gerçek üretim akışında bir job normalde başarılı olduktan sonra tekrar kuyruklanmaz, bu
  sadece test metodolojisinin bir yan etkisiydi, kod tarafında bir şey değiştirilmedi.
- VPS'e ne zaman/nasıl geçileceği (14 canlı WordPress sitesiyle aynı sunucu, kaynak
  paylaşımı) henüz kararlaştırılmadı — kullanıcı kendi VPS'i, risk tamamen kendi tercihi.
- CapCut ile yarı-otomatik hibrit fikri brainstorm seviyesinde kaldı, resmi API yok
  (topluluk tersine mühendislik draft formatı var, kırılgan) — uygulanmadı.

### Sonraki adım

1. Kullanıcının yeni (düzeltilmiş) örnek videoyu değerlendirmesi — ses tonu/kalite yeterli mi.
2. Yeterliyse: gerçek YouTube OAuth kurulumu (`authYoutube.ts travel`) ve ilk gerçek yayın denemesi.
3. Müzik kütüphanesi doldurulması (`MUSIC_LIBRARY_DIR`).
4. VPS'e geçiş kararı ve zamanlaması.

---

## 2026-08-28 (devam) — Repo taşıma + PC bloker çözümü

### Yapılan iş özeti

- **Repo taşıma:** Kod `BestFBMarketer/manager`'dan yeni özel private repo
  `BestFBMarketer/shorts-factory`'ye taşındı. `manager` reposundaki feature branch
  (`claude/youtube-shorts-automation-plan-779kjx`, tüm M0-M6 history'si dahil) `main`'e
  merge edildi (`--no-ff`, history korundu), yeni repoya push edildi. Eski `manager`/
  `ecosystem-hub` repoları dokunulmadan bırakıldı.
- **Karar değişikliği:** Proje VPS'e (Ubuntu) kurulmak üzere tasarlanmıştı; kullanıcı
  önce Windows PC'den çalıştırıp test etme kararı aldı. README/DEVAM_NOTU.md buna göre
  güncellendi (Windows kurulum yolu + "PC'den test" bölümü eklendi, VPS bölümü silinmedi
  — ileride hâlâ geçerli).
- **npm install bloker çözüldü:** `better-sqlite3` `^11.5.0` → `^13.0.3`'e yükseltildi —
  bu sürüm Node 24 için prebuilt binary sağlıyor, VS Build Tools/nvm-windows gerekmedi.
  (nvm-windows kurulumu denendi, UAC izni sandbox'ta tamamlanamadı ve mevcut Node.js
  kurulumunu yarım bırakıp kaldırdı — `winget install OpenJS.NodeJS.LTS` ile geri
  kuruldu, veri kaybı yok, sadece geçici kesinti.)
- **ffmpeg/ffprobe/yt-dlp kuruldu** (winget: `Gyan.FFmpeg`, `yt-dlp.yt-dlp`), gerçek bir
  test encode ile doğrulandı.
- **Kod hatası düzeltildi** (`src/core/exec.ts` `isAvailable()`): tüm ikili dosyalar
  `-version` (tek tire) ile kontrol ediliyordu — yt-dlp bunu kısa bayrak dizisi sanıp
  hata veriyordu (`--version`'a çevrildi). Ayrıca Windows'ta bazı ffmpeg derlemelerinin
  sürüm bayrağıyla **tek başına** çağrıldığında (gerçek iş yokken) tuhaf/sıfır olmayan
  çıkış kodu döndürdüğü gözlendi — gerçek kesim/kodlama işlemi test edildi ve sorunsuz
  çalıştığı doğrulandı (bu sadece `--version` bayrağına özgü bir kozmetik problem).
  `isAvailable()` artık başarısız çıkış kodunda bile stderr'de "version" geçiyorsa
  ikiliyi mevcut sayıyor.
- `npm run typecheck` temiz, `npm run pipeline -- --stage doctor` artık ffmpeg/ffprobe/
  yt-dlp için yeşil (LLM/TTS sağlayıcıları `.env` doldurulmadığı için hâlâ kırmızı —
  beklenen, sıradaki adım).

### Değişen dosyalar

- `src/core/exec.ts` — `isAvailable()` düzeltmesi (yukarıda).
- `package.json` — `better-sqlite3` sürüm yükseltmesi.
- `README.md` — Kurulum bölümü Windows/Ubuntu ayrımı, Işletim bölümüne "PC'den test icin" notu, repo referansı güncellendi.
- `DEVAM_NOTU.md` — durum notu güncellendi, yeni "PC'de test — sırayla" bölümü eklendi, VPS clone komutu yeni repoya güncellendi.

### Test/doğrulama

- `npm install` → 455 paket, 0 hata.
- `npm run typecheck` → temiz.
- `ffmpeg`/`ffprobe --version`, gerçek bir `testsrc` encode → başarılı (exit 0).
- `yt-dlp --version` → başarılı.
- `npm run pipeline -- --stage doctor` → ffmpeg/ffprobe/yt-dlp yeşil, SQLite şema hazır.
- `panel-web`: `npm install` (27 paket) + `npm run build` → temiz (`tsc -b && vite build`, 231ms).
- **Yapılmadı:** gerçek `.env` ile LLM/TTS/YouTube uçtan uca deneme — sıradaki adım.

### Açık riskler / bilinen eksikler

- `.env` henüz doldurulmadı — LLM/TTS/YouTube/Instagram/TikTok anahtarları yok, gerçek
  render/publish hâlâ hiç denenmedi.
- `isAvailable()`'daki stderr-metin-tabanlı yedek kontrol, ffmpeg'in bu spesifik Windows
  davranışına özgü bir iş-etrafından-dolanma (workaround) — gerçek kök neden (neden
  `--version` tek başına tuhaf çıkış kodu veriyor) tam anlaşılmadı, sadece gerçek
  işlemlerin etkilenmediği doğrulandı. VPS/Linux'ta bu sorun muhtemelen hiç yaşanmaz.

### Sonraki adım

1. `.env` doldur (en az bir LLM anahtarı + panel şifre hash'i + YouTube OAuth travel kanalı için).
2. `npx tsx scripts/migrateChannelsToDb.ts`, tekrar `--stage doctor`.
3. `npm run panel:server` + `npm run worker` ile ilk gerçek deneme (HotelTour, tek klip).

---

## 2026-08-28 — Proje Audit (M0-M6 tam kapsam durum tespiti)

### Yapılan iş özeti

Bu oturumda yeni bir Windows makinede repo sıfırdan kuruldu (`C:\Users\MONSTER\claaudeproje\shortsfactory\`).
Kurulum sırasında local branch'in geride olduğu tespit edildi: önceki bir cloud/uzak oturum
`claude/youtube-shorts-automation-plan-779kjx` branch'ini **14 commit ileri** taşımış — M2'den
M6'ya kadar tüm milestone'lar, ek özellikler ve operasyon (pm2/systemd/backup) katmanı bu
oturumdan bağımsız olarak zaten tamamlanmış durumda bulundu. Local branch fast-forward ile
`8a2baaf` (son commit) seviyesine getirildi. Bu audit, kod tabanının **gerçek/güncel durumunu**
tespit içindir — yeni kod yazılmadı.

### Milestone durumu (README "Yol haritasi" + kod taraması ile doğrulandı)

| Milestone | Durum | Not |
|---|---|---|
| M0 — DB şeması, kanal config, zamanlama motoru, LLM router | ✅ | |
| M1 — Admin panel iskeleti + çekirdek video araçları | ✅ | |
| M2 — Worker/orkestratör, atomik iş kapma, crash recovery, HotelTour render zinciri | ✅ | `src/worker/runQueue.ts` (317 satır), `src/worker/stages/hotelTour.ts` (313 satır) |
| M3 — Onay kuyruğu (reviewGate, Review.tsx, story_reference) | ✅ | `src/publish/reviewGate.ts` (277 satır), `panel-web/src/pages/Review.tsx` |
| M4 — Toplu (batch) üretim | ✅ | `src/panel/routes/batch.ts`, `BatchProducer.tsx`, `BatchProgress.tsx` |
| M5 — Hikaye kanalı hattı (transkript→olgu özeti→senaryo→görsel kaynaklama→render) | ✅ | `src/story/*` (5 dosya), `src/worker/stages/storyNarrative.ts` |
| M6 — Instagram Reels + TikTok gerçek yayın adaptörleri, otel veri sağlayıcı zinciri | ✅ | `src/publish/adapters/{instagram,tiktok}.ts`, `src/hotelData/*` (6 dosya) |
| Ek — Thumbnail üretimi, otomatik Shorts türetme (repurpose), niche alanı, pm2/systemd, otomatik yedekleme, `/api/health` | ✅ | `src/render/thumbnail.ts`, `src/publish/repurpose.ts`, `scripts/backupDb.ts`, `ecosystem.config.cjs`, `deploy/*.service` |

### Bilinen boşluklar (README + DEVAM_NOTU.md kaynaklı, kod eksikliği değil kapsam dışı)

- **FunnyRanking (komik Shorts) discovery/curation hiç yazılmadı** — kaynak video keşfi yok,
  bu kanal türü elle `sourceRef` verilmeden worker stage'i "not yet implemented" ile başarısız olur.
- **Facebook adapter stub** — `publish_target` veri modeli hazır, gerçek kod yok (kullanıcı istemedi).
- **TikTok yükleme tek parça, 64MB sınırlı** — çok parçalı yükleme eklenmedi.
- **Instagram cross-post `PUBLIC_MEDIA_BASE_URL` gerektirir** — VPS'te nginx/Caddy ile herkese açık
  adres kurulumu gerekiyor, kod tarafında eksik değil.
- Orijinal plandaki MapLibre harita katmanı ve CapCut draft dışa aktarıcı hiç uygulanmadı
  (kullanıcı gereksinimleri bu yöne gitmedi).

### Değişen dosyalar (bu oturumda, kod değişikliği yok — sadece ortam kurulumu)

- Yeni: `C:\Users\MONSTER\claaudeproje\shortsfactory\` altında `ecosystem-hub` (yeni boş branch
  `claude/youtube-shorts-automation-plan-779kjx` açıldı, ecosystem-hub'da bu branch'e karşılık
  gelen uzak iş yok — hub sadece proje listesi/README tutuyor, shorts-factory kodu `manager`
  reposunda) ve `manager` (mevcut branch fast-forward edildi) clone edildi.
- `manager/AUDIT.md` bu dosya, yeni oluşturuldu.

### Güvenlik kontrolü

- `git log --all -p -- '*.env'` → boş, hiçbir `.env` dosyası hiçbir commit'te yok.
- `.gitignore` içinde `.env`, `node_modules/`, `data/*`, `*.log` doğru şekilde hariç tutulmuş.
- `git ls-files | grep '^\.env$'` → sonuç yok, çalışan ağaçta da commit edilmiş `.env` yok.
- **Sonuç: secret/credential sızıntısı bulunamadı.**

### Bağımlılık/config değişikliği

- Yeni paket kurulmadı (henüz `npm install` tamamlanamadı — aşağıya bakın).
- `.env.example` üretici oturumda genişletilmiş (Instagram/TikTok/Google Places/notify/panel
  şifre hash'i alanları eklenmiş) — mevcut `.env` varsa (bu makinede yok) yeni alanlarla
  karşılaştırılıp doldurulmalı.

### Test/doğrulama — ne yapıldı, ne yapılmadı

**Yapıldı (önceki oturumlarda, DEVAM_NOTU.md'ye göre):**
- `typecheck` ve `panel-web` build'i temiz geçmiş (o ortamda).
- Worker'ın atomik kuyruk mantığı (claim/sweep/review_item yazımı/çifte-onay koruması)
  gerçek bir SQLite dosyasına karşı elle test edilmiş.

**Bu makinede yapılamadı — AÇIK BLOKER:**
- `npm install` **başarısız** — `better-sqlite3` native derlemesi Visual Studio Build Tools
  bulunamadığı için patlıyor (`gyp ERR! find VS ... Could not find any Visual Studio installation`).
  Node sürümü `v24.13.0` — bu sürüm için `better-sqlite3` prebuilt binary bulunamamış olabilir.
  Kullanıcı ile "Node sürümünü değiştir" (nvm-windows) yoluna karar verildi ama **nvm-windows
  bu makinede kurulu değil** — kurulum onayı bekleniyor (winget mevcut: `winget install
  CoreyButler.NVMforWindows`).
- Bu bloker çözülmeden: `npm run typecheck`, `npm run pipeline -- --stage doctor`, gerçek
  render/publish testleri bu makinede **hiç çalıştırılamadı**.
- Hiçbir gerçek video hiçbir ortamda uçtan uca üretilip yayınlanmadı (DEVAM_NOTU.md'nin kendi
  ifadesiyle: "kod doğru mu → evet, gerçek video üretip yayınladı mı → henüz hayır").

### Kalite

- Kod tabanı 149 dosya, `GLOBAL_PROJECT_RULES.md` kısıtlarına (modül başına 600 satır, try-catch,
  sabitler `config/constants.ts`, sessiz hata yok) tabi — bu kurala uyum bu oturumda tekrar
  denetlenmedi, önceki oturumların taahhüdüne güvenildi.
- LLM içerik üretimi (hikaye kanalı script/factBrief) iki aşamalı özgünleştirme ile telif riskini
  azaltıyor ama sıfırlamıyor — README bunu açıkça "editoryal gözden geçirme hâlâ senin işin" diye not ediyor.
- Otel veri zinciri (Google Places → HolidayCheck → Booking → elle) en iyi çaba prensibiyle
  çalışıyor, scraper'lar sessizce boş dönebilir (crash etmez) — kritik değilse kabul edilebilir,
  ama üretim kalitesi elle spot-check gerektirir.

### Açık riskler / bilinen eksikler

1. **[BLOKER] npm install çalışmıyor bu makinede** — better-sqlite3 native build, VS Build Tools yok.
2. Hiç gerçek ortamda (VPS) çalıştırılmadı — ffmpeg/yt-dlp/gerçek API anahtarları hiç test edilmedi.
3. FunnyRanking kanalı discovery eksikliği yüzünden fiilen kullanılamaz durumda (elle sourceRef olmadan).
4. TikTok büyük video desteği yok (>64MB).
5. Instagram/Facebook cross-post için public URL altyapısı (nginx/Caddy) henüz kurulmadı.

### Sonraki adım

1. **Öncelik — bloker çöz:** nvm-windows kur (`winget install CoreyButler.NVMforWindows`),
   Node LTS'e geç (ör. 20.x/22.x — better-sqlite3 prebuilt binary olan bir sürüm), `npm install`
   tekrar dene.
2. `npm run typecheck` ile kod bütünlüğünü bu makinede de doğrula.
3. `.env` oluştur, `.env.example`'a göre doldur (en az bir LLM anahtarı + panel şifre hash'i).
4. `npx tsx scripts/migrateChannelsToDb.ts` + `npm run pipeline -- --stage doctor`.
5. VPS kurulumuna geç (DEVAM_NOTU.md'deki "VPS kurulumu — sırayla" bölümü) — bu Windows makine
   muhtemelen sadece geliştirme/kod inceleme içindir, gerçek üretim VPS'te olacak (ffmpeg/yt-dlp
   Windows'ta ayrı kurulum ister).

---

## 2026-08-28 — Daily Report

- **Tarih:** 2026-08-28
- **Bugün yapılanlar:** Yeni makinede proje kurulumu; ecosystem-hub + manager clone edildi;
  local branch'in 14 commit geride olduğu keşfedildi ve fast-forward ile senkronize edildi;
  tam kapsamlı proje audit'i (bu dosya) çıkarıldı.
- **Kalanlar / bloklayıcılar:** npm install bloklanmış durumda (better-sqlite3 native build,
  VS Build Tools eksik). Kullanıcı "Node sürümü değiştir" yolunu seçti, nvm-windows kurulum
  onayı bekleniyor.
- **Kararlar:** Node sürüm yöneticisi (nvm-windows) ile better-sqlite3 uyumlu bir Node sürümüne
  geçilecek — VS Build Tools kurulumu (ağır, ~6GB) yerine tercih edildi.
- **Riskler:** Doğru Node sürümü seçilmezse (better-sqlite3 prebuilt binary'si olmayan bir sürüm)
  bloker devam edebilir — ilk denemede LTS (22.x) önerilir, olmazsa 20.x.

## 2026-08-28 — Gün Sonu Backup

- **Ne yedeklendi:** Yerel değişiklik yok (sadece clone + fast-forward, kod değişikliği yapılmadı).
  Bu dosya (`AUDIT.md`) yeni oluşturuldu, henüz commit edilmedi.
- **Nereye:** Local `C:\Users\MONSTER\claaudeproje\shortsfactory\manager\` — repo zaten
  `origin/claude/youtube-shorts-automation-plan-779kjx` ile senkron (fast-forward sonrası fark yok).
- **Doğrulama:** `git status` clean (AUDIT.md hariç), `git log` origin ile birebir eşleşiyor.
  Bu dosya commit edilip local push onayı istenecek (kullanıcı onayı gerektirir).

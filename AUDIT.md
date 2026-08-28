# AUDIT.md — shorts-factory

> Her projede kök dizine kopyala, doldur. Tarih + oturum bazlı satır ekle, üzerine yazma.

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

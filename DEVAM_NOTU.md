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

**Güncelleme (2026-08-29):** İlk gerçek uçtan uca render başarılı — gerçek DJI drone
klibi (GPS telemetrili), gerçek Gemini API, gerçek Piper TTS ile HotelTour videosu
üretildi ve onay kuyruğuna düştü (1920x1080, 106sn, thumbnail dahil). Yolda 9 gerçek
kod hatası bulunup düzeltildi (detay: `AUDIT.md` 2026-08-29 girişi + commit `1429822`)
— en önemlileri: HotelTour composition süresi sabit 60sn'ye kilitliymiş (gerçek video
süresi kırpılıyordu), TTS her zaman sabit Türkçe metin okuyordu (kanal dili ne olursa
olsun — düzeltildi, artık LLM kanalın dilinde üretiyor), ve 4K kaynak gereksiz yere
Remotion'a olduğu gibi veriliyordu (1080p'ye indirgeyince render **4.5x hızlandı**,
kalite kaybı yok). Kullanıcı düzeltilmiş örneği inceliyor, sonraki adım YouTube
OAuth kurulumu + ilk gerçek yayın denemesi.

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

## FunnyRanking (Komik Shorts) — genişletilmiş hedef (2026-08-31, henüz kodlanmadı)

Kullanıcının istediği tam akış:
1. **Kategori filtresi** — discovery sabit değil, esnek kategori/niş listesi olacak
   (örnek: pool fails, DIY fails, dance fails vb., kullanıcı çoğaltabilir). Referans
   kanal(lar)dan sadece seçilen kategoriye uyan klipler seçilecek.
2. **Şort başına kısa Gemini planlaması** — her aday klip için Gemini ile mini bir
   plan/senaryo/başlık üretilip panele otomatik düşecek (elle yapıştırma değil, uçtan
   uca otomatik).
3. **Otomatik üretim kuyruğu** — planlanan her short worker kuyruğuna otomatik girecek.
4. **Günde 3 shorts otomatik yayın** — kullanıcı diğer kanallarla ilgilenirken bu
   kanal kendi başına günlük ritimde yayınlamaya devam edecek.

Bağımlılıklar / blokerler:
- Şu an discovery/curation hiç yazılmamış (bkz. "Bilinen boşluklar" yukarıda) — bu
  dört maddenin temeli, önce bu kurulmalı.
- **YouTube kanal bağlama panelde yok** (sadece Facebook/Instagram/TikTok var,
  `Connections.tsx`) — YouTube OAuth için kullanıcının Google Cloud'da OAuth consent
  screen + client id/secret açması gerekiyor (bu adım kullanıcının kendi işlemi,
  Claude yapamaz), sonra kod tarafı (Facebook'un OAuth akışı örnek alınarak) yazılabilir.
  Yayın otomasyonu bu olmadan sonuçları YouTube'a gerçekten basamaz.
- Ses önizleme ("dinle" butonu) kodu ve backend API'si (`/profiles/:id/samples`,
  `/samples/:id`) bu oturumda gerçek Voicebox sunucusuna karşı doğrulandı, çalışıyor —
  Voicebox sesleri (Mytischeecho/HKG2/HKG) ekran görüntüsünde de teyit edildi.
  **Piper önizlemesi kırıktı, kök neden bulunup düzeltildi (2026-08-31): `piper`
  binary'si PATH'te hiç yoktu** (sadece `.onnx` model dosyaları `data/tts-voices/`
  altında duruyordu, `listPiperVoices()` bunları diskten okuyup listeliyordu ama
  gerçek sentez binary'si eksikti). Çözüm: `pip install piper-tts` (yeni CLI'nin
  `--output_file`/`--model` bayrakları `piper.ts`'teki çağrıyla birebir uyumlu,
  `echo text | piper --model ... --output_file ...` ile gerçek WAV üretimi
  doğrulandı). **Panel/worker süreçleri piper kurulmadan önce başlamış olabilir —
  yeniden başlatılmaları gerekebilir ki güncel PATH'i görsünler.**

Sıralama netleşmedi: önce discovery+kategori filtresi mi, önce YouTube OAuth
(kullanıcının Google Cloud adımı) mı başlasın — sıradaki oturumda kullanıcıya sorup
netleştir.

**Güncelleme (2026-08-31) — kategori filtresi kodlandı, typecheck temiz (backend + panel-web):**
- Netleşen gerçek akış: kullanıcı FunnyRanking kanalına elle 5(+) kaynak video linki
  verecek (BatchProducer zaten destekliyor) + kanal ayarına istenen tema listesini
  yazacak (örn. "pool fails", "DIY fails", "dance fails") — discovery "hangi videoyu
  izleyelim" değil, video İÇİNDEKİ hangi anları seçelim sorusuna kategori-farkında
  cevap vermeli. `topicDiscovery.ts`'teki (referans-kanal modu için) başlık/açıklama
  anahtar-kelime filtresi de eklendi ama asıl düzeltme `rankingPlanner.ts` +
  `funnyRanking.ts`'te: `channel.settings.discoveryCategories` artık `planRanking()`'e
  geçiyor, LLM sistem promptuna "sadece bu temalara uyan adayları seç, uymayanı asla
  seçme" kuralı ekleniyor.
- Yeni alan: `ChannelSettings.discoveryCategories: string[]` — hem backend
  `channelSettings.ts` hem frontend `api.ts` (iki ayrı tip tanımı var, ikisi de
  güncellendi). Panelde "Genel ayarlar" kartına yeni bir textarea eklendi
  (FunnyClip/FunnyRanking kanallarında görünür, satır satır kategori girilir).
- Bilinen risk, kullanıcı kabul etti: `findCandidates` aday pencereleri
  TRANSKRİPT/ALTYAZIDAN çıkarıyor — altyazısız/sessiz "fails" videolarında aday
  bulunamaz, iş başarısız olur. Kullanıcı bunun için altyazılı kaynak video
  seçeceğini söyledi, ek bir görsel/ses tabanlı algılama şimdilik yazılmadı.
- Zamanlama ("günde 3 shorts") için yeni kod GEREKMİYOR — `ScheduleRuleEditor`
  zaten çoklu saat slotu + günlük tekrar destekliyor, panelden 3 slot eklenip
  her gün seçilmesi yeterli.
- Hâlâ eksik/açık: YouTube OAuth panel UI'si (kullanıcının Google Cloud'da OAuth
  consent screen + client id/secret açması gerekiyor, bu olmadan kod tarafı
  yazılamaz/test edilemez).
- **Yeni netleşen istek, henüz kodlanmadı — ayrı, daha büyük iş:** haftalık stok
  planlamasında (örn. Shorts1..5) kaynak linkler o short'a özel değil, TÜM haftalık
  parti için ORTAK BİR HAVUZ olmalı. Shorts2'nin istediği tema, sadece Shorts2'ye
  verilen linklerde değil, havuzdaki TÜM linklerde (Shorts1/3/4/5'in linkleri dahil)
  aranmalı. Şu anki mimari "1 iş = 1 kaynak video" varsayıyor (`funnyRanking.ts`
  tüm adayları tek `downloadedPath`'ten çıkarıyor). Havuz mantığı için gerçek bir
  refactor gerekir: havuzdaki tüm videolar (bir kere) indirilip her birinden aday
  çıkarılmalı, adaylar kaynak video etiketiyle birleştirilmeli, `planRanking` havuzun
  TAMAMINDAN o short'un temasına uyanları seçmeli, `cutAndFrame` seçilen her adayı
  KENDİ kaynak videosundan kesmeli (şu an hepsi ayni `downloadedPath`'i varsayıyor).
  Küçük bir tweak değil, sıradaki oturumun ana işi olmalı.
  - Ek detay: indirilen havuz videolarının bir ömrü olmalı (HDD şişmesin). Havuz
    sabit boyutlu olabilir (örn. 20 video), yeni link eklendikçe en eskisi silinir —
    ama silmeden ÖNCE o videodan çıkarılabilecek her adayın gerçekten kullanıldığından
    (ya da en azından bir kez taranıp değerlendirildiğinden) emin olunmalı, kuyrukta
    henüz işlenmemiş/kullanılabilir aday varken video silinmemeli.

**Referans kanal gözlemi (2026-08-31, @FunandRank, ~30 short incelendi):**
- Kategori çeşitliliği geniş: pool/DIY/gym/sports/animal/baby/cooking fails +
  "Who Did It Best" tarzı dans/trend karşılaştırma sıralamaları + "Battle of
  Beauties" gibi rekabetçi format — sadece "fails" değil.
  `discoveryCategories`'e örnek olarak eklenebilir: animal fails, baby fails,
  husband fails, dans/trend "who did it best" rankings.
  - Format sabit: "FUN & RANK" marka banner + üstte alt-tema yazısı (örn. "BEST
    FAILS OF THE DAY") + numaralı geri sayım (#5→#1) + alt kalın altyazı.
  - Başlık kalıpları: "(Wait for #1)", "(Try Not To Laugh)" gibi tık-tuzağı
    ekleri — `rankingPlanner.ts`'in title/hook kuralına örnek olarak eklenebilir.
  - Görüntülenme sayıları çoğunlukla düşük (10-100 arası "bin"), nadiren
    patlıyor (1B-10B = 1000-10000) — her short'un viral olmayacağı baştan kabul
    edilmeli, pipeline kalitesi tek başına garanti değil.
  - **İstek, henüz yazılmadı:** köşede tekrarlayan "reaksiyon yüzü" meme overlay'i
    (referans kanalda aynı yüz PNG'si defalarca farklı klipte kullanılıyor) —
    `renderRemotion`/`FunnyRanking` composition'a veya thumbnail'e eklenebilir,
    şimdilik polish/nice-to-have, öncelik değil.

**Yayın stratejisi referansı (2026-08-31, kullanıcının eskiden elle/Gemini ile yaptığı
günlük plan örneği) — ileride adaptif zamanlama için, şimdi kodlanmadı:**
- Günde 3 slot: 12:30 / 17:30 / 22:30 (mevcut basit ScheduleRuleEditor ile bugün
  bu saatlerle başlanabilir, ekstra kod gerekmez).
- Stratejik sıralama fikri (ileride): 12:30 = geniş kitleye hitap eden "güvenli"
  içerik (algoritmanın doğru kitleyi bulması için ilk 1-2 saatlik düşük veriye
  takılmadan bekleniyor), 17:30 = 12:30 videosunun kitle-genişleme ivmesine
  BAKILARAK en yüksek "duygu dozu"na sahip adaydan seçilir, 22:30 = günün
  finali, gece kitlesi için en "savage"/tartışma-tetikleyici içerik.
  **Bu, gerçek zamanlı YouTube Analytics entegrasyonu + reaktif karar mantığı
  ister (17:30 seçimi 12:30'un canlı performansına bağlı) — bugünkü statik
  yayın hedefinin çok ötesinde, ayrı ve büyük bir özellik. Şimdilik basit sabit
  3-slot ile başla, bu adaptif katman ileride ayrı bir oturumda ele alınmalı.**

**TierList/Crash Dummy içerik türü (2026-08-31) - iskelet kodlandı, çalıştığı
görsel olarak doğrulandı, typecheck temiz:**
- Ayrı kanal DEĞİL - "Komik Shorts"un ikinci içerik türü (FunnyRanking'in
  yanında). Format: Crash Dummy karakteri gerçek marka reklamlarından kısa
  anları (2-3sn) S/A/B/C/D tier listesine yerleştirip alaycı yorum yapıyor.
- **Telif/marka riski kullanıcıya açıkça anlatıldı, kullanıcı bilerek devam
  kararı verdi**: kısa klip + ağır yorum katmanı + Content ID'yi normal
  işletme maliyeti kabul etme stratejisiyle ilerleniyor.
- Yeni dosya: `remotion/compositions/TierList.tsx` (+ `Root.tsx`'e kayıt) -
  `FunnyRanking.tsx` deseni takip edilerek yazıldı: üstte %38 karakter paneli
  (statik görsel, hafif zoom), altta S/A/B/C/D tier tahtası (kod-çizimi renkli
  şeritler, şu an placeholder - kullanıcının verdiği gerçek tahta PNG'si
  henüz dosya yolu olarak gelmedi, gelince arkaplan resmi olarak değiştirilecek
  ve slot koordinatları o görsele göre hizalanacak), aktif klip sağ üstte
  küçük "spot" video, alt yazı `CaptionLine` ile senkron. Remotion Studio'da
  görsel olarak dogrulandı (D-tier + B-tier dolarken doğru sırayla birikiyor,
  altyazı senkron).
- Karakter görseli: kullanıcı Freepik/Magnific'te ürettiği 4 adaydan birini
  (`public/tierlist/dummy.png`) seçti - **hepsinde kask üzerinde kırmızı/beyaz
  "Target" (ABD market zinciri) logosuna çok benzeyen bir amblem vardı, bu
  fark edilip PIL ile düz beyaz yamayla temizlendi** (bkz. session log).
  Göğsündeki sarı/siyah crash-test-dummy piktogramı (jenerik, markasız) kaldı,
  kullanıcının önerisiyle bu semboller kullanılacak.
- **Henüz yapılmadı:** gerçek tier-board arkaplan PNG'sinin dosya yolu (kullanıcı
  Freepik'te üretti, henüz kaydedip yol vermedi), gerçek reklam klipleri
  (worker stage tarafı - `funnyRanking.ts` deseninde yeni bir `tierList.ts`
  worker stage'i + `rankingPlanner.ts` benzeri bir `tierPlanner.ts` LLM
  planlayıcısı yazılmalı, henüz yazılmadı), gerçek TTS/ses (ElevenLabs
  "Antoni"/"Callum" tarzı hızlı/enerjik ses önerildi - şu anki Piper/Voicebox
  seslerinden farklı bir profil gerekebilir).

Detaylı mimari, tüm CLI komutları ve "Isletim" (pm2/systemd/yedekleme/health check)
bölümü: `README.md`. Sorun çıkarsa oturuma devam edip birlikte bakarız.

## Standardizasyon + çok-kanal uçtan uca plan (2026-09-01)

### Hedef

Kanal-özel panel değil, **tek standart panel**: yeni bir kanal eklerken kod
değişikliği gerekmez, sadece config/DB satırı. Bunu doğrulamak için gerçek
kanalların (mystisches-echo zaten uçtan uca doğrulandı — bkz. o kanalın kendi
Memory.md'si) her biri gerçek bir uçtan uca denemeden geçirilecek: hata/eksik
çıktıkça anında bu dosyaya ve `AUDIT.md` checklist'ine işlenir, küçük olan hemen
düzeltilir, büyük olan roadmap'te kalır. Son bir gözden geçirmeyle yayına alınır.

### Kritik bulgu: 2 farklı "aile" var, panel sadece birini kapsıyor

Araştırıldı (2026-09-01), varsayım değil:

- **AI-görsel dokümanter ailesi** — `mystisches-echo` (bkz kendi klasörü, uçtan uca
  doğrulandı) + **`historisches-kapital`** (kendi `Instructions.md`'sinde tanımlı
  gerçek kanal: "Historisches Kapital", tarihi filozof/ekonomist vs modern finansal
  kriz teması, "Dark Cinematic Realism" AI görsel stili, zaten 1 yayınlanmış bölüm
  var — `episodes/ep01-al-ghazali/`). Bu aile **tamamen manuel/script tabanlı**,
  panelde hiç yok. ACE-Step müzik, Groq hizalama, karaoke altyazı, rain-overlay gibi
  parçalar mystisches-echo'da doğrulandı ve tekrar kullanılabilir durumda.
- **Gerçek-footage ailesi** — panelin kendi `HotelTour*`/`FunnyRanking`/`StoryNarrative`
  stage'leri. **`Türkei Urlaub`** gerçek, canlı, 124 aboneli kanal (doğrulandı:
  youtube.com'dan 2 videosu kontrol edildi) — `travel` seed'i zaten DB şablonunda var.
  Aynı kanal iki farklı derinlikte video üretiyor (örnek: "Die dunkle Wahrheit über
  Side" = derin anlatı+tarih+gezi; "Land Of Legends Bei Tag & Nacht" = sade footage
  showcase, anlatı yok) — yani **tek kanal, sabit tek template yetmiyor**, konuya göre
  hangi yapı taşının (derin anlatı / POI-gezi bilgisi / saf footage) kullanılacağı
  seçilebilmeli.
- **Funrank (Komik Shorts)** — panelin `shorts`/`FunnyRanking` seed'i zaten DB
  şablonunda var, ama discovery/curation hiç yazılmadı (bkz. yukarıdaki "Ne var ne
  yok" bölümü) — bu kanalın gerçek/yeni statüsü ve bu turda discovery'nin gerçek
  yazılıp yazılmayacağı henüz kullanıcıdan onay bekliyor.

### Mimari sonuç: tek stage sözleşmesi + composable content

1. Her stage (AI-görsel dahil, port edilince) ortak bir sözleşmeye uysun: girdi =
   `ChannelConfig` + job, çıktı = video + metadata paketi (dil, tag, thumbnail,
   açıklama). Paylaşılan altyapı (upload, review gate, scheduler, thumbnail, dil,
   müzik, altyazı, SFX/efekt hook'ları) hep bu sözleşme üzerinden çalışsın, hiçbir
   content-type'a özel kod bunlara doğrudan dokunmasın.
2. **Kanıtlanmış ilk sızıntı, sözleşmenin ilk test senaryosu:** `src/publish/uploader.ts`
   `channel.language`'ı görmüyor, YouTube videoyu yanlış dilde (İngilizce) yayınlıyor
   (mystisches-echo'da elle yakalandı). Bu düzeltilirken sözleşme de kurulmuş olsun.
3. Türkei Urlaub için: sabit `defaultTemplate` yerine, konu bazında hangi yapı
   taşlarının (anlatı derinliği / POI-gezi bilgisi / saf footage) kullanılacağına
   karar veren bir seçim katmanı gerekiyor (LLM'e "bu konu için ne kullan" kararı
   verdirmek mi, yoksa yapılandırılmış bir enum/flag sistemi mi — henüz karar
   verilmedi, mimariyi kodlarken netleştirilecek).
4. AI-görsel ailesinin (mystisches-echo/historisches-kapital) panele 6. stage
   olarak portu — sıfırdan değil, doğrulanmış scriptlerden (ACE-Step/Groq/karaoke/
   rain-overlay) devşirilecek.

### Roadmap (AUDIT.md P0→P3) bu sözleşmenin parçası olarak ele alınacak

Müzik kütüphanesi/üretimi, gerçek zamanlı karaoke, SFX, görsel efekt sistemi, OAuth
scope — hepsi kanal-bazlı değil, paylaşılan altyapının bir parçası olarak çözülecek
(bkz `AUDIT.md`'deki 2026-09-01 checklist, aynen geçerli, tekrar taranmayacak).

**Yeni madde (2026-09-01):** Standart intro/outro de aynı kategoriye giriyor —
mystisches-echo'nun buddha-boy-akte-01 yayınında unutuldu (kanalın zaten var
olan intro/outro şablonu vardı, kod'a hiç bağlanmamıştı). Kanal konfigürasyonuna
intro/outro asset referansı eklenmeli, her assemble/render adımı bunu otomatik
kontrol etsin — pipeline'a manuel hatırlama ile değil, config'ten gelen zorunlu
adım olarak eklenmeli. Detay: `mystisches-echo/Instructions.md`.

### Düzeltme (2026-09-01): historisches-kapital ayrı 6. stage değil, StoryNarrative varyantı

Kullanıcı netleştirdi: historisches-kapital'in gerçek iş akışı — referans
kanallardaki en çok izlenen (İngilizce) videolardan konu bulmak, sonra o konuyu
**çeviri değil özgün** Almanca içerik olarak yeniden üretmek. `ep01-al-ghazali`
tam böyle üretildi (manuel).

Bu, panelin zaten var olan `topicSource: 'reference'` mekanizmasıyla (StoryNarrative'in
"referans kanal izle → transkript/olgu özeti → yeni özgün senaryo üret" adımı, bkz
`src/story/factBrief.ts`, `topicDiscovery.ts`) birebir örtüşüyor — tek fark **görsel
kaynaklama**: StoryNarrative şu an Pexels stok kullanıyor, historisches-kapital
AI-görsel (mystisches-echo tarzı, "Dark Cinematic Realism") kullanıyor.

**Sonuç:** historisches-kapital için ayrı bir 6. stage yazmaya gerek yok —
StoryNarrative'in `visualSourcing.ts` adımına AI-görsel üretimi **alternatif bir
kaynaklama yöntemi** olarak eklenir (kanal config'inde "visual source: stock |
ai_generated" gibi bir seçim), geri kalan zincir (script/topic-discovery/TTS/render/
upload) StoryNarrative'le aynı kalır. Bu, "tek stage sözleşmesi" prensibiyle de
tam örtüşüyor — content-type'a özel yeni bir zincir değil, mevcut zincirin bir
adımının pluggable alternatifi.

### Konu kuyruğu sırası (2026-09-01, güncellendi)

- **Birden fazla referans kanal olabilir** (tek kanal değil) — havuz hepsinin
  videolarından oluşur.
- Seçim **ağırlıklı-rastgele**: rastgele seçilir ama en çok izlenenler dahil
  edilme/öncelik açısından ağırlıklı — yani katı `viewCount DESC` sıralı kuyruk
  değil, yüksek izlenmeye sahip videoların havuza girme/seçilme olasılığı daha
  yüksek olacak şekilde ağırlıklandırılmış rastgele seçim.
- **Yayın sıklığı:** haftada 1-2 video.
- **Önden planlama:** birkaç aylık bir takvim/kuyruk önceden oluşturulabilir
  (canlı/anlık seçim zorunlu değil — örn. gelecek 2-3 ay için havuzdan ağırlıklı-
  rastgele seçilmiş bir liste baştan üretilip zamanlanabilir).
- Her zamanlanmış yayın slotunda (`scheduleRule`) kuyruktan bir sonraki video
  alınır, özgün Almanca içerik olarak uyarlanır. `topicDiscovery.ts`'in bunu
  şu an nasıl yaptığı doğrulanmalı, yoksa çoklu-referans-kanal + ağırlıklı-
  rastgele + önden-çoklu-ay-planlama mantığı eklenmeli.

**Panel görünürlüğü + global dedup (2026-09-01, yeni gereksinim):**
- Referans-kanal tabanlı bir kanal (örn. historisches-kapital) için panelde
  schedule planı ekranında **sıradaki video konuları otomatik listelenmeli**
  (havuzdan seçilmiş, henüz üretilmemiş konular önceden görünür olsun).
  Ayrıca **yapılmış olanlar da not edilip görünsün** (hangi konu, hangi tarih,
  hangi kanal).
- **Global tekrar-önleme (dedup), inceltildi (2026-09-01):** aynı konu/aynı
  kaynak video — ister aynı kanal ister **başka bir kanal** tarafından zaten
  işlenmiş olsun — birebir tekrar planlamaya alınmamalı (örn. kanal A
  Al-Ghazali'yi işlediyse kanal B aynı Al-Ghazali'yi tekrar almasın). Dedup
  kanal bazlı değil, **tüm sistem çapında** tek bir "işlenmiş konular" kaydı
  üzerinden çalışmalı.
  **Ama katı blok değil:** eğer gerçekten farklı bir bakış açısı/genişletilmiş
  konu varsa (aynı figür/olay ama yeni açı, yeni kaynak, derinleştirilmiş
  içerik), bu tam tekrar sayılmaz — sistem bunu **"devam episodu" (bölüm 2)
  olarak öner**, otomatik sessizce işlemesin, kullanıcıya/onay ekranına
  öneri olarak düşsün.

### Süre-uyum kuralı (2026-09-01, esnek dial — katı kural değil)

Uyarlanan bölümün süresi, kaynak videonun süresine göre bir **tolerans yüzdesi** ile
sınırlı olsun — ama sabit %25 değil, panelde **seçmeli** (%25 / %50 / %75 gibi) bir
ayar. Kanal veya iş bazında seçilebilir, katı/tek bir blok kural değil. Örnek doğrulama:
ep02 Hume taslağı kısaltıldıktan sonra 1320 kelime ≈ 9:33 çıktı, kaynak (9:24) ile
sadece %1.7 fark — %25 toleransı bile rahat karşılıyor, bu da yöntemin (gerçek anlatım
hızına göre kelime→saniye tahmini) işe yaradığını doğruladı.

### ep02 gerçek pipeline testi tamamlandı (2026-09-01) — bulgular

Text→sahne manifest→görsel prompt→TTS→Groq zaman hizalama→karaoke altyazı
zinciri baştan sona gerçek verilerle çalıştırıldı (historisches-kapital'da,
panel dışı ama aynı prensip). Sonuç: zincir otomatik çalışıyor, yolda 2
gerçek bug bulunup düzeltildi — **her iki Groq-çağıran script'te de (zaman
hizalama + karaoke altyazı) rate-limit (429) retry/backoff eksikti**, free
tier 20 req/dk sınırına 23 bölümlük bir işte kaçınılmaz çarpılıyor. Panel
tarafında da Groq'a çoklu ardışık çağrı yapan her yer (varsa) bu riski
taşıyor — kontrol edilmeli.

Tek gerçek otomasyon boşluğu: **görsel üretim adımı**. historisches-kapital'in
orijinal pipeline'ı burada manuel "Auto Meta" (Meta AI tarayıcı eklentisi)
kullanıyor — mystisches-echo'nun tam otomatik Modal+FLUX yaklaşımı buraya
henüz adapte edilmedi. Bu, "tek standart panel" hedefinin somut kanıtı:
StoryNarrative'in görsel-kaynaklama adımına AI-görsel alternatifi eklenince
(bkz yukarıdaki düzeltme notu) bu boşluk hem historisches-kapital hem
gelecekteki benzer kanallar için tek seferde kapanır.

Modal+FLUX adaptasyonunda 2 ek gerçek bug bulunup düzeltildi: (1) `.map()`
varsayılan davranışı tek sahne hata verince TÜM batch'i çökertiyordu -
`return_exceptions=True` + ayrı başarısız-listesi ile düzeltildi. (2) Golden
Rule 3 ("ekranda yazı yok") sadece prompt metnini kontrol ediyor, FLUX
levha/pankart/takvim gibi nesnelere kendiliğinden yazı hallüsine edebiliyor
- OCR tabanlı otomatik tespit eklendi (NSFW kontrolüyle aynı desen). İlk OCR
denemesi (`image_to_string` + ham karakter sayımı) %16 yanlış-pozitif verdi
(doku/gren desenlerini "yazı" sanıyordu) - `image_to_data` + güven skoru
(≥75) + gerçek kelime uzunluğu (≥4 harf) filtresine geçilince düzeldi.

**SONUÇ (2026-09-01):** `assemble_episode.py` (generic, mystisches-echo'nun
gap-closing dersini miras alan) ile tam montaj yapıldı — `episode_final.mp4`,
790.27s (narration 790.32s ile sadece 0.05s fark), 63 sahne, karaoke altyazı
senkron, logo watermark köşede doğru. **historisches-kapital için uçtan uca
zincir (script→prompt→görsel→TTS→hizalama→altyazı→watermark→montaj) bu turda
tamamen çalışır durumda doğrulandı**, 6 gerçek bug bulunup düzeltildi yol
boyunca. Kalan: intro/outro + periyodik CTA overlay (asset henüz yok, sadece
spesifikasyon var, bkz `historisches-kapital/Instructions.md`).

### Watermark + periyodik etkileşim overlay'i (2026-09-01, yeni ihtiyaç)

Kullanıcı ekledi: videoya (1) kalıcı kanal logosu watermark, (2) belirli
aralıklarla kanal dilinde "abone ol / takip et" tarzı hype/CTA overlay'leri
gerekiyor — YouTube dokümanter kanallarında standart pratik, dönüşüm için
önemli. Bu da diğer standart altyapı parçaları (intro/outro, dil, müzik) gibi
**kanal-config-driven** olmalı, hardcoded değil:
- Panelde kanal ayarlarına **logo/watermark upload** seçeneği.
- Panelde **overlay şablonu için prompt/metin girme** seçeneği (kanal dilinde,
  örn. "Abonniere jetzt" / "Subscribe now" / "Abone ol").
- Overlay sıklığı/zamanlaması da ayarlanabilir olmalı (örn. her N dakikada bir).
- Aynı paylaşılan altyapı sözleşmesinin parçası — assembler bunu kanal
  config'inden okuyup otomatik uygulasın, episode/kanal-özel kod gerekmesin.

**Yerleşim kuralı (2026-09-01, netleştirildi):**
- **Logo watermark:** SADECE köşe (üst veya alt, kullanıcı seçer) — asla ortada
  devasa. Küçük köşe logosu hem şık hem "kırpılamaz" (kırpmaya çalışan içeriğin
  kendisini de keser).
- **Text watermark:** ayrı bir seçenek, bu ortada/büyük olabilir (klasik stok-
  görsel tarzı çapraz tekrarlı metin — kırpılmaya karşı asıl koruma bu).
- **İkisi birlikte kullanılabilmeli** — panelde logo watermark ve text
  watermark için ayrı toggle/tick, ikisi de aynı anda açık olabilir.
- Panelde her ikisi için ayrı yerleşim + transparency (opacity) ayarı olmalı.
- `historisches-kapital/scripts/assemble_episode.py`'de ilk versiyon sadece
  logo watermark'ı destekliyordu (köşe, doğru yerleşim) — text watermark
  toggle'ı da eklendi (bkz script'in kendisi).

**Opacity kalibrasyon bulgusu + panel gereksinimi (2026-09-01):** ep02'de
watermark %15 opaklıkla test edildi, düz gri fonda görünüyordu ama kanalın
gerçek koyu/dokulu "Dark Cinematic Realism" sahnelerinde pratikte kayboldu —
kullanıcı fark etti, gerçek görüntüde görünmüyordu. **%70'e çıkarıldı**
(script varsayılanı güncellendi). Bu, sabit bir varsayılan değerin güvenilir
olmadığını kanıtlıyor — **panelde opacity ayarı canlı önizlemeli (gerçek
sahne üzerinde, düz test fonu değil) olmalı, hatta yayın-öncesi onay
ekranında da gösterilmeli** ki reviewer yayına almadan önce watermark'ın
gerçekten görünür olduğunu doğrulayabilsin.

**Kapsam netleştirmesi (2026-09-01):** Abone ol/zil/yorum-yap ikon animasyonlu
CTA overlay'i **Shorts hariç tüm kanallarda standart** olsun — tek video
kanalları (historisches-kapital, mystisches-echo, türkei-urlaub uzun format
vb.) için varsayılan açık, panel seviyesinde paylaşılan bir bileşen. Shorts
zaten kısa (~60sn altı) olduğu için periyodik overlay mantığı oraya uygulanmaz.
**Kanal dili ve logosu/adı otomatik algılanıp kullanılmalı** — CTA metni ve
görsel elementler kanal config'inden (`language`, logo asset, kanal adı)
otomatik türetilsin, her kanal için elle yeniden yazılmasın.

### Zamanlama payı kuralı (2026-09-01)

Toplu üretim zamanlandığında, render **yayın saatinden en az 12-24 saat önce**
onay ekranına düşmeli — reviewer'ın gerekirse müdahale/düzeltme yapacak vakti
olsun, son ana bırakılmasın. Worker/scheduler tasarımına dahil edilecek kural.

### Onay ekranında önizleme + düzeltme (2026-09-01, bugünün somut kanıtı)

ep02'nin bugünkü yayın-öncesi turunda chat üzerinden aynen bunu yaptık: video
izlendi, 3 gerçek sorun bulundu (intro'da takılma, ana seste parazit/cızırtı,
outro'da rahatsız edici bir SFX klibi), her biri **tüm pipeline'ı baştan
çalıştırmadan**, hedefli düzeltmelerle (~birkaç dakikada) giderildi. **Panelin
onay ekranı da aynı yeteneği sunmalı** — sadece onayla/reddet değil:
- Videoyu önizle, **özellikle hata/uyarı durumlarında** (örn. bir aşama
  kısmen başarısız olduysa — bir SFX eşleşmedi, bir sahne OCR'da engellendi,
  bir filtre adımı çöktü ve o adım atlanarak devam edildiyse) bunlar reviewer'a
  açıkça gösterilsin, sessizce geçilmesin.
- Reviewer belirli bir sorunu işaretleyip (örn. "bu zaman aralığında ses
  kötü") **hedefli yeniden üretim** tetikleyebilmeli — ilgili tek aşamayı
  (SFX/watermark/CTA/intro-outro/vb.) yeniden çalıştırıp geri kalanına
  dokunmadan.
- Bu, [[panel-otomasyon-yayin-onay-gereksinimi]] hafıza notuyla aynı ilke,
  bugünkü gerçek deneyimle somutlaştı — panel tasarımına birebir referans
  olarak kullanılabilir (bu oturumun kendisi bir "onay ekranı" simülasyonuydu).

### Açık kararlar (kullanıcı onayı bekliyor)

- Funrank/shorts: discovery/curation bu turda gerçek yazılsın mı, yoksa manuel
  `sourceRef` ile kısmi test mi (render/upload zinciri doğrulanır, discovery ayrı
  roadmap maddesi olarak kalır)?
- AI-görsel görsel-kaynaklama varyantının StoryNarrative'e eklenmesi ne kadar
  öncelikli — standardizasyonun ilk fazı mı, yoksa gerçek-footage ailesi (Türkei
  Urlaub composable-content + Funrank) önce mi standardize edilir?
- Türkei Urlaub'un composable-content seçim mekanizması: LLM karar versin mi, yoksa
  yapılandırılmış (config'te "bu konu tipi = şu yapı taşları") bir sistem mi?

### ep01 (Al-Ghazali) legacy-asset kurtarma turu — panel için yeni dersler (2026-09-02)

- **Önce yerel diski tara, web'e gitme:** Meta AI web arşivinden (browser üzerinden
  network-request takibiyle) tek tek düşük-çözünürlüklü görsel indirmeye saatlerce
  uğraşıldı, sonra kullanıcının kendi diskinde (`E:\algazaliHK\images` + alt klasör
  `klips`) aynı üretimlerin **94 JPG + 485 MP4** halinde zaten indirilmiş kopyaları
  olduğu ortaya çıktı. Panel/pipeline bir "legacy asset" veya "mevcut varlık" adımını
  render öncesi **ilk kontrol** olarak yapmalı — kullanıcının proje klasöründe hazır
  medya var mı diye bakmadan sıfırdan üretime/indirmeye geçmemeli.
- **Dosya adı sırası = anlatı sırası değil, varsayılamaz.** Kullanıcı bu görselleri
  rastgele numarayla kaydetmiş (`1.jpg` "sahne 1" demek değil). Panelin görsel-sahne
  eşleştirmesi dosya adı/klasör sırasına güvenmemeli — içerik bazlı (vision-LLM ile
  kısa açıklama çıkarıp transcript'in ilgili bölümüyle eşleştirme) bir adım şart,
  ve bu hacimli-ama-mekanik iş ücretsiz vision modeline (Gemini) verilmeli, Claude'a
  değil.
- **ffmpeg `zoompan` bu Windows makinesinde patolojik derecede yavaş/kararsız** —
  832×464 kaynaktan 1920×1080 hedefe zoom uygulanan 10 saniyelik bir klip 15+ dakika
  sürüp bitmedi (CPU aktif ama sonuç anormal büyük dosya, muhtemelen sonsuz-benzeri
  döngü). Kaldırılıp sabit crop+fade ile değiştirilince aynı klip saniyeler içinde
  normal boyutta bitti. **Panel/pipeline'da Ken-Burns/zoom-pan efekti risk olarak
  işaretlenmeli** — en azından bu sınıf donanımda varsayılan olmamalı, ya da
  kullanılmadan önce gerçek (kısa değil, çoklu-dakika) bir klip üzerinde ayrı test
  edilmeli.
- **`drawtext` crash'inin gerçek kök nedeni bulundu:** önceki oturumda (ep02) CTA
  overlay üç kez çökmüştü, sebep hep "periyodik `mod()` ifadesi" sanılmıştı. Bu
  oturumda `mod()`'u sabit `between()` pencerelerine çevirmeye rağmen YİNE çöktü —
  asıl sebep Windows font yolundaki (`C:/Windows/Fonts/...`) escape edilmemiş `:`
  karakteriydi (ffmpeg filtergraph'ta `:` seçenek-ayracı). Path'i `\:` ile escape
  edince (ya da fontu proje klasörüne kopyalayıp relatif yol kullanınca) CTA sorunsuz
  çalıştı. **Panel'in font-yolu her zaman ya escape edilmiş ya da relatif olmalı** —
  bu sınıf hata (yanlış teşhis → yanlış düzeltme → sorun gizlice kalıcı olma) panelde
  otomatik bir "önce izole test et" adımıyla önlenebilir.
- Yukarıdakiyle aynı ilke: **her yeni filtre/efekt önce kısa test klipte DEĞİL,
  gerçek uzunlukta bir klipte de doğrulanmalı** — `film-grain` (`noise=` filtresi)
  de bu turda gerçek (~18 dakikalık) render'da çöktü, halbuki daha önce kısa
  testlerde sorunsuzdu (tıpkı önceki CTA crash'inin öyküsü gibi). Panelin render
  pipeline'ı her efekti aktif ettiğinde, en azından bir kere tam-uzunluk bir dry-run
  ile doğrulanmasını zorunlu kılmalı.

## mystisches-echo: Bridey Murphy (Akte-03) turu — yeni dersler (2026-09-03)

- **ACE-Step müzik üretimi süreyle orantısız VRAM kullanıyor, sabit bir üst sınır
  şart.** ep01'de en uzun act 316.99s ile sorunsuz çalışmıştı; bu turda 455s/444s'lik
  iki act A100-40GB'de "Tried to allocate 36.45 GiB" ile OOM verdi. Her act'i ~240s
  altında tutunca (7 act'e bölünce) sorunsuz çalıştı. **Panel'de ACE-Step çağrısı
  öncesi bir süre-üst-sınırı (≈240-300s) kontrolü/otomatik-bölme adımı olmalı.**
- **Resumable script'ler dosya ADINA göre "zaten var" diyor, İÇERİĞE göre değil —
  tehlikeli sessiz bozulma.** Süre gruplarını 5 act'ten 7 act'e değiştirdiğimde,
  arka planda hâlâ çalışan eski döngü ESKİ (yanlış) süre/prompt ile ürettiği
  act02-05.wav dosyalarını YENİ isim şemasıyla aynı ada yazdı (`act04.wav` gibi) —
  script sadece dosya adının var olup olmadığına bakıyor, hangi parametreyle
  üretildiğine değil. ffprobe ile gerçek süreleri kontrol edince fark edildi,
  4 dosya silinip doğru parametrelerle yeniden üretildi. **Panelde resumable/skip
  mantığı content-hash veya parametre-imzası da tutmalı, salt dosya adı yetmez.**
- **Modal `.map()` uzun gRPC stream'i bu makinede erken "Connection lost" ile
  kesiliyor** (100 sahnelik FLUX görsel üretiminde art arda 2 kez, her seferinde
  yaklaşık aynı noktada). Kalıcı network sorunu değil, ama tek büyük `.map()` çağrısı
  güvenilir değil. Çözüm: işi küçük batch'lere bölüp (`--batch-size 10`), her batch
  ayrı `modal run` çağrısı olacak şekilde bash döngüsünde tekrar tekrar çalıştırmak
  (script zaten var-olan dosyaları atlıyor, resumable). **Panelde tek seferlik büyük
  Modal `.map()` yerine batch+retry-loop deseni varsayılan olmalı.**
- **Kanalın standart intro/outro'su ilk kez bu bölümde tam spek'e uygun üretildi**
  (`mystisches-echo/assets/branding/` — 5 kalıcı marka görseli: dossier kartı,
  yanan-göz logo, ağaç-kökü outro çerçevesi (FLUX kendiliğinden kukuletalı figürü de
  merkeze yerleştirdi, ayrı overlay gerekmedi), avatar amblemi; `scripts/
  make_intro_outro.py` — kanal-seviyesinde tekrar kullanılabilir, sadece
  `--case-title`/`--next-image`/`--next-title`/ses kaynağı episode'a özel).
  **Instructions.md'deki "Pflicht ab Episode 2" artık gerçek kod ile karşılanıyor —
  sonraki bölümler bu script'i çağırmalı, yeniden unutulmamalı.**
- **Kullanıcı geri bildirimi (yayından hemen sonra): anlatım "koşar adım", duygu/
  gerilim için boşluk/ritim yok.** Kök neden muhtemelen transcript'i süre hedefine
  ulaştırmak için genişletirken sadece bilgi eklenmesi, duraklama/nefes-alma beat'i
  eklenmemesi — VoiceBox TTS de noktalama dışında ek duraklama uygulamıyor. Detay ve
  sonraki-bölüm kontrol listesi: proje hafızası
  `mystisches-echo-anlatim-ritmi-eksik.md`. **Panelin transcript-genişletme adımı
  "hedef süreye ulaştı mı" yanında "yeterli duraklama beat'i var mı" diye de
  kontrol etmeli.**
- **YouTube Data API upload'ı mystisches-echo'da sessizce otomatik kaldırılmıştı —
  kök neden bulundu ve çözüldü (2026-09-03).** `upload.py` ile public yüklenen
  video (22:24) API'den "başarılı" göründü ama kısa süre sonra "çok uzun olduğu
  için kaldırıldı" mesajıyla otomatik silindi, custom thumbnail set de 403 verdi.
  `channels.list(mine=True)` ile teşhis edildi: `token_mystisches-echo.json`
  **yanlış kanala** bağlıydı (eski kişisel "Nermin Y. Altindal" kanalı, 2013),
  gerçek "Das Mystische Echo der Seele" kanalına değil — muhtemelen `authorize.py`
  ilk çalıştırıldığında tarayıcıda yanlış Google hesabı/kanalı aktifti. Kullanıcı
  `authorize.py --channel-name mystisches-echo`'yu doğru hesapla yeniden
  çalıştırınca düzeldi (`title="Das Mystische Echo der Seele"`,
  `longUploadsStatus="allowed"` doğrulandı). **Panel dersi: `authorize.py` sonrası
  panel/pipeline otomatik bir `channels.list(mine=True)` doğrulama adımı
  eklemeli** (dönen kanal adını kullanıcıya gösterip "doğru kanal bu mu?" diye
  teyit ettirsin) — yanlış kanala bağlanma sessizce oluyor, saatler sonra "video
  kaldırıldı" şeklinde ortaya çıkıyor.

## Yeni özellik testi: otomatik tanıtım Shorts'ları (2026-09-03)

Kanaldaki 3 mevcut videonun (Bridey Murphy, Ram Bahadur/Buddha Boy, Titu Singh)
her biri için 1'er dikey (1080×1920) tanıtım Shorts'u üretilip yayınlandı —
ilk deneme, sonuç olumlu. Script: `mystisches-echo/scripts/make_shorts_promo.py`
(kanal-seviyesinde tekrar kullanılabilir, blur-arka-plan + net ön-plan + CTA
banner + cliffhanger end-card deseni).

**Tasarım ilkesi (kullanıcı talebi, vazgeçilmez): Shorts asla hikayeyi
çözmemeli, mutlaka tam videoyu izlemeye teşvik edici bir "cliffhanger"da
bitmeli.** Bu turda klip seçimi elle (manifest/transkript okunarak, cevapsız
bir soru veya "bekle, gerçek daha karmaşık" cümlesinde biten an bulunarak)
yapıldı — panel bunu otomatikleştirecekse, klip bitiş noktasını rastgele/sabit
saniye yerine transkriptteki soru işareti/gerilim cümlesi gibi bir işarete
göre seçmeli.

**Zamanlama ilkesi (kullanıcı talebi, vazgeçilmez): bir video yayınlandıktan
sonra 3 farklı Shorts otomatik zamanlanmalı — yayından 1 gün, 3 gün ve 5 gün
sonra, her biri farklı bir klipten.** Bu turda hepsi aynı anda elle yayınlandı
(test amaçlı) — panelde gerçek özellik olarak: video yayınlandığında (veya
onaylandığında) otomatik olarak 3 ayrı Shorts render+upload job'ı, videonun
`publishedAt`'ine göre +1g/+3g/+5g için zamanlanmalı, ve bu gecikme (1/3/5 gün,
Shorts sayısı) panelden kanal/iş bazında **ayarlanabilir** olmalı (sabit
kodlanmamalı).

**Panelde bu özellik için yapılması gerekenler:**
- **Klip seçimi otomasyonu:** `scene_manifest_timed.csv` + transkript üzerinden
  "hook adayı" tespiti (ör. soru cümlesiyle biten sahne, ilk N saniye içindeki
  gerilim cümlesi) — şu an elle seçildi, panel bunu bir sezgisel/LLM adımına
  bağlamalı (free-tier'a uygun, mekanik bir "en iyi cliffhanger anını bul" görevi).
  3 farklı zamanlanmış Shorts için 3 FARKLI klip seçilmeli (aynı klibin
  tekrarı olmamalı).
- **Zamanlama/schedule ayarı:** video yayınından +1g/+3g/+5g (varsayılan) —
  panelde kanal ayarlarına "yayın sonrası Shorts zamanlaması" alanı: kaç adet
  Shorts, hangi gün offsetlerinde (liste olarak düzenlenebilir, örn.
  `[1, 3, 5]`), açık/kapalı toggle. Worker/scheduler video `publishedAt`
  bilgisini job kuyruğuna offsetli olarak eklemeli.
- **Community post (anket/gönderi) otomasyonu — API'de mümkün değil (2026-09-03).**
  Kullanıcı önerdi: video yayınlandığında/sonrasında topluluğu canlı tutmak için
  otomatik Community-tab gönderisi (anket/soru, videoyla ilgili). **YouTube Data
  API v3'te Community post oluşturma endpoint'i yok** — bu, Shorts'u mevcut
  videodan klipleme özelliği gibi sadece Studio UI/mobil uygulamada var, API'ye
  hiç açılmamış. Tam otomasyon yapılamaz. **Yarı-otomasyon önerisi:** panel,
  video/senaryo içeriğine göre bir anket sorusu + seçenekleri otomatik üretip
  onay kuyruğunda/panelde göstersin (kopyala-yapıştır hazır), kullanıcı elle
  Studio'ya girip yapıştırsın — elle yazma işini ortadan kaldırır, tam otomasyon
  olmasa da zaman kazandırır. Kanalda zaten örnek "Test" gönderileri var (Side/
  Land of Legends içerikli anketler, 2026-03-01) — bu şablon olarak kullanılabilir.
- **3. bir kanalda (Türkei Urlaub — gerçek footage, bizim pipeline'ımızın
  ÜRETMEDİĞİ hazır videolar) test edildi, 5/5 shorts başarılı, +publishAt ile
  gün içine yayılmış zamanlama ilk kez gerçekten kullanıldı** (önceki turlarda
  hep anlık public'ti). Yeni dersler:
  - **Transkript/manifest'i olmayan (bizim pipeline dışı) kaynak videolar için
    Groq Whisper ile segment-seviyeli transkript çıkarmak işe yarıyor** — hook/
    cliffhanger tespiti için yeterli, `timestamp_granularities[]=segment` (word
    değil) bu iş için yeterli, daha ucuz/hızlı.
  - **Whisper, uzun sessiz/sadece-müzikli bölümlerde halüsinasyon üretiyor**
    (tekrar tekrar "Untertitelung des ZDF für funk" / "Bis zum nächsten Mal"
    gibi TV-altyazı eğitim verisinden kalıntı cümleler basıyor). Panel bunu
    otomatik ayıklamalı — ör. aynı cümlenin birden çok segment'te birebir
    tekrarı = muhtemelen halüsinasyon, gerçek konuşma değil, filtrelenmeli.
  - **Bazı videolarda hiç narrasyon yok** (sadece müzik+görsel showcase,
    örn. Digiverse/Land of Legends/Sandland) — bu durumda cliffhanger-metin
    stratejisi çalışmaz, panel bir fallback'e düşmeli: transkript boşsa/
    anlamsızsa GÖRSEL örnekleme (birkaç zaman noktasından kare çıkarıp en
    "çarpıcı" olanı seçme - şu an elle yapıldı) devreye girmeli.
  - **Kaynak videonun kendi içinde başka bir platformun UI chrome'u (360°
    video oynatıcı arayüzü, "Sessiz" butonu, VR rozeti) baked-in olabilir** —
    bu bizim hatamız değil, orijinal içeriğin kendisi öyle, ama shorts için
    klip seçerken bu tür segmentlerden kaçınmak gerekiyor (görsel örnekleme
    adımında otomatik tespit edilebilir bir şey değil, elle fark edildi).
  - **`yt-dlp` ile kendi kanalının videolarını indirmek** (Şort kaynağı için)
    büyük dosyalara (tekil video 1GB+) yol açıyor — bkz aşağıdaki disk alanı
    riski maddesi, aynı oturumda ortaya çıktı.
- **Yeni öneri (2026-09-03): üretilen her Shorts için "Instagram Story'ye
  gönder" / "Facebook Reels/Story'ye gönder" butonu veya oto-zamanlama.**
  Community post'un aksine bunun gerçek bir API karşılığı var — panelde zaten
  Instagram (Graph API) ve TikTok (Content Posting API v2) adapter'ları
  yazılmış durumda (bkz "Ne var ne yok" bölümü yukarıda), sadece Facebook Reels/
  Story'ye özel bir hedef eksik (mevcut Facebook adapter'ı stub). Aynı üretilen
  dikey Shorts dosyası (1080×1920, ≤3dk) IG Reels/Story ve FB Reels/Story için
  de kullanılabilir formatta zaten — ek render gerekmez, sadece dağıtım hedefi
  eklenir. Panelde onay ekranına (bkz "Onay ekranında önizleme" bölümü) her
  platform için ayrı toggle/zamanlama eklenmeli: "Şimdi", "Video ile aynı gün
  gecikmeli", veya manuel tarih/saat.
- **Disk alanı riski (2026-09-03, kullanıcı gözlemi):** Shorts üretimi için kaynak
  video indirme (`yt-dlp`, tekil videolar 1GB+) + render çıktıları (final mp4'ler,
  ara dosyalar) disk'te ciddi yer kaplıyor — özellikle bu turdaki gibi harici
  kanalların (Türkei Urlaub) mevcut YouTube videolarını yerelde işlerken. **Panel
  önerisi: belli bir süre sonra (ör. iş tamamlanıp onaylandıktan N gün sonra)
  büyük medya dosyaları otomatik bir Google Drive klasörüne taşınmalı, yerelde
  sadece bir link/referans kalmalı** — disk temizliği + arşiv erişimi bir arada.
  Henüz kodlanmadı, ileride ele alınacak.
- **Süre sınırı belirsizliği — ÇÖZÜLDÜ, endişe yersizmiş.** Üretilen Shorts'lar
  1:01/1:38/1:50 uzunluğunda (klasik 60sn sınırının üzerinde), kullanıcı YouTube
  Studio'da doğruladı: **üçü de "Shorts videoları" sekmesinde sorunsuz görünüyor**
  — YouTube'un 3dk'ya kadar dikey videoyu Shorts sayan güncel politikası burada
  net çalışıyor. Panelin 60sn'ye zorla sıkıştırma gibi bir kısıtlaması GEREKMİYOR,
  cliffhanger noktası doğal olarak nereye denk geliyorsa (3dk'ya kadar) sorun yok.
- **"Videoya link" mekanizması:** API'de Shorts'u ana videoya bağlayan resmi bir
  alan yok — açıklamanın ilk satırına `youtu.be/<id>` linki koymak (bu turda
  yapılan) pratik çözüm. Panel bunu şablonlaştırmalı; ayrıca yayından sonra ilk
  yorumu "Ganze Akte: <link>" olarak sabitlemek (comment pinning, ayrı bir API
  çağrısı) ek bir görünürlük katmanı olarak eklenebilir.
- **Kaynak videonun yerelde olmayabileceği durum:** Titu Singh videosu bu
  kanalın kendi eski yüklemesiydi ama pipeline'ın hiç işlemediği bir dosyaydı -
  `yt-dlp` ile kanalın kendi YouTube ID'sinden indirildi. Panel, "kaynak dosya
  yerelde yoksa kendi kanalından indir" adımını (sadece kendi videoları için)
  standart bir fallback olarak tanımlayabilir.

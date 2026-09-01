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

### Süre-uyum kuralı (2026-09-01, esnek dial — katı kural değil)

Uyarlanan bölümün süresi, kaynak videonun süresine göre bir **tolerans yüzdesi** ile
sınırlı olsun — ama sabit %25 değil, panelde **seçmeli** (%25 / %50 / %75 gibi) bir
ayar. Kanal veya iş bazında seçilebilir, katı/tek bir blok kural değil. Örnek doğrulama:
ep02 Hume taslağı kısaltıldıktan sonra 1320 kelime ≈ 9:33 çıktı, kaynak (9:24) ile
sadece %1.7 fark — %25 toleransı bile rahat karşılıyor, bu da yöntemin (gerçek anlatım
hızına göre kelime→saniye tahmini) işe yaradığını doğruladı.

### Açık kararlar (kullanıcı onayı bekliyor)

- Funrank/shorts: discovery/curation bu turda gerçek yazılsın mı, yoksa manuel
  `sourceRef` ile kısmi test mi (render/upload zinciri doğrulanır, discovery ayrı
  roadmap maddesi olarak kalır)?
- AI-görsel görsel-kaynaklama varyantının StoryNarrative'e eklenmesi ne kadar
  öncelikli — standardizasyonun ilk fazı mı, yoksa gerçek-footage ailesi (Türkei
  Urlaub composable-content + Funrank) önce mi standardize edilir?
- Türkei Urlaub'un composable-content seçim mekanizması: LLM karar versin mi, yoksa
  yapılandırılmış (config'te "bu konu tipi = şu yapı taşları") bir sistem mi?

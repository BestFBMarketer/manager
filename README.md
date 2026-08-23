# shorts-factory

Otomatik YouTube video fabrikasi: **komik Shorts** kanali ve **gezi/seyahat (drone)** kanali icin
indirme → kesim → Remotion ile veri-odakli katman → zamanlanmis yayin hatti.

> Not: Bu kod gecici olarak `manager` reposunda gelistirilmektedir; hedef repo `shorts-factory`.

---

## Ne yapar

| Sablon | Kanal | Tempo | Cikti |
|---|---|---|---|
| `FunnyShort` | Komik Shorts | gunde 3 | 1080x1920, <60 sn, altyazi + hook |
| `HotelTourLandscape` | Gezi / Seyahat | haftada 3 | 1920x1080, hedef 8-12 dk, harita + otel bilgi kartlari |
| `HotelTourVertical` | Gezi turevleri | uzun video basina 3 | 1080x1920 teaser, uzun videoya trafik |

Gezi hattinda drone goruntusunun uzerine bolge haritasi, havaalanindan otele ulasim animasyonu,
oteli gosteren ok + isim etiketi ve otel bilgi kartlari (oda sayisi, kapasite, havaalanina mesafe,
her sey dahil mi, yorum/oneri orani) bindirilir. DJI `.SRT` telemetrisi varsa harita, ucusun
**gercek GPS iziyle senkron** ilerler.

---

## Kurulum

```bash
npm install
cp .env.example .env      # anahtarlari doldur
npm run pipeline -- --stage doctor
```

Sistem gereksinimleri (VPS): `ffmpeg`, `ffprobe`, `yt-dlp`, Chromium (Remotion/WebGL icin),
Python 3 + `faster-whisper`. Onerilen: 8 vCPU / 16 GB RAM.

---

## Kullanim

```bash
# Ortam kontrolu: ikili dosyalar, LLM saglayicilari, kanallar, DB
npm run pipeline -- --stage doctor

# Video bilgisi
npm run pipeline -- --stage probe --input video.mp4

# Kesim + dikey cerceve + ses normalizasyonu
npm run pipeline -- --stage cut --input video.mp4 --start 12 --end 45 \
  --orientation vertical --framing crop --output out/short.mp4

# DJI telemetrisi ayristirma
npm run pipeline -- --stage srt --input DJI_0001.SRT

# GoPro telemetrisi (MP4 icine gomulu GPS)
npm run pipeline -- --stage gpmf --input GX010001.MP4

# Seslendirme testi (Voicebox -> Piper zinciri, ikisi de ucretsiz)
npm run pipeline -- --stage tts --input "Bes numara: kediyi kim tuttu?" --output out/vo.wav

# LLM zinciri testi (once ucretsiz katman denenir)
npm run pipeline -- --stage llm --input "Kedi masadan atlarken kayiyor ve sahibine carpiyor"

# Bugunku LLM harcamasi
npm run pipeline -- --stage cost
```

---

## LLM maliyet politikasi

Her LLM cagrisi bir **is tipi** ile yapilir; router o tip icin tanimli zinciri sirayla dener
(`src/config/llmChains.ts`). Kural: **ucretsiz katmanda yapilabilen is ucretli API'ye gitmez.**

| Is tipi | Zincir |
|---|---|
| `classify`, `metadata`, `highlight` | gemini (ucretsiz) → deepseek → openai → claude |
| `viralHook`, `shortsPlan` (kalite-kritik) | claude → openai → gemini |
| Transkripsiyon | **yerel Whisper** — API'ye hic gitmez |

Koruma katmanlari:
- `quotaTracker` saglayici basina dakikalik/gunluk kullanimi sayar, limit dolmadan sonrakine gecer (429 yemeden).
- Ucretli saglayicilar `DAILY_PAID_BUDGET_USD` tavanina takilir; tavan asilinca yalnizca ucretsizler calisir.
- Sema dogrulamasini gecemeyen yanit maliyet olarak kaydedilir ve zincirde ilerlenir.
- Claude tarafinda prompt caching (sabit sistem promptu) + dusuk `effort` ile token maliyeti kisilir.
- Her cagri `llm_usage` tablosuna yazilir; `--stage cost` gunluk harcamayi verir.

---

## Proje yapisi

```
src/
  config/      constants, env, channels, llmChains
  core/        logger, db (SQLite), retry, exec
  llm/         router, quotaTracker, providers/{gemini,deepseek,openai,claude}
  ingest/      probe (+ downloader, driveWatcher)
  telemetry/   djiSrtParser (DJI ucus izi)
  edit/        ffmpegCut, verticalFrame
  pipeline.ts  asama bazli CLI
remotion/      kompozisyonlar (FunnyShort, HotelTour*, MapLayer)
```

---

## Remotion kompozisyonlari

| Kompozisyon | Olcu | Kullanim |
|---|---|---|
| `FunnyRanking` | 1080x1920 | Geri sayimli Top-5: hook → siralar → kapanis |
| `HotelTourVertical` | 1080x1920 | Gezi teaser'i, POI yazi kartlari |
| `HotelTourLandscape` | 1920x1080 | Uzun gezi videosu |

Bilesenler: `RankBadge` (yaylanarak girip koseye cekilen sira numarasi),
`CaptionLine` (kelime kelime vurgulanan altyazi), `HookTitle`, `PoiCard`
(baslik + kisa not + kaynak atfi, donusumlu sag/sol yaslama).

```bash
npm run remotion:studio                       # onizleme
npm run remotion:render -- FunnyRanking out.mp4
npm run remotion:still  -- FunnyRanking f.png --frame=90
```

**Font:** `public/fonts/` altindaki Inter dosyalari `staticFile` ile paketlenir.
Dosyalar yoksa render **calismaya devam eder** ve DejaVu Sans / Liberation Sans'a
duser (ikisi de Turkce karakterleri tam destekler). `@remotion/google-fonts`
bilerek kullanilmiyor: fontu render aninda CDN'den cektigi icin agsiz ortamda
render'i tamamen cokertiyor. Kurulum icin `public/fonts/README.md`.

**Render:** Chromium'un yeni headless modu gerekir; eski headless kaldirildi.
`--browser-executable` ile `chrome-headless-shell` gosterilmelidir.

## YouTube yayina alma

Resumable upload ile `private` yuklenir + `status.publishAt` ayarlanir; YouTube
verilen an geldiginde otomatik olarak public yapar. Kalici hatalar (400/401/403
- gecersiz istek, kota, yetkisiz) yeniden denenmez; 429/5xx ustel geri
cekilmeyle tekrar denenir.

**Kurulum (tek seferlik, kendi bilgisayarinizda):**
```bash
npx tsx scripts/authYoutube.ts shorts   # tarayici acilir, izin verilir
npx tsx scripts/authYoutube.ts travel
```
Cikan refresh token'i VPS'in `.env` dosyasina yapistirin - script bir daha
calistirilmaz.

**Kullanim:**
```bash
# Onizleme - hangi slot secilecek, gercek API cagrisi yok
npm run pipeline -- --stage publish --channel travel --input video.mp4 \
  --title "Baslik" --description "Aciklama" --tags "antalya,tatil" --dry-run

# Kimlik dogrulama kontrolu
npm run pipeline -- --stage authcheck --channel travel

# Gercek yukleme (--jobId verilirse DB'ye kaydedilir, sira otomatik ilerler)
npm run pipeline -- --stage publish --channel travel --input video.mp4 \
  --title "Baslik" --jobId 42
```

**Kuyruk mantigi:** `scheduleAndUpload` o kanalda su an bekleyen kac is oldugunu
DB'den sayar ve yeni isi bir sonraki bos slota yerlestirir - iki is ayni ana
denk gelmez, kuyruk kendiliginden siralanir.

## Yayin saatleri — ABD + Avrupa prime time

Ranking kanali gunde 3 video yayinlar ve slotlar **hedef izleyicinin kendi saatiyle**
tanimlanir, sabit UTC ile degil:

| Slot | Yerel saat | Diger pazarlarda |
|---|---|---|
| ABD prime time | ET 20:00 | PT 17:00 · CET 02:00 |
| Avrupa prime time | CET 20:00 | UK 19:00 · ET 14:00 |
| ABD sabah yogunlugu | ET 08:30 | UK 13:30 · CET 14:30 |

**Neden sabit UTC degil:** ABD yaz saatine mart 2. pazar, AB mart son pazar gecer
(sonbaharda da benzer fark var). Sabit UTC saati kullanmak, yilda iki kez birkac
haftaligina prime time'i kacirir. Slotlar IANA saat dilimiyle tanimlandigi icin
gecisler otomatik dogru hesaplanir.

```bash
npm run pipeline -- --stage schedule --channel shorts --count 6
```

## Ranking + seslendirme

Komik kanal bir **ranking kanali**: geri sayimli Top 5, toplam sure <= 30 sn.
`rankingPlanner` adaylardan siralamayi kurar ve her sira icin alayci tek cumlelik
seslendirme metni uretir; `enforceBudget` LLM ne dondururse donsun sure tavanini ve
`#1`'in korunmasini garanti eder.

Seslendirme zinciri **tamamen ucretsiz**: Voicebox erisilebilirse (GPU gerektirdigi
icin VPS'te degil, tunel uzerinden kendi makinende) klonlanmis karakter sesi;
erisim yoksa zincir sessizce **Piper**'a duser — Piper CPU'da calisir, GPU istemez
ve VPS'in varsayilan motorudur. Ton kurali sistem promptunda sabit:
mizahi/igneleyici/alayci, ama hakaret ve kisisel saldiri yok - dalga gecilen
sey durum, kisi degil.

## Ucus kumeleme ve gunduz-gece gecisleri

Ayni bolgede farkli tarihlerde yapilan cekimler ve ayni gunun seri ucuslari
otomatik teshis edilir:

- **Bolge kumeleme** — klip merkezleri 1.5 km yaricapta toplanir; ayni otelin
  agustos ve eylul cekimleri ayni kumeye duser.
- **Seans ayrimi** — ayni gun 45 dakikadan uzun ara varsa yeni cekim seansi
  sayilir. DJI Neo bataryasi 7-12 dakika dayandigi icin bir bolge genelde
  pes pese birkac ucusla cekilir; bunlar tek seans olarak gruplanir.

### Ayni acidan gunduz + gece

`viewpoint` her cekimin **nereden nereye baktigini** olcer (konum, irtifa ve
GPS'ten turetilen ucus yonu). Isik kosulu ise saat araligina degil **gercek
gunes yuksekligine** bakilarak belirlenir - Antalya'da agustosta 20:00 hala
isikliyken ocakta gece olur:

| Gunes yuksekligi | Kosul |
|---|---|
| > 10° | gunduz |
| 0° – 10° | **altin saat** |
| -6° – 0° | mavi saat |
| < -6° | gece |

Ayni noktadan ayni yone bakan bir aydinlik ve bir karanlik cekim bulunursa
gecis adayi olur. Puanlama: mesafe (%45), yon farki (%35), irtifa farki (%20).
`transitions` bunlari FFmpeg `xfade` ile birlestirir (fade / fadeblack /
circleopen) - izleyici ayni manzarayi iki farkli zamanda gorur.

```bash
npm run pipeline -- --stage cluster --dir /veri/ucuslar
```

## Akilli kurgu — hiz optimizasyonu

DJI Neo bataryasi 7-12 dakika dayanir (genelde ~7). 30 dakikalik bir video, ham
ucuslarin **kesilip sikistirilmasiyla** elde edilir. `speedPlanner` telemetriyi
okuyup her bolume ne yapilacagina karar verir:

| Durum | Karar | Carpan |
|---|---|---|
| Irtifa < 3 m (yerde, kalkis/inis oncesi) | **atilir** | — |
| Hareketsiz hover (< 1.5 m/s) | hizlandirilir | **x2.5** |
| Yavas gecis (< 3 m/s) | hizlandirilir | **x2.0** |
| Orta tempo (< 5 m/s) | hizlandirilir | x1.5 |
| Iyi tempo (5-14 m/s) | korunur | x1.0 |
| Otomatik donus / savrulma (> 18 m/s) | **agir cekim** | x0.75 |

Carpanlar elle kurguda kullanilan %200-250 araligiyla ayni. Hedef sure
verilirse (`--target`) plan o sureye sigdirilir: once sikici bolumler daha da
sikistirilir, iyi tempolu ve agir cekim bolumlere en son dokunulur; tavan x3.

**Goruntu analizi telemetriyi ezer:** sahne degisim skoru yuksekse (kadrajda
yakin gecis, hareketli ozne) yavas ucus bile hizlandirilmaz — "yavas ama kadraj
hareketli" olarak korunur.

**Zaman haritasi zorunlu:** kesme ve hizlandirmadan sonra kaynaktaki 150. saniye
ciktida 84. saniyeye denk gelir. `timeMap` POI kartlarini, muzik bolumlerini ve
ucus izini yeni zaman eksenine tasir; atilan bolumlere denk gelen olaylar elenir.
Bu olmadan kartlar yanlis anda cikar.

```bash
npm run pipeline -- --stage speed --input DJI_0001.MP4 --srt DJI_0001.SRT --target 600 --output kurgu.mp4
```

## Ilgi noktalari (POI) — sadece otel degil

Ucus izinin sinir kutusundan yola cikip **OpenStreetMap Overpass** ile bolgedeki
selaleler, tarihi eserler, manzara noktalari, magaralar ve plajlar bulunur
(anahtar gerektirmez, ucretsiz). Kisa aciklama **Vikipedi/Wikidata**'dan cekilir
ve ekranda kaynak atfiyla gosterilir; aciklama bulunamazsa **uydurma metin uretilmez**.

`poiTimeline` her karti, drone o noktaya **en cok yaklastigi anda** ekrana getirir.
Kurallar: 1.5 km'den uzak noktalar elenir, kartlar ust uste binmez, video basi en
fazla 6 kart, videonun son saniyelerine denk gelen kart sigacak sekilde one cekilir.
Varsayilan sunum **yazi karti**; istenirse ayni metin seslendirmeye de verilebilir.

## Soundtrack secimi (Suno)

Drive'daki soundtrack kutuphanesinden **temaya, gunun saatine ve video suresine**
gore parca secilir: sabah dingin, gunduz yukseltici, gun batimi sinematik.
Dogrudan etiket eslesmesi (orn. `tarihi`) ton tahmininden agir basar; yakin
zamanda kullanilan parca ciddi ceza alir, boylece ard arda ayni muzik cikmaz.
Esit puanli adaylar arasinda rastgele secim yapilir.

### Tek videoda birden fazla parca

Video tek bir sarkiyla doselmez. `segmentPlanner`, ucus telemetrisinden **hiz ve
irtifayi** okuyup videoyu enerji bolumlerine ayirir:

| Bolum | Kosul | Tercih edilen tonlar |
|---|---|---|
| **high** | hizli gecis (>10 m/s) veya GoPro aksiyon | energetic / epic / uplifting |
| **medium** | orta tempo veya yuksek irtifa genis manzara | uplifting / cinematic / epic |
| **low** | yavas + alcak ucus, yakin plan | dreamy / chill / cinematic |

Her bolum kendi parcasini alir ve ardisik bolumlerde ayni parca tekrarlanmaz.

**Limitler video suresine gore olceklenir** — 30 saniyelik bir Shorts ile
30 dakikalik bir gezi videosu ayni kurala tabi olamaz:

| Video suresi | Parca tavani | En kisa bolum |
|---|---|---|
| 30 sn – 5 dk | 3 | 12 sn |
| 16 dakika | 4 | 48 sn |
| 24 dakika | 5 | 72 sn |
| 30 dakika ve uzeri | 6 | 90 sn+ |

Tavan her ~5 dakika icin bir parca hakki ekler ve 6'da durur. En kisa bolum
suresi de video suresinin 1/20'si kadar buyur: uzun videoda 12 saniyede bir
muzik degistirmek, kisa videoda 90 saniye tek parca calmak kadar yanlistir.
Yumusatma penceresi de ayni oranda buyudugu icin uzun kliplerde gereksiz
hesap yapilmaz. Telemetri yoksa tek parcaya donulur.

`audioMix` her bolumun parcasini gerektiginde donguler, bolum sinirlarinda
carprazlama fade uygular ve seslendirme varken `sidechaincompress` ile muzigi
**otomatik kisar (ducking)** — konusma her zaman anlasilir kalir.

## Manuel mudahale

Otomatik GPS eslestirmesi her zaman istenmeyebilir (orn. eski stok goruntu
kullanmak). Is klasorundeki `override.json` ile:

```json
{
  "manualPairs": [
    { "droneClipId": "d1", "goproClipId": "g1",
      "droneStartSec": 12, "goproStartSec": 4, "durationSec": 20 }
  ],
  "stockClips": [
    { "filePath": "stock/antalya-2024.mp4", "atSec": 25, "durationSec": 5, "label": "Arsiv: 2024" }
  ],
  "excludeClipIds": ["d3"]
}
```

Oncelik sirasi: **haric tutma > elle eslesme > otomatik eslesme**. Telemetrisi
olmayan arsiv goruntuleri de bu yolla kurguya girer.

## GoPro + drone harmanlama

GoPro (Hero5+) GPS telemetrisini MP4'un icine gomer; DJI ise yanina `.SRT` yazar.
Ikisi de ayni `TrackPoint` yapisina normalize edilir. `clipSync` iki kaynagin GPS
zaman damgalarini karsilastirip **ayni anin drone (genis) ve GoPro (yakin) acisini**
otomatik eslestirir - kurgu bunlari A-roll / B-roll olarak kullanir. Eleme kurallari:
ortak sure >= 2 sn ve kameralar arasi ortalama mesafe <= 500 m.

## DJI Neo notu

DJI Neo `.SRT` telemetrisini **yalnizca** DJI Fly icinde "Video Captions / Altyazi" ayari
cekim oncesi acikken yazar. Kapaliysa o ucus icin telemetri yoktur ve sonradan eklenemez —
bu durumda harita, otel + havaalani koordinatindan sablon rota uretir. Kartlari Drive'a
atarken `.MP4` yaninda `.SRT` dosyalarini da kopyalayin.

Iki drone ayni dosya adini (`DJI_0001.MP4`) uretebildiginden kimlik, dosya icerik hash'i +
cekim tarihiyle olusturulur; ayni klip iki kez islenmez.

---

## Admin panel (coklu kanal yonetimi)

Kanal ekleme/duzenleme, yayin sikligi (haftaici gunleri / N gunde bir / M ayda N video)
ve gercek yayin takvimi artik statik dosya degistirip redeploy etmeden, bir web panelinden
yonetilir. Panel iki ayri surec: Express API (`src/panel/`) + Vite/React arayuzu (`panel-web/`),
tek SQLite dosyasi uzerinden konusurlar.

**Ilk kurulum:**
```bash
npm run panel:hash-password -- '<sifre>'   # ciktiyi PANEL_PASSWORD_HASH'e yapistir
# .env dosyasina PANEL_PASSWORD_HASH, PANEL_SESSION_SECRET (rastgele uzun bir deger), PANEL_PORT ekle
npx tsx scripts/migrateChannelsToDb.ts     # mevcut shorts/travel kanallarini DB'ye tohumlar (tek seferlik)
```

**Gelistirme:**
```bash
npm run panel:server           # API :4000'de (PANEL_PORT ile degistirilebilir)
cd panel-web && npm install && npm run dev   # Vite dev server, /api istekleri otomatik proxy'lenir
```

**Uretim:** `cd panel-web && npm run build` derlenmis arayuzu `panel-web/dist/`e yazar; `npm run panel:server`
bu klasoru otomatik statik olarak sunar (ayri bir web sunucusuna gerek yok). Panel VPS'te internete
acilacaksa oturum cerezinin guvenligi icin TLS (nginx/Caddy + certbot) zorunludur.

Yeni bir kanal eklemek (herhangi bir nis/tur icin) kod degisikligi gerektirmez: panelde
"+ Yeni kanal" ile `channel` + `schedule_rule` satirlari olusturulur; YouTube OAuth refresh
token'i onceden `scripts/authYoutube.ts` ile uretilip `.env`'e eklenmis olmalidir.

---

## Isletim (surekli calisma - VPS)

Iki surekli surec var: **panel** (her zaman ayakta, crash'te yeniden baslamali) ve
**worker** (`src/worker/runQueue.ts`) - tek seferlik calisip cikan, periyodik olarak
tetiklenmesi gereken bir script (`WORKER.BATCH_SIZE=1` oldugu icin her tetiklemede
en fazla bir is islenir, uzun bir render sonraki turu bloklamaz).

### Secenek A: pm2 (onerilir, kurulumu daha kolay)

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save                # sunucu yeniden baslarsa pm2'nin kendini geri getirmesi icin
pm2 startup             # sistem baslangicinda pm2'yi otomatik baslatan servisi kurar
pm2 install pm2-logrotate   # log dosyalari sinirsiz buyumesin diye
```

`ecosystem.config.cjs` panel'i `autorestart:true` ile surekli ayakta tutar; worker'i
`cron_restart: '*/5 * * * *'` ile her 5 dakikada bir tetikleyip `autorestart:false`
ile tekrar durdurur (pm2'nin "zamanlanmis gorev" kalibi).

### Secenek B: systemd (pm2 kurulamayan/istemeyen VPS'ler icin)

`deploy/` altindaki unit dosyalarini `/etc/systemd/system/`e kopyala (once
`WorkingDirectory` ve `EnvironmentFile` satirlarini kendi kurulum yoluna gore duzenle):

```bash
sudo cp deploy/shorts-factory-panel.service /etc/systemd/system/
sudo cp deploy/shorts-factory-worker.service deploy/shorts-factory-worker.timer /etc/systemd/system/
sudo cp deploy/shorts-factory-backup.service deploy/shorts-factory-backup.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now shorts-factory-panel.service
sudo systemctl enable --now shorts-factory-worker.timer
sudo systemctl enable --now shorts-factory-backup.timer
```

Loglar `journalctl -u shorts-factory-panel -f` / `journalctl -u shorts-factory-worker` ile
izlenir - systemd/journald log rotasyonunu kendisi yapar, ek bir ayar gerekmez.

### Yedekleme

`scripts/backupDb.ts` SQLite'in kendi `.backup()` API'sini kullanir (WAL modunda bile
tutarli bir kopya alir - duz `cp` bunu garanti etmez), `data/backups/`e yazar ve
`SHORTS_DB_BACKUP_RETENTION_DAYS` (varsayilan 14 gun) sonrasini otomatik siler.
Yukaridaki systemd timer gunde bir calistirir; pm2 kullaniyorsan ayni scripti duz bir
crontab satiriyla ("0 3 * * * cd /opt/shorts-factory && npx tsx scripts/backupDb.ts")
tetikleyebilirsin. Off-site senkron icin (onerilir) `rclone`/`rsync` ile
`data/backups/`i harici bir depoya kopyalayan ikinci bir cron satiri eklenebilir.

### Saglik kontrolu

`GET /api/health` kimlik dogrulama gerektirmez, DB'ye gercekten erisilebildigini
kontrol eder (`{ok:true, dbOk:true, lastJobActivity}` veya 503). UptimeRobot vb. dis
izleme araclariyla bu adresi izlemek panel coktugunde haber almayi saglar.

### VPS kaynak onerisi

FFmpeg + Chromium/WebGL (Remotion render) + whisper-benzeri islemler icin **en az
4 vCPU / 8 GB RAM**, harita katmani veya yogun StoryNarrative/hikaye render'lari
eklenirse **8 vCPU / 16 GB RAM** onerilir.

---

## Yol haritasi

Alt yapi tasi olarak kullanilan modul-duzeyi calisma (telemetri, kurgu, muzik, POI,
seslendirme, Remotion kompozisyonlari, YouTube OAuth/upload) M0-M1 kapsaminda erken
tamamlandi. Sonraki milestone'lar bunlari bir orkestratorde birlestirdi:

- [x] **M0** — SQLite semasi, kanal config'i DB'ye tasindi (`channel`/`schedule_rule`),
      zamanlama motoru (haftaici/N gunde bir/M ayda N video), LLM router (ucretsiz katman once)
- [x] **M1** — admin panel (giris, kanal CRUD, zamanlama editoru, gercek yayin takvimi) +
      cekirdek video araclari (ingest/probe, kesim+9:16 cerceve, telemetri ayristirma,
      hiz optimizasyonu, POI kesfi, muzik secimi+miksaj, seslendirme, YouTube upload)
- [x] **M2** — worker/orkestrator: atomik is kapma, crash recovery (stale-claim sweep),
      `HotelTour` uctan uca render zinciri, e-posta bildirimleri
- [x] **M3** — onay kuyrugu: `review_item`, panel onay ekrani (video/thumbnail onizleme,
      duzenle, onayla/reddet/degisiklik-gerekli/yeniden-olustur), story_reference yonetimi
- [x] **M4** — stok uretim: panelden N video icin toplu is acma, ilerleme takibi
- [x] **M5** — hikaye kanali icerik hatti: transkript → olgu ozeti → yeni senaryo (iki
      asamali ozgunlestirme) → sahne bazli gorsel kaynaklama (Pexels video/foto) → render;
      referans kanal kataloglarindan otomatik konu kesfi (YouTube Data API)
- [x] **M6** — gercek Instagram Reels + TikTok yayin adaptorleri (Facebook stub kaldi -
      istenmedi), otel veri saglayici zinciri (Google Places → HolidayCheck → Booking → elle)
- [x] **Ek ozellikler** — otomatik thumbnail uretimi (video karesi + Remotion still),
      uzun videodan otomatik Shorts turetme (belirli araliklarla, kanala trafik cekmek icin),
      niche alani (panelden ayarlanabilir/referans kanaldan devralinabilir), pm2/systemd
      isletim yapilandirmasi, otomatik SQLite yedekleme, `/api/health`

**Bilinen bosluklar** (kod degil, kapsam disi birakildi):
- FunnyRanking (komik Shorts) kanalinin kaynak kesfi (discovery/curation) hic yazilmadi -
  bu kanal turu icin kaynagin nereden gelecegi ayri, isimlendirilmemis bir is
- Facebook Page yayini - veri modeli hazir (`publish_target`), gercek adapter kodu yok
- TikTok yuklemesi tek parcayla sinirli (64MB) - cok parcali yukleme eklenmedi
- Capraz platform (MapLibre harita katmani, CapCut draft disa aktarici) orijinal planda
  vardi ama kullanici gereksinimleri bu yone hic gitmedi, uygulanmadi

---

## Kurallar

Bu proje `ecosystem-hub/GLOBAL_PROJECT_RULES.md` kurallarina tabidir: modul basina 600 satir
siniri, basliksiz modul yok, hardcoded string yok, tum async fonksiyonlarda try-catch,
kaynak temizligi, sabitler `config/constants.ts` icinde, sessiz hata yok.

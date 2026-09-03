# Fun & Rank -- 15 Gunluk Tam Program (Google Sheets, TAM)

Kullanicinin 2026-09-03te 3 ayri Google Sheet olarak paylastigi tam 15 gunluk plan,
kalici olarak buraya birlestirildi. Kaynak sheet'ler:

- **Gun 1-5**: https://docs.google.com/spreadsheets/d/1_gZcv2J05SnI3r1hn026obZk35pTCide_M0ArD1BYlM/edit?usp=sharing
- **Gun 6-10**: https://docs.google.com/spreadsheets/d/1myVtQUTcG_JAVa0PBXySsdNiGrMNGvxFdZAAdz8wp7w/edit?usp=sharing
- **Gun 11-15**: https://docs.google.com/spreadsheets/d/1MPnpE_KN52BDb7wlJxi6rl2eUpTT_kiQDXu3gjnl4qg/edit?usp=sharing

Ham CSV'ler ayni klasorde: `15gun_plan_gsheet.csv` (1-5), `gunler6-10_gsheet.csv`,
`gunler11-15_gsheet.csv`. Gunde 3 slot (12:30/17:30/22:30), iki format donuslu:
**5 to 1 Ranking** (Dummy yok, tam ekran fail-derleme) ve **Tier List** (Dummy var,
S/A/B/C/D reklam kiyaslamasi). Her satirda hazir Ingilizce script (~25-30sn) + gorsel
kurgu notu + TTS ton/hiz talimati var - LLM planlama gerekmiyor, dogrudan uretime
sokulabilir.

## Uretim durumu (2026-09-03)

- **Gun 1 - 17:30 (resmi: Nike vs Adidas)**: Bunun yerine daha once uretilmis "Nike solo"
  (Write the Future vs Dream Crazy) icerigi kullanildi (kullanici onayi) - ses+lip-sync
  video 4/4 tamam (`day1-nike/`, SadTalker ile). Resmi script'e gecilmedi.
- **Gun 2 - 17:30 (Dior vs Chanel)**: Tablo ile eslesiyor, ses+lip-sync video 4/4 tamam
  (`day2-perfume/`).
- **Gun 3 - 17:30 (resmi: Volvo vs BMW)**: Bunun yerine daha once planlanan "Old Spice solo"
  icerigi kullanildi (kullanici onayi) - ses+lip-sync video 3/3 tamam (`day3-oldspice/`).
  Resmi script (Volvo vs BMW) kullanilmadi, ileride ayri gun olarak uretilebilir.
- **Gun 4-15 (tumu) + Gun 1/2/3 icindeki tum "5 to 1 Ranking" satirlari**:
  henuz hic uretilmedi.
- **Karakter/marka varliklari hazir**: `public/tierlist/dummy_v2.png` (gozlukleri gorunen,
  jenerik sari/siyah amblemli, SadTalker-uyumlu), `public/tierlist/tv_frame.png`
  (yesil-ekran TV cercevesi), `public/tierlist/channel_banner.png` (Fun & Rank banner).
- **Ses profili hazir**: VoiceBox "Callum" (ElevenLabs Callum klonu, en, Qwen3-TTS 1.7B,
  ZDF preset) - kanalin tek sesi.
- **Lip-sync calisir durumda**: `tierlist/modal_sadtalker.py` (SadTalker, Modal, H.264
  cikis) - dogrulandi, gozlukleri gorunmeyen ilk Dummy gorseliyle basarisiz oldu
  (yuz-landmark tespiti gozsuz yuzu taniyamadi), gozlukleri gorunen versiyonla calisti.

## Tam program (15 gun)

| Gun/Saat | Format | Konu | Gorsel & Sahne | TTS Ton/Hiz |
|---|---|---|---|---|
| Gün 1 - 12:30 | 5 to 1 Ranking | Epic Pool Fails | Tam Ekran (Dummy Yok): Havuza atlayamayan, suya göbekleme düşen komik insan videoları. | Energetic, Fast (1.15x) |
| Gün 1 - 17:30 | Tier List | Nike vs Adidas | Bölünmüş Ekran (Dummy Var): Üstte Dummy. Altta S-A-B-C-D panosu. Nike S'ye, Adidas C'ye. | Sarcastic, Loud (1.15x) |
| Gün 1 - 22:30 | 5 to 1 Ranking | Cooking Fails | Tam Ekran (Dummy Yok): Yanan tencereler, mutfağa dökülen unlar, fırlayan krep videoları. | Shocked, Fast (1.15x) |
| Gün 2 - 12:30 | 5 to 1 Ranking | Funny Kids Moments | Tam Ekran (Dummy Yok): Spagetti yerken uyuyan, duvarı boyayan çocuk videoları. | Amused, Fast (1.15x) |
| Gün 2 - 17:30 | Tier List | Dior vs Chanel Ads | Bölünmüş Ekran (Dummy Var): Üstte Dummy parfüm taklidi yapar. Altta Depp (S), Pitt (D). | Mocking, Fast (1.15x) |
| Gün 2 - 22:30 | 5 to 1 Ranking | Couple Fails | Tam Ekran (Dummy Yok): Suya düşen çiftler, yanlış giden romantik anlar. | Laughing, Fast (1.15x) |
| Gün 3 - 12:30 | 5 to 1 Ranking | Epic Water Splash | Tam Ekran (Dummy Yok): Kopan ip salıncakları, şişme flamingo kazaları. | Excited, Fast (1.15x) |
| Gün 3 - 17:30 | Tier List | Volvo vs BMW Ads | Bölünmüş Ekran (Dummy Var): Üstte Dummy kollarını bağlar. Altta Van Damme (S), BMW (B). | Impressed, Loud (1.15x) |
| Gün 3 - 22:30 | 5 to 1 Ranking | Funny Pet Fails | Tam Ekran (Dummy Yok): Atlayamayan kediler, kendi osuruğundan korkan köpekler. | Energetic, Fast (1.15x) |
| Gün 4 - 12:30 | 5 to 1 Ranking | Birthday Cake Fails | Tam Ekran (Dummy Yok): Yere düşen pastalar, yanan peçeteler. | Shocked, Fast (1.15x) |
| Gün 4 - 17:30 | Tier List | Old Spice vs Gillette | Bölünmüş Ekran (Dummy Var): Üstte Dummy ekrana parmak sallar. Altta Atlı adam (S), Jilet (C). | Sarcastic, Fast (1.15x) |
| Gün 4 - 22:30 | 5 to 1 Ranking | Gym Fails | Tam Ekran (Dummy Yok): Geriye giden koşu bantları, yüze çarpan direnç lastikleri. | Tense, Fast (1.15x) |
| Gün 5 - 12:30 | 5 to 1 Ranking | Winter/Snow Fails | Tam Ekran (Dummy Yok): Gizli buza basıp düşenler, kayarken kardan adama çarpanlar. | Laughing, Fast (1.15x) |
| Gün 5 - 17:30 | Tier List | Burger King vs McD's | Bölünmüş Ekran (Dummy Var): Üstte Dummy midesi bulanmış gibi yapar. Altta Küflü burger (S), Palyaço (C). | Disgusted, Energetic (1.15x) |
| Gün 5 - 22:30 | 5 to 1 Ranking | Wedding Fails | Tam Ekran (Dummy Yok): Düşen yüzükler, havuza atılan gelinler. | Shocked, Fast (1.15x) |
| Gün 6 - 12:30 | 5 to 1 Ranking | Skateboard Fails | Tam Ekran (Dummy Yok): Merdivenden uçanlar, direğe çarpan kaykaycılar. "Oof" ses efektleri. | Energetic, Fast (1.15x) |
| Gün 6 - 17:30 | Tier List | Apple vs Microsoft | Bölünmüş Ekran (Dummy Var): Üstte Dummy. Altta S-A-B-C-D panosu. Apple S'ye, Microsoft C'ye. | Sarcastic, Loud (1.15x) |
| Gün 6 - 22:30 | 5 to 1 Ranking | Golf Fails | Tam Ekran (Dummy Yok): Topu ıskalayanlar, göle düşen golf arabaları. Su sıçrama SFX. | Laughing, Fast (1.15x) |
| Gün 7 - 12:30 | 5 to 1 Ranking | Magic Trick Fails | Tam Ekran (Dummy Yok): Düşen kartlar, kaçan tavşanlar, yanan şapkalar. | Shocked, Fast (1.15x) |
| Gün 7 - 17:30 | Tier List | Pepsi vs Coca-Cola | Bölünmüş Ekran (Dummy Var): Üstte Dummy kahkaha atar. Altta Kendall Jenner (D), Kutup Ayıları (A). | Mocking, Fast (1.15x) |
| Gün 7 - 22:30 | 5 to 1 Ranking | Live TV News Fails | Tam Ekran (Dummy Yok): Yayına giren çocuklar, bayılan muhabirler. Glitch efektleri. | Amused, Fast (1.15x) |
| Gün 8 - 12:30 | 5 to 1 Ranking | Parkour Fails | Tam Ekran (Dummy Yok): Çatıdan çöp kutusuna düşenler, kayan ayakkabılar. | Tense, Fast (1.15x) |
| Gün 8 - 17:30 | Tier List | PlayStation vs Xbox | Bölünmüş Ekran (Dummy Var): Üstte Dummy oyun oynar gibi yapar. Altta PS Bebek (D), Xbox (S). | Disgusted, Energetic (1.15x) |
| Gün 8 - 22:30 | 5 to 1 Ranking | Trampoline Fails | Tam Ekran (Dummy Yok): Yırtılan trambolinler, uçan çocuklar. Yay sesleri (Boing SFX). | Laughing, Fast (1.15x) |
| Gün 9 - 12:30 | 5 to 1 Ranking | Fishing Fails | Tam Ekran (Dummy Yok): Yüze çarpan balıklar, göle düşen oltalar. | Excited, Fast (1.15x) |
| Gün 9 - 17:30 | Tier List | Balenciaga vs Gucci | Bölünmüş Ekran (Dummy Var): Üstte Dummy göz devirir. Altta Çamur (C), İkizler (A). | Sarcastic, Annoyed (1.15x) |
| Gün 9 - 22:30 | 5 to 1 Ranking | VR (Virtual Reality) Fails | Tam Ekran (Dummy Yok): TV'ye kafa atanlar, avize kıranlar. Cam kırılma SFX. | Shocked, Fast (1.15x) |
| Gün 10 - 12:30 | 5 to 1 Ranking | Delivery Fails | Tam Ekran (Dummy Yok): Paketi çatıya atan kuryeler, kayıp düşen adamlar. | Amused, Fast (1.15x) |
| Gün 10 - 17:30 | Tier List | Red Bull vs GoPro | Bölünmüş Ekran (Dummy Var): Üstte Dummy çok heyecanlı. Altta Uzay (S), Bisiklet (B). | Impressed, Loud (1.15x) |
| Gün 10 - 22:30 | 5 to 1 Ranking | Dance Fails | Tam Ekran (Dummy Yok): Pantolonu yırtılanlar, partnerini düşürenler. | Laughing, Fast (1.15x) |
| Gün 11 - 12:30 | 5 to 1 Ranking | Rollercoaster Fails | Tam Ekran (Dummy Yok): Hız treninde bayılanlar, şapkası uçanlar. Rüzgar ve çığlık SFX. | Excited, Fast (1.15x) |
| Gün 11 - 17:30 | Tier List | Rolex vs Casio | Bölünmüş Ekran (Dummy Var): Üstte Dummy. Altta S-A-B-C-D panosu. Rolex (B), Casio (S). | Sarcastic, Loud (1.15x) |
| Gün 11 - 22:30 | 5 to 1 Ranking | DIY & Repair Fails | Tam Ekran (Dummy Yok): Boya yaparken köşede sıkışanlar, patlayan borular. Su sesi SFX. | Shocked, Fast (1.15x) |
| Gün 12 - 12:30 | 5 to 1 Ranking | Drone Fails | Tam Ekran (Dummy Yok): Ağaca çarpan dronelar, denize düşen kameralar. Pervane sesi. | Tense, Fast (1.15x) |
| Gün 12 - 17:30 | Tier List | Doritos vs Snickers | Bölünmüş Ekran (Dummy Var): Üstte Dummy atıştırmalık arar. Altta Doritos (A), Snickers (S). | Energetic, Fast (1.15x) |
| Gün 12 - 22:30 | 5 to 1 Ranking | Unboxing Fails | Tam Ekran (Dummy Yok): Yeni TV'sini kıranlar, telefonu düşürenler. Cam kırılma SFX. | Disbelieving, Fast (1.15x) |
| Gün 13 - 12:30 | 5 to 1 Ranking | Ice Skating Fails | Tam Ekran (Dummy Yok): Buzda kayanlar, toplu düşüşler. | Laughing, Fast (1.15x) |
| Gün 13 - 17:30 | Tier List | Emirates vs Qatar | Bölünmüş Ekran (Dummy Var): Üstte Dummy şaşkın bakar. Altta Qatar (A), Emirates (S). | Impressed, Loud (1.15x) |
| Gün 13 - 22:30 | 5 to 1 Ranking | Make-up & Beauty Fails | Tam Ekran (Dummy Yok): Dökülen pudralar, yanlış kesilen perçemler. | Amused, Fast (1.15x) |
| Gün 14 - 12:30 | 5 to 1 Ranking | Graduation Fails | Tam Ekran (Dummy Yok): Sahnede düşenler, kepi yüzüne çarpanlar. | Shocked, Fast (1.15x) |
| Gün 14 - 17:30 | Tier List | LEGO vs Barbie | Bölünmüş Ekran (Dummy Var): Üstte Dummy oyuncaklarla oynar gibi yapar. Altta LEGO (A), Barbie (S). | Energetic, Fast (1.15x) |
| Gün 14 - 22:30 | 5 to 1 Ranking | Prank Fails | Tam Ekran (Dummy Yok): Şakası ters tepenler, kendi tuzağına düşenler. | Laughing, Fast (1.15x) |
| Gün 15 - 12:30 | 5 to 1 Ranking | Animal Encounter Fails | Tam Ekran (Dummy Yok): Gözlük çalan maymunlar, kovalayan kazlar. | Tense, Fast (1.15x) |
| Gün 15 - 17:30 | Tier List | Spotify vs Netflix | Bölünmüş Ekran (Dummy Var): Üstte Dummy kulaklıkla müzik dinler. Altta Netflix (A), Spotify (S). | Impressed, Loud (1.15x) |
| Gün 15 - 22:30 | 5 to 1 Ranking | Celebration Fails | Tam Ekran (Dummy Yok): Erken sevinen sporcular, dökülen şampanyalar. | Amused, Fast (1.15x) |

## Tam scriptler (satir satir)

### Gün 1 - 12:30 -- 5 to 1 Ranking: Epic Pool Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Havuza atlayamayan, suya göbekleme düşen komik insan videoları.

**TTS:** Energetic, Fast (1.15x)

**Script:** Ranking the most epic pool fails from 5 to 1! Number 5: The classic belly flop. Ouch! Number 4: Slipping on the diving board. Number 3: The double bounce disaster. Number 2: Missing the pool entirely! And Number 1: The majestic swan dive straight into concrete! Which one made you laugh? Subscribe for more!

### Gün 1 - 17:30 -- Tier List: Nike vs Adidas

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy. Altta S-A-B-C-D panosu. Nike S'ye, Adidas C'ye.

**TTS:** Sarcastic, Loud (1.15x)

**Script:** Who owns the sports world? Let’s rank the biggest sneaker ads! Adidas 'Is All In'? It has everyone, but it's totally forgettable. C-Tier. But Nike's 'Dream Crazy' with Colin Kaepernick? That didn't just sell shoes, it changed the internet! Pure S-Tier legend. Nike or Adidas? Comment below and subscribe!

### Gün 1 - 22:30 -- 5 to 1 Ranking: Cooking Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Yanan tencereler, mutfağa dökülen unlar, fırlayan krep videoları.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the absolute worst cooking fails from 5 to 1! Number 5: Burning water. How? Number 4: Forgetting the blender lid. Number 3: Dropping the Thanksgiving turkey. Number 2: Setting the microwave on fire with noodles. And Number 1: Flipping a pancake straight onto the ceiling! Comment your biggest kitchen disaster and subscribe!

### Gün 2 - 12:30 -- 5 to 1 Ranking: Funny Kids Moments

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Spagetti yerken uyuyan, duvarı boyayan çocuk videoları.

**TTS:** Amused, Fast (1.15x)

**Script:** Ranking the funniest kids moments from 5 to 1! Number 5: Falling asleep while eating spaghetti. Number 4: Getting stuck inside a claw machine. Number 3: Blaming the family dog for drawing on the walls. Number 2: Cutting their own hair! And Number 1: Finding the hidden chocolate stash and turning into a zombie! Subscribe for laughs!

### Gün 2 - 17:30 -- Tier List: Dior vs Chanel Ads

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy parfüm taklidi yapar. Altta Depp (S), Pitt (D).

**TTS:** Mocking, Fast (1.15x)

**Script:** Why do perfume ads make zero sense? Let's rank them! Brad Pitt staring at a wall for Chanel? Just confusing and boring. Straight to D-Tier. Johnny Depp playing guitar for wolves? I don't get it, but the charisma is insane! S-Tier for sure. Dior or Chanel? Tell me in the comments and hit subscribe!

### Gün 2 - 22:30 -- 5 to 1 Ranking: Couple Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Suya düşen çiftler, yanlış giden romantik anlar.

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the most embarrassing couple fails from 5 to 1! Number 5: Dropping her during a piggyback ride. Number 4: Getting rejected on the kiss cam. Number 3: The tandem bike disaster. Number 2: Throwing her into the lake, but taking her phone with you! And Number 1: The proposal ring falling into the ocean! Tag your partner and subscribe!

### Gün 3 - 12:30 -- 5 to 1 Ranking: Epic Water Splash

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Kopan ip salıncakları, şişme flamingo kazaları.

**TTS:** Excited, Fast (1.15x)

**Script:** Ranking the most epic water splash fails from 5 to 1! Number 5: The rope swing snapping in half. Number 4: The inflatable flamingo flipping over. Number 3: The waterslide launch into orbit. Number 2: Jumping off the boat onto a wave. And Number 1: The legendary cannonball that emptied the entire hot tub! Hit subscribe for more!

### Gün 3 - 17:30 -- Tier List: Volvo vs BMW Ads

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy kollarını bağlar. Altta Van Damme (S), BMW (B).

**TTS:** Impressed, Loud (1.15x)

**Script:** Car ads are usually so boring, let's rank the crazy ones! BMW’s action mini-films? Good, but trying too hard. Solid B-Tier. But Jean-Claude Van Damme doing an epic split between two moving Volvo trucks? Absolutely mind-blowing. Easy S-Tier! Which car brand is your favorite? Drop a comment and subscribe!

### Gün 3 - 22:30 -- 5 to 1 Ranking: Funny Pet Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Atlayamayan kediler, kendi osuruğundan korkan köpekler.

**TTS:** Energetic, Fast (1.15x)

**Script:** Ranking the funniest pet fails from 5 to 1! Number 5: The cat missing an easy jump. Number 4: The dog getting scared of its own fart. Number 3: Stealing pizza and running into a glass door. Number 2: Getting stuck in a tiny sweater. And Number 1: The golden retriever jumping straight into mud! Subscribe for more!

### Gün 4 - 12:30 -- 5 to 1 Ranking: Birthday Cake Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Yere düşen pastalar, yanan peçeteler.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the worst birthday cake fails from 5 to 1! Number 5: Spelling the name completely wrong. Number 4: The cake sliding off the table. Number 3: The dog eating the cake before the song ends. Number 2: Lighting the napkins on fire with candles. And Number 1: Smashing their face so hard the table breaks! Subscribe!

### Gün 4 - 17:30 -- Tier List: Old Spice vs Gillette

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy ekrana parmak sallar. Altta Atlı adam (S), Jilet (C).

**TTS:** Sarcastic, Fast (1.15x)

**Script:** Can a deodorant ad break the internet? Let's rank them! Gillette’s toxic masculinity ad? Way too much drama for shaving cream. C-Tier. But the Old Spice 'I'm on a horse' guy? Fast, hilarious, and completely legendary. Absolute S-Tier without a doubt! Old Spice or Gillette? Drop your comment below and subscribe!

### Gün 4 - 22:30 -- 5 to 1 Ranking: Gym Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Geriye giden koşu bantları, yüze çarpan direnç lastikleri.

**TTS:** Tense, Fast (1.15x)

**Script:** Ranking the most painful gym fails from 5 to 1! Number 5: Using the treadmill backwards. Number 4: The resistance band snapping right into the face. Number 3: Dropping the dumbbell on your toes. Number 2: Ripping your pants during a deep squat. And Number 1: Flying off the pull-up bar straight into the mirror! Subscribe!

### Gün 5 - 12:30 -- 5 to 1 Ranking: Winter/Snow Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Gizli buza basıp düşenler, kayarken kardan adama çarpanlar.

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the funniest winter snow fails from 5 to 1! Number 5: The classic slip on invisible ice. Number 4: The snowball hitting the camera. Number 3: Sledding straight into a snowman. Number 2: The ski lift dragging them halfway up the mountain. And Number 1: Falling face first into a frozen bush! Hit subscribe to stay warm!

### Gün 5 - 17:30 -- Tier List: Burger King vs McD's

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy midesi bulanmış gibi yapar. Altta Küflü burger (S), Palyaço (C).

**TTS:** Disgusted, Energetic (1.15x)

**Script:** Who thought showing rotten food was a good strategy? McDonald's creepy clown? Solid C-Tier, purely for the nightmares. But Burger King's Moldy Whopper ad? Disgusting, crazy, but a brilliant marketing move that everyone talked about. S-Tier for bravery! Burger King or McDonald's? Tell me in the comments and smash subscribe!

### Gün 5 - 22:30 -- 5 to 1 Ranking: Wedding Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Düşen yüzükler, havuza atılan gelinler.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the most embarrassing wedding fails from 5 to 1! Number 5: The ring bearer dropping the rings down a vent. Number 4: The best man fainting at the altar. Number 3: Tripping on the massive dress. Number 2: Destroying the massive wedding cake. And Number 1: The groom dropping the bride into the fountain! Tag someone getting married!

### Gün 6 - 12:30 -- 5 to 1 Ranking: Skateboard Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Merdivenden uçanlar, direğe çarpan kaykaycılar. "Oof" ses efektleri.

**TTS:** Energetic, Fast (1.15x)

**Script:** Ranking the most painful skateboard fails from 5 to 1! Number 5: The classic speed wobble wipeout. Number 4: Missing the rail completely. Number 3: The skateboard hitting you right in the shin. Number 2: Splitting your pants on a jump. And Number 1: The legendary faceplant straight into a trash can! Tag a skater and subscribe!

### Gün 6 - 17:30 -- Tier List: Apple vs Microsoft

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy. Altta S-A-B-C-D panosu. Apple S'ye, Microsoft C'ye.

**TTS:** Sarcastic, Loud (1.15x)

**Script:** Mac or PC? Let's rank the biggest tech commercials! Microsoft putting Bill Gates and Jerry Seinfeld in a shoe store? So weird and confusing. Solid C-Tier. But Apple’s legendary 1984 ad? It completely changed the world of advertising. A cinematic masterpiece! Easy S-Tier. Apple or Microsoft? Tell me your favorite in the comments and hit subscribe!

### Gün 6 - 22:30 -- 5 to 1 Ranking: Golf Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Topu ıskalayanlar, göle düşen golf arabaları. Su sıçrama SFX.

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the funniest golf fails from 5 to 1! Number 5: Missing the ball entirely. Number 4: Hitting the golf cart by accident. Number 3: Throwing the club into the lake out of anger. Number 2: The golf cart rolling away on its own. And Number 1: Falling into the water hazard while trying to swing! Subscribe for more!

### Gün 7 - 12:30 -- 5 to 1 Ranking: Magic Trick Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Düşen kartlar, kaçan tavşanlar, yanan şapkalar.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the worst magic trick fails from 5 to 1! Number 5: Dropping the hidden cards. Number 4: The rabbit escaping before the trick starts. Number 3: Messing up the mind-reading act completely. Number 2: Getting stuck inside the escape box. And Number 1: Accidentally setting the magician's hat on fire! Magic is hard! Subscribe for more fails!

### Gün 7 - 17:30 -- Tier List: Pepsi vs Coca-Cola

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy kahkaha atar. Altta Kendall Jenner (D), Kutup Ayıları (A).

**TTS:** Mocking, Fast (1.15x)

**Script:** The ultimate soda war! Who has the best ads? Coca-Cola’s polar bears? Classic, cozy, and perfectly nostalgic. Absolute A-Tier! But Pepsi’s Kendall Jenner ad? Thinking a can of soda can stop a protest? The biggest PR disaster of the decade. Straight to D-Tier trash! Coke or Pepsi? Fight in the comments and subscribe!

### Gün 7 - 22:30 -- 5 to 1 Ranking: Live TV News Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Yayına giren çocuklar, bayılan muhabirler. Glitch efektleri.

**TTS:** Amused, Fast (1.15x)

**Script:** Ranking the most embarrassing live TV news fails from 5 to 1! Number 5: The weather map glitching out. Number 4: A bird landing on the reporter's head. Number 3: The news anchor reading the teleprompter entirely wrong. Number 2: A kid walking into the live interview. And Number 1: The reporter falling out of a boat on live TV! Subscribe!

### Gün 8 - 12:30 -- 5 to 1 Ranking: Parkour Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Çatıdan çöp kutusuna düşenler, kayan ayakkabılar.

**TTS:** Tense, Fast (1.15x)

**Script:** Ranking the most painful parkour fails from 5 to 1! Number 5: Slipping on the very first jump. Number 4: Miscalculating the wall flip. Number 3: Landing straight into a muddy puddle. Number 2: Getting stuck on a high fence. And Number 1: Missing the roof jump and landing directly in a dumpster! Don't try this at home! Subscribe!

### Gün 8 - 17:30 -- Tier List: PlayStation vs Xbox

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy oyun oynar gibi yapar. Altta PS Bebek (D), Xbox (S).

**TTS:** Disgusted, Energetic (1.15x)

**Script:** Console wars are crazy, but their ads are crazier! Remember PlayStation 3’s crying baby ad? Creepy, weird, and gave everyone nightmares. Solid D-Tier! But Xbox’s 'Life is Short' commercial? Banned from TV because it was too extreme and brilliant! Pure S-Tier legend! Are you PlayStation or Xbox? Drop a comment below and subscribe!

### Gün 8 - 22:30 -- 5 to 1 Ranking: Trampoline Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Yırtılan trambolinler, uçan çocuklar. Yay sesleri (Boing SFX).

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the funniest trampoline fails from 5 to 1! Number 5: The double bounce sending someone flying. Number 4: Landing right on the metal springs. Number 3: The trampoline completely tearing in half. Number 2: Bouncing straight over the safety net. And Number 1: Getting stuck in the net like a giant spider web! Tag a friend and subscribe!

### Gün 9 - 12:30 -- 5 to 1 Ranking: Fishing Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Yüze çarpan balıklar, göle düşen oltalar.

**TTS:** Excited, Fast (1.15x)

**Script:** Ranking the craziest fishing fails from 5 to 1! Number 5: The fish slapping the guy right in the face. Number 4: Hooking your buddy's hat instead of a fish. Number 3: Dropping the brand new fishing rod into the lake. Number 2: The boat motor falling off completely. And Number 1: A massive alligator stealing your catch! Subscribe!

### Gün 9 - 17:30 -- Tier List: Balenciaga vs Gucci

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy göz devirir. Altta Çamur (C), İkizler (A).

**TTS:** Sarcastic, Annoyed (1.15x)

**Script:** High fashion is literally just a social experiment! Balenciaga making models walk through literal mud to sell expensive bags? Disgusting and lazy. C-Tier. But Gucci using identical twins walking down the runway holding hands? Weirdly artistic and totally captivating. I will give that a solid A-Tier! Is high fashion a scam? Subscribe and tell me!

### Gün 9 - 22:30 -- 5 to 1 Ranking: VR (Virtual Reality) Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): TV'ye kafa atanlar, avize kıranlar. Cam kırılma SFX.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the absolute worst virtual reality fails from 5 to 1! Number 5: Screaming at a fake zombie. Number 4: Trying to lean on a virtual table and falling over. Number 3: Punching the ceiling fan. Number 2: Smashing the controllers straight into the wall. And Number 1: Diving headfirst into the brand new flat screen TV! Subscribe for more!

### Gün 10 - 12:30 -- 5 to 1 Ranking: Delivery Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Paketi çatıya atan kuryeler, kayıp düşen adamlar.

**TTS:** Amused, Fast (1.15x)

**Script:** Ranking the funniest delivery fails from 5 to 1! Number 5: Throwing the fragile package into a tree. Number 4: The delivery driver slipping on ice. Number 3: Leaving the package right under the rain spout. Number 2: A neighborhood dog stealing the pizza box. And Number 1: The delivery truck forgetting to use the parking brake! Hit subscribe!

### Gün 10 - 17:30 -- Tier List: Red Bull vs GoPro

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy çok heyecanlı. Altta Uzay (S), Bisiklet (B).

**TTS:** Impressed, Loud (1.15x)

**Script:** Is it a commercial, or extreme history? Let's rank them! GoPro's mountain bike videos are cool, but they don't break the sound barrier. Solid B-Tier. But Red Bull sending a guy to space just so he can jump back to Earth? The greatest marketing stunt of all time. Easy S-Tier! What is the craziest stunt you’ve seen? Comment below and subscribe!

### Gün 10 - 22:30 -- 5 to 1 Ranking: Dance Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Pantolonu yırtılanlar, partnerini düşürenler.

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the most embarrassing dance fails from 5 to 1! Number 5: Slipping on the dance floor. Number 4: Kicking your partner in the face by accident. Number 3: Ripping your pants entirely during a split. Number 2: The classic breakdance headspin disaster. And Number 1: Taking out the entire DJ booth with one bad move! Tag a bad dancer and subscribe!

### Gün 11 - 12:30 -- 5 to 1 Ranking: Rollercoaster Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Hız treninde bayılanlar, şapkası uçanlar. Rüzgar ve çığlık SFX.

**TTS:** Excited, Fast (1.15x)

**Script:** Ranking the funniest rollercoaster fails from 5 to 1! Number 5: Screaming before the ride even starts. Number 4: Losing your hat to the wind. Number 3: The ultimate bug in the mouth disaster! Number 2: Passing out and waking up three times. And Number 1: Throwing up your cotton candy on the guy behind you! Hit subscribe!

### Gün 11 - 17:30 -- Tier List: Rolex vs Casio

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy. Altta S-A-B-C-D panosu. Rolex (B), Casio (S).

**TTS:** Sarcastic, Loud (1.15x)

**Script:** Who makes the best watch commercials? Let's rank them! Rolex ads are pure luxury, playing golf on a yacht. Classy, but a bit boring. B-Tier. But Casio? Getting name-dropped in Shakira's revenge song against Pique? The most savage, accidental marketing genius ever! Instant S-Tier! Rolex or Casio? Drop your favorite in the comments and subscribe!

### Gün 11 - 22:30 -- 5 to 1 Ranking: DIY & Repair Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Boya yaparken köşede sıkışanlar, patlayan borular. Su sesi SFX.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the absolute worst DIY fails from 5 to 1! Number 5: Painting the floor and trapping yourself in the corner. Number 4: Nailing the door shut by accident. Number 3: The bookshelf collapsing instantly. Number 2: Hitting a water pipe and flooding the kitchen! And Number 1: The ceiling fan flying off the roof! Subscribe for more disasters!

### Gün 12 - 12:30 -- 5 to 1 Ranking: Drone Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Ağaca çarpan dronelar, denize düşen kameralar. Pervane sesi.

**TTS:** Tense, Fast (1.15x)

**Script:** Ranking the most expensive drone fails from 5 to 1! Number 5: Crashing into a tree on day one. Number 4: A bird attacking the drone mid-air! Number 3: Losing connection over the ocean. Number 2: Flying straight into the wedding cake! And Number 1: Catching it with your face instead of your hands! Subscribe to save your drone!

### Gün 12 - 17:30 -- Tier List: Doritos vs Snickers

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy atıştırmalık arar. Altta Doritos (A), Snickers (S).

**TTS:** Energetic, Fast (1.15x)

**Script:** The ultimate snack commercial battle! Doritos ultrasound baby ad? Hilarious, bizarre, and unforgettable. Easy A-Tier! But Snickers 'You're Not You When You're Hungry' with Betty White playing football? That is absolute Super Bowl royalty! S-Tier legend without a doubt. What is your favorite snack? Let me know down in the comments and smash subscribe!

### Gün 12 - 22:30 -- 5 to 1 Ranking: Unboxing Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Yeni TV'sini kıranlar, telefonu düşürenler. Cam kırılma SFX.

**TTS:** Disbelieving, Fast (1.15x)

**Script:** Ranking the most tragic unboxing fails from 5 to 1! Number 5: Using a knife and slicing the actual product. Number 4: Dropping the new phone immediately onto concrete. Number 3: The cat claiming the box before you even open it. Number 2: Unboxing a completely empty package. And Number 1: The brand new TV falling flat on its screen! Subscribe!

### Gün 13 - 12:30 -- 5 to 1 Ranking: Ice Skating Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Buzda kayanlar, toplu düşüşler.

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the most embarrassing ice skating fails from 5 to 1! Number 5: The wobbly Bambi legs. Number 4: Crashing straight into the barrier wall. Number 3: Taking out an entire group of kids like bowling pins. Number 2: The majestic split that rips your pants. And Number 1: Falling gracefully into a frozen puddle! Tag a bad skater and subscribe!

### Gün 13 - 17:30 -- Tier List: Emirates vs Qatar

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy şaşkın bakar. Altta Qatar (A), Emirates (S).

**TTS:** Impressed, Loud (1.15x)

**Script:** Who rules the skies of advertising? Qatar Airways makes beautiful, cinematic commercials. Very solid, easily an A-Tier! But Emirates? They literally put a real flight attendant on the very top of the Burj Khalifa! No green screen, just pure madness and bravery. That is a legendary S-Tier stunt! Which airline is better? Comment below and subscribe!

### Gün 13 - 22:30 -- 5 to 1 Ranking: Make-up & Beauty Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Dökülen pudralar, yanlış kesilen perçemler.

**TTS:** Amused, Fast (1.15x)

**Script:** Ranking the funniest makeup fails from 5 to 1! Number 5: The classic lipstick on the teeth. Number 4: Sneezing while applying mascara. Number 3: Gluing your eyes shut with fake lashes. Number 2: Using a sharpie instead of eyeliner. And Number 1: Shaving off half an eyebrow by accident! Whoops! Subscribe for more beauty disasters!

### Gün 14 - 12:30 -- 5 to 1 Ranking: Graduation Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Sahnede düşenler, kepi yüzüne çarpanlar.

**TTS:** Shocked, Fast (1.15x)

**Script:** Ranking the most awkward graduation fails from 5 to 1! Number 5: The graduation cap flying into someone's face. Number 4: Tripping on the stairs while getting the diploma. Number 3: The microphone breaking during the big speech. Number 2: The principal saying the completely wrong name. And Number 1: Falling off the stage entirely! Subscribe and stay in school!

### Gün 14 - 17:30 -- Tier List: LEGO vs Barbie

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy oyuncaklarla oynar gibi yapar. Altta LEGO (A), Barbie (S).

**TTS:** Energetic, Fast (1.15x)

**Script:** Ranking the greatest toy commercials! LEGO's 'Rebuild the World' is creative, colorful, and fun. Very solid A-Tier. But Barbie? Creating an entire cinematic universe, taking over the real world, and breaking the box office? That went way beyond just a toy ad. That is an absolute S-Tier cultural reset! LEGO or Barbie? Drop a comment and subscribe!

### Gün 14 - 22:30 -- 5 to 1 Ranking: Prank Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Şakası ters tepenler, kendi tuzağına düşenler.

**TTS:** Laughing, Fast (1.15x)

**Script:** Ranking the worst prank fails from 5 to 1! Number 5: The jump scare that gets no reaction. Number 4: The fake spider causing a real heart attack. Number 3: The pie in the face hitting a random stranger. Number 2: Slipping on your own banana peel. And Number 1: Getting punched instantly by your best friend! Subscribe for more!

### Gün 15 - 12:30 -- 5 to 1 Ranking: Animal Encounter Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Gözlük çalan maymunlar, kovalayan kazlar.

**TTS:** Tense, Fast (1.15x)

**Script:** Ranking the funniest wild animal fails from 5 to 1! Number 5: A seagull stealing your french fry. Number 4: A monkey taking your sunglasses and running away. Number 3: Getting chased by an angry goose at the park. Number 2: An ostrich sticking its head in your car. And Number 1: A pelican trying to eat your entire phone! Subscribe!

### Gün 15 - 17:30 -- Tier List: Spotify vs Netflix

**Gorsel/Sahne:** Bölünmüş Ekran (Dummy Var): Üstte Dummy kulaklıkla müzik dinler. Altta Netflix (A), Spotify (S).

**TTS:** Impressed, Loud (1.15x)

**Script:** Who has the best marketing strategy? Netflix's creepy guerilla marketing campaigns are super cool. Solid A-Tier. But Spotify Wrapped? They literally turned our own music data into a massive global trend that takes over the internet every single December! Absolute S-Tier genius. Do you use Spotify or Apple Music? Let me know and hit that subscribe button!

### Gün 15 - 22:30 -- 5 to 1 Ranking: Celebration Fails

**Gorsel/Sahne:** Tam Ekran (Dummy Yok): Erken sevinen sporcular, dökülen şampanyalar.

**TTS:** Amused, Fast (1.15x)

**Script:** Ranking the most tragic celebration fails from 5 to 1! Number 5: Missing the high five entirely. Number 4: Dropping the massive trophy. Number 3: Celebrating the race finish too early and losing! Number 2: Popping the champagne straight into your own eye. And Number 1: Tearing a muscle while doing the victory dance! Hit subscribe before you celebrate!

# Font dosyalari

Kompozisyonlar `InterLocal` ailesini bu klasorden yukler. Dosyalar burada
yoksa render **yine calisir**: `FONT_STACK` icindeki DejaVu Sans / Liberation
Sans devreye girer (ikisi de Turkce karakterleri tam destekler), sadece harf
sekli degisir.

Tasarimin her makinede birebir ayni olmasi icin su uc dosyayi ekleyin:

- `Inter-Medium.woff2` (500)
- `Inter-ExtraBold.woff2` (800)
- `Inter-Black.woff2` (900)

Inter, SIL Open Font License ile dagitilir: https://github.com/rsms/inter/releases

```bash
# Ornek kurulum (VPS'te bir kez)
curl -L -o /tmp/inter.zip https://github.com/rsms/inter/releases/latest/download/Inter.zip
unzip -j /tmp/inter.zip 'extras/woff2/*' -d public/fonts/
```

**Not:** `@remotion/google-fonts` bilerek kullanilmiyor - fontu render aninda
CDN'den cektigi icin agsiz veya kisitli ortamda render'i tamamen cokertiyor.

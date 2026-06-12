# 🌍 Earth Watcher — Geliştirme Durumu (11 Haziran 2026)

## ✅ Tamamlananlar

### Altyapı
- **Harita**: OpenStreetMap tile, zoom 2-18, kutuplar sınırlı
- **5 Slider**: Aç/kapa, cam efekti (blur 20px)
- **Slider Yerleşimi**:
  - ▼ **Üst Sol**: Katmanlar (8 checkbox)
  - ▼ **Üst Orta**: Genel Kontroller (boş)
  - ▼ **Üst Sağ**: Dil Seçimi (ileride)
  - ▶ **Sol Yan**: (ileride kullanılacak)
  - ◀ **Sağ Yan**: Detaylar / Ülke Bilgisi / Doğal Olaylar
- **İkonlar**: 19 adet SVG ikon (`icons/icons.js`)
- **Data Manager**: `data/events.json` yükleme, filtreleme

### Layer 1 — Temel (`js/layers/temel.js`)
- Grid çizgileri (30° aralıklı, Ekvator/Greenwich vurgulu)
- Canlı koordinat göstergesi (sol alt, derece/dakika/saniye)
- Türkiye merkezli başlangıç

### Layer 2 — Coğrafi (`js/layers/cografi.js`)
- Ülke sınırları (TopoJSON → world-atlas)
- **Ctrl + Mouse** ülke hover → sağ slider'da bilgi
- Ülke bilgileri: bayrak (flagcdn), başkent, nüfus, dil, para birimi
- Veritabanı: `js/data/countries.js` (~100 ülke)
- **Sağ tık** → popup: Google Haritalar + Uydu Görünümü
- Sağ slider başlığı "Detaylar"

### Layer 3 — Doğal Olaylar (`js/layers/dogal-olaylar.js`)
- **USGS** → Depremler (canlı, 2.5+ Mw)
- **NASA EONET** → Sel, yanardağ, fırtına, yangın
- **Open-Meteo** → 10 şehirde hava durumu (ücretsiz)
- Filtreler: Deprem, Su Baskını, Yanardağ, Fırtına, Aşırı Yağış, Yangın, Kuraklık
- Yenileme aralığı: 1-30 dk ayarlanabilir
- Marker'lar 2 dk sonra otomatik kaybolur
- **Ticker** → alt bilgi şeridi (olaylar akar)
- **Olay etiketi** → marker yanında küçük bilgi
- Hava durumu overlay → Doğal Olaylar/Doğa Dışı/Siyasi açıkken gösterilir

### Dosya Yapısı
```
EARTH_WATCHER/
├── index.html
├── img/
│   └── earth-watcher-map.jpg
├── css/
│   ├── main.css
│   └── sliders.css
├── js/
│   ├── main.js
│   ├── data-manager.js
│   ├── data/
│   │   └── countries.js        ← Ülke veritabanı
│   ├── ui/
│   │   └── sliders.js
│   ├── layers/
│   │   ├── temel.js             ← Layer 1 ✅
│   │   ├── cografi.js           ← Layer 2 ✅
│   │   └── dogal-olaylar.js     ← Layer 3 ⚠️ (yarım)
│   │   ├── doga-disi-olaylar.js ← Layer 4 ⏳
│   │   ├── siyasi-olaylar.js    ← Layer 5 ⏳
│   │   ├── uydular.js           ← Layer 6 ⏳
│   │   ├── ucus.js              ← Layer 7 ⏳
│   │   └── gemi.js              ← Layer 8 ⏳
├── icons/
│   └── icons.js
├── data/
│   └── events.json
└── _EARTH_WATCHER_NOTLARI.txt
```

## 🔧 Sıradaki İşler

### Layer 3'te Eksikler
- [ ] Ticker çubuğu test edilmedi
- [ ] Olay etiketleri test edilmedi
- [ ] Sağ slider'daki afet filtreleri kayboluyor olabilir
- [ ] Doğal Olaylar açıkken üst slider'da da gösterilmesi istenmişti

### Kalan Katmanlar
- [ ] **Layer 4 — Doğa Dışı Olaylar** (`doga-disi-olaylar.js`)
- [ ] **Layer 5 — Siyasi Olaylar** (`siyasi-olaylar.js`)
- [ ] **Layer 6 — Uydular** (`uydular.js`)
- [ ] **Layer 7 — Uçuş Bilgileri** (`ucus.js`)
- [ ] **Layer 8 — Gemi Bilgileri** (`gemi.js`)

### Bilinen Sorunlar
- REST Countries API'si kullanım dışı → yerel DB ile çözüldü
- Street View, Google'ın çekmediği yerlerde çalışmaz
- Sağ/sol yan sliderlar programatik (sadece JS ile açılır)
- Sağ slider oku (◀) açıkken tıklanırsa kapatır

### Kullanılan API'ler (ücretsiz)
| API | Kullanım | Limit |
|-----|----------|-------|
| USGS Earthquake | Deprem verisi | Limitsiz |
| NASA EONET | Doğal afetler | Limitsiz |
| Open-Meteo | Hava durumu | Limitsiz |
| flagcdn.com | Bayrak resimleri | Limitsiz |
| Wikipedia | Ülke bağlantısı | Limitsiz |
| cdn.jsdelivr.net | TopoJSON verisi | Limitsiz |

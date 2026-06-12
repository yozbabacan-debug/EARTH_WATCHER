# 🌍 Earth Watcher — Kod Yapısı

## Önerilen Dosya Yapısı
```
earth-watcher/
├── index.html
├── css/
│   ├── main.css
│   └── sliders.css
├── js/
│   ├── main.js
│   ├── ui/
│   │   └── sliders.js
│   ├── layers/               ← Her katman ayrı dosya
│   │   ├── temel.js
│   │   ├── cografi.js
│   │   ├── dogal-olaylar.js
│   │   ├── doga-disi-olaylar.js
│   │   ├── siyasi-olaylar.js
│   │   ├── uydular.js
│   │   ├── ucus.js
│   │   └── gemi.js
│   └── data-manager.js       ← Veri yükleme ve zaman yönetimi
├── icons/
│   └── icons.js
├── data/
│   └── events.json           ← Tüm olaylar (tarih-saat sıralı)
├── db/                       ← İleride (Phase 2)
│   └── schema.sql
└── timeline/                 ← 1 ay sonra
```

## Katmanlar (8 katman)
| # | Dosya | İçerik |
|:--:|-------|--------|
| 1 | `temel.js` | Harita temel katmanı, grid, koordinatlar |
| 2 | `cografi.js` | Ülkeler, şehirler, sınırlar (+ Street View) |
| 3 | `dogal-olaylar.js` | Deprem, volkan, hava durumu, kasırga |
| 4 | `doga-disi-olaylar.js` | Yangın, sel, endüstriyel kazalar |
| 5 | `siyasi-olaylar.js` | Protestolar, seçimler, çatışmalar |
| 6 | `uydular.js` | Starlink, ISS, uydu konumları |
| 7 | `ucus.js` | Uçak takibi, hava yolları |
| 8 | `gemi.js` | Gemi takibi, rotalar |

## UI
- **5 Slider**: Sağ, sol, üst (solid background, ok işaretli)
- **İkonlar**: `icons/icons.js` — ikon ismi + şekil
- **Data Manager**: Veri yükleme, zaman yönetimi, timeline

## Geliştirme Sırası
1. HTML + CSS (index.html, main.css, sliders.css)
2. Slider UI (ui/sliders.js)
3. Temel katman (layers/temel.js) — harita, grid
4. İkonlar (icons/icons.js)
5. Data Manager (data-manager.js)
6. Diğer katmanlar tek tek
7. Timeline (1 ay sonra)

## Data Format (`data/events.json`)
```json
{
  "events": [
    {
      "id": 1,
      "timestamp": "2026-05-31T14:30:00Z",
      "category": "dogal-olaylar",
      "subcategory": "deprem",
      "title": "7.2 Mw Deprem - Japonya",
      "lat": 35.6762,
      "lng": 139.6503,
      "severity": "high",
      "description": "...",
      "source": "USGS"
    }
  ]
}
```

## Phase 2 — Veritabanı Seçenekleri
| Veritabanı | Neden? |
|------------|--------|
| **Supabase** | PostgreSQL + ücretsiz, önerilen |
| Firebase (Firestore) | Gerçek zamanlı güncelleme |
| SQLite | Node.js backend ile

## GitHub Pages Kurulumu
1. **Yeni Repository**
   - GitHub → New repository
   - İsim: `earth-watcher`
   - Public, README.md ile

2. **GitHub Pages Aktif Et**
   - Repo → Settings → Pages
   - Source: Deploy from branch → `main` → `/ (root)` → Save

3. **Dosyaları Yükle**
   - `index.html`, `css/`, `js/`, `icons/`, `data/`

4. **Site Linki**
   - `https://[kullanici].github.io/earth-watcher/`

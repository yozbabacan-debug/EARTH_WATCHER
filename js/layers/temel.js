/**
 * Earth Watcher v2 — Layer 1: Temel Katman (Enterprise Edition)
 * Grid cizgileri, koordinat gostergesi, harita sinirlari
 *
 * V2 farki: destroy fonksiyonu ile bellek temizligi (memory leak yok)
 */

// Izole degiskenler (dışarıdan erişilemez)
let _gridLines = [];
let _coordControl = null;
let _coordHandler = null;

function initTemelLayer(map) {
  console.log("🌐 [Temel Katman] V2 baslatiliyor...");

  // 1. Grid Cizgileri
  _addGridLines(map);

  // 2. Koordinat Gostergesi
  _addCoordinateDisplay(map);

  // 3. Turkiye merkezli baslangic
  map.setView([39.0, 35.0], 4);

  // 4. Leaflet default water mark temizligi (Pro gorunum)
  const attr = document.querySelector(".leaflet-control-attribution");
  if (attr) attr.style.fontSize = "9px";

  console.log("✅ [Temel Katman] V2 hazir");
}

function destroyTemelLayer(map) {
  console.log("🗑️ [Temel Katman] Temizleniyor...");

  // Grid cizgilerini sil
  _gridLines.forEach(function (line) {
    try {
      map.removeLayer(line);
    } catch (e) {}
  });
  _gridLines = [];

  // Koordinat gostergesini sil
  if (_coordControl) {
    try {
      map.removeControl(_coordControl);
    } catch (e) {}
    _coordControl = null;
  }

  // Mouse event'ini kaldir
  if (_coordHandler) {
    map.off("mousemove", _coordHandler);
    _coordHandler = null;
  }

  console.log("✅ [Temel Katman] Temizlendi");
}

// ============================================================
// PRIVATE: Grid Cizgileri
// ============================================================
function _addGridLines(map) {
  // Enlem cizgileri
  for (let lat = -90; lat <= 90; lat += 30) {
    const isEquator = lat === 0;
    const line = L.polyline(
      [
        [lat, -180],
        [lat, 180],
      ],
      {
        color: isEquator ? "#22c55e" : "rgba(34, 197, 94, 0.35)",
        weight: isEquator ? 2 : 1,
        opacity: 0.6,
        dashArray: isEquator ? null : "8, 6",
        interactive: false,
      },
    ).addTo(map);
    _gridLines.push(line);
  }

  // Boylam cizgileri
  for (let lng = -180; lng <= 180; lng += 30) {
    const isGreenwich = lng === 0;
    const line = L.polyline(
      [
        [-90, lng],
        [90, lng],
      ],
      {
        color: isGreenwich ? "#22c55e" : "rgba(34, 197, 94, 0.35)",
        weight: isGreenwich ? 2 : 1,
        opacity: 0.6,
        dashArray: isGreenwich ? null : "8, 6",
        interactive: false,
      },
    ).addTo(map);
    _gridLines.push(line);
  }
}

// ============================================================
// PRIVATE: Koordinat Gostergesi
// ============================================================
function _addCoordinateDisplay(map) {
  _coordControl = L.control({ position: "bottomleft" });

  _coordControl.onAdd = function () {
    const div = L.DomUtil.create("div", "coordinate-display");
    div.innerHTML = `
      <div class="coord-inner" style="background:rgba(15,23,42,0.85);color:#f8fafc;
           padding:6px 14px;border-radius:6px;font-size:0.8rem;font-family:monospace;
           border:1px solid rgba(34,197,94,0.2);white-space:nowrap;">
        🌍 <span class="coord-text">Enlem: --° --' --" | Boylam: --° --' --"</span>
      </div>`;
    return div;
  };

  _coordControl.addTo(map);

  // Mouse handler
  _coordHandler = function (e) {
    const lat = e.latlng.wrap ? e.latlng.wrap().lat : e.latlng.lat;
    const lng = e.latlng.wrap ? e.latlng.wrap().lng : e.latlng.lng;

    const latStr = _formatCoord(lat, "lat");
    const lngStr = _formatCoord(lng, "lng");

    const el = document.querySelector(".coordinate-display .coord-text");
    if (el) {
      el.textContent = `Enlem: ${latStr} | Boylam: ${lngStr}`;
    }
  };

  map.on("mousemove", _coordHandler);
}

function _formatCoord(value, type) {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = ((abs - deg - min / 60) * 3600).toFixed(1);
  const dir =
    type === "lat" ? (value >= 0 ? "K" : "G") : value >= 0 ? "D" : "B";
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

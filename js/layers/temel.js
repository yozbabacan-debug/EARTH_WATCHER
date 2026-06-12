/**
 * Earth Watcher — Layer 1: Temel Katman
 * Grid çizgileri ve koordinat göstergesi
 */

function initTemelLayer(map) {
  console.log("🌐 Temel katman başlatılıyor...");

  // 1. Koordinat Grid Çizgileri
  addGridLines(map);

  // 2. Koordinat Göstergesi (mouse hareketi)
  addCoordinateDisplay(map);

  // 3. Haritayı varsayılan konuma getir
  map.setView([39.0, 35.0], 4);

  console.log("✅ Temel katman hazır");
}

function addGridLines(map) {
  // Her 30 derecede bir enlem çizgisi
  for (let lat = -90; lat <= 90; lat += 30) {
    const color = lat === 0 ? "#22c55e" : "rgba(34, 197, 94, 0.5)";
    const weight = lat === 0 ? 2 : 1;

    L.polyline(
      [
        [lat, -180],
        [lat, 180],
      ],
      {
        color: color,
        weight: weight,
        opacity: 0.6,
        dashArray: lat === 0 ? null : "8, 6",
      },
    ).addTo(map);
  }

  // Her 30 derecede bir boylam çizgisi
  for (let lng = -180; lng <= 180; lng += 30) {
    const color = lng === 0 ? "#22c55e" : "rgba(34, 197, 94, 0.5)";
    const weight = lng === 0 ? 2 : 1;

    L.polyline(
      [
        [-90, lng],
        [90, lng],
      ],
      {
        color: color,
        weight: weight,
        opacity: 0.6,
        dashArray: lng === 0 ? null : "8, 6",
      },
    ).addTo(map);
  }
}

function addCoordinateDisplay(map) {
  const display = L.control({ position: "bottomleft" });

  display.onAdd = function () {
    const div = L.DomUtil.create("div", "coordinate-display");
    div.innerHTML = `
      <div class="coord-inner">
        <span class="coord-icon">🌍</span>
        <span class="coord-text">Enlem: --° --' --" | Boylam: --° --' --"</span>
      </div>
    `;
    return div;
  };

  display.addTo(map);

  // Mouse hareketi ile koordinatları güncelle
  map.on("mousemove", function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    const latStr = formatCoord(lat, "lat");
    const lngStr = formatCoord(lng, "lng");

    const el = document.querySelector(".coordinate-display .coord-text");
    if (el) {
      el.textContent = `Enlem: ${latStr} | Boylam: ${lngStr}`;
    }
  });
}

function formatCoord(value, type) {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = ((abs - deg - min / 60) * 3600).toFixed(1);

  const dir =
    type === "lat" ? (value >= 0 ? "K" : "G") : value >= 0 ? "D" : "B";

  return `${deg}° ${min}' ${sec}" ${dir}`;
}

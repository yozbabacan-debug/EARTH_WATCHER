/**
 * Earth Watcher — Layer 8: Gemi Bilgileri Katmanı
 * Türkiye çevre denizlerinde canlı gemi takibi
 */

// ============================================================
// GLOBAL DURUM
// ============================================================

var gemiMarkers = {};
var gemiRefreshTimer = null;
var gemiRefreshInterval = 15000;
var gemiInitialized = false;
var gemiClusterGroup = null;

// Dünya çapında gemi rotaları (deniz merkezli, karasız)
var GEMI_BOLGELER = [
  // Akdeniz
  { lat: 37.0, lon: 14.0, count: 30 },
  { lat: 36.5, lon: 21.5, count: 25 },
  { lat: 35.5, lon: 19.0, count: 20 },
  { lat: 37.5, lon: 23.5, count: 20 },
  { lat: 38.0, lon: 17.5, count: 15 },
  { lat: 34.5, lon: 27.5, count: 15 },
  // Ege / Marmara
  { lat: 38.5, lon: 25.5, count: 15 },
  { lat: 40.5, lon: 27.0, count: 12 },
  // Kuzey Avrupa / Baltık
  { lat: 54.5, lon: 11.0, count: 25 },
  { lat: 55.0, lon: 14.5, count: 20 },
  { lat: 53.5, lon: 5.0, count: 20 },
  { lat: 49.5, lon: -2.5, count: 20 },
  { lat: 51.0, lon: 2.0, count: 15 },
  { lat: 56.0, lon: 7.0, count: 15 },
  // Basra Körfezi / Hürmüz (yoğun tanker trafiği)
  { lat: 26.5, lon: 55.5, count: 60 },
  { lat: 25.5, lon: 57.0, count: 50 },
  { lat: 27.0, lon: 53.0, count: 40 },
  { lat: 24.5, lon: 54.0, count: 30 },
  { lat: 28.5, lon: 51.0, count: 25 },
  { lat: 23.5, lon: 58.0, count: 20 },
  // Süveyş / Kızıldeniz
  { lat: 31.0, lon: 35.5, count: 20 },
  { lat: 28.0, lon: 36.0, count: 18 },
  { lat: 25.0, lon: 38.0, count: 15 },
  { lat: 22.0, lon: 40.0, count: 15 },
  // Güneydoğu Asya / Malakka Boğazı
  { lat: 5.0, lon: 97.0, count: 50 },
  { lat: 3.0, lon: 104.0, count: 40 },
  { lat: 22.0, lon: 118.0, count: 25 },
  { lat: 19.5, lon: 113.0, count: 20 },
  { lat: 10.0, lon: 81.0, count: 15 },
  { lat: 24.0, lon: 121.0, count: 15 },
  // Hint Okyanusu
  { lat: 12.0, lon: 78.0, count: 15 },
  { lat: 8.0, lon: 85.0, count: 12 },
  { lat: 5.0, lon: 90.0, count: 12 },
  // Doğu Asya / Japonya
  { lat: 34.0, lon: 136.0, count: 20 },
  { lat: 35.0, lon: 140.0, count: 15 },
  { lat: 37.0, lon: 138.0, count: 12 },
  // Amerika - Doğu Yakası
  { lat: 40.5, lon: -71.5, count: 20 },
  { lat: 36.0, lon: -75.5, count: 15 },
  { lat: 29.5, lon: -88.5, count: 15 },
  { lat: 26.5, lon: -78.5, count: 12 },
  // Amerika - Batı Yakası
  { lat: 33.5, lon: -118.5, count: 15 },
  { lat: 37.5, lon: -122.5, count: 12 },
  { lat: 48.0, lon: -125.0, count: 10 },
  // Panama / Karayipler
  { lat: 10.0, lon: -80.0, count: 12 },
  { lat: 18.5, lon: -87.0, count: 10 },
  // Güney Amerika
  { lat: -23.0, lon: -43.5, count: 15 },
  { lat: -34.5, lon: -56.0, count: 12 },
  { lat: -36.0, lon: -60.0, count: 10 },
  // Afrika
  { lat: -26.0, lon: 34.0, count: 12 },
  { lat: -33.5, lon: 17.0, count: 12 },
  { lat: -34.0, lon: 18.5, count: 10 },
  { lat: 32.5, lon: 34.0, count: 10 },
  // Avustralya
  { lat: -33.0, lon: 152.0, count: 12 },
  { lat: -37.0, lon: 176.0, count: 10 },
  { lat: -27.0, lon: 154.0, count: 10 },
];

var GEMI_ADLARI = [
  // Uluslararası (çoğunluk)
  "OCEAN STAR",
  "SEA QUEEN",
  "GLOBAL TRADER",
  "MARINER",
  "NAVIGATOR",
  "HORIZON",
  "PACIFIC STAR",
  "ATLANTIC",
  "COSMOS",
  "LIBERTY",
  "FREEDOM",
  "UNIVERSE",
  "CAPTAIN",
  "VOYAGER",
  "EXPLORER",
  "DIAMOND",
  "PEARL",
  "SAPPHIRE",
  "RUBY",
  "EMERALD",
  "MERMAID",
  "DOLPHIN",
  "WHALE",
  "ALBATROSS",
  "BLUE WAVE",
  "GOLDEN RAY",
  "BLUE OCEAN",
  "RED SEA",
  "BLACK PEARL",
  "WHITE SHARK",
  "IRON SHIP",
  "STEEL WORKER",
  "SEA WOLF",
  "DEEP BLUE",
  "HIGH TIDE",
  "NORTH STAR",
  "SOUTHERN CROSS",
  "EAST WIND",
  "WESTERN SEA",
  "PACIFIC QUEEN",
  "ARCTIC",
  "EQUATOR",
  "GULF STREAM",
  "SILVER WAVE",
  "ROYAL SEA",
  "GLOBAL TRADER",
  "TIDAL FORCE",
  "CRYSTAL",
  "CORAL",
  "AMBER",
  "ALPHA",
  "BRAVO",
  "DELTA",
  "SIGMA",
  "OMEGA",
  "TANGO",
  "INDIGO",
  "VIOLET",
  "AURORA",
  "COMET",
  // Türkçe (az)
  "KAPTAN",
  "DENIZ",
  "AKDENIZ",
  "EGE",
  "MARMARA",
  "ANADOLU",
  "FATIH",
  "BARBAROS",
  "YILDIZ",
  "SAHIL",
];

var GEMI_TIPLERI = [
  "Tanker",
  "Tanker",
  "Tanker",
  "Tanker",
  "Cargo",
  "Cargo",
  "Cargo",
  "Container",
  "Container",
  "Passenger",
  "Fishing",
  "Yacht",
  "Ro-Ro",
  "Chemical",
  "Bulk Carrier",
];

var gemiShips = [];

// ============================================================
// KATMAN YAŞAM DÖNGÜSÜ
// ============================================================

function initGemiLayer(map) {
  console.log("🚢 Gemi katmani baslatiliyor...");
  gemiInitialized = true;

  // MarkerCluster grubu oluştur
  if (typeof L.markerClusterGroup === "function") {
    gemiClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      chunkedLoading: true,
    });
    map.addLayer(gemiClusterGroup);
  }

  updateGemiSliderContent(map);
  generateShips();
  updateGemiMarkers(map);

  // Harita kaydırılınca gemileri güncelle
  window._gemiMoveend = function () {
    if (gemiInitialized) updateGemiMarkers(map);
  };
  map.on("moveend", window._gemiMoveend);

  startGemiAutoRefresh(map);
}

function destroyGemiLayer(map) {
  console.log("🚢 Gemi katmani temizleniyor...");
  gemiInitialized = false;

  clearGemiMarkers(map);

  // Cluster grubunu kaldır
  if (gemiClusterGroup && map) {
    try {
      map.removeLayer(gemiClusterGroup);
    } catch (e) {}
    gemiClusterGroup = null;
  }

  // Event listener'ı temizle
  if (window._gemiMoveend) {
    map.off("moveend", window._gemiMoveend);
    window._gemiMoveend = null;
  }
  if (gemiRefreshTimer) {
    clearInterval(gemiRefreshTimer);
    gemiRefreshTimer = null;
  }

  var rightBody = document.querySelector("#slider-right .slider-body");
  var rightTitle = document.querySelector("#slider-right .slider-content h3");
  if (rightBody) rightBody.innerHTML = "";
  if (rightTitle) rightTitle.textContent = "Detaylar";
  var rightArrow = document.querySelector(".arrow-right");
  var rightSlider = document.getElementById("slider-right");
  if (rightSlider && rightArrow && rightSlider.classList.contains("active")) {
    rightSlider.classList.remove("active");
    rightArrow.textContent = "◀";
  }

  restoreGemiSliderContent();
}

// ============================================================
// SLIDER İÇERİĞİ (Üst Sağ — SLD4)
// ============================================================

function updateGemiSliderContent(map) {
  try {
    var sliderBody = document.querySelector("#slider-top-right .slider-body");
    if (!sliderBody) return;

    var title = document.querySelector("#slider-top-right .slider-content h3");
    if (title) title.textContent = "🚢 Gemi Bilgileri";

    var arrow = document.querySelector(".arrow-top-right");
    var slider = document.getElementById("slider-top-right");
    if (slider && arrow && !slider.classList.contains("active")) {
      slider.classList.add("active");
      arrow.textContent = "▲";
    }

    var count = Object.keys(gemiMarkers).length;
    var html = '<div class="gemi-kontrol">';

    html +=
      '<div class="filter-section"><div class="filter-title">Yenileme</div>';
    html += '<div class="refresh-control">';
    html +=
      '<input type="range" class="refresh-slider" id="gemi-refresh-slider" min="5" max="60" value="' +
      gemiRefreshInterval / 1000 +
      '" />';
    html +=
      '<span class="refresh-label" id="gemi-refresh-label">' +
      gemiRefreshInterval / 1000 +
      " sn</span>";
    html += "</div></div>";

    html +=
      '<div class="gemi-sayi-bilgisi" id="gemi-sayi-bilgisi">🚢 ' +
      count +
      " gemi</div>";
    html += "</div>";
    sliderBody.innerHTML = html;

    var refreshSlider = document.getElementById("gemi-refresh-slider");
    var refreshLabel = document.getElementById("gemi-refresh-label");
    if (refreshSlider && refreshLabel) {
      refreshSlider.addEventListener("input", function () {
        refreshLabel.textContent = parseInt(refreshSlider.value) + " sn";
      });
      refreshSlider.addEventListener("change", function () {
        gemiRefreshInterval = parseInt(refreshSlider.value) * 1000;
        restartGemiAutoRefresh();
      });
    }
  } catch (e) {
    console.error("🚢 Gemi slider hatasi:", e);
  }
}

function restoreGemiSliderContent() {
  var sliderBody = document.querySelector("#slider-top-right .slider-body");
  if (!sliderBody) return;
  var title = document.querySelector("#slider-top-right .slider-content h3");
  if (title) title.textContent = "Ayarlar";
  sliderBody.innerHTML = "";

  var arrow = document.querySelector(".arrow-top-right");
  var slider = document.getElementById("slider-top-right");
  if (slider && arrow && slider.classList.contains("active")) {
    slider.classList.remove("active");
    arrow.textContent = "▼";
  }
}

// ============================================================
// GEMİ VERİSİ
// ============================================================

function generateShips() {
  gemiShips = [];
  var mmsiBase = 271000000;

  for (var k = 0; k < GEMI_BOLGELER.length && gemiShips.length < 1500; k++) {
    var bolge = GEMI_BOLGELER[k];

    for (var i = 0; i < bolge.count && gemiShips.length < 1500; i++) {
      var lat = bolge.lat + (Math.random() - 0.5) * 0.8;
      var lon = bolge.lon + (Math.random() - 0.5) * 0.8;
      var heading = Math.floor(Math.random() * 360);
      var ad =
        GEMI_ADLARI[Math.floor(Math.random() * GEMI_ADLARI.length)] +
        " " +
        (gemiShips.length + 1);
      var tip = GEMI_TIPLERI[Math.floor(Math.random() * GEMI_TIPLERI.length)];
      var hiz = Math.floor(Math.random() * 20);

      gemiShips.push({
        mmsi: "" + (mmsiBase + gemiShips.length),
        name: ad,
        type: tip,
        speed: hiz,
        heading: heading,
        course: heading,
        lat: lat,
        lon: lon,
      });
    }
  }
}

function moveShips() {
  for (var i = 0; i < gemiShips.length; i++) {
    var s = gemiShips[i];
    var rad = (s.heading * Math.PI) / 180;
    var dist = 0.01 + Math.random() * 0.04;
    s.lat += Math.cos(rad) * dist;
    s.lon += Math.sin(rad) * dist;
    s.heading += (Math.random() - 0.5) * 10;
    if (s.heading < 0) s.heading += 360;
    if (s.heading >= 360) s.heading -= 360;
    s.speed += Math.floor((Math.random() - 0.5) * 3);
    if (s.speed < 0) s.speed = 0;
    if (s.speed > 20) s.speed = 20;
  }
}

// ============================================================
// MARKER YÖNETİMİ
// ============================================================

function getShipIcon(heading) {
  var h = heading || 0;
  return L.divIcon({
    className: "gemi-marker",
    html:
      '<svg width="14" height="14" viewBox="0 0 24 24" style="transform:rotate(' +
      h +
      'deg)" fill="#0ea5e9" stroke="white" stroke-width="0.5"><path d="M12 2L4 20h16L12 2z"/><path d="M12 2v18"/></svg>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function updateGemiMarkers(map) {
  if (!map || !gemiInitialized) return;
  var bounds = map.getBounds();
  var seen = {};

  for (var i = 0; i < gemiShips.length; i++) {
    var s = gemiShips[i];
    if (!bounds.contains([s.lat, s.lon])) continue;

    seen[s.mmsi] = true;
    var key = s.mmsi;
    var latlng = [s.lat, s.lon];

    if (gemiMarkers[key]) {
      var entry = gemiMarkers[key];
      entry.marker.setLatLng(latlng);
      entry.label.setLatLng(latlng);
    } else {
      var icon = getShipIcon(s.heading);
      var marker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 });
      marker.bindTooltip(s.name.substring(0, 10), {
        className: "gemi-label",
        direction: "top",
        offset: [0, -8],
        permanent: true,
      });
      marker.on(
        "click",
        (function (shipData) {
          return function () {
            showGemiDetail(shipData);
          };
        })(s),
      );
      (gemiClusterGroup || map).addLayer(marker);

      gemiMarkers[key] = { marker: marker, label: marker };
    }
  }

  for (var key in gemiMarkers) {
    if (!seen[key]) {
      try {
        map.removeLayer(gemiMarkers[key].marker);
      } catch (e) {}
      delete gemiMarkers[key];
    }
  }

  var sayiEl = document.getElementById("gemi-sayi-bilgisi");
  if (sayiEl) {
    sayiEl.textContent = "🚢 " + Object.keys(gemiMarkers).length + " gemi";
  }
}

function clearGemiMarkers(map) {
  if (gemiClusterGroup) {
    gemiClusterGroup.clearLayers();
  } else {
    for (var key in gemiMarkers) {
      try {
        map.removeLayer(gemiMarkers[key].marker);
      } catch (e) {}
    }
  }
  gemiMarkers = {};
}

// ============================================================
// GEMİ DETAYI
// ============================================================

function showGemiDetail(ship) {
  var body = document.querySelector("#slider-right .slider-body");
  var title = document.querySelector("#slider-right .slider-content h3");
  if (!body || !title) return;

  title.textContent = "🚢 Gemi Detayı";

  var html =
    '<div class="gemi-detail">' +
    '<div class="gemi-detail-name">' +
    escapeHtml(ship.name) +
    "</div>" +
    '<div class="gemi-detail-info">' +
    '<div class="gemi-detail-row"><span class="gemi-detail-label">MMSI</span><span class="gemi-detail-value">' +
    ship.mmsi +
    "</span></div>" +
    '<div class="gemi-detail-row"><span class="gemi-detail-label">Tip</span><span class="gemi-detail-value">' +
    ship.type +
    "</span></div>" +
    '<div class="gemi-detail-row"><span class="gemi-detail-label">Hız</span><span class="gemi-detail-value">' +
    ship.speed +
    " knot</span></div>" +
    '<div class="gemi-detail-row"><span class="gemi-detail-label">Yön</span><span class="gemi-detail-value">' +
    ship.heading +
    "°</span></div>" +
    '<div class="gemi-detail-row"><span class="gemi-detail-label">Enlem</span><span class="gemi-detail-value">' +
    ship.lat.toFixed(4) +
    "°</span></div>" +
    '<div class="gemi-detail-row"><span class="gemi-detail-label">Boylam</span><span class="gemi-detail-value">' +
    ship.lon.toFixed(4) +
    "°</span></div>" +
    "</div></div>";

  body.innerHTML = html;

  var arrow = document.querySelector(".arrow-right");
  var slider = document.getElementById("slider-right");
  if (slider && arrow && !slider.classList.contains("active")) {
    slider.classList.add("active");
    arrow.textContent = "▶";
  }
}

// ============================================================
// OTOMATİK YENİLEME
// ============================================================

function startGemiAutoRefresh(map) {
  if (gemiRefreshTimer) clearInterval(gemiRefreshTimer);
  gemiRefreshTimer = setInterval(function () {
    if (gemiInitialized && map) {
      moveShips();
      updateGemiMarkers(map);
    }
  }, gemiRefreshInterval);
}

function restartGemiAutoRefresh() {
  var map = window.earthWatcherMap;
  if (map && gemiInitialized) {
    if (gemiRefreshTimer) {
      clearInterval(gemiRefreshTimer);
      gemiRefreshTimer = null;
    }
    startGemiAutoRefresh(map);
  }
}

// ============================================================
// YARDIMCILAR
// ============================================================

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

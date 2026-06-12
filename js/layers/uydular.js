/**
 * Earth Watcher — Layer 6: Uydular Katmanı
 * N2YO benzeri canlı uydu takibi + Heavens-Above benzeri geçiş hesaplama
 *
 * TLE Kaynak: CelesTrak (ücretsiz, anahtar gerektirmez)
 * Propagasyon: satellite.js (UMD global)
 */

// ============================================================
// GLOBAL DURUM
// ============================================================

let satelliteMarkers = {}; // { key: { marker, label, orbitLine, satData, groupColor } }
let refreshTimerUydular = null;
let refreshIntervalUydular = 5000; // 5 saniye
let satelliteGroups = {}; // { groupId: [satellite, ...] }
let selectedSatGroups = []; // Aktif grup ID'leri
let allSatellites = []; // Tüm gruplardaki uydular (düz liste)
let uyduSearchTerm = "";
let uyduLayerInitialized = false;
let orbitLinesVisible = true;
let uyduCurrentPassSatKey = null;
let uyduTleRefreshCounter = 0; // TLE yenileme sayaacı

// Performans sınırlamaları
const MAX_SATELLITES_PER_GROUP = {
  starlink: 200,
  default: 250,
};
const MIN_ZOOM_FOR_STARLINK = 4;
const MAP_BOUNDS_MARGIN = 3; // derece

// ============================================================
// UYDU GRUP TANIMLARI (CelesTrak)
// ============================================================

const SAT_GROUPS = [
  {
    id: "stations",
    name: "🛸 Uzay İstasyonları",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
    color: "#22c55e",
  },
  {
    id: "starlink",
    name: "📡 Starlink",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
    color: "#8b5cf6",
  },
  {
    id: "weather",
    name: "🌤 Hava Durumu",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle",
    color: "#0ea5e9",
  },
  {
    id: "gps-ops",
    name: "📍 GPS",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle",
    color: "#f59e0b",
  },
  {
    id: "iridium",
    name: "📞 İridyum",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium&FORMAT=tle",
    color: "#06b6d4",
  },
  {
    id: "visual",
    name: "✨ Parlak Uydular",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle",
    color: "#f97316",
  },
  {
    id: "noaa",
    name: "🔵 NOAA",
    url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=noaa&FORMAT=tle",
    color: "#3b82f6",
  },
  {
    id: "turksat",
    name: "🇹🇷 Türk Uyduları",
    type: "static",
    color: "#e30b17",
    satellites: [
      {
        name: "TÜRKSAT 3A",
        tleLine1:
          "1 33056U 08030B   26163.27311942  .00000161  00000+0  00000+0 0  9991",
        tleLine2:
          "2 33056   0.0448  77.9485 0004985 352.4724 330.5212  1.00274179 52305",
      },
      {
        name: "TÜRKSAT 4A",
        tleLine1:
          "1 39522U 14007A   26163.27311942  .00000162  00000+0  00000+0 0  9997",
        tleLine2:
          "2 39522   0.0451 300.5927 0001361  16.3275  83.9984  1.00271570 44916",
      },
      {
        name: "TÜRKSAT 4B",
        tleLine1:
          "1 40984U 15060A   26163.20343463  .00000131  00000+0  00000+0 0  9993",
        tleLine2:
          "2 40984   0.0241  62.0093 0002240   4.3707 317.3789  1.00269732 39047",
      },
      {
        name: "TÜRKSAT 5A",
        tleLine1:
          "1 47306U 21001A   26162.98572434  .00000170  00000+0  00000+0 0  9999",
        tleLine2:
          "2 47306   0.0198  56.4803 0000087 196.8234  32.8204  1.00271651 19916",
      },
      {
        name: "TÜRKSAT 5B",
        tleLine1:
          "1 50212U 21126A   26163.05922678  .00000162  00000+0  00000+0 0  9996",
        tleLine2:
          "2 50212   0.0676 341.6413 0003421  13.2934 328.7843  1.00271127 16244",
      },
      {
        name: "TÜRKSAT 6A",
        tleLine1:
          "1 60233U 24127A   26163.20178795  .00000162  00000+0  00000+0 0  9994",
        tleLine2:
          "2 60233   0.0534 215.8715 0001660 282.6228 236.7183  1.00274435  6967",
      },
      {
        name: "GÖKTÜRK-1",
        tleLine1:
          "1 41875U 16073A   26163.32064567  .00000242  00000+0  56523-4 0  9995",
        tleLine2:
          "2 41875  98.1259  58.0713 0001449  76.3363 283.8000 14.62770776508114",
      },
      {
        name: "GÖKTÜRK-2",
        tleLine1:
          "1 39030U 12073A   26163.26606269  .00000691  00000+0  10837-3 0  9990",
        tleLine2:
          "2 39030  97.6828   0.9446 0001784  58.0355 302.1029 14.75538948723784",
      },
      {
        name: "İMECE",
        tleLine1:
          "1 56178U 23054A   26163.30780603  .00000244  00000+0  53518-4 0  9991",
        tleLine2:
          "2 56178  98.1233  68.1797 0009514 177.7832 182.3416 14.65844984169696",
      },
    ],
  },
];

// ============================================================
// KATMAN YAŞAM DÖNGÜSÜ
// ============================================================

function initUydularLayer(map) {
  console.log("🛰️ Uydular katmanı başlatılıyor...");

  if (typeof satellite === "undefined") {
    console.error("❌ satellite.js yüklenmemiş!");
    updateUyduSliderContent(
      map,
      "⚠️ satellite.js kütüphanesi yüklenemedi. Lütfen sayfayı yenileyin.",
    );
    return;
  }

  uyduLayerInitialized = true;
  selectedSatGroups = SAT_GROUPS.map(function (g) {
    return g.id;
  });

  // Slider içeriğini ayarla
  updateUyduSliderContent(map);

  // Verileri çek (async, bitince propagasyon otomatik)
  fetchAllSatelliteGroups(map);

  // Otomatik yenilemeyi başlat
  startUyduAutoRefresh(map);
}

function destroyUydularLayer(map) {
  console.log("🛰️ Uydular katmanı temizleniyor...");

  uyduLayerInitialized = false;
  uyduCurrentPassSatKey = null;
  uyduSearchTerm = "";

  // Marker'ları temizle
  clearSatelliteMarkers(map);

  // Zamanlayıcıyı durdur
  if (refreshTimerUydular) {
    clearInterval(refreshTimerUydular);
    refreshTimerUydular = null;
  }

  // Sağ slider'ı temizle (detaylar)
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

  // Üst sağ slider'ı eski haline döndür
  restoreUyduSliderContent();
}

// ============================================================
// SLIDER İÇERİĞİ (Üst Sağ — SLD4)
// ============================================================

function updateUyduSliderContent(map, errorMsg) {
  try {
    var sliderBody = document.querySelector("#slider-top-right .slider-body");
    if (!sliderBody) return;

    var title = document.querySelector("#slider-top-right .slider-content h3");
    if (title) title.textContent = "🛰️ Uydular";

    // Üst sağ slider'ı aç
    var arrow = document.querySelector(".arrow-top-right");
    var slider = document.getElementById("slider-top-right");
    if (slider && arrow && !slider.classList.contains("active")) {
      slider.classList.add("active");
      arrow.textContent = "▲";
    }

    if (errorMsg) {
      sliderBody.innerHTML =
        '<div style="color:#ef4444;font-size:0.85rem;padding:8px">' +
        errorMsg +
        "</div>";
      return;
    }

    var html = '<div class="uydu-kontrol">';

    // Grup filtreleri
    html +=
      '<div class="filter-section"><div class="filter-title">Uydu Grupları</div>';
    SAT_GROUPS.forEach(function (group) {
      var checked = selectedSatGroups.indexOf(group.id) !== -1 ? "checked" : "";
      html +=
        '<label class="layer-item uydu-group-filter" data-group="' +
        group.id +
        '">' +
        '<input type="checkbox" class="uydu-group-checkbox" data-group="' +
        group.id +
        '" ' +
        checked +
        " />" +
        '<span class="layer-name" style="color:' +
        group.color +
        '">' +
        group.name +
        "</span>" +
        "</label>";
    });
    html += "</div>";

    // Arama
    html += '<div class="filter-section"><div class="filter-title">Arama</div>';
    html +=
      '<input type="text" class="uydu-arama" id="uydu-arama-input" placeholder="Uydu adı ile ara..." value="' +
      escapeHtml(uyduSearchTerm) +
      '" />';
    html += "</div>";

    // Yenileme hızı
    html +=
      '<div class="filter-section"><div class="filter-title">Yenileme</div>';
    html += '<div class="refresh-control">';
    html +=
      '<input type="range" class="refresh-slider" id="uydu-refresh-slider" min="1" max="30" value="' +
      refreshIntervalUydular / 1000 +
      '" />';
    html +=
      '<span class="refresh-label" id="uydu-refresh-label">' +
      refreshIntervalUydular / 1000 +
      " sn</span>";
    html += "</div></div>";

    // Yörünge çizgileri toggle
    html += '<div class="filter-section">';
    html +=
      '<label class="layer-item">' +
      '<input type="checkbox" id="uydu-orbit-toggle" ' +
      (orbitLinesVisible ? "checked" : "") +
      " />" +
      '<span class="layer-name">🔄 Yörünge Çizgileri</span>' +
      "</label>";
    html += "</div>";

    // Sayı bilgisi
    html +=
      '<div class="uydu-sayi-bilgisi" id="uydu-sayi-bilgisi">Toplam: 0 uydu gösteriliyor</div>';

    html += "</div>";
    sliderBody.innerHTML = html;

    // Grup checkbox dinleyicileri
    var groupCbs = document.querySelectorAll(".uydu-group-checkbox");
    groupCbs.forEach(function (cb) {
      cb.addEventListener("change", function (e) {
        var groupId = e.target.dataset.group;
        if (e.target.checked) {
          if (selectedSatGroups.indexOf(groupId) === -1) {
            selectedSatGroups.push(groupId);
          }
        } else {
          selectedSatGroups = selectedSatGroups.filter(function (g) {
            return g !== groupId;
          });
        }
        // Satellite'ları yeniden göster
        var m = window.earthWatcherMap;
        if (m && uyduLayerInitialized) {
          updateSatellitePositions(m);
        }
      });
    });

    // Arama input dinleyicisi
    var searchInput = document.getElementById("uydu-arama-input");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        uyduSearchTerm = e.target.value.trim().toLowerCase();
        var m = window.earthWatcherMap;
        if (m && uyduLayerInitialized) {
          updateSatellitePositions(m);
        }
      });
    }

    // Refresh slider
    var refreshSlider = document.getElementById("uydu-refresh-slider");
    var refreshLabel = document.getElementById("uydu-refresh-label");
    if (refreshSlider && refreshLabel) {
      refreshSlider.addEventListener("input", function () {
        var val = parseInt(refreshSlider.value);
        refreshLabel.textContent = val + " sn";
      });
      refreshSlider.addEventListener("change", function () {
        var val = parseInt(refreshSlider.value);
        refreshIntervalUydular = val * 1000;
        restartUyduAutoRefresh();
      });
    }

    // Yörünge çizgileri toggle
    var orbitToggle = document.getElementById("uydu-orbit-toggle");
    if (orbitToggle) {
      orbitToggle.addEventListener("change", function (e) {
        orbitLinesVisible = e.target.checked;
        var m = window.earthWatcherMap;
        if (m && uyduLayerInitialized) {
          // Orbit lines'ları göster/gizle
          Object.keys(satelliteMarkers).forEach(function (key) {
            var entry = satelliteMarkers[key];
            if (entry && entry.orbitLine) {
              if (orbitLinesVisible) {
                m.addLayer(entry.orbitLine);
              } else {
                m.removeLayer(entry.orbitLine);
              }
            }
          });
        }
      });
    }
  } catch (e) {
    console.error("❌ Uydu slider hatası:", e);
  }
}

function restoreUyduSliderContent() {
  var sliderBody = document.querySelector("#slider-top-right .slider-body");
  if (!sliderBody) return;

  var title = document.querySelector("#slider-top-right .slider-content h3");
  if (title) title.textContent = "Ayarlar";

  sliderBody.innerHTML = "";

  // Üst sağ slider'ı kapat
  var arrow = document.querySelector(".arrow-top-right");
  var slider = document.getElementById("slider-top-right");
  if (slider && arrow && slider.classList.contains("active")) {
    slider.classList.remove("active");
    arrow.textContent = "▼";
  }
}

// ============================================================
// VERİ ÇEKME (TLE)
// ============================================================

async function fetchSatelliteGroup(groupId) {
  var group = null;
  for (var i = 0; i < SAT_GROUPS.length; i++) {
    if (SAT_GROUPS[i].id === groupId) {
      group = SAT_GROUPS[i];
      break;
    }
  }
  if (!group) return [];

  // Static grup (TLE verisi koda gömülü — örn: Türk uyduları)
  if (group.type === "static" && group.satellites) {
    console.log(
      "📦 Static grup yükleniyor: " +
        group.name +
        " (" +
        group.satellites.length +
        " uydu)",
    );
    return group.satellites.map(function (sat) {
      return {
        name: sat.name,
        tleLine1: sat.tleLine1,
        tleLine2: sat.tleLine2,
        groupId: group.id,
        color: group.color,
      };
    });
  }

  // Custom grup (örn: NORAD ID listesi ile — eski yöntem)
  if (group.type === "custom" && group.noradIds) {
    return await fetchCustomSatelliteGroup(group);
  }

  try {
    var response = await fetch(group.url);
    if (!response.ok) {
      console.warn("⚠️ TLE yanıt hatasi (" + groupId + "):", response.status);
      return [];
    }
    var text = await response.text();
    var lines = text.trim().split("\n");
    var satellites = [];
    for (var i = 0; i < lines.length; i += 3) {
      if (i + 2 < lines.length) {
        satellites.push({
          name: lines[i].trim(),
          tleLine1: lines[i + 1].trim(),
          tleLine2: lines[i + 2].trim(),
          groupId: groupId,
          color: group.color,
        });
      }
    }
    return satellites;
  } catch (err) {
    console.error("❌ TLE yüklenemedi (" + groupId + "):", err);
    return [];
  }
}

/**
 * Custom grup için tek tek NORAD ID'lerinden TLE çeker
 */
async function fetchCustomSatelliteGroup(group) {
  var satellites = [];
  for (var i = 0; i < group.noradIds.length; i++) {
    var noradId = group.noradIds[i];
    try {
      var url =
        "https://celestrak.org/NORAD/elements/gp.php?CATNR=" +
        noradId +
        "&FORMAT=tle";
      var response = await fetch(url);
      if (!response.ok) continue;
      var text = await response.text();
      var lines = text.trim().split("\n");
      if (lines.length >= 3) {
        satellites.push({
          name: lines[0].trim(),
          tleLine1: lines[1].trim(),
          tleLine2: lines[2].trim(),
          groupId: group.id,
          color: group.color,
        });
      }
    } catch (e) {
      console.warn("⚠️ NORAD " + noradId + " yüklenemedi");
    }
  }
  return satellites;
}

async function fetchAllSatelliteGroups(map) {
  console.log("📡 TLE verileri çekiliyor...");

  var results = await Promise.all(
    SAT_GROUPS.map(function (g) {
      return fetchSatelliteGroup(g.id);
    }),
  );

  satelliteGroups = {};
  allSatellites = [];

  SAT_GROUPS.forEach(function (group, idx) {
    satelliteGroups[group.id] = results[idx] || [];
    allSatellites = allSatellites.concat(results[idx] || []);
  });

  var totalSats = allSatellites.length;
  console.log("✅ Toplam " + totalSats + " uydu TLE'si yüklendi");

  // Sayı bilgisini güncelle
  var sayiEl = document.getElementById("uydu-sayi-bilgisi");
  if (sayiEl) {
    sayiEl.textContent = "Toplam: " + totalSats + " uydu (TLE yüklendi)";
  }

  // İlk propagasyon
  if (map) {
    propagateSatellites(map);
  }
}

// ============================================================
// UYDU PROPAGASYONU (satellite.js)
// ============================================================

function propagateSatellite(tleLine1, tleLine2) {
  try {
    if (typeof satellite === "undefined") return null;
    var satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    var now = new Date();
    var positionAndVelocity = satellite.propagate(satrec, now);

    if (!positionAndVelocity.position) return null;

    var gmst = satellite.gstime(now);
    var positionGd = satellite.eciToGeodetic(
      positionAndVelocity.position,
      gmst,
    );

    var lat = satellite.degreesLat(positionGd.latitude);
    var lng = satellite.degreesLong(positionGd.longitude);
    var alt = positionGd.height; // km

    // Hız (velocity vector magnitude)
    var speed = 0;
    if (positionAndVelocity.velocity) {
      var v = positionAndVelocity.velocity;
      speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    // Yörünge periyodu (TLE line 2'den mean motion)
    var meanMotion = parseFloat(tleLine2.substring(52, 63).trim());
    var period = meanMotion > 0 ? 1440 / meanMotion : 0; // dakika

    return { lat: lat, lng: lng, alt: alt, speed: speed, period: period };
  } catch (e) {
    return null;
  }
}

function calculateOrbitPath(tleLine1, tleLine2, minutesBefore, minutesAfter) {
  try {
    if (typeof satellite === "undefined") return null;
    var satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    var now = new Date();
    var path = [];

    // minutesBefore'den minutesAfter'a 1'er dakika adımla
    var totalMinutes = minutesBefore + minutesAfter;
    for (var m = -minutesBefore; m <= minutesAfter; m++) {
      var time = new Date(now.getTime() + m * 60000);
      var posVel = satellite.propagate(satrec, time);
      if (!posVel.position) continue;

      var gmst = satellite.gstime(time);
      var posGd = satellite.eciToGeodetic(posVel.position, gmst);
      var lat = satellite.degreesLat(posGd.latitude);
      var lng = satellite.degreesLong(posGd.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        path.push([lat, lng]);
      }
    }
    return path.length > 1 ? path : null;
  } catch (e) {
    return null;
  }
}

function propagateSatellites(map) {
  if (!map || !uyduLayerInitialized) return;
  console.log("🔄 Uydular propagasyon ediliyor...");

  var zoom = map.getZoom();
  var bounds = map.getBounds();
  var isStarlinkLimited = zoom < MIN_ZOOM_FOR_STARLINK;

  // Filtrelenmiş uydu listesi
  var visibleSatellites = [];
  var maxTotal = 250;

  for (var i = 0; i < allSatellites.length; i++) {
    var sat = allSatellites[i];

    // Grup filtresi
    if (selectedSatGroups.indexOf(sat.groupId) === -1) continue;

    // Starlink zoom limiti
    if (sat.groupId === "starlink" && isStarlinkLimited) continue;

    // Arama filtresi
    if (uyduSearchTerm && sat.name.toLowerCase().indexOf(uyduSearchTerm) === -1)
      continue;

    visibleSatellites.push(sat);

    // Maksimum sınır
    if (visibleSatellites.length >= maxTotal) break;
  }

  // Propagate and create/update markers
  var newKeys = {};
  var processedCount = {};

  for (var i = 0; i < visibleSatellites.length; i++) {
    var sat = visibleSatellites[i];
    var result = propagateSatellite(sat.tleLine1, sat.tleLine2);
    if (!result) continue;

    // Harita sınırları içinde mi kontrol et
    if (!bounds.contains([result.lat, result.lng])) continue;

    // Grup bazında max sınır
    var groupMax =
      MAX_SATELLITES_PER_GROUP[sat.groupId] || MAX_SATELLITES_PER_GROUP.default;
    if (!processedCount[sat.groupId]) processedCount[sat.groupId] = 0;
    processedCount[sat.groupId]++;
    if (processedCount[sat.groupId] > groupMax) continue;

    // Global max sınır
    var totalCount = 0;
    Object.keys(processedCount).forEach(function (g) {
      totalCount += processedCount[g];
    });
    if (totalCount > maxTotal) break;

    var key = sat.name + "|" + sat.groupId;
    newKeys[key] = true;

    // Mevcut marker'ı güncelle veya yeni oluştur
    if (satelliteMarkers[key]) {
      updateExistingMarker(map, key, sat, result);
    } else {
      createSatelliteMarker(map, key, sat, result);
    }
  }

  // Artık görünür olmayan marker'ları temizle
  Object.keys(satelliteMarkers).forEach(function (key) {
    if (!newKeys[key]) {
      removeSatelliteMarker(map, key);
    }
  });

  // Sayı bilgisini güncelle
  var sayiEl = document.getElementById("uydu-sayi-bilgisi");
  if (sayiEl) {
    var markerCount = Object.keys(satelliteMarkers).length;
    sayiEl.textContent =
      "Gösterilen: " +
      markerCount +
      " / Toplam: " +
      allSatellites.length +
      " uydu";
  }
}

function updateExistingMarker(map, key, sat, result) {
  var entry = satelliteMarkers[key];
  if (!entry) return;

  var latlng = L.latLng(result.lat, result.lng);
  entry.marker.setLatLng(latlng);
  entry.satData = sat;
  entry.propResult = result;

  // Label'ı güncelle
  if (entry.label) {
    entry.label.setLatLng(L.latLng(result.lat + 0.15, result.lng));
  }

  // Popup içeriğini güncelle
  if (entry.marker.getPopup()) {
    entry.marker.setPopupContent(buildSatellitePopupContent(sat, result));
  }

  // Orbit line'ı güncelle
  if (orbitLinesVisible) {
    var path = calculateOrbitPath(sat.tleLine1, sat.tleLine2, 15, 15);
    if (path && entry.orbitLine) {
      entry.orbitLine.setLatLngs(path);
    } else if (path && !entry.orbitLine) {
      entry.orbitLine = L.polyline(path, {
        color: sat.color,
        weight: 2,
        opacity: 0.6,
        dashArray: "8, 6",
      }).addTo(map);
    }
  }
}

function createSatelliteMarker(map, key, sat, result) {
  var latlng = L.latLng(result.lat, result.lng);

  // Uydu noktası (divIcon)
  var dotIcon = L.divIcon({
    className: "satellite-marker",
    html:
      '<div class="satellite-dot" style="background:' +
      sat.color +
      ";border-color:" +
      sat.color +
      '"></div>',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  var marker = L.marker(latlng, {
    icon: dotIcon,
    zIndexOffset: 1000,
  });

  // Tıkla → sağ slider'da detay
  marker.on("click", function () {
    showSatelliteDetail(key, sat, result);
  });

  marker.addTo(map);

  // İsim etiketi
  var labelIcon = L.divIcon({
    className: "satellite-label",
    html:
      '<span style="color:' + sat.color + ';">●</span> ' + escapeHtml(sat.name),
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  var label = L.marker(L.latLng(result.lat + 0.15, result.lng), {
    icon: labelIcon,
    interactive: false,
    keyboard: false,
  });
  label.addTo(map);

  // Yörünge çizgisi (30 dk ileri + 5 dk geri)
  var orbitLine = null;
  if (orbitLinesVisible) {
    var path = calculateOrbitPath(sat.tleLine1, sat.tleLine2, 5, 30);
    if (path) {
      orbitLine = L.polyline(path, {
        color: sat.color,
        weight: 2,
        opacity: 0.6,
        dashArray: "8, 6",
      }).addTo(map);
    }
  }

  satelliteMarkers[key] = {
    marker: marker,
    label: label,
    orbitLine: orbitLine,
    satData: sat,
    propResult: result,
    groupColor: sat.color,
  };
}

function removeSatelliteMarker(map, key) {
  var entry = satelliteMarkers[key];
  if (!entry) return;

  try {
    map.removeLayer(entry.marker);
  } catch (e) {}
  try {
    if (entry.label) map.removeLayer(entry.label);
  } catch (e) {}
  try {
    if (entry.orbitLine) map.removeLayer(entry.orbitLine);
  } catch (e) {}

  delete satelliteMarkers[key];
}

function clearSatelliteMarkers(map) {
  Object.keys(satelliteMarkers).forEach(function (key) {
    removeSatelliteMarker(map, key);
  });
  satelliteMarkers = {};
}

// ============================================================
// GÜNCELLEME (Her 5 saniyede bir)
// ============================================================

function updateSatellitePositions(map) {
  if (!map || !uyduLayerInitialized) return;

  var zoom = map.getZoom();
  var bounds = map.getBounds();
  var isStarlinkLimited = zoom < MIN_ZOOM_FOR_STARLINK;

  var newKeys = {};
  var processedCount = 0;
  var maxTotal = 250;

  for (var i = 0; i < allSatellites.length; i++) {
    var sat = allSatellites[i];

    if (selectedSatGroups.indexOf(sat.groupId) === -1) continue;
    if (sat.groupId === "starlink" && isStarlinkLimited) continue;
    if (uyduSearchTerm && sat.name.toLowerCase().indexOf(uyduSearchTerm) === -1)
      continue;

    var result = propagateSatellite(sat.tleLine1, sat.tleLine2);
    if (!result) continue;
    if (!bounds.contains([result.lat, result.lng])) continue;

    processedCount++;
    if (processedCount > maxTotal) break;

    var key = sat.name + "|" + sat.groupId;
    newKeys[key] = true;

    if (satelliteMarkers[key]) {
      updateExistingMarker(map, key, sat, result);
    } else {
      createSatelliteMarker(map, key, sat, result);
    }
  }

  Object.keys(satelliteMarkers).forEach(function (key) {
    if (!newKeys[key]) {
      removeSatelliteMarker(map, key);
    }
  });

  var sayiEl = document.getElementById("uydu-sayi-bilgisi");
  if (sayiEl) {
    var markerCount = Object.keys(satelliteMarkers).length;
    sayiEl.textContent =
      "Gösterilen: " +
      markerCount +
      " / Toplam: " +
      allSatellites.length +
      " uydu";
  }

  // Detay paneli açık olan uyduyu güncelle
  if (uyduCurrentPassSatKey && satelliteMarkers[uyduCurrentPassSatKey]) {
    var entry = satelliteMarkers[uyduCurrentPassSatKey];
    showSatelliteDetail(uyduCurrentPassSatKey, entry.satData, entry.propResult);
  }
}

// ============================================================
// POPUP İÇERİĞİ
// ============================================================

function buildSatellitePopupContent(sat, result) {
  var groupInfo = null;
  for (var i = 0; i < SAT_GROUPS.length; i++) {
    if (SAT_GROUPS[i].id === sat.groupId) {
      groupInfo = SAT_GROUPS[i];
      break;
    }
  }
  var groupName = groupInfo ? groupInfo.name : sat.groupId;
  var latDir = result.lat >= 0 ? "K" : "G";
  var lngDir = result.lng >= 0 ? "D" : "B";
  var absLat = Math.abs(result.lat).toFixed(2);
  var absLng = Math.abs(result.lng).toFixed(2);

  return (
    '<div style="font-size:0.85rem;line-height:1.6">' +
    '<b style="color:' +
    sat.color +
    '">' +
    escapeHtml(sat.name) +
    "</b><br/>" +
    '<span style="color:rgba(248,250,252,0.6);font-size:0.75rem">' +
    groupName +
    "</span><br/>" +
    "📍 " +
    absLat +
    "°" +
    latDir +
    ", " +
    absLng +
    "°" +
    lngDir +
    "<br/>" +
    "📏 " +
    result.alt.toFixed(1) +
    " km<br/>" +
    "🚀 " +
    result.speed.toFixed(2) +
    " km/s<br/>" +
    "⏱ " +
    (result.period > 0 ? result.period.toFixed(1) + " dk" : "N/A") +
    "<br/><br/>" +
    '<button class="popup-btn popup-street" onclick="window.handleUyduPassClick(\'' +
    escapeJs(sat.name) +
    "','" +
    escapeJs(sat.tleLine1) +
    "','" +
    escapeJs(sat.tleLine2) +
    "','" +
    escapeJs(sat.groupId) +
    "','" +
    sat.color +
    "')\">📡 Geçiş Tahmini</button>" +
    "</div>"
  );
}

// Global handler for pass prediction button
window.handleUyduPassClick = function (
  satName,
  tleLine1,
  tleLine2,
  groupId,
  color,
) {
  var map = window.earthWatcherMap;
  if (!map) return;

  var center = map.getCenter();
  var passes = calculatePassPredictions(
    satName,
    tleLine1,
    tleLine2,
    center.lat,
    center.lng,
  );

  var groupName = "";
  for (var i = 0; i < SAT_GROUPS.length; i++) {
    if (SAT_GROUPS[i].id === groupId) {
      groupName = SAT_GROUPS[i].name;
      break;
    }
  }

  showSatellitePassDetail(satName, groupName, color, passes);
};

// ============================================================
// GEÇİŞ TAHMİNİ (Heavens-Above stili)
// ============================================================

function calculateElevation(observerLat, observerLng, satLat, satLng, satAlt) {
  var R = 6371; // Dünya yarıçapı (km)
  var lat1 = observerLat * (Math.PI / 180);
  var lat2 = satLat * (Math.PI / 180);
  var dLon = (satLng - observerLng) * (Math.PI / 180);

  // Merkez açı (great-circle distance)
  var cosAng =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon);
  var centralAngle = Math.acos(Math.max(-1, Math.min(1, cosAng)));

  // Elevasyon açısı
  var ratio = R / (R + satAlt);
  var numerator = Math.cos(centralAngle) - ratio;
  var denominator = Math.sin(centralAngle);

  if (Math.abs(denominator) < 1e-10) {
    return centralAngle < 0.01 ? 90 : 0;
  }

  var elevationRad = Math.atan2(numerator, denominator);
  return elevationRad * (180 / Math.PI);
}

function groupPasses(passes) {
  if (!passes || passes.length === 0) return [];

  var grouped = [];
  var currentPass = [passes[0]];

  for (var i = 1; i < passes.length; i++) {
    var prev = passes[i - 1];
    var curr = passes[i];
    // 5 dakikadan fazla boşluk varsa yeni geçiş
    if (curr.time - prev.time > 5 * 60 * 1000) {
      grouped.push(currentPass);
      currentPass = [curr];
    } else {
      currentPass.push(curr);
    }
  }
  if (currentPass.length > 0) {
    grouped.push(currentPass);
  }

  return grouped;
}

function calculatePassPredictions(
  satName,
  tleLine1,
  tleLine2,
  observerLat,
  observerLng,
) {
  if (typeof satellite === "undefined") return [];

  try {
    var satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    var now = new Date();
    var rawPasses = [];

    // 24 saat = 1440 dakika, 1'er dakika adım
    for (var m = 0; m < 1440; m++) {
      var time = new Date(now.getTime() + m * 60000);
      var posVel = satellite.propagate(satrec, time);
      if (!posVel || !posVel.position) continue;

      var gmst = satellite.gstime(time);
      var posGd = satellite.eciToGeodetic(posVel.position, gmst);
      var satLat = satellite.degreesLat(posGd.latitude);
      var satLng = satellite.degreesLong(posGd.longitude);
      var satAlt = posGd.height;

      var elevation = calculateElevation(
        observerLat,
        observerLng,
        satLat,
        satLng,
        satAlt,
      );

      if (elevation > 10) {
        rawPasses.push({
          time: new Date(time),
          elevation: elevation,
          lat: satLat,
          lng: satLng,
          alt: satAlt,
        });
      }
    }

    // Geçişleri grupla
    var grouped = groupPasses(rawPasses);

    // Her geçiş için özet bilgi
    var summaries = grouped.map(function (pass) {
      var maxEl = -Infinity;
      var maxElTime = pass[0].time;
      var startTime = pass[0].time;
      var endTime = pass[pass.length - 1].time;
      var startAlt = pass[0].alt;

      pass.forEach(function (p) {
        if (p.elevation > maxEl) {
          maxEl = p.elevation;
          maxElTime = p.time;
        }
      });

      return {
        startTime: startTime,
        endTime: endTime,
        maxElevation: Math.round(maxEl * 10) / 10,
        maxElevationTime: maxElTime,
        duration: Math.round((endTime - startTime) / 60000),
        startAlt: Math.round(startAlt),
      };
    });

    // En fazla 5 geçiş döndür
    return summaries.slice(0, 5);
  } catch (e) {
    console.error("❌ Geçiş hesaplama hatası:", e);
    return [];
  }
}

// ============================================================
// DETAY PANELİ (Sağ Slider)
// ============================================================

function showSatelliteDetail(key, sat, result) {
  // Global referans
  uyduCurrentPassSatKey = key;

  var body = document.querySelector("#slider-right .slider-body");
  var title = document.querySelector("#slider-right .slider-content h3");
  if (!body || !title) return;

  title.textContent = "🛰️ Uydu Detayı";

  var groupName = "";
  for (var i = 0; i < SAT_GROUPS.length; i++) {
    if (SAT_GROUPS[i].id === sat.groupId) {
      groupName = SAT_GROUPS[i].name;
      break;
    }
  }

  var latDir = result.lat >= 0 ? "K" : "G";
  var lngDir = result.lng >= 0 ? "D" : "B";
  var absLat = Math.abs(result.lat).toFixed(2);
  var absLng = Math.abs(result.lng).toFixed(2);

  var html =
    '<div class="sat-detail">' +
    '<div class="sat-detail-name" style="color:' +
    sat.color +
    '">' +
    escapeHtml(sat.name) +
    "</div>" +
    '<div class="sat-detail-group" style="background:rgba(' +
    hexToRgb(sat.color) +
    ",0.2);color:" +
    sat.color +
    '">' +
    groupName +
    "</div>" +
    '<div class="sat-detail-info">' +
    '<div class="sat-detail-row">' +
    '<span class="sat-detail-label">Enlem</span>' +
    '<span class="sat-detail-value">' +
    absLat +
    "°" +
    latDir +
    "</span>" +
    "</div>" +
    '<div class="sat-detail-row">' +
    '<span class="sat-detail-label">Boylam</span>' +
    '<span class="sat-detail-value">' +
    absLng +
    "°" +
    lngDir +
    "</span>" +
    "</div>" +
    '<div class="sat-detail-row">' +
    '<span class="sat-detail-label">Yükseklik</span>' +
    '<span class="sat-detail-value">' +
    result.alt.toFixed(1) +
    " km</span>" +
    "</div>" +
    '<div class="sat-detail-row">' +
    '<span class="sat-detail-label">Hız</span>' +
    '<span class="sat-detail-value">' +
    result.speed.toFixed(2) +
    " km/s</span>" +
    "</div>" +
    '<div class="sat-detail-row">' +
    '<span class="sat-detail-label">Periyot</span>' +
    '<span class="sat-detail-value">' +
    (result.period > 0 ? result.period.toFixed(1) + " dk" : "N/A") +
    "</span>" +
    "</div>" +
    "</div>" +
    '<div class="sat-passes-title">📡 Geçiş Tahminleri</div>' +
    '<div class="pass-prediction" id="sat-pass-list">Geçişler hesaplanıyor...</div>' +
    "</div>";

  body.innerHTML = html;

  // Sağ slider'ı aç
  var arrow = document.querySelector(".arrow-right");
  var slider = document.getElementById("slider-right");
  if (slider && arrow && !slider.classList.contains("active")) {
    slider.classList.add("active");
    arrow.textContent = "▶";
  }

  // Geçiş tahminlerini hesapla ve göster
  var map = window.earthWatcherMap;
  if (map) {
    var center = map.getCenter();
    var passes = calculatePassPredictions(
      sat.name,
      sat.tleLine1,
      sat.tleLine2,
      center.lat,
      center.lng,
    );
    renderPassPredictions(passes);
  }
}

function showSatellitePassDetail(satName, groupName, color, passes) {
  var body = document.querySelector("#slider-right .slider-body");
  var title = document.querySelector("#slider-right .slider-content h3");
  if (!body || !title) return;

  title.textContent = "📡 Geçiş Tahmini";

  var html =
    '<div class="sat-detail">' +
    '<div class="sat-detail-name" style="color:' +
    color +
    '">' +
    escapeHtml(satName) +
    "</div>" +
    '<div class="sat-detail-group" style="background:rgba(' +
    hexToRgb(color) +
    ",0.2);color:" +
    color +
    '">' +
    escapeHtml(groupName) +
    "</div>" +
    '<div class="sat-passes-title" style="margin-top:0">Geçişler (24 saat)</div>' +
    '<div class="pass-prediction" id="sat-pass-list">Hesaplanıyor...</div>' +
    "</div>";

  body.innerHTML = html;

  // Sağ slider'ı aç
  var arrow = document.querySelector(".arrow-right");
  var slider = document.getElementById("slider-right");
  if (slider && arrow && !slider.classList.contains("active")) {
    slider.classList.add("active");
    arrow.textContent = "▶";
  }

  renderPassPredictions(passes);
}

function renderPassPredictions(passes) {
  var listEl = document.getElementById("sat-pass-list");
  if (!listEl) return;

  if (!passes || passes.length === 0) {
    listEl.innerHTML =
      '<div style="color:rgba(248,250,252,0.5);font-size:0.8rem;padding:8px">' +
      "24 saat içinde >10° geçiş bulunamadı.</div>";
    return;
  }

  var html = "";
  passes.forEach(function (pass, idx) {
    var startStr = pass.startTime.toLocaleDateString("tr-TR", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    var timeStr = pass.startTime.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    var dirStr = pass.maxElevationTime.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    html +=
      '<div class="pass-item">' +
      "<div>" +
      '<div class="pass-time">#' +
      (idx + 1) +
      " " +
      timeStr +
      "</div>" +
      '<div style="font-size:0.65rem;color:rgba(248,250,252,0.4)">' +
      startStr +
      "</div>" +
      "</div>" +
      '<div style="text-align:right">' +
      '<div class="pass-max-el">' +
      pass.maxElevation +
      "°</div>" +
      '<div style="font-size:0.65rem;color:rgba(248,250,252,0.4)">' +
      pass.duration +
      " dk</div>" +
      "</div>" +
      "</div>";
  });

  listEl.innerHTML = html;
}

// ============================================================
// OTOMATİK YENİLEME
// ============================================================

function startUyduAutoRefresh(map) {
  if (refreshTimerUydular) {
    clearInterval(refreshTimerUydular);
  }
  refreshTimerUydular = setInterval(function () {
    if (uyduLayerInitialized && map && window.earthWatcherMap) {
      // TLE'leri periyodik yenile (her 5 döngüde bir = 25 saniye)
      uyduTleRefreshCounter++;
      if (uyduTleRefreshCounter >= 5) {
        uyduTleRefreshCounter = 0;
        fetchAllSatelliteGroups(map);
      } else {
        updateSatellitePositions(map);
      }
    }
  }, refreshIntervalUydular);
}

function restartUyduAutoRefresh() {
  var map = window.earthWatcherMap;
  if (map && uyduLayerInitialized) {
    if (refreshTimerUydular) {
      clearInterval(refreshTimerUydular);
      refreshTimerUydular = null;
    }
    startUyduAutoRefresh(map);
  }
}

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? parseInt(result[1], 16) +
        "," +
        parseInt(result[2], 16) +
        "," +
        parseInt(result[3], 16)
    : "139,92,246";
}

/**
 * Earth Watcher — Layer 7: Uçuş Bilgileri Katmanı
 * OpenSky Network API üzerinden canlı uçak takibi
 *
 * API: https://opensky-network.org/api/states/all
 * Rate limit: 10 requests/minute (anonymous)
 */

// ============================================================
// GLOBAL DURUM
// ============================================================

var ucusMarkers = {}; // { icao24: { marker, label } }
var ucusRefreshTimer = null;
var ucusRefreshInterval = 15000;
var ucusInitialized = false;
var ucusFilterCountry = "";
var ucusShowMilitary = false;
var ucusClusterGroup = null; // MarkerCluster grubu

// Askeri havayolu ICAO kodları
var MILITARY_CODES = [
  "TKJ",
  "RCH",
  "GAF",
  "BAF",
  "IAM",
  "PLF",
  "HUAF",
  "FNY",
  "CTM",
  "COCA",
  "DUKE",
  "B451",
  "NAF",
  "CFC",
  "RFR",
  "RRR",
  "SQF",
  "BKH",
  "GRIMM",
  "HKY",
  "JCO",
  "MFC",
  "NATO",
  "NVY",
  "REACH",
  "SNAKE",
  "SPAR",
  "STRIX",
  "TEAM",
  "VIPR",
  "WOLF",
];

// ============================================================
// KATMAN YAŞAM DÖNGÜSÜ
// ============================================================

function initUcusLayer(map) {
  console.log("✈️ Uçuş katmanı başlatılıyor...");

  ucusInitialized = true;

  // MarkerCluster grubu oluştur
  if (typeof L.markerClusterGroup === "function") {
    ucusClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
    map.addLayer(ucusClusterGroup);
  }

  // SLD 1 (sol): ülke filtresi
  updateUcusLeftSliderContent(map);

  // SLD 4 (üst sağ): adet + yenileme
  updateUcusSliderContent(map);

  // İlk veri çekme
  fetchAircraft(map);

  // Harita kaydırılınca yeni bölge için uçakları getir
  window._ucusMoveend = function () {
    if (ucusInitialized) {
      console.log("✈️ moveend: uçaklar yenileniyor...");
      fetchAircraft(map);
    }
  };
  map.on("moveend", window._ucusMoveend);
  map.on("dragend", window._ucusMoveend);

  // Otomatik yenilemeyi başlat
  startUcusAutoRefresh(map);
}

function destroyUcusLayer(map) {
  console.log("✈️ Uçuş katmanı temizleniyor...");

  ucusInitialized = false;
  ucusFilterCountry = "";
  ucusShowMilitary = false;

  // Marker'ları temizle
  clearUcusMarkers(map);

  // Cluster grubunu kaldır
  if (ucusClusterGroup && map) {
    try {
      map.removeLayer(ucusClusterGroup);
    } catch (e) {}
    ucusClusterGroup = null;
  }

  // Event listener'ı temizle
  if (window._ucusMoveend) {
    map.off("moveend", window._ucusMoveend);
    map.off("dragend", window._ucusMoveend);
    window._ucusMoveend = null;
  }

  // Zamanlayıcıyı durdur
  if (ucusRefreshTimer) {
    clearInterval(ucusRefreshTimer);
    ucusRefreshTimer = null;
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

  // Sol slider'ı eski haline döndür (SLD 1)
  restoreUcusLeftSliderContent();

  // Üst sağ slider'ı eski haline döndür (SLD 4)
  restoreUcusSliderContent();
}

// ============================================================
// SLIDER İÇERİĞİ (Üst Sağ — SLD4)
// ============================================================

function updateUcusSliderContent(map, errorMsg) {
  try {
    var sliderBody = document.querySelector("#slider-top-right .slider-body");
    if (!sliderBody) return;

    var title = document.querySelector("#slider-top-right .slider-content h3");
    if (title) title.textContent = "✈️ Uçuş Bilgileri";

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

    var html = '<div class="ucus-kontrol">';

    // Yenileme hızı
    html +=
      '<div class="filter-section"><div class="filter-title">Yenileme</div>';
    html += '<div class="refresh-control">';
    html +=
      '<input type="range" class="refresh-slider" id="ucus-refresh-slider" min="5" max="60" value="' +
      ucusRefreshInterval / 1000 +
      '" />';
    html +=
      '<span class="refresh-label" id="ucus-refresh-label">' +
      ucusRefreshInterval / 1000 +
      " sn</span>";
    html += "</div></div>";

    // Sayı bilgisi
    var ucusSayisi = 0;
    for (var key in ucusMarkers) {
      if (ucusMarkers.hasOwnProperty(key)) {
        ucusSayisi++;
      }
    }
    html +=
      '<div class="ucus-sayi-bilgisi" id="ucus-sayi-bilgisi">Toplam: ' +
      ucusSayisi +
      " uçak gösteriliyor</div>";

    html += "</div>";
    sliderBody.innerHTML = html;

    // Refresh slider
    var refreshSlider = document.getElementById("ucus-refresh-slider");
    var refreshLabel = document.getElementById("ucus-refresh-label");
    if (refreshSlider && refreshLabel) {
      refreshSlider.addEventListener("input", function () {
        var val = parseInt(refreshSlider.value);
        refreshLabel.textContent = val + " sn";
      });
      refreshSlider.addEventListener("change", function () {
        var val = parseInt(refreshSlider.value);
        ucusRefreshInterval = val * 1000;
        restartUcusAutoRefresh(map);
      });
    }
  } catch (e) {
    console.error("❌ Uçuş slider hatası:", e);
  }
}

function restoreUcusSliderContent() {
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
// SLIDER İÇERİĞİ (Sol — SLD 1)
// ============================================================

function updateUcusLeftSliderContent(map) {
  try {
    var sliderBody = document.querySelector("#slider-left-top .slider-body");
    if (!sliderBody) return;

    var title = document.querySelector("#slider-left-top .slider-content h3");
    if (title) title.textContent = "✈️ Uçuş Filtresi";

    // Sol slider'ı aç
    if (typeof toggleSideSlider === "function") {
      toggleSideSlider("left", true);
    }

    var html = '<div class="ucus-kontrol">';

    // Havayolu filtresi
    html +=
      '<div class="filter-section"><div class="filter-title">Havayolu / Kod</div>';
    html +=
      '<input type="text" class="ucus-arama" id="ucus-arama-input" placeholder="Havayolu kodu (TK, PC, QR, EK...)" value="' +
      escapeHtml(ucusFilterCountry) +
      '" />';
    html +=
      '<div style="font-size:0.65rem;color:rgba(248,250,252,0.4);margin-top:2px">';
    html += "Havayolu kodu veya kayıt ön eki (TK, PC, TC, D...)</div>";
    html += "</div>";

    // Hızlı seç
    html +=
      '<div class="filter-section"><div class="filter-title">Hızlı Seç</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
    var quickCountries = [
      { code: "TK", name: "Turkish Airlines" },
      { code: "PC", name: "Pegasus" },
      { code: "XQ", name: "SunExpress" },
      { code: "QR", name: "Qatar Airways" },
      { code: "EK", name: "Emirates" },
      { code: "BA", name: "British Airways" },
      { code: "LH", name: "Lufthansa" },
      { code: "W6", name: "Wizz Air" },
      { code: "FR", name: "Ryanair" },
      { code: "SU", name: "Aeroflot" },
      { code: "TC", name: "Türkiye" },
    ];
    for (var i = 0; i < quickCountries.length; i++) {
      var item = quickCountries[i];
      var c = item.code;
      var activeClass =
        ucusFilterCountry === c
          ? ' style="background:rgba(20,184,166,0.3);border-color:#14b8a6"'
          : "";
      html +=
        '<span class="ucus-hizli-btn" data-ulke="' +
        c +
        '" title="' +
        item.name +
        '"' +
        activeClass +
        ">" +
        c +
        "</span>";
    }
    html += "</div></div>";

    // Askeri toggle
    html += '<div class="filter-section" style="margin-top:8px">';
    html +=
      '<label class="layer-item">' +
      '<input type="checkbox" id="ucus-military-toggle" ' +
      (ucusShowMilitary ? "checked" : "") +
      " />" +
      '<span class="layer-name" style="color:#ef4444">🎖️ Askeri Uçaklar</span>' +
      "</label>";
    html += "</div>";

    html += "</div>";
    sliderBody.innerHTML = html;

    // Arama input dinleyicisi
    var searchInput = document.getElementById("ucus-arama-input");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        ucusFilterCountry = e.target.value.trim().toUpperCase();
        if (map && ucusInitialized) {
          fetchAircraft(map);
        }
      });
    }

    // Askeri toggle
    var militaryToggle = document.getElementById("ucus-military-toggle");
    if (militaryToggle) {
      militaryToggle.addEventListener("change", function (e) {
        ucusShowMilitary = e.target.checked;
        if (map && ucusInitialized) {
          fetchAircraft(map);
        }
      });
    }

    // Hızlı seç butonları
    var hizliBtns = document.querySelectorAll(".ucus-hizli-btn");
    hizliBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ulke = btn.dataset.ulke;
        ucusFilterCountry = ucusFilterCountry === ulke ? "" : ulke;
        if (searchInput) searchInput.value = ucusFilterCountry;
        // Buton stillerini güncelle
        hizliBtns.forEach(function (b) {
          b.style.background = "";
          b.style.borderColor = "";
        });
        if (ucusFilterCountry === ulke) {
          btn.style.background = "rgba(20,184,166,0.3)";
          btn.style.borderColor = "#14b8a6";
        }
        if (map && ucusInitialized) {
          fetchAircraft(map);
        }
      });
    });
  } catch (e) {
    console.error("❌ Uçuş sol slider hatası:", e);
  }
}

function restoreUcusLeftSliderContent() {
  var sliderBody = document.querySelector("#slider-left-top .slider-body");
  if (!sliderBody) return;

  var title = document.querySelector("#slider-left-top .slider-content h3");
  if (title) title.textContent = "Katmanlar";

  sliderBody.innerHTML = "";

  // Sol slider'ı kapat
  if (typeof toggleSideSlider === "function") {
    toggleSideSlider("left", false);
  }
}

// ============================================================
// VERİ ÇEKME (ADSB.lol via CORS proxy — GitHub Pages dostu)
// ============================================================

function fetchAircraft(map) {
  if (!map) return;
  var center = map.getCenter();
  var zoom = map.getZoom();

  var sayiEl = document.getElementById("ucus-sayi-bilgisi");
  if (sayiEl) sayiEl.textContent = "📡 Uçuş verisi alınıyor...";

  // Zoom'a göre yarıçap (50-500 km)
  var radius = Math.max(
    50,
    Math.min(500, Math.round(400 / Math.pow(2, zoom - 3))),
  );

  // ADSB.lol via allorigins.win (CORS sorunu yok, GitHub Pages'de çalışır)
  var url =
    "https://api.allorigins.win/raw?url=" +
    encodeURIComponent(
      "https://api.adsb.lol/v2/point/" +
        center.lat.toFixed(2) +
        "/" +
        center.lng.toFixed(2) +
        "/" +
        radius,
    );

  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error("ADSB: " + r.status);
      return r.json();
    })
    .then(function (d) {
      if (d && d.ac && Array.isArray(d.ac) && d.ac.length > 0) {
        processAircraftData(map, d.ac.slice(0, 500));
        if (sayiEl)
          sayiEl.textContent = "✈️ " + Math.min(d.ac.length, 500) + " uçak";
      } else {
        throw new Error("Boş veri");
      }
    })
    .catch(function (err) {
      console.warn("✈️ ADSB.lol hatasi:", err.message);
      if (sayiEl) sayiEl.textContent = "⚠️ Uçuş verisi alınamadı";
    });
}

function processAircraftData(map, aircraftList) {
  if (!aircraftList || !Array.isArray(aircraftList)) {
    console.warn("✈️ Geçersiz uçuş verisi");
    return;
  }

  var mapBounds = map.getBounds();
  var count = 0;
  var seenIcao24 = {};

  for (var i = 0; i < aircraftList.length; i++) {
    var ac = aircraftList[i];

    var icao24 = ac.hex || "";
    var callsign = (ac.flight || "").trim();
    var airline = ac.airline || "";
    var registration = ac.r || "";
    var acType = ac.t || "";
    var longitude = ac.lon;
    var latitude = ac.lat;
    var baroAltitude = ac.alt_baro;
    var velocity = ac.gs; // knots
    var trueTrack = ac.track !== undefined ? ac.track : ac.true_heading;
    var verticalRate = ac.baro_rate || 0;

    // Geçerli koordinat kontrolü
    if (longitude === undefined || latitude === undefined) continue;
    if (isNaN(longitude) || isNaN(latitude)) continue;

    // Sadece harita sınırları içindekiler
    if (!mapBounds.contains([latitude, longitude])) continue;

    // Askeri filtre (toggle kapalıyken askeri uçakları gizle)
    if (!ucusShowMilitary) {
      var isMilitary = false;
      if (callsign) {
        var cs = callsign.toUpperCase();
        for (var mi = 0; mi < MILITARY_CODES.length; mi++) {
          if (cs.indexOf(MILITARY_CODES[mi]) === 0) {
            isMilitary = true;
            break;
          }
        }
      }
      if (isMilitary) continue;
    }

    // Ülke / Havayolu filtresi — callsign, airline veya registration ile
    if (ucusFilterCountry) {
      var filterUpper = ucusFilterCountry.toUpperCase();
      var matchCall = callsign.toUpperCase().indexOf(filterUpper) !== -1;
      var matchAir = airline.toUpperCase().indexOf(filterUpper) !== -1;
      var matchReg = registration.toUpperCase().indexOf(filterUpper) !== -1;
      if (!matchCall && !matchAir && !matchReg) continue;
    }

    if (!icao24) icao24 = "ac_" + i;
    seenIcao24[icao24] = true;
    count++;

    var aircraft = {
      icao24: icao24,
      callsign: callsign,
      airline: airline,
      registration: registration,
      acType: acType,
      latitude: latitude,
      longitude: longitude,
      baroAltitude: baroAltitude,
      velocity: velocity,
      trueTrack: trueTrack,
      verticalRate: verticalRate,
    };

    updateAircraftMarker(map, aircraft);
  }

  // Artık görünmeyen uçakların marker'larını temizle
  var toRemove = [];
  for (var key in ucusMarkers) {
    if (ucusMarkers.hasOwnProperty(key)) {
      if (!seenIcao24[key]) {
        toRemove.push(key);
      }
    }
  }

  for (var r = 0; r < toRemove.length; r++) {
    removeAircraftMarker(map, toRemove[r]);
  }

  // Sayı bilgisini güncelle
  var sayiInfo = document.getElementById("ucus-sayi-bilgisi");
  if (sayiInfo) {
    var activeCount = 0;
    for (var k in ucusMarkers) {
      if (ucusMarkers.hasOwnProperty(k)) {
        activeCount++;
      }
    }
    sayiInfo.textContent =
      "Toplam: " +
      activeCount +
      " uçak gösteriliyor (güncelleme: her " +
      ucusRefreshInterval / 1000 +
      " sn)";
  }

  console.log(
    "✈️ " + count + " uçak gösteriliyor (toplam kayıt: " + states.length + ")",
  );
}

// ============================================================
// MARKER YÖNETİMİ
// ============================================================

function updateAircraftMarker(map, aircraft) {
  var icao24 = aircraft.icao24;

  // Mevcut marker varsa güncelle
  if (ucusMarkers[icao24]) {
    var existing = ucusMarkers[icao24];
    var latlng = [aircraft.latitude, aircraft.longitude];

    // Konumu güncelle
    existing.marker.setLatLng(latlng);

    // İkonu yeni heading ile güncelle
    var heading = aircraft.trueTrack || 0;
    var newIcon = getPlaneIcon(heading, "#14b8a6");
    existing.marker.setIcon(newIcon);

    // Etiketi güncelle
    var labelText = getCallsignLabel(aircraft.callsign);
    existing.label.setLatLng(latlng);
    existing.label.setContent(labelText);

    return;
  }

  // Yeni marker oluştur
  var latlng = [aircraft.latitude, aircraft.longitude];
  var heading = aircraft.trueTrack || 0;

  // Uçak ikonu
  var icon = getPlaneIcon(heading, "#14b8a6");
  var marker = L.marker(latlng, {
    icon: icon,
    zIndexOffset: 1000,
  });

  marker.on("click", function () {
    showAircraftDetail(aircraft);
  });

  (ucusClusterGroup || map).addLayer(marker);

  // Callsign etiketi (standalone tooltip)
  var labelText = getCallsignLabel(aircraft.callsign);
  var label = L.tooltip({
    className: "ucus-label",
    direction: "top",
    offset: [0, -10],
    permanent: true,
    interactive: false,
  })
    .setLatLng(latlng)
    .setContent(labelText);

  label.addTo(map);

  ucusMarkers[icao24] = {
    marker: marker,
    label: label,
  };
}

function removeAircraftMarker(map, icao24) {
  if (!ucusMarkers[icao24]) return;

  var entry = ucusMarkers[icao24];
  if (entry.marker) {
    map.removeLayer(entry.marker);
  }
  if (entry.label) {
    map.removeLayer(entry.label);
  }

  delete ucusMarkers[icao24];
}

function clearUcusMarkers(map) {
  for (var key in ucusMarkers) {
    if (ucusMarkers.hasOwnProperty(key)) {
      removeAircraftMarker(map, key);
    }
  }
  ucusMarkers = {};
}

// ============================================================
// UÇAK İKONU
// ============================================================

// Havayolu IATA → İsim
var AIRLINE_NAMES = {
  TK: "Turkish Airlines",
  PC: "Pegasus",
  XQ: "SunExpress",
  YO: "Tailwind",
  KK: "AtlasGlobal",
  ZY: "Sky Airlines",
  FH: "Freebird",
  KC: "Air Astana",
  QR: "Qatar Airways",
  EK: "Emirates",
  EY: "Etihad",
  BA: "British Airways",
  VS: "Virgin Atlantic",
  LH: "Lufthansa",
  FR: "Ryanair",
  W6: "Wizz Air",
  U2: "easyJet",
  AF: "Air France",
  KL: "KLM",
  AY: "Finnair",
  SK: "SAS",
  SU: "Aeroflot",
  S7: "S7 Airlines",
  TKJ: "Türk Hava Kuvvetleri",
  RCH: "USAF",
  GAF: "Alman Hava Kuvvetleri",
  BAF: "Belçika Hava Kuvvetleri",
  IAM: "İtalyan Hava Kuvvetleri",
  PLF: "Polonya Hava Kuvvetleri",
  HUAF: "Macar Hava Kuvvetleri",
};

// Tescil ön eki → Ülke
var COUNTRY_NAMES = {
  TC: "Türkiye",
  D: "Almanya",
  G: "Birleşik Krallık",
  F: "Fransa",
  I: "İtalya",
  PH: "Hollanda",
  EC: "İspanya",
  CS: "Portekiz",
  HB: "İsviçre",
  OE: "Avusturya",
  LN: "Norveç",
  SE: "İsveç",
  OY: "Danimarka",
  OH: "Finlandiya",
  SP: "Polonya",
  OK: "Çekya",
  OM: "Slovakya",
  HA: "Macaristan",
  YR: "Romanya",
  LZ: "Bulgaristan",
  "9A": "Hırvatistan",
  SX: "Yunanistan",
  TC: "Türkiye",
  A6: "BAE",
  A7: "Katar",
  "9K": "Kuveyt",
  HZ: "Suudi Arabistan",
  "4X": "İsrail",
  JY: "Ürdün",
  OD: "Lübnan",
  SU: "Mısır",
  TS: "Tunus",
  "5T": "Moritanya",
  RA: "Rusya",
  UR: "Ukrayna",
  EU: "Belarus",
  "4L": "Gürcistan",
  EZ: "Türkmenistan",
  UP: "Kazakistan",
  N: "ABD",
  C: "Kanada",
  LV: "Arjantin",
  PP: "Brezilya",
  JA: "Japonya",
  HL: "Güney Kore",
  B: "Çin",
  HS: "Tayland",
  VT: "Hindistan",
  PK: "Endonezya",
  "9V": "Singapur",
  ZK: "Yeni Zelanda",
};

function getPlaneIcon(heading, color) {
  var h = heading || 0;
  return L.divIcon({
    className: "ucus-marker",
    html:
      '<svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(' +
      h +
      'deg)" fill="' +
      color +
      '" stroke="white" stroke-width="0.5">' +
      '<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>' +
      "</svg>",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function getCallsignLabel(callsign) {
  if (!callsign || callsign.trim() === "") return "---";
  return callsign.trim().substring(0, 6);
}

/**
 * Çağrı kodu veya tescil ön ekine göre havayolu adını bulur
 */
function getAirlineName(callsign, registration) {
  if (callsign) {
    var cs = callsign.trim().toUpperCase();
    // Önce 3 harfli kodları dene (ICAO: TKJ, RCH...)
    if (cs.length >= 3 && AIRLINE_NAMES[cs.substring(0, 3)]) {
      return AIRLINE_NAMES[cs.substring(0, 3)];
    }
    // Sonra 2 harfli kodları dene (IATA: TK, PC, QR...)
    if (cs.length >= 2 && AIRLINE_NAMES[cs.substring(0, 2)]) {
      return AIRLINE_NAMES[cs.substring(0, 2)];
    }
  }
  if (registration) {
    var reg = registration.trim().toUpperCase();
    // "TC-JSE" → "TC"
    var prefix = reg.split("-")[0];
    if (prefix && AIRLINE_NAMES[prefix]) {
      return AIRLINE_NAMES[prefix];
    }
  }
  return "";
}

/**
 * Tescil ön ekine göre ülkeyi bulur
 */
function getCountry(registration) {
  if (!registration) return "";
  var reg = registration.trim().toUpperCase();
  var prefix = reg.split("-")[0];
  if (!prefix) return "";
  if (COUNTRY_NAMES[prefix]) return COUNTRY_NAMES[prefix];
  // Tek harfli önekler (N=ABD, D=Almanya, G=İngiltere...)
  if (prefix.length > 1) {
    var firstChar = prefix.charAt(0);
    if (COUNTRY_NAMES[firstChar]) return COUNTRY_NAMES[firstChar];
  }
  return "";
}

// ============================================================
// UÇAK DETAYI (Sağ Slider — SLD5)
// ============================================================

function showAircraftDetail(aircraft) {
  var rightBody = document.querySelector("#slider-right .slider-body");
  var rightTitle = document.querySelector("#slider-right .slider-content h3");
  if (!rightBody || !rightTitle) return;

  var callsign =
    aircraft.callsign && aircraft.callsign.trim() !== ""
      ? aircraft.callsign.trim()
      : "N/A";
  var airline = getAirlineName(aircraft.callsign, aircraft.registration);
  var country = getCountry(aircraft.registration);
  var registration = aircraft.registration || "";
  var acType = aircraft.acType || "";
  var altitude =
    aircraft.baroAltitude !== undefined && aircraft.baroAltitude !== null
      ? Math.round(aircraft.baroAltitude * 0.3048).toLocaleString("tr-TR") +
        " m"
      : "---";
  var speed =
    aircraft.velocity !== undefined && aircraft.velocity !== null
      ? Math.round(aircraft.velocity) +
        " knot (" +
        Math.round(aircraft.velocity * 1.852) +
        " km/h)"
      : "---";
  var heading =
    aircraft.trueTrack !== undefined && aircraft.trueTrack !== null
      ? Math.round(aircraft.trueTrack) + "°"
      : "---";
  var vertRate =
    aircraft.verticalRate !== undefined && aircraft.verticalRate !== null
      ? Math.round(aircraft.verticalRate * 0.00508) + " m/s"
      : "---";
  var latitude = aircraft.latitude.toFixed(4);
  var longitude = aircraft.longitude.toFixed(4);
  var latDir = aircraft.latitude >= 0 ? "K" : "G";
  var lngDir = aircraft.longitude >= 0 ? "D" : "B";

  rightTitle.textContent = "✈️ Uçuş Detayı";

  var html =
    '<div class="ucus-detail">' +
    '<div class="ucus-detail-callsign">' +
    escapeHtml(callsign) +
    "</div>";
  if (registration) {
    html +=
      '<div style="font-size:0.75rem;color:rgba(248,250,252,0.6)">' +
      escapeHtml(registration);
    if (acType) html += " · " + escapeHtml(acType);
    html += "</div>";
  }
  if (airline || country) {
    html += '<div style="font-size:0.75rem;color:#14b8a6;margin-top:4px">';
    if (airline) html += escapeHtml(airline);
    if (airline && country) html += " · ";
    if (country) html += escapeHtml(country);
    html += "</div>";
  }
  html +=
    '<div class="ucus-detail-info">' +
    '<div class="ucus-detail-row"><span class="ucus-detail-label">İrtifa</span><span class="ucus-detail-value">' +
    altitude +
    "</span></div>" +
    '<div class="ucus-detail-row"><span class="ucus-detail-label">Hız</span><span class="ucus-detail-value">' +
    speed +
    "</span></div>" +
    '<div class="ucus-detail-row"><span class="ucus-detail-label">Yön</span><span class="ucus-detail-value">' +
    heading +
    "</span></div>" +
    '<div class="ucus-detail-row"><span class="ucus-detail-label">Dikey Hız</span><span class="ucus-detail-value">' +
    vertRate +
    "</span></div>" +
    '<div class="ucus-detail-row"><span class="ucus-detail-label">Konum</span><span class="ucus-detail-value">' +
    latitude +
    "°" +
    latDir +
    " " +
    longitude +
    "°" +
    lngDir +
    "</span></div>" +
    '<div class="ucus-detail-row"><span class="ucus-detail-label">ICAO</span><span class="ucus-detail-value">' +
    aircraft.icao24 +
    "</span></div>" +
    "</div></div>";

  rightBody.innerHTML = html;

  // Sağ slider'ı aç
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

function startUcusAutoRefresh(map) {
  if (ucusRefreshTimer) {
    clearInterval(ucusRefreshTimer);
    ucusRefreshTimer = null;
  }

  ucusRefreshTimer = setInterval(function () {
    if (ucusInitialized && map) {
      console.log("✈️ Uçuş verileri yenileniyor...");
      fetchAircraft(map);
    } else {
      // Katman kapanmışsa zamanlayıcıyı durdur
      if (ucusRefreshTimer) {
        clearInterval(ucusRefreshTimer);
        ucusRefreshTimer = null;
      }
    }
  }, ucusRefreshInterval);

  console.log(
    "✈️ Otomatik yenileme baslatildi: her " +
      ucusRefreshInterval / 1000 +
      " saniye",
  );
}

function restartUcusAutoRefresh(map) {
  console.log(
    "✈️ Yenileme aralığı güncellendi: " + ucusRefreshInterval / 1000 + " sn",
  );
  if (ucusRefreshTimer) {
    clearInterval(ucusRefreshTimer);
    ucusRefreshTimer = null;
  }
  startUcusAutoRefresh(map);
}

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

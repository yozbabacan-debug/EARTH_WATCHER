/**
 * Earth Watcher — Layer 2: Coğrafi Katman
 * Ülke hover bilgisi + çift tık popup (Street View / Satellite View)
 */

let countriesLayer = null;
let activeCountry = null;

function initCografiLayer(map) {
  console.log("🌍 Coğrafi katman başlatılıyor...");

  // SLD 1 ve SLD 4'ü kapat ve içeriklerini temizle
  var s4s = document.getElementById("slider-top-right");
  var s4a = document.querySelector(".arrow-top-right");
  if (s4s) {
    var s4body = s4s.querySelector(".slider-body");
    if (s4body) s4body.innerHTML = "";
    s4s.classList.remove("active");
    if (s4a) s4a.textContent = "▼";
  }
  var s1s = document.getElementById("slider-left-top");
  var s1a = document.querySelector(".arrow-left-top");
  if (s1s) {
    var s1body = s1s.querySelector(".slider-body");
    if (s1body) s1body.innerHTML = "";
    s1s.classList.remove("active");
    if (s1a) s1a.textContent = "▶";
  }
  // Üst sol slider başlığını da sıfırla
  var s2title = document.querySelector("#slider-top-left .slider-content h3");
  if (s2title) s2title.textContent = "Katmanlar";

  // Sağ tık menüsünü engelle (doğrudan DOM üzerinden)
  map.getContainer().oncontextmenu = function () {
    return false;
  };

  // Sağ tık dinleyicisi
  map.on("contextmenu", onMapRightClick);

  // Ülke verilerini yükle
  loadCountries(map);
}

function destroyCografiLayer(map) {
  console.log("🌍 Coğrafi katman temizleniyor...");

  if (countriesLayer) {
    map.removeLayer(countriesLayer);
    countriesLayer = null;
  }

  map.off("contextmenu", onMapRightClick);

  // Sağ slider'ı kapat ve içeriği temizle
  if (typeof toggleSideSlider === "function") {
    toggleSideSlider("right", false);
  }
  const sliderBody = document.querySelector("#slider-right .slider-body");
  if (sliderBody) sliderBody.innerHTML = "";
  const sliderTitle = document.querySelector(
    "#slider-right .slider-content h3",
  );
  if (sliderTitle) sliderTitle.textContent = "Detaylar";

  activeCountry = null;
}

function loadCountries(map) {
  const url = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

  fetch(url)
    .then((res) => res.json())
    .then((topology) => {
      const countries = topojson.feature(topology, topology.objects.countries);

      countriesLayer = L.geoJSON(countries, {
        style: {
          color: "#22c55e",
          weight: 1.5,
          fillColor: "rgba(34, 197, 94, 0.08)",
          fillOpacity: 0.3,
        },
        onEachFeature: function (feature, layer) {
          layer.on({
            mouseover: function (e) {
              onCountryHover(e, feature, layer);
            },
            mouseout: function () {
              onCountryOut(layer);
            },
          });
        },
      }).addTo(map);
    })
    .catch((err) => {
      console.error("❌ Ülke verileri yüklenemedi:", err);
    });
}

function onCountryHover(e, feature, layer) {
  // Sadece CTRL basılıyken çalışsın
  if (!e.originalEvent || !e.originalEvent.ctrlKey) {
    // Önceki vurguyu temizle
    if (activeCountry && activeCountry.layer) {
      activeCountry.layer.setStyle({
        weight: 1.5,
        fillOpacity: 0.3,
      });
      activeCountry = null;
    }
    return;
  }

  // Önceki ülkeyi eski haline döndür
  if (activeCountry && activeCountry.layer) {
    activeCountry.layer.setStyle({
      weight: 1.5,
      fillOpacity: 0.3,
    });
  }

  // Yeni ülkeyi vurgula
  layer.setStyle({
    weight: 3,
    fillOpacity: 0.5,
  });

  activeCountry = { feature, layer };
  const name = feature.properties.name || "Bilinmeyen Ülke";

  // Sağ slider'ı aç ve bilgileri göster
  showCountryInfo(name, feature, e.latlng);
}

function onCountryOut(layer) {
  // Hover'dan çıkınca eski haline döndür
  layer.setStyle({
    weight: 1.5,
    fillOpacity: 0.3,
  });

  activeCountry = null;
  // Slider açık kalır — kullanıcı okla kapatır
}

function showCountryInfo(name, feature, latlng) {
  const sliderBody = document.querySelector("#slider-right .slider-body");
  if (!sliderBody) return;

  const sliderTitle = document.querySelector(
    "#slider-right .slider-content h3",
  );
  if (sliderTitle) sliderTitle.textContent = "🌍 Ülke Bilgileri";

  const alpha2 = getAlpha2(feature);
  const flagUrl = getFlagUrl(feature);
  const flagHtml = flagUrl
    ? `<img src="${flagUrl}" alt="${name}" class="country-flag-img" />`
    : "";

  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`;

  // Hemen göster (yerel DB varsa)
  var cached = window.CountryDB ? window.CountryDB[alpha2] : null;
  sliderBody.innerHTML = renderCountryHTML(
    name,
    flagHtml,
    latlng,
    wikiUrl,
    cached,
  );

  // Sağ slider'ı aç
  if (typeof toggleSideSlider === "function") {
    toggleSideSlider("right", true);
  }

  // SLD 1 ve SLD 4'ü kapat (sadece SLD 5 açık kalsın)
  var sld4arrow = document.querySelector(".arrow-top-right");
  var sld4slider = document.getElementById("slider-top-right");
  if (sld4slider && sld4arrow && sld4slider.classList.contains("active")) {
    sld4slider.classList.remove("active");
    sld4arrow.textContent = "▼";
  }
  var sld1arrow = document.querySelector(".arrow-left-top");
  var sld1slider = document.getElementById("slider-left-top");
  if (sld1slider && sld1arrow && sld1slider.classList.contains("active")) {
    sld1slider.classList.remove("active");
    sld1arrow.textContent = "▶";
  }

  // API'den çek (önbellek yoksa)
  if (alpha2 && !window._countryApiFetched) {
    window._countryApiFetched = window._countryApiFetched || {};
  }
  if (alpha2 && !window._countryApiFetched[alpha2]) {
    window._countryApiFetched[alpha2] = true;
    fetch(`https://restcountries.com/v3.1/alpha/${alpha2}`)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data[0]) {
          var c = data[0];
          var entry = {
            capital: c.capital ? c.capital[0] : "—",
            population: c.population
              ? (c.population / 1000000).toFixed(1) + " milyon"
              : "—",
            language: c.languages ? Object.values(c.languages).join(", ") : "—",
            currency: c.currencies
              ? Object.values(c.currencies)
                  .map(function (x) {
                    return x.name + " (" + (x.symbol || "") + ")";
                  })
                  .join(", ")
              : "—",
          };
          if (window.CountryDB) window.CountryDB[alpha2] = entry;
          // Hâlâ aynı ülkeye bakıyorsa güncelle
          if (activeCountry && getAlpha2(activeCountry.feature) === alpha2) {
            sliderBody.innerHTML = renderCountryHTML(
              name,
              flagHtml,
              latlng,
              wikiUrl,
              entry,
            );
          }
        }
      })
      .catch(function () {});
  }
}

function renderCountryHTML(name, flagHtml, latlng, wikiUrl, data) {
  var capital = data ? data.capital : "—";
  var population = data ? data.population : "—";
  var language = data ? data.language : "—";
  var currency = data ? data.currency : "—";
  var loading = !data
    ? '<div style="font-size:0.7rem;color:rgba(248,250,252,0.4);margin-top:8px">📡 ' +
      (typeof __ === "function" ? __("ui.details") : "Bilgiler yükleniyor") +
      "...</div>"
    : "";

  var labelCapital =
    typeof __ === "function" ? __("ui.filter.capital") : "🏛️ Başkent";
  var labelPopulation =
    typeof __ === "function" ? __("ui.filter.population") : "👥 Nüfus";
  var labelLanguage =
    typeof __ === "function" ? __("ui.filter.language") : "🗣️ Dil";
  var labelCurrency =
    typeof __ === "function" ? __("ui.filter.currency") : "💶 Para Birimi";
  var wikiMore =
    typeof __ === "function"
      ? "📖 Wikipedia" + "'da daha fazla"
      : "📖 Wikipedia'da daha fazla";

  return `
    <div class="country-info">
      <div class="country-header">
        ${flagHtml}
        <span class="country-name" style="font-size:1.1rem">${name}</span>
      </div>
      <div class="country-coords" style="font-size:0.85rem">
        📍 ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°
      </div>
      <div class="country-details" style="font-size:0.9rem">
        <div class="detail-row">
          <span class="detail-label" style="font-size:0.85rem">${labelCapital}</span>
          <span class="detail-value" style="font-size:0.85rem">${capital}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label" style="font-size:0.85rem">${labelPopulation}</span>
          <span class="detail-value" style="font-size:0.85rem">${population}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label" style="font-size:0.85rem">${labelLanguage}</span>
          <span class="detail-value" style="font-size:0.85rem">${language}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label" style="font-size:0.85rem">${labelCurrency}</span>
          <span class="detail-value" style="font-size:0.85rem">${currency}</span>
        </div>
      </div>
      ${loading}
      <a href="${wikiUrl}" target="_blank" class="country-wiki" style="font-size:0.85rem;margin-top:8px">
        ${wikiMore}
      </a>
    </div>
  `;
}

function onMapRightClick(e) {
  const { lat, lng } = e.latlng;

  // Haritayı tıklanan noktada ortala (animasyonsuz)
  window.earthWatcherMap.setView(e.latlng, window.earthWatcherMap.getZoom(), {
    animate: false,
  });

  const zoom = 12;
  const tile = latLngToTile(lat, lng, zoom);

  L.popup({ maxWidth: 500, className: "cografi-popup" })
    .setLatLng(e.latlng)
    .setContent(
      `
      <div class="dblclick-popup">
        <div class="popup-coords">
          📍 ${lat.toFixed(4)}°, ${lng.toFixed(4)}°
        </div>
        <div class="popup-minimap" data-zoom="${zoom}" data-lat="${lat}" data-lng="${lng}">
          <img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y}/${tile.x}.png"
               alt="Uydu görüntüsü" class="satellite-img" id="satellite-img" />
          <div class="sat-zoom-controls">
            <button class="sat-zoom-btn" onclick="adjustSatZoom(1)">+</button>
            <span class="sat-zoom-level" id="sat-zoom-level">${zoom}</span>
            <button class="sat-zoom-btn" onclick="adjustSatZoom(-1)">−</button>
          </div>
        </div>
        <div class="satellite-list">
          <span class="sat-label">🛰️ ${getSatelliteName(zoom)}</span>
        </div>
        <div class="popup-actions">
          <a href="https://www.google.com/maps/@${lat},${lng},15z" target="_blank" class="popup-btn popup-street">🏙️ Google Haritalar'da Aç</a>
          <a href="https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},15z/data=!3m1!1e3" target="_blank" class="popup-btn popup-satellite">🛰️ Uydu Görünümü</a>
        </div>
      </div>
    `,
    )
    .openOn(window.earthWatcherMap);
}

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

function getSatelliteName(zoom) {
  if (zoom <= 6) return "MODIS (NASA) — 250m";
  if (zoom <= 8) return "Sentinel-3 (ESA) — 300m";
  if (zoom <= 10) return "Sentinel-2 (ESA) — 10m";
  if (zoom <= 12) return "Landsat 8/9 (USGS) — 15m";
  if (zoom <= 14) return "Sentinel-2 (ESA) — 10m";
  return "Maxar/ESRI — 0.3m";
}

// Uydu görüntüsünü fare ile sürükleme
function initSatDrag(img) {
  var isDragging = false;
  var startX, startY;
  var startLat, startLng;

  img.onmousedown = function (e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    var container = img.closest(".popup-minimap");
    startLat = parseFloat(container.dataset.lat);
    startLng = parseFloat(container.dataset.lng);
    img.style.cursor = "grabbing";
    e.preventDefault();
  };

  document.onmousemove = function (e) {
    if (!isDragging) return;
    e.preventDefault();
  };

  document.onmouseup = function (e) {
    if (!isDragging) return;
    isDragging = false;
    img.style.cursor = "grab";

    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    var container = img.closest(".popup-minimap");
    var zoom = parseInt(container.dataset.zoom);
    // Piksel kaymasını koordinat kaymasına çevir (yaklaşık)
    var latPerPx =
      (Math.cos((startLat * Math.PI) / 180) * 360) / Math.pow(2, zoom + 8);
    var lngPerPx = 360 / Math.pow(2, zoom + 8);

    var newLat = startLat - dy * latPerPx;
    var newLng = startLng + dx * lngPerPx;

    container.dataset.lat = newLat;
    container.dataset.lng = newLng;
    var tile = latLngToTile(newLat, newLng, zoom);
    img.src =
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" +
      zoom +
      "/" +
      tile.y +
      "/" +
      tile.x +
      ".png";
  };

  img.style.cursor = "grab";
}

function adjustSatZoom(delta) {
  const container = document.querySelector(".popup-minimap");
  const img = document.getElementById("satellite-img");
  const levelEl = document.getElementById("sat-zoom-level");
  if (!container || !img) return;

  let zoom = parseInt(container.dataset.zoom) + delta;
  zoom = Math.max(4, Math.min(18, zoom));
  container.dataset.zoom = zoom;

  const lat = parseFloat(container.dataset.lat);
  const lng = parseFloat(container.dataset.lng);
  const tile = latLngToTile(lat, lng, zoom);

  img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y}/${tile.x}.png`;
  levelEl.textContent = zoom;

  const satName = document.querySelector(".sat-label");
  if (satName) satName.textContent = `🛰️ ${getSatelliteName(zoom)}`;
}

function getFlagEmoji(countryName) {
  return "";
}

// ISO numeric -> alpha-2 dönüşüm tablosu
const NUMERIC_TO_ALPHA2 = JSON.parse(`{
  "004": "af",
  "008": "al",
  "012": "dz",
  "020": "ad",
  "024": "ao",
  "032": "ar",
  "036": "au",
  "040": "at",
  "050": "bd",
  "051": "am",
  "056": "be",
  "064": "bt",
  "068": "bo",
  "070": "ba",
  "072": "bw",
  "076": "br",
  "084": "bz",
  "090": "sb",
  "096": "bn",
  "100": "bg",
  "104": "mm",
  "108": "bi",
  "112": "by",
  "116": "kh",
  "120": "cm",
  "124": "ca",
  "140": "cf",
  "144": "lk",
  "148": "td",
  "152": "cl",
  "156": "cn",
  "158": "tw",
  "170": "co",
  "180": "cd",
  "188": "cr",
  "191": "hr",
  "192": "cu",
  "196": "cy",
  "203": "cz",
  "204": "bj",
  "208": "dk",
  "214": "do",
  "218": "ec",
  "222": "sv",
  "226": "gq",
  "231": "et",
  "232": "er",
  "233": "ee",
  "238": "fk",
  "242": "fj",
  "246": "fi",
  "250": "fr",
  "260": "tf",
  "262": "dj",
  "266": "ga",
  "268": "ge",
  "270": "gm",
  "275": "ps",
  "276": "de",
  "288": "gh",
  "300": "gr",
  "304": "gl",
  "320": "gt",
  "324": "gn",
  "328": "gy",
  "332": "ht",
  "340": "hn",
  "348": "hu",
  "352": "is",
  "356": "in",
  "360": "id",
  "364": "ir",
  "368": "iq",
  "372": "ie",
  "376": "il",
  "380": "it",
  "384": "ci",
  "388": "jm",
  "392": "jp",
  "398": "kz",
  "400": "jo",
  "404": "ke",
  "408": "kp",
  "410": "kr",
  "414": "kw",
  "417": "kg",
  "418": "la",
  "422": "lb",
  "426": "ls",
  "428": "lv",
  "430": "lr",
  "434": "ly",
  "440": "lt",
  "442": "lu",
  "450": "mg",
  "454": "mw",
  "458": "my",
  "466": "ml",
  "478": "mr",
  "484": "mx",
  "496": "mn",
  "498": "md",
  "499": "me",
  "504": "ma",
  "508": "mz",
  "512": "om",
  "516": "na",
  "524": "np",
  "528": "nl",
  "540": "nc",
  "548": "vu",
  "554": "nz",
  "558": "ni",
  "562": "ne",
  "566": "ng",
  "578": "no",
  "586": "pk",
  "591": "pa",
  "598": "pg",
  "600": "py",
  "604": "pe",
  "608": "ph",
  "616": "pl",
  "620": "pt",
  "624": "gw",
  "626": "tl",
  "630": "pr",
  "634": "qa",
  "642": "ro",
  "643": "ru",
  "646": "rw",
  "682": "sa",
  "686": "sn",
  "688": "rs",
  "694": "sl",
  "703": "sk",
  "704": "vn",
  "705": "si",
  "706": "so",
  "710": "za",
  "716": "zw",
  "724": "es",
  "728": "ss",
  "729": "sd",
  "732": "eh",
  "740": "sr",
  "748": "sz",
  "752": "se",
  "756": "ch",
  "760": "sy",
  "762": "tj",
  "764": "th",
  "768": "tg",
  "780": "tt",
  "784": "ae",
  "788": "tn",
  "792": "tr",
  "795": "tm",
  "800": "ug",
  "804": "ua",
  "807": "mk",
  "818": "eg",
  "826": "gb",
  "834": "tz",
  "840": "us",
  "854": "bf",
  "858": "uy",
  "860": "uz",
  "862": "ve",
  "887": "ye",
  "894": "zm",
  "916": "xk"
}`);

function getAlpha2(feature) {
  return NUMERIC_TO_ALPHA2[feature.id] || null;
}

function getFlagUrl(feature) {
  const alpha2 = getAlpha2(feature);
  if (alpha2) {
    return `https://flagcdn.com/24x18/${alpha2}.png`;
  }
  return null;
}

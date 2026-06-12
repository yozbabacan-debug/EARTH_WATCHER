/**
 * Earth Watcher — Layer 3: Doğal Olaylar
 * Gerçek zamanlı doğal afet verileri (USGS + NASA EONET + Open-Meteo)
 * Ayrıca hava durumu overlay katmanı
 */

let naturalMarkers = [];
let weatherLayers = [];
let refreshTimer = null;
let refreshInterval = 5; // dakika
let selectedDisasterTypes = ["earthquake", "flood", "volcano", "storm"];

// Afet tipleri
const DISASTER_TYPES = [
  { id: "earthquake", name: "Deprem", icon: "🔴", color: "#ef4444" },
  { id: "flood", name: "Su Baskını", icon: "🔵", color: "#3b82f6" },
  { id: "volcano", name: "Yanardağ", icon: "🟠", color: "#f97316" },
  { id: "storm", name: "Fırtına", icon: "🟣", color: "#a855f7" },
  { id: "extreme_rain", name: "Aşırı Yağış", icon: "🔷", color: "#06b6d4" },
  { id: "drought", name: "Kuraklık", icon: "🟫", color: "#92400e" },
];

function initDogalOlaylarLayer(map) {
  console.log("🌊 Doğal olaylar katmanı başlatılıyor...");

  // Önceki katmanın ticker olaylarını temizle
  clearTickerEvents();

  // Slider içeriğini güncelle
  updateSliderContent();

  // Ticker'ı göster
  showTicker();

  // İlk veri çekme
  fetchAllEvents(map);

  // Periyodik yenileme
  startAutoRefresh(map);
}

function destroyDogalOlaylarLayer(map) {
  console.log("🌊 Doğal olaylar katmanı temizleniyor...");

  // Marker'ları temizle
  clearMarkers(map);

  // Zamanlayıcıyı durdur
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // Hava durumu overlay'ini gizle
  hideWeatherOverlay(map);

  // Ticker'ı gizle (başka katman açıksa gizleme)
  updateTickerVisibility();

  // Slider içeriğini eski haline döndür
  restoreSliderContent();
}

// ============================================================
// SLIDER İÇERİĞİ
// ============================================================

function updateSliderContent() {
  try {
    const sliderBody = document.querySelector("#slider-top-right .slider-body");
    if (!sliderBody) return;

    const title = document.querySelector(
      "#slider-top-right .slider-content h3",
    );
    if (title) title.textContent = "🌊 Doğal Olaylar";

    // Üst sağ slider'ı aç
    const arrow = document.querySelector(".arrow-top-right");
    const slider = document.getElementById("slider-top-right");
    if (slider && arrow && !slider.classList.contains("active")) {
      slider.classList.add("active");
      arrow.textContent = "▲";
    }

    // Tüm afet tiplerini içeren HTML
    let html = '<div class="disaster-filters">';
    html +=
      '<div class="filter-section"><div class="filter-title">Afet Türü</div>';

    DISASTER_TYPES.forEach((type) => {
      const checked = selectedDisasterTypes.includes(type.id) ? "checked" : "";
      html +=
        `<label class="layer-item disaster-filter" data-type="${type.id}">` +
        `<input type="checkbox" class="disaster-checkbox" data-type="${type.id}" ${checked} />` +
        `<span class="disaster-icon">${type.icon}</span>` +
        `<span class="layer-name">${type.name}</span>` +
        `</label>`;
    });

    html += "</div>";
    html +=
      '<div class="filter-section"><div class="filter-title">Yenileme</div>';
    html += '<div class="refresh-control">';
    html += `<input type="range" class="refresh-slider" id="refresh-slider" min="1" max="30" value="${refreshInterval}">`;
    html += `<span class="refresh-label" id="refresh-label">${refreshInterval} dk</span>`;
    html += "</div></div></div>";

    sliderBody.innerHTML = html;
    console.log("✅ SLD4 içeriği güncellendi");
  } catch (e) {
    console.error("❌ SLD4 hatası:", e);
  }

  // Checkbox dinleyicileri
  document.querySelectorAll(".disaster-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const typeId = e.target.dataset.type;
      if (e.target.checked) {
        if (!selectedDisasterTypes.includes(typeId)) {
          selectedDisasterTypes.push(typeId);
        }
      } else {
        selectedDisasterTypes = selectedDisasterTypes.filter(
          (t) => t !== typeId,
        );
      }
      // Haritayı yeniden yükle
      const map = window.earthWatcherMap;
      if (map) {
        clearMarkers(map);
        fetchAllEvents(map);
      }
    });
  });

  // Refresh slider dinleyicisi
  const slider = document.getElementById("refresh-slider");
  const label = document.getElementById("refresh-label");
  if (slider && label) {
    slider.addEventListener("input", () => {
      refreshInterval = parseInt(slider.value);
      label.textContent = `${refreshInterval} dk`;
    });
    slider.addEventListener("change", () => {
      const map = window.earthWatcherMap;
      if (map) restartAutoRefresh(map);
    });
  }
}

function restoreSliderContent() {
  const sliderBody = document.querySelector("#slider-top-right .slider-body");
  if (!sliderBody) return;

  const title = document.querySelector("#slider-top-right .slider-content h3");
  if (title) title.textContent = "Ayarlar";

  sliderBody.innerHTML = "";

  // Üst sağ slider'ı kapat
  const arrow = document.querySelector(".arrow-top-right");
  const slider = document.getElementById("slider-top-right");
  if (slider && arrow && slider.classList.contains("active")) {
    slider.classList.remove("active");
    arrow.textContent = "▼";
  }
}

// ============================================================
// VERİ ÇEKME
// ============================================================

async function fetchAllEvents(map) {
  console.log("📡 Doğal olaylar verisi çekiliyor...");

  // USGS Deprem verisi
  if (selectedDisasterTypes.includes("earthquake")) {
    fetchEarthquakes(map);
  }

  // NASA EONET diğer afetler
  fetchEONETEvents(map);

  // Hava durumunu güncelle
  updateWeather();
}

function fetchEarthquakes(map) {
  const url =
    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&orderby=time&limit=50";

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      data.features.forEach((eq) => {
        const coords = eq.geometry.coordinates;
        const mag = eq.properties.mag;
        const place = eq.properties.place || "Bilinmeyen";
        const time = new Date(eq.properties.time).toLocaleString("tr-TR");

        const size = Math.max(8, Math.min(30, mag * 5));
        const marker = L.circleMarker([coords[1], coords[0]], {
          radius: size,
          color: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: 0.6,
          weight: 2,
          opacity: 0.8,
        });

        marker.bindTooltip(`🔴 <b>${mag} Mw</b><br/>${place}<br/>${time}`, {
          direction: "top",
        });

        marker.on("click", () => {
          marker.openTooltip();
        });

        const timeStr = new Date(eq.properties.time).toLocaleTimeString(
          "tr-TR",
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        );
        const country = place.split(",").pop()?.trim() || place;
        addMarkerWithTimeout(
          map,
          marker,
          `🔴 ${country}: Deprem ${mag} Mw: ${timeStr}`,
        );
      });
    })
    .catch((err) => console.error("❌ Deprem verisi alınamadı:", err));
}

function fetchEONETEvents(map) {
  const url = "https://eonet.gsfc.nasa.gov/api/v3/events?limit=50";

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (!data.events) return;

      data.events.forEach((event) => {
        const category = event.categories?.[0]?.id || "";
        const mappedType = mapEONETCategory(category);

        if (!selectedDisasterTypes.includes(mappedType)) return;
        if (!event.geometry?.length) return;

        const geom = event.geometry[0];
        const coords = geom.coordinates;
        const lat = coords[1];
        const lng = coords[0];

        const typeInfo = DISASTER_TYPES.find((t) => t.id === mappedType);
        const color = typeInfo?.color || "#888";
        const icon = typeInfo?.icon || "🌍";
        const time = event.geometry[0]?.date
          ? new Date(event.geometry[0].date).toLocaleString("tr-TR")
          : "";

        const marker = L.circleMarker([lat, lng], {
          radius: 10,
          color: color,
          fillColor: color,
          fillOpacity: 0.5,
          weight: 2,
          opacity: 0.8,
        });

        marker.bindTooltip(`${icon} <b>${event.title}</b><br/>${time}`, {
          direction: "top",
        });

        marker.on("click", () => marker.openTooltip());

        const timeStr = time
          ? new Date(time).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const shortName = event.title.substring(0, 25);
        addMarkerWithTimeout(map, marker, `${icon} ${shortName}: ${timeStr}`);
      });
    })
    .catch((err) => console.error("❌ EONET verisi alınamadı:", err));
}

function addMarkerWithTimeout(map, marker, tickerText, labelText, color) {
  marker.addTo(map);
  naturalMarkers.push(marker);

  if (tickerText) addEventToTicker(tickerText);

  let label = null;
  if (labelText && color) {
    label = addEventLabel(map, marker, labelText, color);
  }

  // 20 saniye sonra otomatik temizle
  setTimeout(() => {
    try {
      map.removeLayer(marker);
    } catch (e) {}
    if (label) {
      try {
        map.removeLayer(label);
      } catch (e) {}
    }
    naturalMarkers = naturalMarkers.filter((m) => m !== marker && m !== label);
  }, 20000);
}

function mapEONETCategory(catId) {
  const map = {
    earthquakes: "earthquake",
    floods: "flood",
    volcanoes: "volcano",
    severeStorms: "storm",
    severeStorms: "storm",
    wildfires: "wildfire",
    drought: "drought",
    "extreme-temperature": "extreme_rain",
  };
  return map[catId] || "storm";
}

// ============================================================
// YENİLEME
// ============================================================

function startAutoRefresh(map) {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(
    () => {
      clearMarkers(map);
      fetchAllEvents(map);
      updateWeather();
    },
    refreshInterval * 60 * 1000,
  );
}

function restartAutoRefresh(map) {
  startAutoRefresh(map);
}

function clearMarkers(map) {
  naturalMarkers.forEach((m) => map.removeLayer(m));
  naturalMarkers = [];
}

// ============================================================
// HAVA DURUMU OVERLAY
// ============================================================

function showWeatherOverlay(map) {
  // RainViewer radar overlay (ücretsiz, API anahtarı gerekmez)
  fetch("https://api.rainviewer.com/public/weather-maps.json")
    .then((res) => res.json())
    .then((data) => {
      const past = data.radar.past;
      if (past.length > 0) {
        const latest = past[past.length - 1];
        const radarLayer = L.tileLayer(
          `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
          {
            opacity: 0.4,
            zIndex: 500,
            attribution:
              '&copy; <a href="https://rainviewer.com">RainViewer</a>',
          },
        );
        radarLayer.addTo(map);
        weatherLayers.push(radarLayer);
        console.log(
          "🌧️ RainViewer radar yüklendi:",
          new Date(latest.time * 1000).toLocaleString("tr-TR"),
        );
      }
    })
    .catch((err) => console.error("❌ Radar verisi alınamadı:", err));

  // Şehir hava durumu marker'ları
  const cities = [
    { name: "İstanbul", lat: 41.01, lng: 28.95, country: "Türkiye" },
    { name: "Ankara", lat: 39.93, lng: 32.86, country: "Türkiye" },
    { name: "Londra", lat: 51.51, lng: -0.13, country: "İngiltere" },
    { name: "Paris", lat: 48.86, lng: 2.35, country: "Fransa" },
    { name: "Berlin", lat: 52.52, lng: 13.41, country: "Almanya" },
    { name: "New York", lat: 40.71, lng: -74.01, country: "ABD" },
    { name: "Tokyo", lat: 35.68, lng: 139.69, country: "Japonya" },
    { name: "Moskova", lat: 55.76, lng: 37.62, country: "Rusya" },
    { name: "Pekin", lat: 39.9, lng: 116.4, country: "Çin" },
    { name: "Dubai", lat: 25.2, lng: 55.27, country: "BAE" },
    { name: "Sydney", lat: -33.87, lng: 151.21, country: "Avustralya" },
    { name: "Kahire", lat: 30.04, lng: 31.24, country: "Mısır" },
    { name: "Roma", lat: 41.9, lng: 12.5, country: "İtalya" },
    { name: "Madrid", lat: 40.42, lng: -3.7, country: "İspanya" },
    { name: "Toronto", lat: 43.65, lng: -79.38, country: "Kanada" },
    { name: "Mumbai", lat: 19.08, lng: 72.88, country: "Hindistan" },
    { name: "Seul", lat: 37.57, lng: 126.98, country: "Güney Kore" },
    { name: "Singapur", lat: 1.35, lng: 103.82, country: "Singapur" },
  ];

  cities.forEach((city) => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const temp = Math.round(data.current?.temperature_2m ?? 0);
        const code = data.current?.weather_code ?? 0;
        const wind = data.current?.wind_speed_10m ?? 0;
        const humid = data.current?.relative_humidity_2m ?? 0;
        const emoji = weatherCodeToEmoji(code);

        const marker = L.marker([city.lat, city.lng], {
          icon: L.divIcon({
            className: "weather-icon",
            html: `<div class="weather-badge">${emoji} ${temp}°</div>`,
            iconSize: [50, 22],
            iconAnchor: [25, 11],
          }),
        });

        marker.bindTooltip(
          `<b>${city.name}, ${city.country}</b><br/>` +
            `${emoji} ${temp}°C &nbsp; 💨 ${wind} km/h &nbsp; 💧 ${humid}%`,
          { direction: "top" },
        );

        marker.addTo(map);
        weatherLayers.push(marker);
      })
      .catch(() => {});
  });
}

function hideWeatherOverlay(map) {
  weatherLayers.forEach((m) => {
    if (m.remove) {
      map.removeLayer(m);
    }
  });
  weatherLayers = [];
}

function updateWeather() {
  // Hava durumu zaten canlı — periyodik yenilemede tekrar çekilir
}

function weatherCodeToEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌧️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

// ============================================================
// TICKER ÇUBUĞU (Alt Bilgi Şeridi)
// ============================================================

let tickerInterval = null;
let tickerEvents = [];
let tickerAnimFrame = null;
let tickerPos = 0;

function showTicker() {
  const ticker = document.getElementById("event-ticker");
  if (ticker) {
    ticker.style.display = "flex";
    console.log("📋 Ticker gösteriliyor");
    // Animasyonu başlat
    tickerPos = 0;
    if (tickerAnimFrame) cancelAnimationFrame(tickerAnimFrame);
    animateTicker();
  }
}

function hideTicker() {
  const ticker = document.getElementById("event-ticker");
  if (ticker) ticker.style.display = "none";
  if (tickerAnimFrame) {
    cancelAnimationFrame(tickerAnimFrame);
    tickerAnimFrame = null;
  }
  tickerEvents = [];
}

// Ticker görünürlüğünü aktif katmanlara göre yönet (merkezi)
function updateTickerVisibility() {
  const activeLayers = window.earthWatcher?.activeLayers || {};
  const tickerLayers = ["dogal-olaylar", "doga-disi-olaylar", "siyasi-olaylar"];
  const anyActive = tickerLayers.some((l) => activeLayers[l]);
  if (!anyActive) {
    hideTicker();
  }
}

// Ticker olaylarını temizle (katman değişiminde çağrılır)
function clearTickerEvents() {
  tickerEvents = [];
  updateTickerContent();
}

function addEventToTicker(text) {
  tickerEvents.push(text);
  updateTickerContent();
}

function updateTickerContent() {
  const track = document.getElementById("ticker-track");
  if (!track) return;

  const allText = tickerEvents
    .map((e) => `⏺ ${e}`)
    .join(" &nbsp;&nbsp;&nbsp; ");
  track.innerHTML = allText || "🌍 Bekleniyor...";
  tickerPos = 0;
}

function animateTicker() {
  const track = document.getElementById("ticker-track");
  const container = document.getElementById("event-ticker");
  if (!track || !container) return;

  const containerW = container.offsetWidth;
  const trackW = track.scrollWidth;

  if (trackW > containerW) {
    tickerPos -= 1; // piksel/frame hızı
    if (tickerPos < -trackW) {
      tickerPos = containerW;
    }
    track.style.transform = `translateX(${tickerPos}px)`;
  }

  tickerAnimFrame = requestAnimationFrame(animateTicker);
}

// ============================================================
// OLAY BİLGİ KUTUSU (Marker yanında küçük etiket)
// ============================================================

function addEventLabel(map, marker, text, color) {
  const latlng = marker.getLatLng();
  const label = L.marker(latlng, {
    icon: L.divIcon({
      className: "event-label-icon",
      html: `<div class="event-label" style="border-left: 3px solid ${color}">${text}</div>`,
      iconSize: [120, 20],
      iconAnchor: [60, -12],
    }),
    interactive: false,
  });
  label.addTo(map);
  naturalMarkers.push(label);
  return label;
}

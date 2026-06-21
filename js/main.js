/* ==========================================================================
   Earth Watcher v4 — Geopolitical Situation Room
   Core Intelligence Engine
   ========================================================================== */

/**
 * ███████╗ █████╗ ██████╗ ████████╗██╗  ██╗
 * ██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██║  ██║
 * █████╗  ███████║██████╔╝   ██║   ███████║
 * ██╔══╝  ██╔══██║██╔══██╗   ██║   ██╔══██║
 * ███████╗██║  ██║██║  ██║   ██║   ██║  ██║
 * ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
 *
 *   WATCHER v4 — SITUATION ROOM
 */

(function () {
  "use strict";

  // =========================================================================
  // CONSTANTS — Design Tokens
  // =========================================================================
  const TOKENS = {
    color: {
      physical: "#00e5ff", // Cyan — Natural / Environmental
      socioCritical: "#ff1744", // Red — War / High conflict
      socioHigh: "#ff9100", // Orange — Attack / Severe
      socioMedium: "#ffea00", // Yellow — Protest / Diplomacy
      border: "#ffffff",
    },
    riskThresholds: {
      high: 75,
      medium: 40,
    },
    defaultCenter: [20.0, 0.0],
    defaultZoom: 3,
  };

  // =========================================================================
  // STATE — Application State
  // =========================================================================
  const state = {
    map: null,
    physicalRiskLayer: null,
    socioPoliticalLayer: null,
    allMarkers: [], // [{ marker, article }]
    allArticles: [], // Raw articles from data source
    visibleCount: 0,
    riskThreshold: 0, // Current slider value
    tickerQueue: [],
    tickerAnimationId: null,
  };

  // =========================================================================
  // 1. MAP INITIALIZATION — Canvas Mode + Dark Matter
  // =========================================================================
  function initMap() {
    const map = L.map("map", {
      center: TOKENS.defaultCenter,
      zoom: TOKENS.defaultZoom,
      minZoom: 2,
      preferCanvas: true, // Canvas renderer — smooth with thousands of points
      zoomControl: false, // We add our own styled control below
      attributionControl: true,
    });

    // Styled zoom control — bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Dark Matter tile layer — clean, military-grade base
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      },
    ).addTo(map);

    return map;
  }

  // =========================================================================
  // 2. LAYER GROUPS — Two Macro Layers
  // =========================================================================
  function initLayers(map) {
    const physicalRiskLayer = L.layerGroup().addTo(map);
    const socioPoliticalLayer = L.layerGroup().addTo(map);

    // Professional layer control — topright, always expanded
    const overlayMaps = {};
    overlayMaps[
      '<span style="color: ' +
        TOKENS.color.physical +
        '; font-weight: 600; letter-spacing: 0.5px;">🌱 ÇEVRESEL & DOĞAL</span>'
    ] = physicalRiskLayer;
    overlayMaps[
      '<span style="color: ' +
        TOKENS.color.socioCritical +
        '; font-weight: 600; letter-spacing: 0.5px;">⚡ SOSYO-POLİTİK</span>'
    ] = socioPoliticalLayer;

    L.control
      .layers(null, overlayMaps, {
        collapsed: false,
        position: "topright",
      })
      .addTo(map);

    return { physicalRiskLayer, socioPoliticalLayer };
  }

  // =========================================================================
  // 3. RISK FILTER BAR — Bottom Center Command Bar
  // =========================================================================
  function initRiskFilterBar(map) {
    const container = document.createElement("div");
    container.className = "risk-filter-bar";
    container.innerHTML = `
      <span class="risk-icon">⚠️</span>
      <label>RİSK EŞİĞİ</label>
      <input type="range" id="risk-slider" min="0" max="100" value="0" />
      <span class="risk-value" id="risk-value">0</span>
      <span class="event-count" id="event-count">0 olay</span>
    `;

    // Insert after map container
    document.getElementById("map").appendChild(container);

    // Slider event listener
    const slider = container.querySelector("#risk-slider");
    const valueDisplay = container.querySelector("#risk-value");
    const countDisplay = container.querySelector("#event-count");

    slider.addEventListener("input", function () {
      const threshold = parseInt(this.value, 10);
      state.riskThreshold = threshold;
      valueDisplay.textContent = threshold;
      applyRiskFilter(threshold);
      countDisplay.textContent = state.visibleCount + " olay";
    });
  }

  // Filter markers based on risk threshold
  function applyRiskFilter(threshold) {
    let visible = 0;
    state.allMarkers.forEach(({ marker, article }) => {
      const score = article.liveRiskScore || article.risk_score || 0;
      if (score >= threshold) {
        marker.setOpacity(article.opacity || 1);
        visible++;
      } else {
        marker.setOpacity(0);
      }
    });
    state.visibleCount = visible;
    const countDisplay = document.getElementById("event-count");
    if (countDisplay) countDisplay.textContent = visible + " olay";
  }

  // =========================================================================
  // 4. TICKER BAR — Bottom Scrolling Intelligence Feed
  // =========================================================================
  function initTicker() {
    const existing = document.getElementById("event-ticker");
    if (existing) existing.remove();

    const ticker = document.createElement("div");
    ticker.id = "event-ticker";
    ticker.className = "event-ticker";
    ticker.innerHTML = '<div class="ticker-track" id="ticker-track"></div>';
    document.body.appendChild(ticker);
  }

  function updateTicker(articles) {
    const track = document.getElementById("ticker-track");
    if (!track) return;

    // Sort by risk score descending, take top 20
    const topArticles = articles
      .filter((a) => (a.liveRiskScore || a.risk_score || 0) > 20)
      .sort((a, b) => (b.liveRiskScore || 0) - (a.liveRiskScore || 0))
      .slice(0, 20);

    if (topArticles.length === 0) {
      track.innerHTML =
        '<span class="ticker-item">🌍 İstihbarat akışı bekleniyor...</span>';
      return;
    }

    // Build ticker HTML — duplicate for seamless scroll
    const buildItems = () =>
      topArticles
        .map(
          (a) =>
            `<span class="ticker-item">
          <span class="ticker-source">${a.source || "INTEL"}</span>
          <span class="ticker-separator">│</span>
          ${a.title || ""}
          <span class="ticker-separator">│</span>
          Risk:${a.liveRiskScore || a.risk_score || "?"}
        </span>`,
        )
        .join("");

    track.innerHTML = buildItems() + buildItems();
  }

  // =========================================================================
  // 5. DATA VISUALIZATION — Circle Markers
  // =========================================================================

  /**
   * Determine marker color based on macroLayer and risk score
   * Physical → Cyan (always)
   * Socio-Political → Red (critical), Orange (high), Yellow (medium/low)
   */
  function getMarkerColor(article) {
    const isPhysical =
      article.macroLayer === "physical" ||
      article.type === "physical" ||
      article.category === "natural_disaster";

    if (isPhysical) return TOKENS.color.physical;

    // Socio-Political — risk-based gradient
    const score = article.liveRiskScore || article.risk_score || 0;
    if (score > TOKENS.riskThresholds.high) return TOKENS.color.socioCritical;
    if (score > TOKENS.riskThresholds.medium) return TOKENS.color.socioHigh;
    return TOKENS.color.socioMedium;
  }

  /**
   * Dynamic radius — bigger risk = bigger circle
   */
  function getMarkerRadius(article) {
    const score = article.liveRiskScore || article.risk_score || 0;
    return Math.max(4, score * 0.22);
  }

  /**
   * Create an intelligence popup for a marker
   */
  function createPopupContent(article) {
    const isPhysical =
      article.macroLayer === "physical" ||
      article.type === "physical" ||
      article.category === "natural_disaster";
    const macroLabel = isPhysical ? "ÇEVRESEL" : "SOSYO-POLİTİK";
    const macroClass = isPhysical ? "physical" : "socio-political";
    const category = (article.category || article.type || "unrest")
      .replace(/_/g, " ")
      .toUpperCase();

    // Risk bar color
    const score = article.liveRiskScore || article.risk_score || 0;
    let riskColor;
    if (isPhysical) riskColor = TOKENS.color.physical;
    else if (score > 75) riskColor = TOKENS.color.socioCritical;
    else if (score > 40) riskColor = TOKENS.color.socioHigh;
    else riskColor = TOKENS.color.socioMedium;

    return `
      <div class="intel-popup">
        <div>
          <span class="source-badge">${article.source || "INTEL"}</span>
          <span class="category-badge ${macroClass}">${macroLabel} · ${category}</span>
        </div>
        <div class="event-title">${article.title || "İsimsiz Olay"}</div>
        ${
          article.description
            ? `<div class="event-desc">${article.description.substring(0, 200)}</div>`
            : ""
        }
        <div class="risk-bar-container">
          <div class="risk-label">RİSK ENDEKSİ</div>
          <div class="risk-bar-track">
            <div class="risk-bar-fill" style="width: ${score}%; background: ${riskColor};"></div>
          </div>
          <div class="risk-score-text" style="color: ${riskColor};">${score} / 100</div>
        </div>
      </div>
    `;
  }

  /**
   * Place a single article on the map as a styled circle marker
   */
  function placeArticle(article, map, physicalLayer, socioLayer) {
    const coords = extractCoordinates(article);
    if (!coords) return null;

    const color = getMarkerColor(article);
    const radius = getMarkerRadius(article);
    const opacity = article.opacity || 1;

    const marker = L.circleMarker(coords, {
      radius: radius,
      fillColor: color,
      color: TOKENS.color.border,
      weight: 0.8,
      opacity: opacity,
      fillOpacity: opacity * 0.75,
    });

    marker.bindPopup(createPopupContent(article), {
      maxWidth: 320,
      className: "intel-popup-container",
    });

    // Add to appropriate layer
    const isPhysical =
      article.macroLayer === "physical" ||
      article.type === "physical" ||
      article.category === "natural_disaster";

    if (isPhysical) {
      marker.addTo(physicalLayer);
    } else {
      marker.addTo(socioLayer);
    }

    return { marker, article };
  }

  /**
   * Extract [lat, lng] from article in various possible formats
   */
  function extractCoordinates(article) {
    // Format 1: article.coordinates (array)
    if (Array.isArray(article.coordinates) && article.coordinates.length >= 2) {
      const [lat, lng] = article.coordinates;
      if (typeof lat === "number" && typeof lng === "number") {
        return [lat, lng];
      }
    }
    // Format 2: article.lat / article.lng
    if (typeof article.lat === "number" && typeof article.lng === "number") {
      return [article.lat, article.lng];
    }
    // Format 3: article.latitude / article.longitude
    if (
      typeof article.latitude === "number" &&
      typeof article.longitude === "number"
    ) {
      return [article.latitude, article.longitude];
    }
    return null;
  }

  // =========================================================================
  // 6. DATA LOADING — Fetch + Render Pipeline
  // =========================================================================

  /**
   * Load intelligence data from news.json (generated by tools/fetch-news.js)
   * Also attempts GDELT API for live data
   */
  async function loadData(map, physicalLayer, socioLayer) {
    console.log("🛰️  Earth Watcher v4 — Veri akışı başlatılıyor...");

    // 1. Load local news.json (RSS processed data)
    let allArticles = [];
    try {
      const resp = await fetch("data/news.json");
      const json = await resp.json();
      allArticles = json.articles || json || [];
      console.log(`📡 news.json: ${allArticles.length} olay yüklendi`);
    } catch (err) {
      console.warn("⚠️  news.json yüklenemedi:", err.message);
    }

    // 2. Attempt GDELT fetch for live socio-political data
    try {
      const gdeltArticles = await fetchGDELT("turkey ukraine gaza syria");
      allArticles = allArticles.concat(gdeltArticles);
      console.log(`📡 GDELT: ${gdeltArticles.length} canlı olay eklendi`);
    } catch (err) {
      console.warn("⚠️  GDELT verisi alınamadı:", err.message);
    }

    // 3. Attempt ACLED fetch for conflict data
    try {
      const acledArticles = await fetchACLED("Turkey");
      allArticles = allArticles.concat(acledArticles);
      console.log(`📡 ACLED: ${acledArticles.length} çatışma olayı eklendi`);
    } catch (err) {
      console.warn("⚠️  ACLED verisi alınamadı:", err.message);
    }

    if (allArticles.length === 0) {
      // Add demo data so the map isn't empty
      allArticles = generateDemoData();
      console.log("📌 Demo veriler haritaya yerleştirildi");
    }

    // Store articles
    state.allArticles = allArticles;

    // 4. Place all articles on the map
    state.allMarkers = [];
    const placed = allArticles
      .map((article) => placeArticle(article, map, physicalLayer, socioLayer))
      .filter(Boolean);

    state.allMarkers = placed;
    state.visibleCount = placed.length;

    // Update risk filter count
    const countDisplay = document.getElementById("event-count");
    if (countDisplay) countDisplay.textContent = placed.length + " olay";

    // Update ticker
    updateTicker(allArticles);

    console.log(`✅ ${placed.length} olay haritaya yerleştirildi`);
  }

  // =========================================================================
  // 7. GDELT API — Live Socio-Political Intel
  // =========================================================================
  async function fetchGDELT(query) {
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc" +
      "?query=" +
      encodeURIComponent(query) +
      "&mode=artlist" +
      "&format=json" +
      "&maxrecords=100";

    const resp = await fetch(url);
    const json = await resp.json();

    if (!json.articles) return [];

    return json.articles.map((a, i) => {
      // Risk scoring based on GDELT tone
      const tone = parseFloat(a.tone) || 0;
      const baseRisk = 35;
      const toneRisk = tone < 0 ? Math.abs(tone) * 0.4 : 0;
      const riskScore = Math.min(100, Math.round(baseRisk + toneRisk));

      return {
        title: a.title || "GDELT Olayı",
        description: a.seendate || "",
        source: "GDELT",
        lat: parseFloat(a.domainlat) || null,
        lng: parseFloat(a.domainlon) || null,
        coordinates: [
          parseFloat(a.domainlat) || 0,
          parseFloat(a.domainlon) || 0,
        ],
        macroLayer: "socio-political",
        category: "intelligence",
        liveRiskScore: riskScore,
        opacity: 0.85,
      };
    });
  }

  // =========================================================================
  // 8. ACLED API — Armed Conflict Data
  // =========================================================================
  async function fetchACLED(country) {
    const url =
      "https://api.acleddata.com/acled/read" +
      "?country=" +
      encodeURIComponent(country) +
      "&limit=200";

    const resp = await fetch(url);
    const json = await resp.json();

    if (!json.data) return [];

    return json.data.map((e, i) => {
      // Risk based on fatalities
      const fatalities = parseInt(e.fatalities) || 0;
      let baseRisk = 40;
      if (fatalities > 10) baseRisk = 80;
      else if (fatalities > 0) baseRisk = 55;
      const riskScore = Math.min(100, baseRisk + fatalities * 2);

      return {
        title: (e.event_type || "Olay") + " — " + (e.location || country),
        description: e.notes || "",
        source: "ACLED",
        lat: parseFloat(e.latitude) || null,
        lng: parseFloat(e.longitude) || null,
        coordinates: [
          parseFloat(e.latitude) || 0,
          parseFloat(e.longitude) || 0,
        ],
        macroLayer: "socio-political",
        category: e.event_type || "conflict",
        liveRiskScore: riskScore,
        opacity: 0.9,
      };
    });
  }

  // =========================================================================
  // 9. DEMO DATA — Fallback when no live data
  // =========================================================================
  function generateDemoData() {
    const demoEvents = [
      {
        title: "Ukrayna — Cephe Hattı Çatışmaları",
        description:
          "Doğu Ukrayna'da yoğun topçu atışları ve zırhlı birlik hareketliliği rapor edildi.",
        source: "OSINT",
        coordinates: [48.5, 37.8],
        macroLayer: "socio-political",
        category: "military_conflict",
        liveRiskScore: 92,
        opacity: 0.95,
      },
      {
        title: "Gazze — İnsani Kriz Derinleşiyor",
        description:
          "BM raporuna göre bölgede gıda ve temiz su erişimi kritik seviyede.",
        source: "BM",
        coordinates: [31.5, 34.47],
        macroLayer: "socio-political",
        category: "humanitarian_crisis",
        liveRiskScore: 88,
        opacity: 0.9,
      },
      {
        title: "Tayvan Boğazı — Askeri Yığınak",
        description:
          "Çin Halk Kurtuluş Ordusu'na ait 45 savaş gemisi ve 60 uçak bölgede tatbikat yapıyor.",
        source: "US PACOM",
        coordinates: [24.0, 119.5],
        macroLayer: "socio-political",
        category: "military_buildup",
        liveRiskScore: 78,
        opacity: 0.85,
      },
      {
        title: "Myanmar — İç Savaş Şiddetleniyor",
        description:
          "Etnik silahlı gruplar ile cunta güçleri arasında çatışmalar 3 eyalete yayıldı.",
        source: "ACLED",
        coordinates: [21.9, 96.0],
        macroLayer: "socio-political",
        category: "civil_war",
        liveRiskScore: 85,
        opacity: 0.9,
      },
      {
        title: "Sudan — Kıtlık Uyarısı",
        description:
          "WFP, Sudan'da 18 milyon kişinin akut gıda güvensizliğiyle karşı karşıya olduğunu açıkladı.",
        source: "WFP",
        coordinates: [15.5, 32.5],
        macroLayer: "physical",
        category: "food_crisis",
        liveRiskScore: 75,
        opacity: 0.85,
      },
      {
        title: "Kuzey Kutbu — Rekor Sıcaklık Artışı",
        description:
          "Kuzey Kutbu'nda sıcaklıklar mevsim normallerinin 20°C üzerinde seyrediyor. Buzullar hızla eriyor.",
        source: "NASA",
        coordinates: [78.0, -40.0],
        macroLayer: "physical",
        category: "climate_crisis",
        liveRiskScore: 65,
        opacity: 0.8,
      },
      {
        title: "Süveyş Kanalı — Deniz Trafiği Tehdit Altında",
        description:
          "Husi saldırıları nedeniyle Kızıldeniz rotasında büyük çaplı deniz trafiği aksaması devam ediyor.",
        source: "IMO",
        coordinates: [29.5, 32.5],
        macroLayer: "socio-political",
        category: "maritime_threat",
        liveRiskScore: 82,
        opacity: 0.88,
      },
      {
        title: "Hindistan — Muson Selleri",
        description:
          "Assam ve Bihar eyaletlerinde şiddetli muson yağışları sonucu 2 milyon kişi yerinden oldu.",
        source: "NDMA",
        coordinates: [26.0, 89.0],
        macroLayer: "physical",
        category: "flood",
        liveRiskScore: 55,
        opacity: 0.75,
      },
      {
        title: "Paraguay — Dang Humması Salgını",
        description:
          "Sağlık Bakanlığı ülke çapında acil durum ilan etti, 50.000+ vaka.",
        source: "WHO",
        coordinates: [-23.0, -58.0],
        macroLayer: "physical",
        category: "epidemic",
        liveRiskScore: 45,
        opacity: 0.7,
      },
      {
        title: "Fransa — Genel Grev",
        description:
          "Emeklilik reformuna karşı ülke çapında milyonlarca işçi grevde. Paris'te çatışmalar çıktı.",
        source: "AFP",
        coordinates: [48.85, 2.35],
        macroLayer: "socio-political",
        category: "civil_unrest",
        liveRiskScore: 42,
        opacity: 0.8,
      },
    ];

    return demoEvents;
  }

  // =========================================================================
  // 10. CAMERA LAYER INIT — Live Camera Integration
  // =========================================================================
  function initCameraLayer(map) {
    if (typeof initKameraLayer === "function") {
      // Register the camera layer to the map
      // The existing kamera.js handles its own cluster group
      // We just need to provide a toggle mechanism

      // Create a hidden layer group for camera
      const cameraLayer = L.layerGroup();

      // Override: intercept and place cameras
      // Since kamera.js uses its own mechanism, we just expose the layer
      window._cameraLayer = cameraLayer;

      console.log("📷 Kamera katmanı hazır");
    }
  }

  // =========================================================================
  // MAIN BOOT SEQUENCE
  // =========================================================================
  async function boot() {
    console.log(
      "%c🌍 EARTH WATCHER v4 %c— GEOPOLITICAL SITUATION ROOM",
      "color: #00e5ff; font-size: 18px; font-weight: bold;",
      "color: #94a3b8; font-size: 14px;",
    );

    // 1. Initialize map
    const map = initMap();
    state.map = map;

    // 2. Initialize layer groups
    const { physicalRiskLayer, socioPoliticalLayer } = initLayers(map);
    state.physicalRiskLayer = physicalRiskLayer;
    state.socioPoliticalLayer = socioPoliticalLayer;

    // 3. Initialize risk filter bar
    initRiskFilterBar(map);

    // 4. Initialize ticker
    initTicker();

    // 5. Initialize camera layer
    initCameraLayer(map);

    // 6. Load and render data
    await loadData(map, physicalRiskLayer, socioPoliticalLayer);

    console.log(
      "%c✅ EARTH WATCHER v4 AKTİF %c— Tüm sistemler hazır",
      "color: #00e676; font-weight: bold;",
      "color: #94a3b8;",
    );
  }

  // =========================================================================
  // EXPORT — Global access for debugging
  // =========================================================================
  window.EW4 = {
    state,
    getMap: () => state.map,
    refreshData: () => {
      if (state.physicalRiskLayer) state.physicalRiskLayer.clearLayers();
      if (state.socioPoliticalLayer) state.socioPoliticalLayer.clearLayers();
      state.allMarkers = [];
      loadData(state.map, state.physicalRiskLayer, state.socioPoliticalLayer);
    },
  };

  // =========================================================================
  // LAUNCH
  // =========================================================================
  document.addEventListener("DOMContentLoaded", boot);
})();

/**
 * Earth Watcher v4 — Frontend App
 * News Ticker + 2 Master Layers + Risk/Time Sliders + Satellite Recon
 */
(function () {
  // ============================================================
  // HARITA
  // ============================================================
  const map = L.map("map", {
    center: [20, 0],
    zoom: 3,
    minZoom: 2,
    preferCanvas: true,
    zoomControl: false,
  });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // ============================================================
  // MAKRO KATMANLAR
  // ============================================================
  const physicalRiskLayer = L.layerGroup().addTo(map);
  const socioPoliticalLayer = L.layerGroup().addTo(map);

  // ============================================================
  // STATE
  // ============================================================
  let globalArticles = [];
  let currentRiskThreshold = 0;
  let currentTimeFilterDays = 7;
  let firmsLayer = null; // NASA FIRMS fire layer
  let meteorLayer = null; // NASA Meteorite layer
  let correlationLayer = null; // Crisis correlation zones
  let nasaFirmsData = [];
  let nasaMeteorData = [];

  // ============================================================
  // CATEGORY + COLOR HELPERS
  // ============================================================
  function getCatLabel(cat) {
    const m = {
      nuclear_threat: "Nukleer",
      military_conflict: "Catisma",
      terror_attack: "Teror",
      civil_unrest: "Protesto",
      diplomatic_crisis: "Diplomasi",
      catastrophic_disaster: "Felaket",
      natural_disaster: "Dogal Afet",
      climate_anomaly: "Iklim",
    };
    return m[cat] || cat;
  }
  function riskColor(a) {
    if (a.macroLayer === "physical") {
      if (a.liveRiskScore > 75) return "#ff5500";
      if (a.liveRiskScore > 40) return "#ff8c00";
      return "#00ffcc";
    }
    if (a.liveRiskScore > 75) return "#ff0055";
    if (a.liveRiskScore > 40) return "#ff9900";
    return "#ffea00";
  }

  // ============================================================
  // RENDER — FILTRELI
  // ============================================================
  function updateMapLayers() {
    physicalRiskLayer.clearLayers();
    socioPoliticalLayer.clearLayers();
    const now = new Date();
    let visible = 0;
    globalArticles.forEach((a) => {
      const days = Math.abs(now - new Date(a.timestamp)) / 86400000;
      if (days > currentTimeFilterDays) return;
      if (a.liveRiskScore < currentRiskThreshold) return;
      visible++;
      const color = riskColor(a);
      const r = Math.max(3, Math.min(16, a.liveRiskScore * 0.18));
      const op = Math.max(0.15, a.decayFactor || 0.8);
      const m = L.circleMarker(a.coordinates, {
        radius: r,
        fillColor: color,
        color: "#fff",
        weight: a.isHotspot ? 1.5 : 0.3,
        opacity: op,
        fillOpacity: op * 0.8,
      });
      const pop = `<div style="padding:2px;min-width:200px">
        <span style="font-size:9px;text-transform:uppercase;color:#94a3b8">${a.source} · ${getCatLabel(a.category)}</span>
        <h4 style="margin:4px 0;color:#f8fafc;font-size:13px">${a.title || ""}</h4>
        <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:1.4">${(a.description || "").slice(0, 130)}</p>
        <div style="margin-top:6px;border-top:1px solid #334155;padding-top:4px;display:flex;justify-content:space-between">
          <span style="color:#ef4444;font-weight:bold;font-size:11px">Risk: ${a.liveRiskScore}/100</span>
          <span style="color:#64748b;font-size:9px">${new Date(a.timestamp).toLocaleDateString()}</span>
        </div>
        <div style="margin-top:4px">
          <button onclick="event.stopPropagation();satelliteRecon(${a.coordinates[0]},${a.coordinates[1]})"
            style="background:none;border:1px solid #00ffcc;color:#00ffcc;font-size:9px;padding:2px 8px;border-radius:3px;cursor:pointer">🛰️ Uydu Kesif</button>
        </div></div>`;
      m.bindPopup(pop, { maxWidth: 290 });
      if (a.macroLayer === "physical") m.addTo(physicalRiskLayer);
      else m.addTo(socioPoliticalLayer);
    });
    document.getElementById("stat-visible").textContent = visible;
  }

  // ============================================================
  // NEWS TICKER
  // ============================================================
  function updateTicker() {
    const el = document.getElementById("ticker-track");
    if (!globalArticles.length) {
      el.innerHTML = "🌍 Veri bekleniyor...";
      return;
    }
    const top = globalArticles.filter((a) => a.liveRiskScore > 50).slice(0, 15);
    if (!top.length) {
      el.innerHTML = globalArticles
        .slice(0, 10)
        .map((a) => `${a.source}: ${(a.title || "").slice(0, 60)}`)
        .join(" &nbsp;·&nbsp; ");
      return;
    }
    el.innerHTML = top
      .map((a) => {
        const cls = a.liveRiskScore > 75 ? "risk-high" : "risk-mid";
        return `<b class="${cls}">[${a.liveRiskScore}]</b> ${a.source}: ${(a.title || "").slice(0, 70)}`;
      })
      .join(" &nbsp;·&nbsp; ");
  }

  function updateStats() {
    document.getElementById("stat-total").textContent = globalArticles.length;
    document.getElementById("stat-hotspot").textContent = globalArticles.filter(
      (a) => a.isHotspot,
    ).length;
  }

  // ============================================================
  // VERI YUKLEME
  // ============================================================
  async function loadData() {
    try {
      const r = await fetch("data/news-v4.json");
      if (!r.ok) throw new Error("HTTP " + r.status);
      globalArticles = await r.json();
      updateStats();
      updateTicker();
      updateMapLayers();
      document.getElementById("last-update").textContent =
        new Date().toLocaleTimeString();
    } catch (e) {
      console.warn(e.message);
      document.getElementById("last-update").textContent = "Veri yok";
    }
  }

  // ============================================================
  // SLIDER EVENTS (duzeltildi)
  // ============================================================
  const riskSlider = document.getElementById("riskThresholdSlider");
  const timeSlider = document.getElementById("timeRangeSlider");
  const riskLabel = document.getElementById("riskValueLabel");
  const timeLabel = document.getElementById("timeValueLabel");
  if (riskSlider)
    riskSlider.addEventListener("input", function (e) {
      currentRiskThreshold = parseInt(this.value);
      riskLabel.textContent = "Min Risk: " + currentRiskThreshold + "/100";
      updateMapLayers();
    });
  if (timeSlider)
    timeSlider.addEventListener("input", function (e) {
      currentTimeFilterDays = parseInt(this.value);
      timeLabel.textContent =
        currentTimeFilterDays === 1
          ? "Zaman: Son 24 Saat"
          : "Zaman: Son " + currentTimeFilterDays + " Gun";
      updateMapLayers();
    });

  // ============================================================
  // SATELLITE RECON — Esri World Imagery Overlay
  // ============================================================
  let activeSatOverlay = null;

  window.openNearbyCamera = function (lat, lng, name) {
    // Kamera layer'ini goster ve o kameraya zoomla
    if (cameraLayer && !map.hasLayer(cameraLayer)) {
      map.addLayer(cameraLayer);
      // Checkbox'i da isaretle
      const cb = document.getElementById("layer-📷 Canli Kameralar 59".replace(/[^a-z]/gi, ""));
      if (cb) cb.checked = true;
    }
    map.setView([lat, lng], 13, { animate: true });
    // Kameranin popup'ini acmak icin katmandaki marker'i bul
    setTimeout(function () {
      cameraLayer.eachLayer(function (layer) {
        if (layer.getLatLng) {
          const ll = layer.getLatLng();
          if (Math.abs(ll.lat - lat) < 0.001 && Math.abs(ll.lng - lng) < 0.001) {
            layer.openPopup();
          }
        }
      });
    }, 800);
  };

  window.satelliteRecon = function (lat, lng) {
    map.closePopup();

    // Onceki overlay'i temizle
    if (activeSatOverlay) {
      map.removeLayer(activeSatOverlay);
      activeSatOverlay = null;
    }

    // Esri World Imagery tile layer (calisiyor, ucretsiz, CORS yok)
    const satLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxZoom: 18,
        opacity: 0.5,
      },
    ).addTo(map);

    activeSatOverlay = satLayer;

    // Hedef noktaya zoom + crosshair
    map.setView([lat, lng], 14, { animate: true });

    const crosshair = L.circleMarker([lat, lng], {
      radius: 5,
      fillColor: "#00ffcc",
      color: "#00ffcc",
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.3,
      className: "satellite-scan-pulse",
    }).addTo(map);

    // Bilgi popup'ı
    const popup = L.popup({ maxWidth: 300, className: "ew-recon-popup" })
      .setLatLng([lat, lng])
      .setContent(
        `<div style="padding:8px;text-align:center">
        <span style="font-size:10px;text-transform:uppercase;color:#00ffcc;font-weight:bold">🛰️ UYDU KEŞFİ</span>
        <p style="margin:4px 0 0;color:#64748b;font-size:9px">Esri World Imagery · Zoom 14<br>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
        <button onclick="closeSatelliteView()" style="margin-top:6px;background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#ef4444;font-size:9px;padding:2px 10px;border-radius:3px;cursor:pointer">✕ Kapat</button>
      </div>`,
      )
      .openOn(map);

    // 60 sn sonra otomatik kapanir
    window._satTimeout = setTimeout(() => closeSatelliteView(), 60000);
    window._satCrosshair = crosshair;
    window._satPopup = popup;
  };

  window.closeSatelliteView = function () {
    if (activeSatOverlay) {
      map.removeLayer(activeSatOverlay);
      activeSatOverlay = null;
    }
    if (window._satCrosshair) {
      map.removeLayer(window._satCrosshair);
      window._satCrosshair = null;
    }
    if (window._satPopup) {
      map.closePopup(window._satPopup);
      window._satPopup = null;
    }
    if (window._satTimeout) {
      clearTimeout(window._satTimeout);
      window._satTimeout = null;
    }
    map.setView([20, 0], 3, { animate: true });
  };

  // ============================================================
  // MAP RIGHT-CLICK → Satellite Recon
  // ============================================================
  map.getContainer().addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  map.on("contextmenu", function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Yakindaki kamerayi bul (50km)
    let nearbyCam = null;
    if (cameraData.length) {
      let minDist = Infinity;
      cameraData.forEach(function (cam) {
        if (!cam.lat || !cam.lng) return;
        const d = getDistanceKm(lat, lng, cam.lat, cam.lng);
        if (d < 50 && d < minDist) {
          minDist = d;
          nearbyCam = cam;
        }
      });
    }

    // Context menu popup
    let menuHTML = '<div style="padding:6px;min-width:180px;font-family:sans-serif">';
    menuHTML += '<span style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:bold">📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</span>';
    menuHTML += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">';

    // Uydu butonu
    menuHTML += '<button onclick="satelliteRecon(' + lat + ',' + lng + ');map.closePopup();" style="background:rgba(0,255,204,0.1);border:1px solid #00ffcc;color:#00ffcc;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;text-align:left">🛰️ Uydu Kesif</button>';

    // Kamera butonu (sadece yakininda varsa)
    if (nearbyCam) {
      const camName = (nearbyCam.name || "Kamera").replace(/'/g, "\'");
      menuHTML += '<button onclick="openNearbyCamera(' + nearbyCam.lat + ',' + nearbyCam.lng + ','' + camName + '');map.closePopup();" style="background:rgba(129,140,248,0.1);border:1px solid #818cf8;color:#c7d2fe;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;text-align:left">📷 ' + nearbyCam.name + ' (' + minDist.toFixed(0) + ' km)</button>';
    }

    menuHTML += '</div></div>';

    L.popup({ maxWidth: 260, className: "ew-context-popup" })
      .setLatLng([lat, lng])
      .setContent(menuHTML)
      .openOn(map);
  });

  // ============================================================
  // NASA FIRMS — Active Fire Data
  // ============================================================
  // Ucretsiz MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/
  const NASA_FIRMS_KEY = "ec79b73de125772b42739d679870409a"; // Bos birakilirsa demo veri kullanilir

  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function fetchNASADemoFires() {
    // Demo yangin verisi (gercek API key olmadiginda)
    return [
      {
        lat: 37.5,
        lng: -119.5,
        brightness: 340,
        frp: 85,
        acq_date: "2026-06-20",
        confidence: 95,
        scan: 0.5,
        track: 0.5,
        satellite: "MODIS",
        instrument: "MODIS",
      },
      {
        lat: 41.2,
        lng: -122.3,
        brightness: 355,
        frp: 120,
        acq_date: "2026-06-21",
        confidence: 90,
        scan: 0.6,
        track: 0.6,
        satellite: "MODIS",
        instrument: "MODIS",
      },
      {
        lat: 64.8,
        lng: -147.5,
        brightness: 310,
        frp: 45,
        acq_date: "2026-06-20",
        confidence: 80,
        scan: 0.4,
        track: 0.4,
        satellite: "VIIRS",
        instrument: "VIIRS",
      },
      {
        lat: -23.5,
        lng: -46.6,
        brightness: 380,
        frp: 200,
        acq_date: "2026-06-22",
        confidence: 95,
        scan: 0.8,
        track: 0.8,
        satellite: "MODIS",
        instrument: "MODIS",
      },
      {
        lat: -33.9,
        lng: 151.2,
        brightness: 330,
        frp: 65,
        acq_date: "2026-06-21",
        confidence: 85,
        scan: 0.5,
        track: 0.5,
        satellite: "VIIRS",
        instrument: "VIIRS",
      },
      {
        lat: 55.8,
        lng: 37.6,
        brightness: 290,
        frp: 30,
        acq_date: "2026-06-22",
        confidence: 70,
        scan: 0.3,
        track: 0.3,
        satellite: "MODIS",
        instrument: "MODIS",
      },
      {
        lat: -5.5,
        lng: -62.2,
        brightness: 395,
        frp: 250,
        acq_date: "2026-06-22",
        confidence: 98,
        scan: 0.9,
        track: 0.9,
        satellite: "MODIS",
        instrument: "MODIS",
      },
      {
        lat: 48.4,
        lng: -106.5,
        brightness: 325,
        frp: 55,
        acq_date: "2026-06-21",
        confidence: 75,
        scan: 0.4,
        track: 0.4,
        satellite: "VIIRS",
        instrument: "VIIRS",
      },
      {
        lat: 36.8,
        lng: 140.8,
        brightness: 300,
        frp: 38,
        acq_date: "2026-06-20",
        confidence: 72,
        scan: 0.35,
        track: 0.35,
        satellite: "MODIS",
        instrument: "MODIS",
      },
      {
        lat: 39.9,
        lng: 32.8,
        brightness: 360,
        frp: 110,
        acq_date: "2026-06-22",
        confidence: 92,
        scan: 0.7,
        track: 0.7,
        satellite: "MODIS",
        instrument: "MODIS",
      },
    ];
  }

  async function fetchNasaFirms() {
    try {
      let allFires = [];
      if (NASA_FIRMS_KEY) {
        const bounds = map.getBounds();
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

        // MODIS + VIIRS dual fetch (VIIRS daha yuksek cozunurluklu)
        const sources = [
          { name: "MODIS_NRT", label: "MODIS" },
          { name: "VIIRS_SNPP_NRT", label: "VIIRS" },
        ];

        for (const src of sources) {
          try {
            const url = `https://firms.modaps.eosdis.nasa.gov/api/area/json/${NASA_FIRMS_KEY}/${src.name}/${bbox}/3`;
            const r = await fetch(url);
            if (!r.ok) continue;
            const data = await r.json();
            data.forEach((f) => {
              allFires.push({
                lat: parseFloat(f.latitude),
                lng: parseFloat(f.longitude),
                brightness: parseFloat(f.bright_ti4) || 300,
                frp: parseFloat(f.frp) || 30,
                acq_date: f.acq_date,
                acq_time: f.acq_time || "",
                confidence: parseInt(f.confidence) || 80,
                scan: parseFloat(f.scan) || 0.5,
                track: parseFloat(f.track) || 0.5,
                satellite: src.label,
                instrument: src.label,
              });
            });
          } catch (e) {
            console.warn("FIRMS " + src.label + ":", e.message);
          }
        }

        // Dedup: ayni koordinattaki yanginlari birlestir (en yuksek FRP'yi tut)
        const seen = new Map();
        const deduped = [];
        allFires.forEach((f) => {
          const key = f.lat.toFixed(4) + "," + f.lng.toFixed(4);
          if (!seen.has(key)) {
            seen.set(key, f);
            deduped.push(f);
          } else {
            const existing = seen.get(key);
            if (f.frp > existing.frp) {
              existing.frp = f.frp;
              existing.brightness = Math.max(existing.brightness, f.brightness);
              if (f.satellite !== existing.satellite)
                existing.satellite = "MODIS+VIIRS";
            }
          }
        });

        nasaFirmsData = deduped;
        console.log("🔥 NASA FIRMS: " + deduped.length + " yangin (MODIS+VIIRS)");
        return deduped;
      } else {
        const fires = await fetchNASADemoFires();
        nasaFirmsData = fires;
        return fires;
      }
    } catch (e) {
      console.warn("NASA FIRMS:", e.message);
      const fires = await fetchNASADemoFires();
      nasaFirmsData = fires;
      return fires;
    }
  }


  function renderFirmsOnMap(fires) {
    if (firmsLayer) map.removeLayer(firmsLayer);
    firmsLayer = L.layerGroup().addTo(map);

    fires.forEach((f) => {
      const r = Math.max(3, Math.min(10, (f.frp || 30) * 0.04));
      const m = L.circleMarker([f.lat, f.lng], {
        radius: r,
        fillColor: "#ff3300",
        color: "#ffcc00",
        weight: 0.8,
        opacity: 0.9,
        fillOpacity: 0.6,
      });
      m.bindPopup(`
        <div style="padding:2px;min-width:180px">
          <span style="font-size:9px;text-transform:uppercase;color:#ff6600;font-weight:bold">🔥 NASA FIRMS</span>
          <p style="margin:4px 0;color:#f8fafc;font-size:12px">Aktif Yangin</p>
          <span style="color:#cbd5e1;font-size:10px">
            Uydu: ${f.satellite}<br>Tarih: ${f.acq_date}<br>
            Guc: ${f.frp} MW<br>
            Parlaklik: ${f.brightness}K<br>
            Guvenilirlik: %${f.confidence}
          </span>
        </div>`);
      firmsLayer.addLayer(m);
    });

    // Layer control'e ekle (varsa)
    addToLayerControl("🔥 Aktif Yangin (NASA FIRMS)", firmsLayer, false);
  }

  // ============================================================
  // CORRELATION ENGINE — ACLED + NASA Yangin Iliskisi
  // ============================================================
  function analyzeNaturalAndSocialCorrelation(articles, fires) {
    const MAX_DISTANCE_KM = 50;
    const MAX_DAYS_DIFF = 7;
    const pairs = [];

    articles.forEach((a) => {
      if (!a.coordinates || a.macroLayer !== "socio-political") return;
      const aDate = new Date(a.timestamp);

      fires.forEach((f) => {
        const dist = getDistanceKm(
          a.coordinates[0],
          a.coordinates[1],
          f.lat,
          f.lng,
        );
        if (dist <= MAX_DISTANCE_KM) {
          const fDate = new Date(f.acq_date);
          const daysDiff = Math.abs(aDate - fDate) / 86400000;
          if (daysDiff <= MAX_DAYS_DIFF) {
            const spatialW = 1 - dist / MAX_DISTANCE_KM;
            const temporalW = 1 - daysDiff / MAX_DAYS_DIFF;
            const score = spatialW * 0.6 + temporalW * 0.4;
            pairs.push({
              article: a,
              fire: f,
              distance: dist.toFixed(1),
              days: daysDiff.toFixed(1),
              score: score,
              lat: a.coordinates[0],
              lng: a.coordinates[1],
            });
          }
        }
      });
    });
    return pairs;
  }

  function renderCorrelationZones(pairs) {
    if (correlationLayer) map.removeLayer(correlationLayer);
    correlationLayer = L.layerGroup().addTo(map);

    const highPairs = pairs.filter((p) => p.score > 0.7);
    highPairs.forEach((p) => {
      const zone = L.circle([p.lat, p.lng], {
        radius: 25000,
        color: "#9900cc",
        fillColor: "#ff0055",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "5, 5",
      });
      zone.bindPopup(`
        <div style="padding:2px;min-width:200px">
          <span style="font-size:9px;text-transform:uppercase;color:#9900cc;font-weight:bold">⚠️ KRIZ BOLGESI</span>
          <p style="margin:4px 0;color:#f8fafc;font-size:11px">${(p.article.title || "").slice(0, 80)}</p>
          <span style="color:#cbd5e1;font-size:10px">
            Korelasyon: %${Math.round(p.score * 100)}<br>
            Mesafe: ${p.distance} km<br>
            Zaman Farki: ${p.days} gun<br>
            🔥 Yangin Gucu: ${p.fire.frp} MW
          </span>
        </div>`);
      correlationLayer.addLayer(zone);
    });

    if (highPairs.length > 0) {
      addToLayerControl("⚠️ Kriz Korelasyon Bolgeleri", correlationLayer, true);
      document.getElementById("stat-hotspot").textContent = highPairs.length;
    }
  }

  // ============================================================
  // NASA METEORITE — Meteor Dusus Verileri
  // ============================================================
  async function fetchNasaMeteorites() {
    try {
      const url =
        "https://data.nasa.gov/resource/gh4g-9sfh.json?$select=name,id,nametype,recclass,mass,fall,year,geolocation&$where=geolocation%20is%20not%20null&$limit=500";
      const r = await fetch(url);
      if (!r.ok) throw new Error("Meteor API hatasi");
      const data = await r.json();
      nasaMeteorData = data
        .filter(
          (m) =>
            m.geolocation &&
            m.geolocation.coordinates &&
            m.geolocation.coordinates.length >= 2,
        )
        .map((m) => ({
          name: m.name || "Bilinmeyen",
          lat: parseFloat(m.geolocation.coordinates[1]),
          lng: parseFloat(m.geolocation.coordinates[0]),
          mass: parseFloat(m.mass) || 0,
          year: m.year ? new Date(m.year).getFullYear() : "?",
          recclass: m.recclass || "?",
          fall: m.fall || "?",
        }));
      return nasaMeteorData;
    } catch (e) {
      console.warn("NASA Meteor:", e.message);
      nasaMeteorData = [];
      return [];
    }
  }

  function renderMeteoritesOnMap(meteors) {
    if (meteorLayer) map.removeLayer(meteorLayer);
    meteorLayer = L.layerGroup().addTo(map);

    meteors.slice(0, 200).forEach((m) => {
      const r = m.mass > 100000 ? 7 : m.mass > 10000 ? 5 : 3;
      const mk = L.circleMarker([m.lat, m.lng], {
        radius: r,
        fillColor: "#4a148c",
        color: "#b3e5fc",
        weight: 1,
        opacity: 0.7,
        fillOpacity: 0.5,
      });
      mk.bindPopup(`
        <div style="padding:2px;min-width:160px">
          <span style="font-size:9px;text-transform:uppercase;color:#9c27b0;font-weight:bold">☄️ NASA Meteorit</span>
          <p style="margin:4px 0;color:#f8fafc;font-size:11px">${m.name}</p>
          <span style="color:#cbd5e1;font-size:10px">
            Yil: ${m.year}<br>
            Kutle: ${(m.mass / 1000).toFixed(1)} kg<br>
            Sinif: ${m.recclass}
          </span>
        </div>`);
      meteorLayer.addLayer(mk);
    });

    addToLayerControl("☄️ Meteor Dususleri (NASA)", meteorLayer, false);
  }

  // Layer control helper
  function addToLayerControl(label, layer, checked) {
    // Leaflet layer control'e sonradan ekleme hack'i
    const existing = document.querySelector(".leaflet-control-layers-overlays");
    if (!existing) return;

    const id = "layer-" + label.replace(/[^a-z]/gi, "");
    if (document.getElementById(id)) return;

    const div = document.createElement("div");
    div.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;font-size:11px;color:#cbd5e1">
        <input type="checkbox" id="${id}" ${checked ? "checked" : ""} onchange="window._toggleLayer('${id}', this.checked)">
        ${label}
      </label>`;
    existing.appendChild(div);

    window._layerMap = window._layerMap || {};
    window._layerMap[id] = layer;
    if (!checked) map.removeLayer(layer);

    window._toggleLayer = function (layerId, on) {
      const l = window._layerMap[layerId];
      if (l) on ? l.addTo(map) : map.removeLayer(l);
    };
  }

  // ============================================================
  // LAYER TOGGLE + REFRESH
  // ============================================================
  window.toggleLayer = function (layer, visible) {
    if (layer === "physical")
      visible
        ? physicalRiskLayer.addTo(map)
        : map.removeLayer(physicalRiskLayer);
    else
      visible
        ? socioPoliticalLayer.addTo(map)
        : map.removeLayer(socioPoliticalLayer);
  };
  window.refreshData = function () {
    document.getElementById("last-update").textContent = "Yukleniyor...";
    loadData();
  };

  // ============================================================
  // LEGEND
  // ============================================================
  (function () {
    document.getElementById("legend").innerHTML = [
      { c: "#ff0055", l: "Kritik (>75)" },
      { c: "#ff9900", l: "Yuksek (40-75)" },
      { c: "#ffea00", l: "Orta (<40)" },
      { c: "#00ffcc", l: "Cevresel" },
    ]
      .map(
        (i) =>
          `<div class="legend-row"><span class="legend-dot" style="background:${i.c}"></span> ${i.l}</div>`,
      )
      .join("");
  })();


  // ============================================================
  // CANLI KAMERALAR — fetch from cameras.json
  // ============================================================
  let cameraLayer = null;
  let cameraData = [];

  async function loadCameras() {
    try {
      const r = await fetch("data/cameras.json");
      if (!r.ok) throw new Error("Kamera JSON yuklenemedi");
      const json = await r.json();
      cameraData = json.cameras || [];
      if (cameraData.length) renderCamerasOnMap(cameraData);
      console.log("📷 " + cameraData.length + " kamera yuklendi");
    } catch (e) {
      console.warn("Kamera hatasi:", e.message);
    }
  }

  function renderCamerasOnMap(cameras) {
    if (cameraLayer) map.removeLayer(cameraLayer);

    // MarkerClusterGroup kullan (performans + profesyonel gorunum)
    if (typeof L.markerClusterGroup === "function") {
      cameraLayer = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: function (cluster) {
          const count = cluster.getChildCount();
          let size = count < 10 ? "small" : count < 50 ? "medium" : "large";
          let color = count < 50 ? "#818cf8" : "#ef4444";
          return L.divIcon({
            html: '<div style="background:' + color + ';border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:13px;box-shadow:0 0 12px ' + color + '">' + count + '</div>',
            className: "ew-camera-cluster",
            iconSize: L.point(36, 36),
          });
        },
      });
    } else {
      cameraLayer = L.layerGroup();
    }

    // Ozel kamera ikonu
    const camIcon = L.divIcon({
      className: "ew-camera-icon",
      html: '<div style="background:#1e1b4b;border:2px solid #818cf8;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 8px rgba(129,140,248,0.5)">📷</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    });

    cameras.forEach(function (cam) {
      if (!cam.lat || !cam.lng) return;
      var popupContent = "";

      if (cam.type === "youtube" && cam.stream) {
        popupContent =
          '<div style="width:300px;font-family:sans-serif">' +
          '<h4 style="margin:0 0 8px;color:#f8fafc;font-size:13px">📷 ' + (cam.name || "") + '</h4>' +
          '<iframe width="100%" height="180" src="' + cam.stream + '?autoplay=1&mute=1" ' +
          'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
          'allowfullscreen style="border-radius:6px"></iframe>' +
          '<span style="font-size:9px;color:#64748b">' + (cam.provider || "") + ' · ' + (cam.country || "") + '</span>' +
          '</div>';
      } else if (cam.type === "snapshot" && cam.url) {
        popupContent =
          '<div style="width:300px;font-family:sans-serif">' +
          '<h4 style="margin:0 0 8px;color:#f8fafc;font-size:13px">📷 ' + (cam.name || "") + '</h4>' +
          '<img src="' + cam.url + '" width="100%" style="border-radius:6px" alt="' + (cam.name || "") + '">' +
          '<span style="font-size:9px;color:#64748b">' + (cam.provider || "") + ' · ' + (cam.country || "") + '</span>' +
          '</div>';
      } else if (cam.type === "video" && cam.stream) {
        popupContent =
          '<div style="width:300px;font-family:sans-serif">' +
          '<h4 style="margin:0 0 8px;color:#f8fafc;font-size:13px">📷 ' + (cam.name || "") + '</h4>' +
          '<iframe width="100%" height="180" src="' + cam.stream + '?autoplay=1&mute=1" ' +
          'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
          'allowfullscreen style="border-radius:6px"></iframe>' +
          '<span style="font-size:9px;color:#64748b">' + (cam.provider || "") + ' · ' + (cam.country || "") + '</span>' +
          '</div>';
      }

      if (popupContent) {
        var marker = L.marker([cam.lat, cam.lng], { icon: camIcon })
          .bindPopup(popupContent, { maxWidth: 320 });
        cameraLayer.addLayer(marker);
      }
    });

    // Baslangicta GIZLI — sag tik veya toggle ile acilir
    addToLayerControl("📷 Canli Kameralar (59)", cameraLayer, false);
  }

  // Kamera layer toggle desteği
  window.toggleCameras = function (visible) {
    if (!cameraLayer) return;
    visible ? cameraLayer.addTo(map) : map.removeLayer(cameraLayer);
  };

  // ============================================================
  // INIT — Master Orchestrator
  // ============================================================
  async function initEarthWatcher() {
    console.log("🚀 Earth Watcher v4 baslatiliyor...");

    // 1. Haber verisi (her zaman calisir)
    await loadData();

    // 2. Kameralar (her zaman calisir)
    await loadCameras();

    // 3. NASA FIRMS — aktif yangin verisi (API key varsa gercek, yoksa demo)
    console.log("🔥 NASA FIRMS yukleniyor...");
    const fires = await fetchNasaFirms();
    renderFirmsOnMap(fires);
    document.getElementById("stat-hotspot").textContent = fires.length;

    // 4. NASA Meteorit verisi
    console.log("☄️ NASA Meteorit yukleniyor...");
    const meteors = await fetchNasaMeteorites();
    if (meteors.length) renderMeteoritesOnMap(meteors);

    // 5. Korelasyon motoru: Haberler + Yangin iliskisi
    if (globalArticles.length && fires.length) {
      console.log("⚡ Korelasyon analizi...");
      const pairs = analyzeNaturalAndSocialCorrelation(globalArticles, fires);
      if (pairs.length) {
        renderCorrelationZones(pairs);
        document.getElementById("stat-hotspot").textContent =
          pairs.filter(function(p) { return p.score > 0.7; }).length;
      }
    }

    console.log("✅ Earth Watcher v4 hazir");
  }

  // Baslat!
  initEarthWatcher();
})();

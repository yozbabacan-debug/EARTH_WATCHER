/**
 * Earth Watcher v4 — Frontend App
 * 2 Master Layers + Risk/Time Sliders + Dynamic Filtering
 */
(function () {
  // ============================================================
  // HARITA
  // ============================================================
  const map = L.map("map", {
    center: [20, 0], zoom: 3, minZoom: 2,
    preferCanvas: true, zoomControl: false,
  });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; CARTO', subdomains: "abcd", maxZoom: 19,
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // ============================================================
  // MAKRO KATMANLAR
  // ============================================================
  const physicalRiskLayer = L.layerGroup().addTo(map);
  const socioPoliticalLayer = L.layerGroup().addTo(map);

  // ============================================================
  // VERI & SLIDER STATE
  // ============================================================
  let globalArticles = [];
  let currentRiskThreshold = 0;
  let currentTimeFilterDays = 7;

  // ============================================================
  // CATEGORY LABELS
  // ============================================================
  function getCategoryLabel(cat) {
    const m = {
      nuclear_threat: "Nukleer Tehdit", military_conflict: "Askeri Catisma",
      terror_attack: "Teror Saldirisi", civil_unrest: "Sivil Huzursuzluk",
      diplomatic_crisis: "Diplomatik Kriz", catastrophic_disaster: "Katastrofik Felaket",
      natural_disaster: "Dogal Afet", climate_anomaly: "Iklim Anomalisi",
    };
    return m[cat] || cat;
  }

  function getRiskColor(article) {
    if (article.macroLayer === "physical") {
      if (article.liveRiskScore > 75) return "#ff5500";
      if (article.liveRiskScore > 40) return "#ff8c00";
      return "#00ffcc";
    }
    if (article.liveRiskScore > 75) return "#ff0055";
    if (article.liveRiskScore > 40) return "#ff9900";
    return "#ffea00";
  }

  // ============================================================
  // RENDER — Filtreli
  // ============================================================
  function updateMapLayers() {
    physicalRiskLayer.clearLayers();
    socioPoliticalLayer.clearLayers();
    const now = new Date();
    let visibleCount = 0;

    globalArticles.forEach((article) => {
      // ZAMAN FILTRESI
      const articleDate = new Date(article.timestamp);
      const diffDays = Math.abs(now - articleDate) / (1000 * 60 * 60 * 24);
      if (diffDays > currentTimeFilterDays) return;

      // RISK ESIGI FILTRESI
      if (article.liveRiskScore < currentRiskThreshold) return;

      visibleCount++;
      const color = getRiskColor(article);
      const radius = Math.max(3, Math.min(16, article.liveRiskScore * 0.18));
      const opacity = Math.max(0.15, article.decayFactor || 0.8);

      const marker = L.circleMarker(article.coordinates, {
        radius, fillColor: color, color: "#ffffff",
        weight: article.isHotspot ? 1.5 : 0.3,
        opacity, fillOpacity: opacity * 0.8,
      });

      const popup = `
        <div style="padding:2px;min-width:200px;">
          <span style="font-size:9px;text-transform:uppercase;color:#94a3b8;">
            ${article.source} · ${getCategoryLabel(article.category)}
          </span>
          <h4 style="margin:4px 0;color:#f8fafc;font-size:13px;">${article.title||""}</h4>
          <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:1.4;">${(article.description||"").slice(0,130)}</p>
          <div style="margin-top:6px;border-top:1px solid #334155;padding-top:4px;display:flex;justify-content:space-between;">
            <span style="color:#ef4444;font-weight:bold;font-size:11px;">Risk: ${article.liveRiskScore}/100</span>
            <span style="color:#64748b;font-size:9px;">${new Date(article.timestamp).toLocaleDateString()}</span>
          </div>
        </div>`;
      marker.bindPopup(popup, { maxWidth: 280 });

      if (article.macroLayer === "physical") marker.addTo(physicalRiskLayer);
      else marker.addTo(socioPoliticalLayer);
    });

    document.getElementById("stat-visible").textContent = visibleCount;
  }

  function updateStats() {
    document.getElementById("stat-total").textContent = globalArticles.length;
    document.getElementById("stat-hotspot").textContent = globalArticles.filter(a => a.isHotspot).length;
  }

  // ============================================================
  // VERI YUKLEME
  // ============================================================
  async function loadData() {
    try {
      const resp = await fetch("data/news-v4.json");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      globalArticles = await resp.json();
      updateStats();
      updateMapLayers();
      document.getElementById("last-update").textContent = new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("news-v4.json:", e.message);
      document.getElementById("last-update").textContent = "Veri yok";
    }
  }

  // ============================================================
  // SLIDER EVENTS
  // ============================================================
  const riskSlider = document.getElementById("riskThresholdSlider");
  const timeSlider = document.getElementById("timeRangeSlider");
  const riskLabel = document.getElementById("riskValueLabel");
  const timeLabel = document.getElementById("timeValueLabel");

  if (riskSlider) {
    riskSlider.addEventListener("input", (e) => {
      currentRiskThreshold = parseInt(e.target.value);
      riskLabel.textContent = `Min Risk: ${currentRiskThreshold}/100`;
      updateMapLayers();
    });
  }
  if (timeSlider) {
    timeSlider.addEventListener("input", (e) => {
      currentTimeFilterDays = parseInt(e.target.value);
      if (currentTimeFilterDays === 1) timeLabel.textContent = "Zaman: Son 24 Saat";
      else timeLabel.textContent = `Zaman: Son ${currentTimeFilterDays} Gun`;
      updateMapLayers();
    });
  }

  // ============================================================
  // LAYER TOGGLE + REFRESH
  // ============================================================
  window.toggleLayer = function (layer, visible) {
    if (layer === "physical") visible ? physicalRiskLayer.addTo(map) : map.removeLayer(physicalRiskLayer);
    else visible ? socioPoliticalLayer.addTo(map) : map.removeLayer(socioPoliticalLayer);
  };
  window.refreshData = function () {
    document.getElementById("last-update").textContent = "Yukleniyor...";
    loadData();
  };

  // ============================================================
  // LEGEND
  // ============================================================
  (function () {
    const el = document.getElementById("legend");
    el.innerHTML = [
      { c: "#ff0055", l: "Kritik (>75)" },
      { c: "#ff9900", l: "Yuksek (40-75)" },
      { c: "#ffea00", l: "Orta (<40)" },
      { c: "#00ffcc", l: "Cevresel" },
    ].map(i => `<div class="legend-row"><span class="legend-dot" style="background:${i.c}"></span> ${i.l}</div>`).join("");
  })();

  // ============================================================
  // INIT
  // ============================================================
  loadData();
})();

/**
 * Earth Watcher v4 — Frontend Application
 * 2 Master Layers: physical + socio-political
 * Dynamic risk-based rendering
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
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // ============================================================
  // MAKRO KATMANLAR (Sadece 2 tane!)
  // ============================================================
  const physicalRiskLayer = L.layerGroup().addTo(map);
  const socioPoliticalLayer = L.layerGroup().addTo(map);

  // ============================================================
  // RISK RENK PALETI
  // ============================================================
  function getRiskColor(article) {
    if (article.macroLayer === "physical") {
      if (article.liveRiskScore > 75) return "#ff5500"; // volkanik
      if (article.liveRiskScore > 40) return "#ff8c00"; // koyu turuncu
      return "#00ffcc"; // neon cyan
    }
    // socio-political
    if (article.liveRiskScore > 75) return "#ff0055"; // kritik kirmizi
    if (article.liveRiskScore > 40) return "#ff9900"; // turuncu
    return "#ffea00"; // sari
  }

  function getCategoryLabel(cat) {
    const labels = {
      nuclear_threat: "Nukleer Tehdit",
      military_conflict: "Askeri Catisma",
      terror_attack: "Teror Saldirisi",
      civil_unrest: "Sivil Huzursuzluk",
      diplomatic_crisis: "Diplomatik Kriz",
      catastrophic_disaster: "Katastrofik Felaket",
      natural_disaster: "Dogal Afet",
      climate_anomaly: "Iklim Anomalisi",
    };
    return labels[cat] || cat;
  }

  // ============================================================
  // MARKER OLUSTURMA
  // ============================================================
  function createMarker(article) {
    const color = getRiskColor(article);
    const radius = Math.max(4, Math.min(18, article.liveRiskScore * 0.18));
    const opacity = Math.max(0.15, article.decayFactor || 0.8);

    const marker = L.circleMarker(article.coordinates, {
      radius,
      fillColor: color,
      color: "#ffffff",
      weight: article.isHotspot ? 1.5 : 0.5,
      opacity,
      fillOpacity: opacity * 0.8,
      className: article.isHotspot ? "hotspot-pulse" : "",
    });

    const popup = `
      <div style="padding:2px;min-width:220px;">
        <span style="font-size:9px;text-transform:uppercase;color:#94a3b8;">
          ${article.source} · ${getCategoryLabel(article.category)}
        </span>
        <h4 style="margin:5px 0;color:#f8fafc;font-size:13px;">${article.title || ""}</h4>
        <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:1.4;">${(article.description || "").slice(0, 150)}</p>
        <div style="margin-top:7px;border-top:1px solid #334155;padding-top:5px;display:flex;justify-content:space-between;">
          <span style="color:#ef4444;font-weight:bold;font-size:11px;">Risk: ${article.liveRiskScore}/100</span>
          <span style="color:#64748b;font-size:10px;">${article.timestamp ? new Date(article.timestamp).toLocaleDateString() : ""}</span>
        </div>
      </div>`;

    marker.bindPopup(popup, { maxWidth: 300, className: "v4-popup" });
    return marker;
  }

  // ============================================================
  // VERI YUKLEME
  // ============================================================
  let allArticles = [];

  async function loadData() {
    try {
      const resp = await fetch("data/news-v4.json");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      allArticles = await resp.json();
      renderAll();
      updateStats();
      document.getElementById("last-update").textContent =
        new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("news-v4.json yuklenemedi:", e.message);
      document.getElementById("last-update").textContent = "Veri yok";
    }
  }

  function renderAll() {
    physicalRiskLayer.clearLayers();
    socioPoliticalLayer.clearLayers();

    allArticles.forEach((article) => {
      const marker = createMarker(article);
      if (article.macroLayer === "physical") {
        marker.addTo(physicalRiskLayer);
      } else {
        marker.addTo(socioPoliticalLayer);
      }
    });
  }

  function updateStats() {
    document.getElementById("stat-total").textContent = allArticles.length;
    document.getElementById("stat-hotspot").textContent = allArticles.filter(
      (a) => a.isHotspot
    ).length;
  }

  // ============================================================
  // LAYER TOGGLE
  // ============================================================
  window.toggleLayer = function (layer, visible) {
    if (layer === "physical") {
      visible ? physicalRiskLayer.addTo(map) : map.removeLayer(physicalRiskLayer);
    } else {
      visible ? socioPoliticalLayer.addTo(map) : map.removeLayer(socioPoliticalLayer);
    }
  };

  window.refreshData = function () {
    document.getElementById("last-update").textContent = "Yukleniyor...";
    loadData();
  };

  // ============================================================
  // LEGEND
  // ============================================================
  function buildLegend() {
    const el = document.getElementById("legend");
    const items = [
      { color: "#ff0055", label: "Kritik (>75)" },
      { color: "#ff9900", label: "Yuksek (40-75)" },
      { color: "#ffea00", label: "Orta (<40)" },
      { color: "#00ffcc", label: "Cevresel" },
    ];
    el.innerHTML = items
      .map(
        (i) =>
          `<div class="legend-row"><span class="legend-dot" style="background:${i.color}"></span> ${i.label}</div>`
      )
      .join("");
  }

  // ============================================================
  // INIT
  // ============================================================
  buildLegend();
  loadData();
})();

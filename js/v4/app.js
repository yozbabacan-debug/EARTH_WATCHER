/**
 * Earth Watcher v4 — Frontend App
 * News Ticker + 2 Master Layers + Risk/Time Sliders + Satellite Recon
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
  // STATE
  // ============================================================
  let globalArticles = [];
  let currentRiskThreshold = 0;
  let currentTimeFilterDays = 7;

  // ============================================================
  // CATEGORY + COLOR HELPERS
  // ============================================================
  function getCatLabel(cat) {
    const m = { nuclear_threat:"Nukleer", military_conflict:"Catisma", terror_attack:"Teror",
      civil_unrest:"Protesto", diplomatic_crisis:"Diplomasi", catastrophic_disaster:"Felaket",
      natural_disaster:"Dogal Afet", climate_anomaly:"Iklim" };
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
    globalArticles.forEach(a => {
      const days = Math.abs(now - new Date(a.timestamp)) / 86400000;
      if (days > currentTimeFilterDays) return;
      if (a.liveRiskScore < currentRiskThreshold) return;
      visible++;
      const color = riskColor(a);
      const r = Math.max(3, Math.min(16, a.liveRiskScore * 0.18));
      const op = Math.max(0.15, a.decayFactor || 0.8);
      const m = L.circleMarker(a.coordinates, {
        radius:r, fillColor:color, color:"#fff",
        weight:a.isHotspot?1.5:0.3, opacity:op, fillOpacity:op*0.8
      });
      const pop = `<div style="padding:2px;min-width:200px">
        <span style="font-size:9px;text-transform:uppercase;color:#94a3b8">${a.source} · ${getCatLabel(a.category)}</span>
        <h4 style="margin:4px 0;color:#f8fafc;font-size:13px">${a.title||""}</h4>
        <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:1.4">${(a.description||"").slice(0,130)}</p>
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
    if (!globalArticles.length) { el.innerHTML = "🌍 Veri bekleniyor..."; return; }
    const top = globalArticles.filter(a => a.liveRiskScore > 50).slice(0, 15);
    if (!top.length) { el.innerHTML = globalArticles.slice(0,10).map(a => `${a.source}: ${(a.title||"").slice(0,60)}`).join(" &nbsp;·&nbsp; "); return; }
    el.innerHTML = top.map(a => {
      const cls = a.liveRiskScore > 75 ? "risk-high" : "risk-mid";
      return `<b class="${cls}">[${a.liveRiskScore}]</b> ${a.source}: ${(a.title||"").slice(0,70)}`;
    }).join(" &nbsp;·&nbsp; ");
  }

  function updateStats() {
    document.getElementById("stat-total").textContent = globalArticles.length;
    document.getElementById("stat-hotspot").textContent = globalArticles.filter(a=>a.isHotspot).length;
  }

  // ============================================================
  // VERI YUKLEME
  // ============================================================
  async function loadData() {
    try {
      const r = await fetch("data/news-v4.json");
      if (!r.ok) throw new Error("HTTP "+r.status);
      globalArticles = await r.json();
      updateStats();
      updateTicker();
      updateMapLayers();
      document.getElementById("last-update").textContent = new Date().toLocaleTimeString();
    } catch(e) {
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
  if (riskSlider) riskSlider.addEventListener("input", function(e) {
    currentRiskThreshold = parseInt(this.value);
    riskLabel.textContent = "Min Risk: "+currentRiskThreshold+"/100";
    updateMapLayers();
  });
  if (timeSlider) timeSlider.addEventListener("input", function(e) {
    currentTimeFilterDays = parseInt(this.value);
    timeLabel.textContent = currentTimeFilterDays===1 ? "Zaman: Son 24 Saat" : "Zaman: Son "+currentTimeFilterDays+" Gun";
    updateMapLayers();
  });

  // ============================================================
  // SATELLITE RECON (Mapbox free tier)
  // ============================================================
  window.satelliteRecon = function(lat, lng) {
    map.closePopup();
    const MAPBOX_TOKEN = "YOUR_MAPBOX_TOKEN";
    const pulse = L.circleMarker([lat,lng], {
      radius:8, fillColor:"#00ffcc", color:"#00ffcc",
      weight:2, opacity:0.8, fillOpacity:0.3, className:"satellite-scan-pulse"
    }).addTo(map);

    const popup = L.popup({ maxWidth:330, className:"ew-recon-popup" })
      .setLatLng([lat,lng])
      .setContent(`<div style="padding:12px;width:280px;text-align:center">
        <div class="intel-spinner"></div>
        <p style="margin:8px 0 0;color:#00ffcc;font-size:11px;font-weight:bold">🛰️ Taktik Uydu Taramasi...</p>
        <span style="color:#64748b;font-size:10px">${lat.toFixed(4)}, ${lng.toFixed(4)}</span></div>`)
      .openOn(map);

    setTimeout(() => {
      map.removeLayer(pulse);
      const imgUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},15,0/400x300@2x.png?access_token=${MAPBOX_TOKEN}`;
      popup.setContent(`<div style="padding:4px;width:290px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;text-transform:uppercase;color:#00ffcc;font-weight:bold">🛰️ GEOINT // Uydu Kesif</span>
          <span style="font-size:9px;color:#ef4444;background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px">Kritik Alan</span></div>
        <div style="border:1px solid rgba(0,255,204,0.2);border-radius:6px;overflow:hidden;height:180px;background:#0f172a">
          <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" alt="Satellite" onerror="this.parentElement.innerHTML='<div style=color:#94a3b8;text-align:center;padding-top:70px>Uydu goruntusu yuklenemedi</div>'">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(0,255,204,0.3);font-size:22px;pointer-events:none">+</div></div>
        <div style="margin-top:6px;font-size:10px;color:#64748b">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div></div>`);
    }, 1000);
  };

  // ============================================================
  // MAP RIGHT-CLICK → Satellite Recon
  // ============================================================
  map.getContainer().addEventListener("contextmenu", function(e) { e.preventDefault(); });
  map.on("contextmenu", function(e) {
    satelliteRecon(e.latlng.lat, e.latlng.lng);
  });

  // ============================================================
  // LAYER TOGGLE + REFRESH
  // ============================================================
  window.toggleLayer = function(layer, visible) {
    if (layer==="physical") visible ? physicalRiskLayer.addTo(map) : map.removeLayer(physicalRiskLayer);
    else visible ? socioPoliticalLayer.addTo(map) : map.removeLayer(socioPoliticalLayer);
  };
  window.refreshData = function() {
    document.getElementById("last-update").textContent = "Yukleniyor...";
    loadData();
  };

  // ============================================================
  // LEGEND
  // ============================================================
  (function(){
    document.getElementById("legend").innerHTML = [
      {c:"#ff0055",l:"Kritik (>75)"},{c:"#ff9900",l:"Yuksek (40-75)"},
      {c:"#ffea00",l:"Orta (<40)"},{c:"#00ffcc",l:"Cevresel"}
    ].map(i=>`<div class="legend-row"><span class="legend-dot" style="background:${i.c}"></span> ${i.l}</div>`).join("");
  })();

  // ============================================================
  // INIT
  // ============================================================
  loadData();
})();

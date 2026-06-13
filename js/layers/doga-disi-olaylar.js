/**
 * Earth Watcher — Layer 4: Doğa Dışı Olaylar
 * Yangın, sel, endüstriyel kazalar (NASA FIRMS + EONET)
 */

let nonNaturalMarkers = [];
let nonNaturalTimer = null;
let nonNaturalRefresh = 5;
let selectedNonNaturalTypes = ["wildfire", "flood", "industrial", "accident"];

const NON_NATURAL_TYPES = [
  { id: "wildfire", name: "Yangın", icon: "🔥", color: "#f97316" },
  { id: "flood", name: "Sel", icon: "🌊", color: "#3b82f6" },
  { id: "industrial", name: "Endüstriyel", icon: "🏭", color: "#92400e" },
  { id: "accident", name: "Kaza", icon: "⚠️", color: "#dc2626" },
  { id: "explosion", name: "Patlama", icon: "💥", color: "#ea580c" },
  { id: "oil_spill", name: "Petrol Sızıntısı", icon: "🛢️", color: "#1e293b" },
];

function initDogaDisiOlaylarLayer(map) {
  console.log("🔥 Doğa dışı olaylar katmanı başlatılıyor...");

  updateNonNaturalSlider();
  showNonNaturalTicker();
  fetchNonNaturalEvents(map);
  startNonNaturalRefresh(map);
}

function destroyDogaDisiOlaylarLayer(map) {
  console.log("🔥 Doğa dışı olaylar katmanı temizleniyor...");

  clearNonNaturalMarkers(map);
  if (nonNaturalTimer) {
    clearInterval(nonNaturalTimer);
    nonNaturalTimer = null;
  }
  hideNonNaturalTicker();
  restoreNonNaturalSlider();
}

// ============================================================
// SLIDER (SLD 4 — Üst Sağ)
// ============================================================

function updateNonNaturalSlider() {
  const body = document.querySelector("#slider-top-right .slider-body");
  if (!body) return;
  const title = document.querySelector("#slider-top-right .slider-content h3");
  if (title) {
    const layerName =
      typeof __ === "function"
        ? __("layers.doga-disi-olaylar")
        : "Doğa Dışı Olaylar";
    title.textContent = `🔥 ${layerName}`;
  }

  const arrow = document.querySelector(".arrow-top-right");
  const slider = document.getElementById("slider-top-right");
  if (slider && arrow && !slider.classList.contains("active")) {
    slider.classList.add("active");
    arrow.textContent = "▲";
  }

  let html = '<div class="disaster-filters">';
  html +=
    '<div class="filter-section"><div class="filter-title">' +
    (typeof __ === "function" ? __("ui.filter.eventType") : "Olay Türü") +
    "</div>";

  NON_NATURAL_TYPES.forEach((t) => {
    const checked = selectedNonNaturalTypes.includes(t.id) ? "checked" : "";
    html += `<label class="layer-item disaster-filter">`;
    html += `<input type="checkbox" class="disaster-checkbox" data-type="${t.id}" ${checked} />`;
    html += `<span class="disaster-icon">${t.icon}</span>`;
    html += `<span class="layer-name">${t.name}</span></label>`;
  });

  html +=
    '</div><div class="filter-section"><div class="filter-title">' +
    (typeof __ === "function" ? __("ui.filter.refresh") : "Yenileme") +
    "</div>";
  html += '<div class="refresh-control">';
  html += `<input type="range" class="refresh-slider" min="1" max="30" value="${nonNaturalRefresh}" />`;
  html += `<span class="refresh-label">${nonNaturalRefresh} dk</span>`;
  html += "</div></div></div>";
  body.innerHTML = html;

  // Event listeners
  body.querySelectorAll(".disaster-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const t = e.target.dataset.type;
      if (e.target.checked) {
        if (!selectedNonNaturalTypes.includes(t))
          selectedNonNaturalTypes.push(t);
      } else {
        selectedNonNaturalTypes = selectedNonNaturalTypes.filter(
          (x) => x !== t,
        );
      }
      const map = window.earthWatcherMap;
      if (map) {
        clearNonNaturalMarkers(map);
        fetchNonNaturalEvents(map);
      }
    });
  });
}

function restoreNonNaturalSlider() {
  const body = document.querySelector("#slider-top-right .slider-body");
  if (!body) return;
  const title = document.querySelector("#slider-top-right .slider-content h3");
  if (title) title.textContent = "Ayarlar";
  body.innerHTML = "";
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

function fetchNonNaturalEvents(map) {
  // NASA EONET'ten yangın ve sel olayları
  fetch(
    "https://eonet.gsfc.nasa.gov/api/v3/events?limit=30&category=wildfires,floods,severeStorms",
  )
    .then((r) => r.json())
    .then((data) => {
      if (!data.events) return;
      data.events.forEach((event) => {
        const cat = event.categories?.[0]?.id || "";
        let mapped = "wildfire";
        if (cat === "floods") mapped = "flood";
        else if (cat === "wildfires") mapped = "wildfire";
        else if (cat === "severeStorms") mapped = "accident";

        if (!selectedNonNaturalTypes.includes(mapped)) return;
        if (!event.geometry?.length) return;

        const g = event.geometry[0];
        const lat = g.coordinates[1],
          lng = g.coordinates[0];
        const typeInfo = NON_NATURAL_TYPES.find((t) => t.id === mapped);
        const color = typeInfo?.color || "#888";
        const icon = typeInfo?.icon || "🔥";

        const marker = L.circleMarker([lat, lng], {
          radius: 10,
          color,
          fillColor: color,
          fillOpacity: 0.5,
          weight: 2,
        });
        marker.bindTooltip(`${icon} <b>${event.title}</b>`, {
          direction: "top",
        });
        marker.on("click", () => marker.openTooltip());

        marker.addTo(map);
        nonNaturalMarkers.push(marker);

        // 20 saniye sonra kaybol
        setTimeout(() => {
          try {
            map.removeLayer(marker);
          } catch (e) {}
          nonNaturalMarkers = nonNaturalMarkers.filter((m) => m !== marker);
        }, 20000);

        // Ticker
        addNonNaturalToTicker(`${icon} ${event.title}`);
      });
    })
    .catch((err) => console.error("❌ Doğa dışı verisi alınamadı:", err));
}

function clearNonNaturalMarkers(map) {
  nonNaturalMarkers.forEach((m) => map.removeLayer(m));
  nonNaturalMarkers = [];
}

function startNonNaturalRefresh(map) {
  if (nonNaturalTimer) clearInterval(nonNaturalTimer);
  nonNaturalTimer = setInterval(
    () => {
      clearNonNaturalMarkers(map);
      fetchNonNaturalEvents(map);
    },
    nonNaturalRefresh * 60 * 1000,
  );
}

// ============================================================
// TICKER
// ============================================================

function showNonNaturalTicker() {
  // Önceki katmanın olaylarını temizle
  if (typeof clearTickerEvents === "function") {
    clearTickerEvents();
  }

  // Ticker animasyonunu başlat
  if (typeof showTicker === "function") {
    showTicker();
  } else {
    const ticker = document.getElementById("event-ticker");
    if (ticker) ticker.style.display = "flex";
  }
}

function hideNonNaturalTicker() {
  // Başka katman açık değilse ticker'ı gizle
  if (typeof updateTickerVisibility === "function") {
    updateTickerVisibility();
  }
}

function addNonNaturalToTicker(text) {
  if (typeof addEventToTicker === "function") {
    addEventToTicker(text);
  }
}

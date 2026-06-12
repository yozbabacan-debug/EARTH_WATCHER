/**
 * Earth Watcher — Ana Giriş Noktası
 * Phase 1: Harita + Slider UI + Data Manager başlatma
 */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌍 Earth Watcher başlatılıyor...");

  // 1. Verileri yükle
  if (window.dataManager) {
    await window.dataManager.load();
    console.log("📊 Özet:", window.dataManager.getSummary());
  }

  // 2. Haritayı başlat
  initMap();

  // 3. Slider UI'ı başlat
  if (typeof initSliderUI === "function") {
    initSliderUI();
  }

  // 4. Kaydedilmiş dili uygula
  if (typeof setLanguage === "function") {
    setLanguage(window.currentLang);
  }

  console.log("✅ Earth Watcher hazır");
});

function initMap() {
  const map = L.map("map", {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: true,
    worldCopyJump: true,
    maxBounds: [
      [-85, -Infinity],
      [85, Infinity],
    ],
    maxBoundsViscosity: 1.0,
  });

  // OpenStreetMap — en güvenilir, tüm tile'lar gelir
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // Global referans
  window.earthWatcherMap = map;
  window.earthWatcher = {
    map,
    currentLayer: "temel",
    dataManager: window.dataManager,
    Icons: window.Icons,
    activeLayers: { temel: true },
    weatherActive: false,
    showWeatherIfNeeded: function () {
      const weatherLayers = [
        "dogal-olaylar",
        "doga-disi-olaylar",
        "siyasi-olaylar",
      ];
      const shouldShow = weatherLayers.some(
        (l) => window.earthWatcher.activeLayers[l],
      );
      const map = window.earthWatcherMap;

      if (shouldShow && !window.earthWatcher.weatherActive) {
        window.earthWatcher.weatherActive = true;
        if (typeof showWeatherOverlay === "function") {
          showWeatherOverlay(map);
        }
      } else if (!shouldShow && window.earthWatcher.weatherActive) {
        window.earthWatcher.weatherActive = false;
        if (typeof hideWeatherOverlay === "function") {
          hideWeatherOverlay(map);
        }
      }
    },
    onLayerToggle: function (layerId, isChecked) {
      console.log(`🔀 Katman değişti: ${layerId} = ${isChecked}`);
      window.earthWatcher.activeLayers[layerId] = isChecked;

      if (layerId === "cografi") {
        if (isChecked) {
          if (typeof initCografiLayer === "function") {
            initCografiLayer(map);
          }
        } else {
          if (typeof destroyCografiLayer === "function") {
            destroyCografiLayer(map);
          }
        }
      }

      if (layerId === "dogal-olaylar") {
        // Doğrudan SLD 4 içeriğini ayarla (fallback)
        const sld4body = document.querySelector(
          "#slider-top-right .slider-body",
        );
        const sld4title = document.querySelector(
          "#slider-top-right .slider-content h3",
        );

        if (isChecked) {
          if (sld4title) sld4title.textContent = "🌊 Doğal Olaylar";
          if (sld4body) {
            sld4body.innerHTML = `
              <div class="disaster-filters">
                <div class="filter-section">
                  <div class="filter-title">Afet Türü</div>
                  <label class="layer-item disaster-filter">
                    <input type="checkbox" class="disaster-checkbox" checked />
                    <span class="disaster-icon">🔴</span>
                    <span class="layer-name">Deprem</span>
                  </label>
                  <label class="layer-item disaster-filter">
                    <input type="checkbox" class="disaster-checkbox" checked />
                    <span class="disaster-icon">🔵</span>
                    <span class="layer-name">Su Baskını</span>
                  </label>
                </div>
                <div class="filter-section">
                  <div class="filter-title">Yenileme</div>
                  <div class="refresh-control">
                    <input type="range" class="refresh-slider" min="1" max="30" value="5" />
                    <span class="refresh-label">5 dk</span>
                  </div>
                </div>
              </div>
            `;
          }
          // SLD 4'ü aç
          const arrow4 = document.querySelector(".arrow-top-right");
          const slider4 = document.getElementById("slider-top-right");
          if (slider4 && arrow4 && !slider4.classList.contains("active")) {
            slider4.classList.add("active");
            arrow4.textContent = "▲";
          }

          // Ticker'ı doğrudan göster
          const ticker = document.getElementById("event-ticker");
          if (ticker) {
            ticker.style.display = "flex";
            console.log("📋 Ticker main.js'den gösterildi");
          }

          if (typeof initDogalOlaylarLayer === "function") {
            initDogalOlaylarLayer(map);
          }
        } else {
          if (sld4title) sld4title.textContent = "Ayarlar";
          if (sld4body) sld4body.innerHTML = "";
          const arrow4 = document.querySelector(".arrow-top-right");
          const slider4 = document.getElementById("slider-top-right");
          if (slider4 && arrow4 && slider4.classList.contains("active")) {
            slider4.classList.remove("active");
            arrow4.textContent = "▼";
          }

          if (typeof destroyDogalOlaylarLayer === "function") {
            destroyDogalOlaylarLayer(map);
          }
        }
      }

      if (layerId === "doga-disi-olaylar") {
        if (isChecked) {
          if (typeof initDogaDisiOlaylarLayer === "function") {
            initDogaDisiOlaylarLayer(map);
          }
        } else {
          if (typeof destroyDogaDisiOlaylarLayer === "function") {
            destroyDogaDisiOlaylarLayer(map);
          }
        }
      }

      if (layerId === "siyasi-olaylar") {
        if (isChecked) {
          if (typeof initSiyasiOlaylarLayer === "function") {
            initSiyasiOlaylarLayer(map);
          }
        } else {
          if (typeof destroySiyasiOlaylarLayer === "function") {
            destroySiyasiOlaylarLayer(map);
          }
        }
      }

      if (layerId === "uydular") {
        if (isChecked) {
          if (typeof initUydularLayer === "function") {
            initUydularLayer(map);
          }
        } else {
          if (typeof destroyUydularLayer === "function") {
            destroyUydularLayer(map);
          }
        }
      }

      if (layerId === "ucus") {
        if (isChecked) {
          if (typeof initUcusLayer === "function") {
            initUcusLayer(map);
          }
        } else {
          if (typeof destroyUcusLayer === "function") {
            destroyUcusLayer(map);
          }
        }
      }

      if (layerId === "gemi") {
        if (isChecked) {
          if (typeof initGemiLayer === "function") {
            initGemiLayer(map);
          }
        } else {
          if (typeof destroyGemiLayer === "function") {
            destroyGemiLayer(map);
          }
        }
      }

      // Hava durumu overlay'ini kontrol et (Doğal Olaylar / Doğa Dışı / Siyasi)
      window.earthWatcher.showWeatherIfNeeded();
    },
  };

  // Temel katmanı başlat
  if (typeof initTemelLayer === "function") {
    initTemelLayer(map);
  }

  console.log("✅ Harita yüklendi");
}

/**
 * Earth Watcher v2 — Enterprise Core Map Engine
 *
 * Merkezi harita motoru. Haritayı başlatır, canvas render kullanır,
 * katmanları orkestre eder, ve performans yardımcılarını sağlar.
 *
 * Tüm katmanlar izole IIFE modülleridir — bu motor üzerinden kaydedilir.
 */

const EarthWatcher = (function () {
  // ============================================================
  // ÖZEL DEĞİŞKENLER (Dışarıdan erişilemez)
  // ============================================================
  let _map = null;
  const _activeLayers = new Set();
  const _layerRegistry = {};

  // ============================================================
  // YARDIMCI ARAÇLAR
  // ============================================================
  function _debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============================================================
  // ANA API (Dışarıya açık)
  // ============================================================
  const API = {
    // --- HARİTA ---
    get map() {
      return _map;
    },

    init: function (divId) {
      console.log("🚀 [Earth Watcher Core] Profesyonel Harita Motoru başlatılıyor...");

      // Canvas renderer: DOM yerine vektörel çizim (pro performans)
      _map = L.map(divId, {
        renderer: L.canvas({ tolerance: 5 }),
        zoomControl: true,
        preferCanvas: true,
      });

      // OpenStreetMap tile — en güvenilir
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(_map);

      // Hari̇ta sınırları (Sonsuz dünya kopyalanmasını engelle)
      _map.setMinZoom(2);
      _map.setMaxZoom(18);
      _map.setView([39.0, 35.0], 4); // Türkiye merkezli başlangıç

      const southWest = L.latLng(-85, -180);
      const northEast = L.latLng(85, 180);
      const bounds = L.latLngBounds(southWest, northEast);
      _map.setMaxBounds(bounds);
      _map.on("drag", function () {
        _map.panInsideBounds(bounds, { animate: false });
      });

      // Hari̇ta kaydırma debounce (API çağrılarını frenle)
      _map.on("moveend", _debounce(function () {
        API.triggerLayerUpdate();
      }, 400));

      console.log("✅ Earth Watcher Core hazir");
      window.earthWatcherMap = _map; // Geriye uyumluluk
      return _map;
    },

    // --- KATMAN YÖNETİMİ ---
    register: function (layerId, layerModule) {
      if (_layerRegistry[layerId]) {
        console.warn(`⚠️ [Core] ${layerId} zaten kayitli, uzerine yaziliyor`);
      }
      _layerRegistry[layerId] = layerModule;
      console.log(`📋 [Core] Katman kaydedildi: ${layerId}`);
    },

    toggleLayer: function (layerId) {
      const layer = _layerRegistry[layerId];
      if (!layer) {
        console.error(`❌ [Core] ${layerId}: kayitli degil!`);
        return;
      }

      if (_activeLayers.has(layerId)) {
        console.log(`🗑️ [Core] ${layerId} kapatiliyor...`);
        if (typeof layer.destroy === "function") {
          layer.destroy(_map);
        }
        _activeLayers.delete(layerId);
      } else {
        console.log(`🔌 [Core] ${layerId} aciliyor...`);
        if (typeof layer.init === "function") {
          layer.init(_map);
        }
        _activeLayers.add(layerId);
      }

      // Slider matrisini güncelle (kernel.js'de tanimli)
      if (typeof EarthWatcher.Kernel !== "undefined" && EarthWatcher.Kernel.routeMatrixUI) {
        EarthWatcher.Kernel.routeMatrixUI(layerId);
      }
    },

    isActive: function (layerId) {
      return _activeLayers.has(layerId);
    },

    getActiveLayers: function () {
      return new Set(_activeLayers);
    },

    destroyAll: function () {
      console.log("🗑️ [Core] Tum katmanlar temizleniyor...");
      _activeLayers.forEach(function (id) {
        const layer = _layerRegistry[id];
        if (layer && typeof layer.destroy === "function") {
          layer.destroy(_map);
        }
      });
      _activeLayers.clear();
    },

    // --- HARİTA OLAYI ---
    triggerLayerUpdate: function () {
      _activeLayers.forEach(function (id) {
        const layer = _layerRegistry[id];
        if (layer && typeof layer.onMapMove === "function") {
          layer.onMapMove(_map);
        }
      });
    },

    // --- YARDIMCI ARAÇLAR ---
    utils: {
      debounce: _debounce,
    },
  };

  return API;
})();

// Global namespace (window.EarthWatcher)
window.EarthWatcher = EarthWatcher;

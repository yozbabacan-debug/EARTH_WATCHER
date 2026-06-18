/**
 * Earth Watcher v2 — Ana Giriş Noktası (Enterprise)
 * Yeni mimari: EarthWatcher.init() + Kernel.boot() + katman kaydi
 */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌍 Earth Watcher v2 başlatılıyor...");

  // 1. Verileri yükle
  if (window.dataManager) {
    await window.dataManager.load();
    console.log("📊 Özet:", window.dataManager.getSummary());
  }

  // 2. Haritayı başlat (Canvas renderer + sınırlar)
  const map = EarthWatcher.init("map");

  // 3. Kernel matrisini başlat (Slider otomasyonu)
  if (EarthWatcher.Kernel) {
    EarthWatcher.Kernel.boot();
  }

  // 4. Katmanları kaydet (her katman kendini register eder)
  _registerLayers(map);

  // 5. Kaydedilmiş dili uygula
  if (typeof setLanguage === "function") {
    setLanguage(window.currentLang);
  }

  // 6. Slider UI'ı başlat (eski sistem - gecis surecinde)
  if (typeof initSliderUI === "function") {
    initSliderUI();
  }

  console.log("✅ Earth Watcher v2 hazir");
});

/**
 * Tum katmanlari V2 formatinda kaydet
 * Her katman IIFE {init(map), destroy(map)} seklinde sarilmalidir.
 * Su an gecis doneminde — eski fonksiyonlari wrap ediyoruz.
 */
function _registerLayers(map) {
  // Temel Katman (zaten destroyTemelLayer var mi kontrol et)
  EarthWatcher.register("temel", {
    init: function (m) {
      if (typeof initTemelLayer === "function") initTemelLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyTemelLayer === "function") destroyTemelLayer(m);
    },
  });

  // Cografi Katman
  EarthWatcher.register("cografi", {
    init: function (m) {
      if (typeof initCografiLayer === "function") initCografiLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyCografiLayer === "function") destroyCografiLayer(m);
    },
  });

  // Dogal Olaylar
  EarthWatcher.register("dogal-olaylar", {
    init: function (m) {
      if (typeof initDogalOlaylarLayer === "function") initDogalOlaylarLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyDogalOlaylarLayer === "function")
        destroyDogalOlaylarLayer(m);
    },
  });

  // Doga Disi Olaylar
  EarthWatcher.register("doga-disi-olaylar", {
    init: function (m) {
      if (typeof initDogaDisiOlaylarLayer === "function")
        initDogaDisiOlaylarLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyDogaDisiOlaylarLayer === "function")
        destroyDogaDisiOlaylarLayer(m);
    },
  });

  // Siyasi Olaylar
  EarthWatcher.register("siyasi-olaylar", {
    init: function (m) {
      if (typeof initSiyasiOlaylarLayer === "function")
        initSiyasiOlaylarLayer(m);
    },
    destroy: function (m) {
      if (typeof destroySiyasiOlaylarLayer === "function")
        destroySiyasiOlaylarLayer(m);
    },
  });

  // Uydular
  EarthWatcher.register("uydular", {
    init: function (m) {
      if (typeof initUydularLayer === "function") initUydularLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyUydularLayer === "function") destroyUydularLayer(m);
    },
  });

  // Ucus
  EarthWatcher.register("ucus", {
    init: function (m) {
      if (typeof initUcusLayer === "function") initUcusLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyUcusLayer === "function") destroyUcusLayer(m);
    },
  });

  // Gemi
  EarthWatcher.register("gemi", {
    init: function (m) {
      if (typeof initGemiLayer === "function") initGemiLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyGemiLayer === "function") destroyGemiLayer(m);
    },
  });

  // Kameralar
  EarthWatcher.register("kameralar", {
    init: function (m) {
      if (typeof initKameraLayer === "function") initKameraLayer(m);
    },
    destroy: function (m) {
      if (typeof destroyKameraLayer === "function") destroyKameraLayer(m);
    },
  });

  // Eski onLayerToggle'ı yeni mimariye bagla
  window.earthWatcher = window.earthWatcher || {};
  if (!window.earthWatcher.onLayerToggle) {
    window.earthWatcher.onLayerToggle = function (layerId, isChecked) {
      EarthWatcher.toggleLayer(layerId);
    };
  }

  console.log("📋 Tum katmanlar V2 formatinda kaydedildi");

  // Temel katmani baslangicta aktif et
  if (!EarthWatcher.isActive("temel")) {
    EarthWatcher.toggleLayer("temel");
  }
}

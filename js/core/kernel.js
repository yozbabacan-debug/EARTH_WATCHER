/**
 * Earth Watcher v2 — Enterprise Slider Kernel (5 Slider Matrisi)
 *
 * SLD 1-5 arası tüm slider'ları katman durumuna göre otomatik yönetir.
 * Boş slider'ları gizler, aktif katmana göre uygun paneli açar.
 * CTRL+Y klavye kısayoluyla SLD 5 (detay paneli) hızlı erişim.
 */

EarthWatcher.Kernel = (function () {
  // ============================================================
  // DOM REFERANSLARI
  // ============================================================
  const SLD = {
    // SLD 1 — Sol Yan (Katman seçici)
    sld1: null,
    // SLD 2 — Üst Orta (Ayarlar/Genel Kontroller)
    sld2: null,
    // SLD 3 — Üst Sağ (Filtreler/Olay Türü)
    sld3: null,
    // SLD 4 — Sol Üst (Dil Seçimi)
    sld4: null,
    // SLD 5 — Sağ Yan (Detay Paneli)
    sld5: null,
  };

  let _currentLayer = "temel";
  let _cachedAsset = null; // CTRL+Y için önbellek

  // ============================================================
  // BAŞLATMA
  // ============================================================
  function boot() {
    console.log("🎛️ [Kernel] 5-Slider Matrisi başlatılıyor...");

    // DOM referanslarını al
    SLD.sld1 = document.getElementById("slider-left-top");
    SLD.sld2 = document.getElementById("slider-top-center");
    SLD.sld3 = document.getElementById("slider-top-right");
    SLD.sld4 = document.getElementById("slider-top-left");
    SLD.sld5 = document.getElementById("slider-right");

    // Klavye kısayollarını bağla
    _bindKeyboard();

    // Varsayılan temel durumu ayarla
    _route("temel");

    console.log("✅ Kernel hazir");
  }

  // ============================================================
  // KLVYE KISAYOLLARI
  // ============================================================
  function _bindKeyboard() {
    window.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        _openSld5();
      }
    });
  }

  function _openSld5() {
    if (!_cachedAsset) {
      _show("sld5", true);
      const body = document.querySelector("#slider-right .slider-body");
      if (body) {
        body.innerHTML = `<div class="enterprise-panel-container" style="padding:20px;color:#f8fafc;">
          <h4 style="color:#f59e0b">⚠️ HEDEF SEÇİLMEDİ</h4>
          <p style="font-size:0.85rem;color:#888">CTRL+Y kullanmadan önce haritada bir öğeye tıklayın.</p>
        </div>`;
      }
      return;
    }

    _show("sld5", true);
    const body = document.querySelector("#slider-right .slider-body");
    if (body && _cachedAsset) {
      body.innerHTML = `<div class="enterprise-panel-container" style="padding:20px;color:#f8fafc;">
        <h4 style="color:#22c55e;border-bottom:1px solid rgba(34,197,94,0.3);padding-bottom:8px;margin-bottom:12px;">⚡ HEDEF PROFILI</h4>
        <div style="font-size:0.85rem;line-height:1.8;">
          <div><span style="color:#888">Ad:</span> <strong>${_cachedAsset.name || _cachedAsset.title || "—"}</strong></div>
          <div><span style="color:#888">ID:</span> ${_cachedAsset.id || "—"}</div>
          <div><span style="color:#888">Konum:</span> ${_cachedAsset.lat?.toFixed(4) || "?"}, ${_cachedAsset.lng?.toFixed(4) || "?"}</div>
        </div>
      </div>`;
    }
  }

  // ============================================================
  // SLIDER YÖNETİMİ
  // ============================================================
  function _show(sldKey, open) {
    const slider = SLD[sldKey];
    if (!slider) return;

    if (open) {
      slider.classList.add("active");
      // Ok ikonlarını güncelle
      const arrow = _getArrow(sldKey);
      if (arrow) arrow.textContent = "▲";
    } else {
      slider.classList.remove("active");
      const arrow = _getArrow(sldKey);
      if (arrow) {
        if (sldKey === "sld1") arrow.textContent = "▶";
        else if (sldKey === "sld5") arrow.textContent = "◀";
        else arrow.textContent = "▼";
      }
    }
  }

  function _getArrow(sldKey) {
    const map = {
      sld1: ".arrow-left-top",
      sld2: ".arrow-top-center",
      sld3: ".arrow-top-right",
      sld4: ".arrow-top-left",
      sld5: ".arrow-right",
    };
    return document.querySelector(map[sldKey] || "");
  }

  function _resetAll() {
    Object.keys(SLD).forEach(function (key) {
      if (key !== "sld4") {
        // SLD 4 (katman listesi) her zaman açık kalabilir
        _show(key, false);
      }
    });
  }

  // ============================================================
  // TICKER YÖNETİMİ
  // ============================================================
  function _setTicker(show) {
    const ticker = document.getElementById("event-ticker");
    if (!ticker) return;
    ticker.style.display = show ? "flex" : "none";
  }

  // ============================================================
  // ANA ROUTER (Katmana göre slider konfigürasyonu)
  // ============================================================
  function _route(layerKey) {
    _currentLayer = layerKey;
    console.log(`🎛️ [Kernel] Matris yonlendiriliyor: ${layerKey}`);

    _resetAll();

    switch (layerKey) {
      case "temel":
        _show("sld4", true); // Katman listesi
        _setTicker(false);
        break;

      case "cografi":
        _show("sld4", true);
        _setTicker(true);
        break;

      case "dogal-olaylar":
      case "doga-disi-olaylar":
        _show("sld3", true); // Filtre/olay turu
        _show("sld4", true);
        _setTicker(true);
        break;

      case "siyasi-olaylar":
        _show("sld3", true); // Filtre
        _show("sld4", true);
        _setTicker(true);
        break;

      case "uydular":
      case "ucus":
      case "gemi":
        _show("sld3", true);
        _show("sld4", true);
        _setTicker(false);
        break;

      case "kameralar":
        _show("sld4", true);
        _setTicker(false);
        break;

      default:
        _show("sld4", true);
        _setTicker(false);
    }
  }

  // ============================================================
  // VARLIK ÖNBELLEĞİ (CTRL+Y için)
  // ============================================================
  function cacheAsset(payload) {
    _cachedAsset = payload;
    console.log("💾 [Kernel] Varlik onbellege alindi:", payload.name || payload.title);
  }

  // ============================================================
  // API
  // ============================================================
  return {
    boot: boot,
    routeMatrixUI: _route,
    cacheAsset: cacheAsset,
    get currentLayer() {
      return _currentLayer;
    },
    show: _show,
    setTicker: _setTicker,
  };
})();

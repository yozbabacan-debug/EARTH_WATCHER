/**
 * Earth Watcher — Dil / İ18N Sistemi
 * Çoklu dil desteği: UI metinleri, katman adları, olay türleri
 */

const LANGS = {
  tr: {
    name: "Türkçe",
    flag: "🇹🇷",
    meta: {
      sliderTitle: "Dil Seçimi",
      langLabel: "Dil",
    },
    ui: {
      layers: "Katmanlar",
      settings: "Ayarlar",
      details: "Detaylar",
      generalControls: "Genel Kontroller",
      coordinateLabel: "Koordinat",
    },
    layers: {
      temel: "Temel",
      cografi: "Coğrafi",
      "dogal-olaylar": "Doğal Olaylar",
      "doga-disi-olaylar": "Doğa Dışı Olaylar",
      "siyasi-olaylar": "Siyasi Olaylar",
      uydular: "Uydular",
      ucus: "Uçuş Bilgileri",
      gemi: "Gemi Bilgileri",
    },
    events: {
      earthquake: "Deprem",
      flood: "Su Baskını",
      volcano: "Yanardağ",
      storm: "Fırtına",
      wildfire: "Yangın",
      drought: "Kuraklık",
      extremeRain: "Aşırı Yağış",
      weather: "Hava Durumu",
    },
    ticker: {
      waiting: "🌍 Olaylar bekleniyor...",
      loading: "🌍 Olaylar yükleniyor...",
    },
  },

  en: {
    name: "English",
    flag: "🇬🇧",
    meta: {
      sliderTitle: "Language Selection",
      langLabel: "Language",
    },
    ui: {
      layers: "Layers",
      settings: "Settings",
      details: "Details",
      generalControls: "General Controls",
      coordinateLabel: "Coordinates",
    },
    layers: {
      temel: "Basic",
      cografi: "Geographic",
      "dogal-olaylar": "Natural Events",
      "doga-disi-olaylar": "Non-Natural Events",
      "siyasi-olaylar": "Political Events",
      uydular: "Satellites",
      ucus: "Flight Info",
      gemi: "Ship Info",
    },
    events: {
      earthquake: "Earthquake",
      flood: "Flood",
      volcano: "Volcano",
      storm: "Storm",
      wildfire: "Wildfire",
      drought: "Drought",
      extremeRain: "Extreme Rain",
      weather: "Weather",
    },
    ticker: {
      waiting: "🌍 Waiting for events...",
      loading: "🌍 Loading events...",
    },
  },

  fr: {
    name: "Français",
    flag: "🇫🇷",
    meta: {
      sliderTitle: "Sélection de la langue",
      langLabel: "Langue",
    },
    ui: {
      layers: "Couches",
      settings: "Paramètres",
      details: "Détails",
      generalControls: "Contrôles généraux",
      coordinateLabel: "Coordonnées",
    },
    layers: {
      temel: "Base",
      cografi: "Géographique",
      "dogal-olaylar": "Événements naturels",
      "doga-disi-olaylar": "Événements non naturels",
      "siyasi-olaylar": "Événements politiques",
      uydular: "Satellites",
      ucus: "Infos de vol",
      gemi: "Infos maritimes",
    },
    events: {
      earthquake: "Tremblement de terre",
      flood: "Inondation",
      volcano: "Volcan",
      storm: "Tempête",
      wildfire: "Incendie",
      drought: "Sécheresse",
      extremeRain: "Pluie extrême",
      weather: "Météo",
    },
    ticker: {
      waiting: "🌍 En attente d'événements...",
      loading: "🌍 Chargement des événements...",
    },
  },

  de: {
    name: "Deutsch",
    flag: "🇩🇪",
    meta: {
      sliderTitle: "Sprachauswahl",
      langLabel: "Sprache",
    },
    ui: {
      layers: "Ebenen",
      settings: "Einstellungen",
      details: "Details",
      generalControls: "Allgemeine Steuerung",
      coordinateLabel: "Koordinaten",
    },
    layers: {
      temel: "Basis",
      cografi: "Geografisch",
      "dogal-olaylar": "Naturereignisse",
      "doga-disi-olaylar": "Nicht-natürliche Ereignisse",
      "siyasi-olaylar": "Politische Ereignisse",
      uydular: "Satelliten",
      ucus: "Fluginformationen",
      gemi: "Schiffsinformationen",
    },
    events: {
      earthquake: "Erdbeben",
      flood: "Überschwemmung",
      volcano: "Vulkan",
      storm: "Sturm",
      wildfire: "Waldbrand",
      drought: "Dürre",
      extremeRain: "Extremregen",
      weather: "Wetter",
    },
    ticker: {
      waiting: "🌍 Warte auf Ereignisse...",
      loading: "🌍 Lade Ereignisse...",
    },
  },

  it: {
    name: "Italiano",
    flag: "🇮🇹",
    meta: {
      sliderTitle: "Selezione lingua",
      langLabel: "Lingua",
    },
    ui: {
      layers: "Livelli",
      settings: "Impostazioni",
      details: "Dettagli",
      generalControls: "Controlli generali",
      coordinateLabel: "Coordinate",
    },
    layers: {
      temel: "Base",
      cografi: "Geografico",
      "dogal-olaylar": "Eventi naturali",
      "doga-disi-olaylar": "Eventi non naturali",
      "siyasi-olaylar": "Eventi politici",
      uydular: "Satelliti",
      ucus: "Informazioni volo",
      gemi: "Informazioni navi",
    },
    events: {
      earthquake: "Terremoto",
      flood: "Alluvione",
      volcano: "Vulcano",
      storm: "Tempesta",
      wildfire: "Incendio",
      drought: "Siccità",
      extremeRain: "Pioggia estrema",
      weather: "Meteo",
    },
    ticker: {
      waiting: "🌍 In attesa di eventi...",
      loading: "🌍 Caricamento eventi...",
    },
  },
};

// Aktif dil — varsayılan Türkçe
let currentLang = "tr";

/**
 * Çeviri al — noktalı yol ile (örn: "layers.temel" veya "ui.layers")
 */
function __(key) {
  const keys = key.split(".");
  let val = LANGS[currentLang];
  for (const k of keys) {
    if (val && typeof val === "object" && k in val) {
      val = val[k];
    } else {
      // Fallback: İngilizce'de ara
      let fallback = LANGS["en"];
      for (const fk of keys) {
        if (fallback && typeof fallback === "object" && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return key;
        }
      }
      return fallback;
    }
  }
  return val;
}

/**
 * Dil değiştir
 */
function setLanguage(langCode) {
  if (!LANGS[langCode]) return;
  currentLang = langCode;

  // Tüm data-i18n elementlerini güncelle
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const translation = __(el.dataset.i18n);
    if (translation) el.textContent = translation;
  });

  // Slider başlıklarını güncelle
  document.querySelectorAll(".slider-content h3").forEach((h3) => {
    const key = h3.dataset.i18n;
    if (key) {
      const t = __(key);
      if (t) h3.textContent = t;
    }
  });

  // Katman listesini yeniden doldur (çevrilmiş adlarla)
  if (typeof populateLayerList === "function") {
    populateLayerList();
  }

  // Dil butonlarının aktiflik durumunu güncelle
  const langBtns = document.querySelectorAll(".lang-btn");
  langBtns.forEach((btn) => {
    const isActive = btn.dataset.lang === langCode;
    btn.classList.toggle("active", isActive);
    btn.style.background = isActive ? "rgba(34,197,94,0.2)" : "transparent";
  });

  // Dil seçimi slider başlığını güncelle
  const langSliderTitle = document.querySelector(
    "#slider-top-right .slider-content h3",
  );
  if (langSliderTitle) {
    langSliderTitle.textContent = __("meta.sliderTitle");
  }

  // Event'i tetikle — katmanlar ve diğer bileşenler dinleyebilir
  document.dispatchEvent(
    new CustomEvent("languageChanged", { detail: langCode }),
  );

  // localStorage'a kaydet
  try {
    localStorage.setItem("earth-watcher-lang", langCode);
  } catch (_) {}

  console.log(`🌐 Dil değiştirildi: ${langCode} (${LANGS[langCode].name})`);
}

/**
 * Dil seçici UI'ını SLD3'e (üst sağ slider) doldur
 */
function populateLangSelector() {
  const sliderBody = document.querySelector("#slider-top-right .slider-body");
  if (!sliderBody) return;

  let html =
    '<div class="lang-list" style="display:flex;flex-direction:column;gap:6px;">';

  Object.keys(LANGS).forEach((code) => {
    const lang = LANGS[code];
    const active = code === currentLang;
    html += `
      <button class="lang-btn ${active ? "active" : ""}" data-lang="${code}"
        style="display:flex;align-items:center;gap:10px;padding:8px 12px;
               border:1px solid rgba(34,197,94,0.3);border-radius:8px;
               background:${active ? "rgba(34,197,94,0.2)" : "transparent"};
               color:#f8fafc;cursor:pointer;font-size:0.9rem;
               transition:all 0.2s;width:100%;text-align:left;
               font-family:inherit;"
        onmouseenter="this.style.background='rgba(34,197,94,0.15)'"
        onmouseleave="this.style.background='${active ? "rgba(34,197,94,0.2)" : "transparent"}'">
        <span style="font-size:1.3rem;">${lang.flag}</span>
        <span>${lang.name}</span>
        <span style="margin-left:auto;font-size:0.75rem;opacity:0.5;text-transform:uppercase;">${code}</span>
      </button>
    `;
  });

  html += "</div>";
  sliderBody.innerHTML = html;

  // Butonlara tıklama dinleyicisi ekle
  sliderBody.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLanguage(btn.dataset.lang);
    });
  });
}

// Kaydedilmiş dili yükle
(function loadSavedLang() {
  try {
    const saved = localStorage.getItem("earth-watcher-lang");
    if (saved && LANGS[saved]) {
      currentLang = saved;
    }
  } catch (_) {}
})();

// Global erişim
window.__ = __;
window.LANGS = LANGS;
window.currentLang = currentLang;
window.setLanguage = setLanguage;
window.populateLangSelector = populateLangSelector;

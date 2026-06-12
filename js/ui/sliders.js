/**
 * Earth Watcher — Slider UI Controller
 * 5 slider'ın açılıp kapanmasını ve sol slider'daki katman listesini yönetir.
 */

const LAYERS = [
  { id: "temel", name: "Temel", icon: "globe" },
  { id: "cografi", name: "Coğrafi", icon: "mapPin" },
  { id: "dogal-olaylar", name: "Doğal Olaylar", icon: "natural" },
  { id: "doga-disi-olaylar", name: "Doğa Dışı Olaylar", icon: "wildfire" },
  { id: "siyasi-olaylar", name: "Siyasi Olaylar", icon: "political" },
  { id: "uydular", name: "Uydular", icon: "satellite" },
  { id: "ucus", name: "Uçuş Bilgileri", icon: "flight" },
  { id: "gemi", name: "Gemi Bilgileri", icon: "ship" },
];

function initSliderUI() {
  console.log("🔘 Slider UI başlatılıyor...");

  // Ok tıklamaları — sadece üst orta ve üst sol/sağ açılsın
  const arrows = document.querySelectorAll(".slider-arrow");
  arrows.forEach((arrow) => {
    // SLD 1 (sol yan) — tıklanabilir, aç/kapa yapılsın
    if (arrow.classList.contains("arrow-left-top")) {
      arrow.addEventListener("click", () => {
        const slider = document.getElementById("slider-left-top");
        if (!slider) return;
        const isActive = slider.classList.contains("active");
        if (isActive) {
          slider.classList.remove("active");
          arrow.textContent = "▶";
        } else {
          slider.classList.add("active");
          arrow.textContent = "◀";
        }
      });
      return;
    }

    // SLD 3 (üst orta) — hiç açılmasın
    if (arrow.classList.contains("arrow-top-center")) {
      return;
    }

    // SLD 5 (sağ yan) — sadece JS ile açılır, ok sadece kapatır
    if (arrow.classList.contains("arrow-right")) {
      arrow.addEventListener("click", () => {
        const slider = document.getElementById("slider-right");
        if (slider && slider.classList.contains("active")) {
          slider.classList.remove("active");
          arrow.textContent = "◀";
        }
      });
      return;
    }

    // Üst sliderlar (SLD 2 ve SLD 4) — tıklanabilir
    arrow.addEventListener("click", () => {
      const targetId = arrow.dataset.target;
      const slider = document.getElementById(targetId);
      if (!slider) return;

      const isActive = slider.classList.contains("active");
      if (isActive) {
        slider.classList.remove("active");
        restoreArrow(arrow);
      } else {
        slider.classList.add("active");
        arrow.textContent = "▲";
      }
    });
  });

  // Sol slider'a katman listesini doldur
  populateLayerList();

  console.log("✅ Slider UI hazır");
}

function populateLayerList() {
  const sliderBody = document.querySelector("#slider-top-left .slider-body");
  if (!sliderBody) return;

  // Başlığı güncelle
  const title = document.querySelector("#slider-top-left .slider-content h3");
  if (title) title.textContent = "Katmanlar";

  let html = '<div class="layer-list">';

  LAYERS.forEach((layer, index) => {
    const iconSvg = window.Icons[layer.icon] || "";
    const checked = index === 0 ? "checked" : ""; // Temel varsayılan açık
    html += `
      <label class="layer-item" data-layer="${layer.id}">
        <input type="checkbox" class="layer-checkbox" data-layer="${layer.id}" ${checked} />
        <span class="layer-icon">${iconSvg}</span>
        <span class="layer-name">${layer.name}</span>
      </label>
    `;
  });

  html += "</div>";
  sliderBody.innerHTML = html;

  // Checkbox değişim dinleyicileri
  document.querySelectorAll(".layer-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const layerId = e.target.dataset.layer;
      const isChecked = e.target.checked;
      console.log(`🔀 Katman değişti: ${layerId} = ${isChecked}`);
      // İleride burada katman aç/kapa fonksiyonu çağrılacak
      if (window.earthWatcher && window.earthWatcher.onLayerToggle) {
        window.earthWatcher.onLayerToggle(layerId, isChecked);
      }
    });
  });
}

function restoreArrow(arrow) {
  const cls = arrow.className;
  if (cls.includes("arrow-right")) arrow.textContent = "◀";
  else if (cls.includes("arrow-left")) arrow.textContent = "▶";
  else arrow.textContent = "▼";
}

/**
 * Yan sliderları programatik aç/kapa (sadece koşul sağlanırsa kullanılır)
 * @param {string} side — "right" veya "left"
 * @param {boolean} open — true = aç, false = kapa
 */
function toggleSideSlider(side, open) {
  const sliderId = side === "right" ? "slider-right" : "slider-left-top";
  const arrowSelector = side === "right" ? ".arrow-right" : ".arrow-left-top";

  const slider = document.getElementById(sliderId);
  const arrow = document.querySelector(arrowSelector);
  if (!slider || !arrow) return;

  if (open) {
    slider.classList.add("active");
    arrow.textContent = "▲";
  } else {
    slider.classList.remove("active");
    restoreArrow(arrow);
  }
}

// Global erişim — yan sliderlar programatik açılır
window.toggleSideSlider = toggleSideSlider;

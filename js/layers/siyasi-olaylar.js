/**
 * Earth Watcher — Layer 5: Siyasi Olaylar
 * Ayaklanma, ihtilal, seçim, savaş/terör, saldırı (Wikipedia API)
 */

let politicalMarkers = [];
let politicalTimer = null;
let politicalRefresh = 5;

const POLITICAL_TYPES = [
  { id: "protest", name: "Ayaklanma", icon: "✊", color: "#f59e0b" },
  { id: "coup", name: "İhtilal", icon: "⚔️", color: "#dc2626" },
  { id: "election", name: "Seçim", icon: "🗳️", color: "#3b82f6" },
  { id: "war", name: "Savaş/Terör", icon: "💣", color: "#991b1b" },
  { id: "attack", name: "Saldırı", icon: "🔪", color: "#be123c" },
  { id: "sanction", name: "Yaptırım", icon: "🚫", color: "#6b7280" },
  { id: "diplomacy", name: "Diplomasi", icon: "🤝", color: "#8b5cf6" },
];

function initSiyasiOlaylarLayer(map) {
  console.log("🏛️ Siyasi olaylar katmanı başlatılıyor...");

  updatePoliticalSlider();
  showPoliticalTicker();
  fetchPoliticalEvents(map);
  startPoliticalRefresh(map);
}

function destroySiyasiOlaylarLayer(map) {
  console.log("🏛️ Siyasi olaylar katmanı temizleniyor...");

  clearPoliticalMarkers(map);
  if (politicalTimer) {
    clearInterval(politicalTimer);
    politicalTimer = null;
  }
  hidePoliticalTicker();
  restorePoliticalSlider();
}

// ============================================================
// SLIDER (SLD 4 — Üst Sağ)
// ============================================================

function updatePoliticalSlider() {
  const body = document.querySelector("#slider-top-right .slider-body");
  if (!body) return;
  const title = document.querySelector("#slider-top-right .slider-content h3");
  if (title) {
    const layerName =
      typeof __ === "function" ? __("layers.siyasi-olaylar") : "Siyasi Olaylar";
    title.textContent = `🏛️ ${layerName}`;
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

  const selected = window._selectedPoliticalTypes || [
    "protest",
    "coup",
    "election",
    "war",
    "attack",
    "sanction",
    "diplomacy",
  ];
  POLITICAL_TYPES.forEach((t) => {
    const checked = selected.includes(t.id) ? "checked" : "";
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
  html += `<input type="range" class="refresh-slider" min="1" max="30" value="${politicalRefresh}" />`;
  html += `<span class="refresh-label">${politicalRefresh} dk</span>`;
  html += "</div></div></div>";
  body.innerHTML = html;

  body.querySelectorAll(".disaster-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const selected = window._selectedPoliticalTypes || [];
      const t = e.target.dataset.type;
      if (e.target.checked) {
        if (!selected.includes(t)) selected.push(t);
      } else {
        const idx = selected.indexOf(t);
        if (idx > -1) selected.splice(idx, 1);
      }
      window._selectedPoliticalTypes = selected;
      const map = window.earthWatcherMap;
      if (map) {
        clearPoliticalMarkers(map);
        fetchPoliticalEvents(map);
      }
    });
  });
}

function restorePoliticalSlider() {
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
// VERİ ÇEKME — Wikipedia On This Day
// ============================================================

function fetchPoliticalEvents(map) {
  // 1. Önce data/news.json'dan dene (RSS aggregator ciktisi)
  fetch("data/news.json")
    .then((r) => r.json())
    .then((data) => {
      if (data.articles && data.articles.length > 0) {
        console.log(`📰 news.json: ${data.articles.length} siyasi haber`);
        processPoliticalArticles(data.articles, map);
        return;
      }
      // 2. news.json yoksa canli API'lerden cek
      fetchLiveNews(map);
    })
    .catch(() => {
      fetchLiveNews(map);
    });
}

function fetchLiveNews(map) {
  const apiKey = window._newsApiKey || "7dfdd71112a44d58a3923c5357f4d814";
  fetchNewsAPIEvents(map, apiKey);
}

// Ortak fonksiyon — haber listesini markera çevir (news.json için)
function processPoliticalArticles(articles, map) {
  const selected = window._selectedPoliticalTypes || [
    "protest",
    "coup",
    "election",
    "war",
    "attack",
    "sanction",
    "diplomacy",
  ];
  let count = 0;
  let skipped = 0;

  articles.forEach((article) => {
    if (!selected.includes(article.type || "protest")) {
      skipped++;
      return;
    }
    const typeInfo = POLITICAL_TYPES.find(
      (t) => t.id === (article.type || "protest"),
    );
    const color = typeInfo?.color || "#888";
    const icon = typeInfo?.icon || "🏛️";
    const coords = [article.lat, article.lng];

    if (!coords || !coords[0]) {
      skipped++;
      return;
    }

    const marker = L.circleMarker(coords, {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.5,
      weight: 2,
    });
    marker.bindTooltip(
      `${icon} <b>${article.source || "?"}</b><br/>${article.title.substring(0, 80)}`,
      { direction: "top" },
    );
    marker.on("click", () => marker.openTooltip());
    marker.addTo(map);
    politicalMarkers.push(marker);

    setTimeout(() => {
      try {
        map.removeLayer(marker);
      } catch (e) {}
      politicalMarkers = politicalMarkers.filter((m) => m !== marker);
    }, 300000);

    addPoliticalToTicker(
      `${icon} ${article.source}: ${article.title.substring(0, 60)}`,
    );
    count++;
  });

  console.log(
    `📰 ${count}/${articles.length} siyasi haber haritaya islendi (${skipped} atlandi)`,
  );
  addEventToTicker(`📰 ${count} siyasi olay`);
}

function fetchNewsAPIEvents(map, apiKey) {
  const selected = window._selectedPoliticalTypes || [
    "protest",
    "coup",
    "election",
    "war",
    "attack",
    "sanction",
    "diplomacy",
  ];

  const gnewsKey = "a1af788dfad51b4fecf479c6b44a5323";
  const gnewsUrl = `https://gnews.io/api/v4/search?q=politics+OR+election+OR+protest+OR+war+OR+sanctions+OR+government+OR+diplomacy&lang=en&max=20&token=${gnewsKey}`;
  const newsUrl = `https://newsapi.org/v2/everything?q=politics+OR+protest+OR+war+OR+election+OR+diplomacy+OR+government&pageSize=15&language=en&sortBy=publishedAt&apiKey=${apiKey}`;

  // RSS feed'leri — rate limit icin 6 kaynak (kitalara gore)
  const rssFeeds = [
    {
      url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      name: "NYT",
    },
    { url: "https://tass.com/rss/v2.xml", name: "TASS" },
    { url: "https://www.scmp.com/rss/4/feed", name: "SCMP" },
    { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera" },
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC" },
    { url: "https://feeds.washingtonpost.com/rss/world", name: "WaPo" },
  ];

  // RSS'yi rss2json ile çek, 5sn timeout
  async function fetchRSS(url, name) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const r2j = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
        { signal: controller.signal },
      ).then((r) => r.json());
      clearTimeout(timeout);
      if (r2j.status === "ok" && r2j.items?.length) {
        console.log(`📰 ${name}: ${r2j.items.length} haber`);
        return { items: r2j.items, name };
      }
    } catch (_) {}
    return { items: [], name };
  }

  const rssPromises = rssFeeds.map((f) => fetchRSS(f.url, f.name));

  // GNews + NewsAPI + RSS paralel
  Promise.allSettled([fetch(gnewsUrl), fetch(newsUrl), ...rssPromises])
    .then(async (results) => {
      let articles = [];

      // 1. GNews
      const gRes = results[0];
      if (gRes.status === "fulfilled") {
        try {
          const data = await gRes.value.json();
          if (data.articles && data.articles.length) {
            data.articles.forEach((a) => {
              if (a.title) {
                articles.push({
                  title: a.title,
                  desc: (a.description || "").replace(/<[^>]*>/g, "").trim(),
                  source: a.source?.name || a.source?.title || "GNews",
                });
              }
            });
            console.log(`📰 GNews: ${data.articles.length} haber`);
          }
        } catch (e) {
          console.error("❌ GNews hatası:", e);
        }
      }

      // 2. NewsAPI (tarayıcıdan çalışmazsa sessizce geç)
      const nRes = results[1];
      if (nRes.status === "fulfilled") {
        try {
          const data = await nRes.value.json();
          if (data.articles && data.articles.length) {
            const existing = new Set(articles.map((a) => a.title));
            data.articles.forEach((a) => {
              if (a.title && !existing.has(a.title)) {
                articles.push({
                  title: a.title,
                  desc: (a.description || "").replace(/<[^>]*>/g, "").trim(),
                  source: a.source?.name || "NewsAPI",
                });
                existing.add(a.title);
              }
            });
            console.log(`📰 NewsAPI: ${data.articles.length} haber`);
          }
        } catch (e) {
          // NewsAPI browser'dan CORS hatası verir, sessizce geç
        }
      }

      // 3. RSS feed'leri (index 2, 3, 4)
      for (let i = 0; i < rssFeeds.length; i++) {
        const rRes = results[2 + i];
        if (rRes.status === "fulfilled") {
          const data = rRes.value;
          if (data.items && data.items.length) {
            const existing = new Set(articles.map((a) => a.title));
            data.items.forEach((item) => {
              if (item.title && !existing.has(item.title) && item.description) {
                articles.push({
                  title: item.title,
                  desc: (item.description || "").replace(/<[^>]*>/g, "").trim(),
                  source: data.name,
                });
                existing.add(item.title);
              }
            });
            console.log(`📰 RSS ${data.name}: ${data.items.length} haber`);
          }
        }
      }

      if (articles.length === 0) {
        console.log(
          "📰 Hiçbir kaynaktan haber alınamadı, bir sonraki yenileme bekleniyor...",
        );
        return;
      }

      // Sınırla (fazla marker olmasın)
      articles = articles.slice(0, 25);

      console.log(`📰 Toplam ${articles.length} canlı haber işleniyor...`);
      addEventToTicker(`📰 ${articles.length} canlı haber`);

      articles.forEach((article) => {
        const fullText = article.title + " " + (article.desc || "");
        const mappedType = categorizePoliticalEvent(fullText);
        if (!selected.includes(mappedType)) return;

        const typeInfo = POLITICAL_TYPES.find((t) => t.id === mappedType);
        const color = typeInfo?.color || "#888";
        const icon = typeInfo?.icon || "🏛️";

        const coords = extractCountryCoords(fullText);
        if (!coords) {
          // Kaynak bazlı yedek konum
          const fallbackCoords = {
            NYT: [40.7, -74.0],
            TASS: [55.8, 37.6],
            SCMP: [22.3, 114.2],
            "Al Jazeera": [25.3, 51.5],
            BBC: [51.5, -0.1],
            WaPo: [38.9, -77.0],
            GNews: [40.7, -74.0],
            NewsAPI: [40.7, -74.0],
          };
          const fallback = fallbackCoords[article.source] || [20.0, 0.0];
          // Yine de ekle, konum tam bilinmiyor uyarısıyla
          const marker = L.circleMarker(fallback, {
            radius: 6,
            color: "#888",
            fillColor: "#888",
            fillOpacity: 0.3,
            weight: 1,
          });
          marker.bindTooltip(
            `${icon} <b>${article.source}</b><br/>${article.title.substring(0, 80)}`,
            { direction: "top" },
          );
          marker.on("click", () => marker.openTooltip());
          marker.addTo(map);
          politicalMarkers.push(marker);

          setTimeout(() => {
            try {
              map.removeLayer(marker);
            } catch (e) {}
            politicalMarkers = politicalMarkers.filter((m) => m !== marker);
          }, 300000);

          addPoliticalToTicker(
            `${icon} ${article.source}: ${article.title.substring(0, 60)}`,
          );
          return;
        }

        const marker = L.circleMarker(coords, {
          radius: 8,
          color,
          fillColor: color,
          fillOpacity: 0.5,
          weight: 2,
        });
        marker.bindTooltip(
          `${icon} <b>${article.source}</b><br/>${article.title.substring(0, 80)}`,
          { direction: "top" },
        );
        marker.on("click", () => marker.openTooltip());
        marker.addTo(map);
        politicalMarkers.push(marker);

        setTimeout(() => {
          try {
            map.removeLayer(marker);
          } catch (e) {}
          politicalMarkers = politicalMarkers.filter((m) => m !== marker);
        }, 300000);

        addPoliticalToTicker(
          `${icon} ${article.source}: ${article.title.substring(0, 60)}`,
        );
      });
    })
    .catch((err) => console.error("❌ Siyasi haber API hatası:", err));
}

// Ülke/bölge adı + demonym'den koordinat bul (kapsamlı dünya haritası)
function extractCountryCoords(text) {
  const lower = text.toLowerCase();

  // == ÜLKELER / BÖLGELER (resmi ad, yaygın ad, demonym) ==
  const entries = [
    // --- Afrika ---
    ["south africa", "güney afrika", "s.africa"],
    [-30.0, 25.0],
    ["nigeria", "nijerya"],
    [9.0, 8.0],
    ["egypt", "mısır", "egyptian"],
    [27.0, 30.0],
    ["ethiopia", "etiopya", "ethiopian"],
    [9.0, 40.0],
    ["kenya", "kenyan"],
    [-1.0, 38.0],
    ["ghana", "ghanian"],
    [8.0, -2.0],
    ["morocco", "fas", "moroccan"],
    [31.0, -7.0],
    ["algeria", "cezayir", "algerian"],
    [28.0, 3.0],
    ["tunisia", "tunus", "tunisian"],
    [34.0, 9.0],
    ["libya", "libyan"],
    [26.0, 18.0],
    ["sudan", "sudanese"],
    [16.0, 30.0],
    ["somalia", "somali", "somalian"],
    [6.0, 47.0],
    ["angola", "angolan"],
    [-12.0, 18.0],
    ["mozambique", "mozambican"],
    [-18.0, 35.0],
    ["tanzania", "tanzanian"],
    [-6.0, 35.0],
    ["uganda", "ugandan"],
    [1.0, 32.0],
    ["cameroon", "kamerun", "cameroonian"],
    [6.0, 12.0],
    ["ivory coast", "côte d'ivoire", "fildişi"],
    [7.0, -5.0],
    ["senegal", "senegalese"],
    [14.0, -14.0],
    ["zimbabwe", "zimbabwean"],
    [-19.0, 30.0],
    ["zambia", "zambian"],
    [-15.0, 30.0],
    ["congo"],
    [-2.0, 22.0],
    ["rwanda", "ruanda", "rwandan"],
    [-2.0, 30.0],
    ["madagascar", "madagaskar", "malagasy"],
    [-20.0, 47.0],

    // --- Asya ---
    [
      "china",
      "çin",
      "chinese",
      "beijing",
      "xi jinping",
      "taiwan",
      "tayvan",
      "shanghai",
    ],
    [35.0, 105.0],
    ["india", "hindistan", "indian", "delhi", "modi", "mumbai"],
    [20.0, 78.0],
    ["indonesia", "endonezya", "indonesian"],
    [-5.0, 120.0],
    ["pakistan", "pakistani"],
    [30.0, 70.0],
    ["bangladesh", "bangladeş", "bangladeshi"],
    [24.0, 90.0],
    ["japan", "japonya", "japanese", "tokyo"],
    [36.0, 138.0],
    ["philippines", "filipinler", "filipino"],
    [13.0, 122.0],
    ["vietnam", "vietnamese"],
    [14.0, 108.0],
    ["thailand", "tayland", "thai"],
    [15.0, 101.0],
    ["myanmar", "burma"],
    [22.0, 96.0],
    ["south korea", "güney kore", "korean"],
    [36.0, 128.0],
    ["north korea", "kuzey kore"],
    [40.0, 127.0],
    ["taiwan", "tayvan"],
    [23.5, 121.0],
    ["malaysia", "malezya", "malaysian"],
    [4.0, 102.0],
    ["singapore", "singapur"],
    [1.3, 103.8],
    ["sri lanka", "sri lankan"],
    [7.0, 81.0],
    ["nepal", "nepali"],
    [28.0, 84.0],
    ["afghanistan", "afganistan", "afghan"],
    [33.0, 65.0],
    ["uzbekistan", "özbekistan", "uzbek"],
    [41.0, 64.0],
    ["kazakhstan", "kazakistan", "kazakh"],
    [48.0, 68.0],

    // --- Orta Doğu ---
    ["iran", "irank", "iranian", "persian"],
    [32.0, 53.0],
    ["turkey", "türkiye", "turkish", "türk", "ankara", "istanbul", "erdogan"],
    [39.0, 35.0],
    ["iraq", "ırak", "iraqi"],
    [33.0, 43.0],
    ["saudi arabia", "suudi arabistan", "saudi"],
    [24.0, 45.0],
    ["syria", "suria", "syrian"],
    [35.0, 39.0],
    ["yemen", "yemeni"],
    [15.0, 48.0],
    ["oman", "omani"],
    [21.0, 57.0],
    ["uae", "united arab emirates", "birleşik arap", "dubai", "abu dhabi"],
    [24.0, 54.0],
    ["qatar", "katar", "qatari"],
    [25.0, 51.0],
    ["kuwait", "kuveyt", "kuwaiti"],
    [29.0, 48.0],
    ["bahrain", "bahreyn", "bahraini"],
    [26.0, 50.5],
    ["jordan", "ürdün", "jordanian"],
    [31.0, 36.0],
    ["israel", "i̇srail", "israeli"],
    [31.0, 34.8],
    ["palestine", "filistin", "palestinian", "gaza", "west bank"],
    [31.9, 35.2],
    ["lebanon", "lübnan", "lebanese"],
    [34.0, 36.0],
    ["azerbaijan", "azerbaijani"],
    [40.0, 48.0],
    ["armenia", "ermenistan", "armenian"],
    [40.0, 45.0],
    ["georgia", "gürcistan", "georgian"],
    [42.0, 43.0],

    // --- Avrupa ---
    ["germany", "almanya", "german", "berlin", "scholz"],
    [51.0, 10.0],
    ["france", "fransa", "french", "paris", "macron"],
    [46.0, 2.0],
    [
      "united kingdom",
      "uk",
      "britain",
      "birleşik krallık",
      "british",
      "england",
      "ingiltere",
      "london",
      "westminster",
      "scotland",
      "i̇skoçya",
      "wales",
      "galleri",
    ],
    [55.0, -3.0],
    ["italy", "i̇talya", "italian"],
    [42.0, 12.0],
    ["spain", "i̇spanya", "spanish"],
    [40.0, -4.0],
    ["ukraine", "ukrayna", "ukrainian", "kyiv", "kiev"],
    [49.0, 31.0],
    ["belarus", "belarusian", "lukashenko", "minsk"],
    [53.9, 27.6],
    ["poland", "polonya", "polish", "warsaw"],
    [52.0, 19.0],
    ["romania", "romanya", "romanian", "bucharest"],
    [46.0, 25.0],
    ["netherlands", "hollanda", "dutch"],
    [52.0, 5.0],
    ["belgium", "belçika", "belgian"],
    [50.5, 4.5],
    ["greece", "yunani", "yunan", "greek"],
    [39.0, 22.0],
    ["portugal", "portekiz", "portuguese"],
    [39.5, -8.0],
    ["sweden", "i̇sveç", "swedish"],
    [62.0, 15.0],
    ["norway", "norveç", "norwegian"],
    [62.0, 10.0],
    ["denmark", "danimarka", "danish"],
    [56.0, 10.0],
    ["finland", "finlandiya", "finnish"],
    [64.0, 26.0],
    ["austria", "avusturya", "austrian"],
    [47.0, 14.0],
    ["switzerland", "i̇sviçre", "swiss"],
    [47.0, 8.0],
    ["ireland", "i̇rlanda", "irish"],
    [53.0, -8.0],
    ["hungary", "macaristan", "hungarian", "budapest", "orban"],
    [47.0, 19.0],
    ["czech", "çekya", "czech republic", "prague"],
    [50.0, 15.0],
    ["slovakia", "slovakya", "slovak", "bratislava"],
    [49.0, 19.5],
    ["bulgaria", "bulgaristan", "bulgarian", "sofia"],
    [43.0, 25.0],
    ["serbia", "sırbistan", "serbian", "belgrade", "vučić"],
    [44.0, 21.0],
    ["croatia", "hirvatistan", "croatian", "hrvatska"],
    [45.0, 16.0],
    ["bosnia", "bosna"],
    [44.0, 18.0],
    ["albania", "arnavutluk", "albanian"],
    [41.0, 20.0],
    ["lithuania", "litvanya", "lithuanian"],
    [55.0, 24.0],
    ["latvia", "letonya", "latvian"],
    [57.0, 25.0],
    ["estonia", "estonya", "estonian"],
    [59.0, 26.0],
    ["iceland", "i̇zlanda", "icelandic"],
    [65.0, -18.0],
    ["belarus", "beyaz rusya", "belarusian"],
    [53.0, 28.0],
    ["moldova", "moldovan"],
    [47.0, 28.5],
    ["cyprus", "kıbrıs", "cypriot"],
    [35.0, 33.0],
    ["malta", "maltese"],
    [35.9, 14.4],
    ["kosovo", "kosovan"],
    [42.6, 20.9],
    ["montenegro", "karadağ", "montenegrin"],
    [42.5, 19.3],
    ["macedonia", "makedonya", "macedonian"],
    [41.5, 21.7],
    ["slovenia", "slovenya", "slovenian"],
    [46.0, 15.0],
    ["luxembourg", "lüksemburg"],
    [49.6, 6.1],
    ["monaco", "monacan"],
    [43.7, 7.4],
    ["vatican"],
    [41.9, 12.5],
    [
      "europe",
      "eu",
      "european union",
      "avrupa birliği",
      "brussels",
      "strasbourg",
    ],
    [50.0, 10.0],
    ["russia", "rusya", "russian", "moscow", "kremlin", "putin"],
    [61.0, 40.0],

    // --- Kuzey Amerika ---
    ["united states", "usa", "america", "abd", "amerikan", "american"],
    [38.0, -97.0],
    ["canada", "kanada", "canadian"],
    [56.0, -106.0],
    ["mexico", "meksika", "mexican"],
    [23.0, -102.0],
    ["cuba", "cuban"],
    [22.0, -80.0],
    ["haiti", "haitian"],
    [19.0, -72.0],
    ["dominican republic", "dominik"],
    [19.0, -71.0],
    ["jamaica", "jamaican"],
    [18.0, -77.0],
    ["puerto rico", "porto riko"],
    [18.0, -66.5],
    ["guatemala", "guatemalan"],
    [15.0, -90.0],
    ["honduras", "honduran"],
    [14.0, -87.0],
    ["nicaragua", "nicaraguan"],
    [13.0, -85.0],
    ["costa rica", "kosta rika"],
    [10.0, -84.0],
    ["panama", "panamanian"],
    [9.0, -80.0],
    ["el salvador"],
    [14.0, -89.0],
    ["bahamas", "bahamian"],
    [25.0, -77.0],
    ["trinidad", "trinidadian"],
    [10.5, -61.5],

    // --- Güney Amerika ---
    ["brazil", "brezilya", "brazilian"],
    [-14.0, -53.0],
    ["argentina", "arjantin", "argentine"],
    [-38.0, -63.0],
    ["colombia", "kolombiya", "colombian"],
    [4.0, -73.0],
    ["venezuela", "venezuelan"],
    [8.0, -66.0],
    ["chile", "şili", "chilean"],
    [-35.0, -71.0],
    ["peru", "peruvian"],
    [-10.0, -76.0],
    ["ecuador", "ekvador", "ecuadorian"],
    [-1.0, -78.0],
    ["bolivia", "bolivya", "bolivian"],
    [-17.0, -65.0],
    ["paraguay", "paraguayan"],
    [-23.0, -58.0],
    ["uruguay", "uruguayan"],
    [-33.0, -56.0],
    ["guyana", "guyanese"],
    [5.0, -59.0],
    ["suriname"],
    [4.0, -56.0],

    // --- Okyanusya ---
    ["australia", "avustralya", "australian"],
    [-25.0, 135.0],
    ["new zealand", "yeni zelanda", "zealand"],
    [-41.0, 174.0],
    ["fiji", "fijian"],
    [-18.0, 178.0],
    ["papua new guinea", "papua"],
    [-6.0, 147.0],
    ["samoa", "samoan"],
    [-13.5, -172.0],

    // --- Uluslararası / Genel ---
    ["european union", "avrupa birliği", "eu"],
    [50.0, 10.0],
    ["nato"],
    [50.0, 10.0],
    ["united nations", "un", "birleşmiş milletler"],
    [40.7, -74.0],
    ["middle east", "orta doğu"],
    [30.0, 40.0],
    ["latin america", "latam", "güney amerika"],
    [-15.0, -60.0],
    ["africa", "afrika"],
    [0.0, 20.0],
    ["europe", "avrupa"],
    [50.0, 10.0],
    ["asia", "asya", "pacific"],
    [35.0, 100.0],
    ["baltic"],
    [57.0, 24.0],
    ["balkans", "balkanlar"],
    [44.0, 20.0],
    ["scandinavia", "scandinavian", "iskandinav"],
    [62.0, 15.0],
    ["siberia", "sibirya"],
    [60.0, 100.0],
    ["arctic", "arktik"],
    [80.0, 0.0],
    ["antarctic", "antarctica", "antarktika"],
    [-80.0, 0.0],

    // == BÜYÜK ŞEHİRLER ==
    ["london"],
    [51.5, -0.1],
    ["paris"],
    [48.9, 2.3],
    ["berlin"],
    [52.5, 13.4],
    ["moscow"],
    [55.8, 37.6],
    // Büyük şehir merkezleri + başkentler
    ["beijing"],
    [39.9, 116.4],
    ["washington", "white house", "capitol hill", "pentagon"],
    [38.9, -77.0],
    ["new york", "new york city", "nyc", "manhattan"],
    [40.7, -74.0],
    ["los angeles", "la"],
    [34.1, -118.2],
    ["tokyo"],
    [35.7, 139.7],
    ["delhi", "new delhi"],
    [28.6, 77.2],
    ["mumbai", "bombay"],
    [19.1, 72.9],
    ["kiev", "kyiv"],
    [50.5, 30.5],
    ["tehran"],
    [35.7, 51.4],
    ["riyadh"],
    [24.7, 46.7],
    ["ankara"],
    [39.9, 32.9],
    ["istanbul"],
    [41.0, 28.9],
    ["dubai"],
    [25.2, 55.3],
    ["hong kong"],
    [22.3, 114.2],
    ["shanghai"],
    [31.2, 121.5],
    ["sydney"],
    [-33.9, 151.2],
    ["melbourne"],
    [-37.8, 145.0],
    ["cairo"],
    [30.0, 31.2],
    ["cape town"],
    [-33.9, 18.4],
    ["nairobi"],
    [-1.3, 36.8],
    ["lagos"],
    [6.5, 3.4],
    ["accra"],
    [5.6, -0.2],
    ["sao paulo"],
    [-23.5, -46.6],
    ["buenos aires"],
    [-34.6, -58.4],
    ["mexico city"],
    [19.4, -99.1],
    ["toronto"],
    [43.7, -79.4],
    ["chicago"],
    [41.9, -87.6],
    ["san francisco"],
    [37.8, -122.4],
    ["seattle"],
    [47.6, -122.3],
    ["boston"],
    [42.4, -71.1],
    ["miami"],
    [25.8, -80.2],
    ["dallas"],
    [32.8, -96.8],
    ["houston"],
    [29.8, -95.4],
    ["atlanta"],
    [33.7, -84.4],
    ["denver"],
    [39.7, -105.0],
    ["las vegas"],
    [36.2, -115.1],
    ["rome"],
    [41.9, 12.5],
    ["milan"],
    [45.5, 9.2],
    ["barcelona"],
    [41.4, 2.2],
    ["madrid"],
    [40.4, -3.7],
    ["amsterdam"],
    [52.4, 4.9],
    ["brussels"],
    [50.9, 4.4],
    ["vienna"],
    [48.2, 16.4],
    ["prague"],
    [50.1, 14.4],
    ["warsaw"],
    [52.2, 21.0],
    ["stockholm"],
    [59.3, 18.1],
    ["oslo"],
    [59.9, 10.7],
    ["copenhagen"],
    [55.7, 12.6],
    ["helsinki"],
    [60.2, 24.9],
    ["dublin"],
    [53.3, -6.3],
    ["athens"],
    [38.0, 23.7],
    ["lisbon"],
    [38.7, -9.1],
    ["budapest"],
    [47.5, 19.1],
    ["bucharest"],
    [44.4, 26.1],
    ["sofia"],
    [42.7, 23.3],
    ["belgrade"],
    [44.8, 20.5],
    ["zagreb"],
    [45.8, 16.0],
    ["seoul"],
    [37.6, 127.0],
    ["bangkok"],
    [13.8, 100.6],
    ["hanoi"],
    [21.0, 105.8],
    ["ho chi minh", "saigon"],
    [10.8, 106.7],
    ["jakarta"],
    [-6.2, 106.8],
    ["manila"],
    [14.6, 121.0],
    ["kuala lumpur"],
    [3.1, 101.7],
    ["singapore city"],
    [1.3, 103.8],
    ["dhaka"],
    [23.7, 90.4],
    ["karachi"],
    [24.9, 67.1],
    ["lahore"],
    [31.5, 74.3],
    ["kabul"],
    [34.5, 69.2],
    ["baghdad"],
    [33.3, 44.4],
    ["damascus"],
    [33.5, 36.3],
    ["amman"],
    [31.9, 35.9],
    ["beirut"],
    [33.9, 35.5],
    ["jerusalem", "quds"],
    [31.8, 35.2],
    ["doha"],
    [25.3, 51.5],
    ["muscat"],
    [23.6, 58.6],
    ["sanaa"],
    [15.4, 44.2],
    ["addis ababa"],
    [9.0, 38.7],
    ["algiers"],
    [36.8, 3.0],
    ["tripoli"],
    [32.9, 13.2],
    ["tunis"],
    [36.8, 10.2],
    ["rabat"],
    [34.0, -6.8],
    ["pretoria", "johannesburg"],
    [-25.7, 28.2],
    ["luanda"],
    [-8.8, 13.2],
  ];

  for (let i = 0; i < entries.length; i += 2) {
    const names = Array.isArray(entries[i]) ? entries[i] : [String(entries[i])];
    const coords = entries[i + 1];
    for (const name of names) {
      if (lower.includes(name)) return coords;
    }
  }
  return null;
}

function categorizePoliticalEvent(text) {
  const lower = text.toLowerCase();

  // Savaş/Terör
  if (
    lower.includes("war") ||
    lower.includes("terror") ||
    lower.includes("battle") ||
    lower.includes("conflict") ||
    lower.includes("invasion") ||
    lower.includes("nuclear") ||
    lower.includes("military") ||
    lower.includes("rebellion") ||
    lower.includes("uprising")
  ) {
    return "war";
  }

  // Saldırı
  if (
    lower.includes("attack") ||
    lower.includes("massacre") ||
    lower.includes("assassination") ||
    lower.includes("shooting") ||
    lower.includes("bomb") ||
    lower.includes("kill") ||
    lower.includes("murder")
  ) {
    return "attack";
  }

  // İhtilal
  if (
    lower.includes("coup") ||
    lower.includes("revolution") ||
    lower.includes("overthrow") ||
    lower.includes("deposed") ||
    lower.includes("dictator") ||
    lower.includes("martial law")
  ) {
    return "coup";
  }

  // Seçim
  if (
    lower.includes("election") ||
    lower.includes("vote") ||
    lower.includes("president") ||
    lower.includes("parliament") ||
    lower.includes("democracy") ||
    lower.includes("inaugurat")
  ) {
    return "election";
  }

  // Protesto/Ayaklanma
  if (
    lower.includes("protest") ||
    lower.includes("riot") ||
    lower.includes("demonstration") ||
    lower.includes("strike") ||
    lower.includes("march") ||
    lower.includes("rally") ||
    lower.includes("civil rights")
  ) {
    return "protest";
  }

  // Diplomasi
  if (
    lower.includes("treaty") ||
    lower.includes("summit") ||
    lower.includes("peace") ||
    lower.includes("alliance") ||
    lower.includes("sanction") ||
    lower.includes("embargo")
  ) {
    return "diplomacy";
  }

  // Yaptırım
  if (
    lower.includes("sanction") ||
    lower.includes("embargo") ||
    lower.includes("boycott")
  ) {
    return "sanction";
  }

  // Varsayılan olarak protesto
  return "protest";
}

function clearPoliticalMarkers(map) {
  politicalMarkers.forEach((m) => map.removeLayer(m));
  politicalMarkers = [];
}

function startPoliticalRefresh(map) {
  if (politicalTimer) clearInterval(politicalTimer);
  politicalTimer = setInterval(
    () => {
      clearPoliticalMarkers(map);
      if (typeof clearTickerEvents === "function") clearTickerEvents();
      fetchPoliticalEvents(map);
    },
    politicalRefresh * 60 * 1000,
  );
}

// ============================================================
// TICKER
// ============================================================

function showPoliticalTicker() {
  // Önceki katmanın olaylarını temizle
  if (typeof clearTickerEvents === "function") {
    clearTickerEvents();
  }

  if (typeof showTicker === "function") {
    showTicker();
  } else {
    const ticker = document.getElementById("event-ticker");
    if (ticker) ticker.style.display = "flex";
  }
}

function hidePoliticalTicker() {
  // Başka katman açık değilse ticker'ı gizle
  if (typeof updateTickerVisibility === "function") {
    updateTickerVisibility();
  }
}

function addPoliticalToTicker(text) {
  if (typeof addEventToTicker === "function") {
    addEventToTicker(text);
  }
}

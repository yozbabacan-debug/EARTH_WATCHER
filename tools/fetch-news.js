/**
 * Earth Watcher — RSS Haber Toplayıcı (RSS Aggregator)
 *
 * Kullanım:
 *   node tools/fetch-news.js
 *
 * Bu script tüm RSS kaynaklarını çeker, işler ve data/news.json'a kaydeder.
 * Frontend bu JSON'ı okuyarak siyasi olayları gösterir.
 *
 * Öneri: Her 5-10 dakikada bir çalıştırın (cron job ile)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// RSS kaynakları
const RSS_FEEDS = [
  {
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    name: "NYT",
    country: "US",
  },
  { url: "https://tass.com/rss/v2.xml", name: "TASS", country: "RU" },
  { url: "https://www.scmp.com/rss/4/feed", name: "SCMP", country: "CN" },
  {
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    name: "Al Jazeera",
    country: "QA",
  },
  {
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    name: "BBC",
    country: "GB",
  },
  {
    url: "https://feeds.washingtonpost.com/rss/world",
    name: "WaPo",
    country: "US",
  },
  {
    url: "https://www.theguardian.com/world/rss",
    name: "Guardian",
    country: "GB",
  },
  { url: "https://feeds.npr.org/1001/rss.xml", name: "NPR", country: "US" },
  { url: "https://www.trtworld.com/rss", name: "TRT", country: "TR" },
  {
    url: "https://www.abc.net.au/news/feed/46156/rss.xml",
    name: "ABC Au",
    country: "AU",
  },
  {
    url: "https://www.independent.co.uk/news/world/rss.xml",
    name: "Independent",
    country: "GB",
  },
  {
    url: "https://www.trthaber.com/sondakika_articles.rss",
    name: "TRT Haber",
    country: "TR",
  },
  {
    url: "https://www.france24.com/en/rss",
    name: "France 24",
    country: "FR",
  },
  {
    url: "https://en.mercopress.com/rss",
    name: "MercoPress",
    country: "UY",
  },
  {
    url: "https://www.japantimes.co.jp/feed/",
    name: "Japan Times",
    country: "JP",
  },
  {
    url: "https://www.chinadaily.com.cn/rss/world_rss.xml",
    name: "China Daily",
    country: "CN",
  },
  {
    url: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms",
    name: "Times of India",
    country: "IN",
  },
];

// Konum eşleştirme
const COUNTRY_COORDS = {
  US: [38.0, -97.0],
  "United States": [38.0, -97.0],
  USA: [38.0, -97.0],
  Canada: [56.0, -106.0],
  Mexico: [23.0, -102.0],
  GB: [55.0, -3.0],
  UK: [55.0, -3.0],
  England: [52.0, -1.0],
  France: [46.0, 2.0],
  Germany: [51.0, 10.0],
  Italy: [42.0, 12.0],
  Spain: [40.0, -4.0],
  Netherlands: [52.0, 5.0],
  Poland: [52.0, 19.0],
  Czech: [50.0, 15.0],
  Hungary: [47.0, 19.0],
  Romania: [46.0, 25.0],
  Bulgaria: [43.0, 25.0],
  Greece: [39.0, 22.0],
  Turkey: [39.0, 35.0],
  Turkiye: [39.0, 35.0],
  Ukraine: [49.0, 31.0],
  Belarus: [53.9, 27.6],
  Serbia: [44.0, 21.0],
  Sweden: [62.0, 15.0],
  Norway: [62.0, 10.0],
  Denmark: [56.0, 10.0],
  Finland: [64.0, 26.0],
  CN: [35.0, 105.0],
  China: [35.0, 105.0],
  Japan: [36.0, 138.0],
  "South Korea": [37.0, 127.0],
  "North Korea": [40.0, 127.0],
  India: [20.0, 78.0],
  Pakistan: [30.0, 70.0],
  Indonesia: [-5.0, 120.0],
  Philippines: [13.0, 122.0],
  Vietnam: [14.0, 108.0],
  Thailand: [15.0, 101.0],
  Singapore: [1.3, 103.8],
  Iran: [32.0, 53.0],
  Iraq: [33.0, 43.0],
  Syria: [35.0, 39.0],
  Israel: [31.0, 34.8],
  Palestine: [31.9, 35.2],
  Jordan: [31.0, 36.0],
  Lebanon: [34.0, 36.0],
  Yemen: [15.0, 48.0],
  UAE: [24.0, 54.0],
  "Saudi Arabia": [24.0, 45.0],
  Qatar: [25.0, 51.0],
  Egypt: [26.0, 30.0],
  Libya: [26.0, 17.0],
  Tunisia: [34.0, 9.0],
  Algeria: [28.0, 3.0],
  Morocco: [32.0, -6.0],
  Ethiopia: [9.0, 38.7],
  Kenya: [1.0, 38.0],
  Nigeria: [8.0, 8.0],
  "South Africa": [-30.0, 25.0],
  Australia: [-25.0, 135.0],
  "New Zealand": [-42.0, 174.0],
  Brazil: [-14.0, -55.0],
  Argentina: [-35.0, -60.0],
  Chile: [-35.0, -70.0],
  Colombia: [4.0, -72.0],
  Venezuela: [8.0, -66.0],
  Peru: [-10.0, -75.0],
  RU: [61.0, 40.0],
  Russia: [61.0, 40.0],
  // Kaynak merkezleri (yedek)
  NYT: [40.7, -74.0],
  TASS: [55.8, 37.6],
  SCMP: [22.3, 114.2],
  "Al Jazeera": [25.3, 51.5],
  BBC: [51.5, -0.1],
  WaPo: [38.9, -77.0],
  Guardian: [51.5, -0.1],
  NPR: [38.9, -77.0],
  TRT: [39.9, 32.9],
  "ABC Au": [-33.9, 151.2],
  Independent: [51.5, -0.1],
  "France 24": [48.9, 2.3],
  MercoPress: [-34.9, -56.2],
  "Japan Times": [35.7, 139.7],
  "China Daily": [39.9, 116.4],
  "Times of India": [28.6, 77.2],
};

// Şehir isimleri
const CITIES = {
  washington: [38.9, -77.0],
  london: [51.5, -0.1],
  moscow: [55.8, 37.6],
  beijing: [39.9, 116.4],
  paris: [48.9, 2.3],
  berlin: [52.5, 13.4],
  tokyo: [35.7, 139.7],
  "new york": [40.7, -74.0],
  dubai: [25.2, 55.3],
  istanbul: [41.0, 28.9],
  ankara: [39.9, 32.9],
  kyiv: [50.4, 30.5],
  kiev: [50.4, 30.5],
  minsk: [53.9, 27.6],
  warsaw: [52.2, 21.0],
  prague: [50.1, 14.4],
  budapest: [47.5, 19.0],
  belgrade: [44.8, 20.5],
  bucharest: [44.4, 26.1],
  sofia: [42.7, 23.3],
  brussels: [50.8, 4.3],
  rome: [41.9, 12.5],
  madrid: [40.4, -3.7],
  seoul: [37.6, 126.9],
  delhi: [28.6, 77.2],
  "hong kong": [22.3, 114.2],
  sydney: [-33.9, 151.2],
  cairo: [30.0, 31.2],
  riyadh: [24.7, 46.7],
  tehran: [35.7, 51.4],
  baghdad: [33.3, 44.4],
  damascus: [33.5, 36.3],
};

function categorize(title, desc) {
  const text = (title + " " + (desc || "")).toLowerCase();
  if (
    /(war|terror|battle|conflict|invasion|nuclear|military|rebellion|uprising)/.test(
      text,
    )
  )
    return "war";
  if (/(attack|massacre|assassination|shooting|bomb|kill|murder)/.test(text))
    return "attack";
  if (/(coup|revolution|overthrow|deposed|dictator|martial law)/.test(text))
    return "coup";
  if (/(election|vote|president|parliament|democracy|inaugurat)/.test(text))
    return "election";
  if (/(protest|riot|demonstration|strike|march|rally)/.test(text))
    return "protest";
  if (/(treaty|summit|peace|alliance|sanction|embargo)/.test(text))
    return "diplomacy";
  return "protest";
}

function findLocation(text, sourceName) {
  const lower = text.toLowerCase();
  for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
    if (name.length > 2 && lower.includes(name.toLowerCase())) return coords;
  }
  for (const [city, coords] of Object.entries(CITIES)) {
    if (lower.includes(city)) return coords;
  }
  return COUNTRY_COORDS[sourceName] || [20.0, 0.0];
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { timeout: 15000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject)
      .on("timeout", function () {
        this.destroy();
        reject(new Error("timeout"));
      });
  });
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getField = (tag) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(
        block,
      );
      return m
        ? m[1]
            .replace(/<!\[CDATA\[|\]\]>/g, "")
            .replace(/<[^>]*>/g, "")
            .trim()
        : "";
    };
    const title = getField("title");
    if (title) items.push({ title, description: getField("description") });
  }
  return items;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🌍 Earth Watcher — RSS Aggregator");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  let allArticles = [];
  const seen = new Set();

  for (const feed of RSS_FEEDS) {
    process.stdout.write(`  📡 ${feed.name.padEnd(16)}... `);
    try {
      const xml = await fetchURL(feed.url);
      const items = parseRSS(xml);
      if (items.length === 0) {
        console.log("❌ bos");
        continue;
      }

      let count = 0;
      for (const item of items) {
        const key = item.title.slice(0, 100);
        if (seen.has(key)) continue;
        seen.add(key);

        const fullText = item.title + " " + (item.description || "");
        const type = categorize(item.title, item.description);
        const coords = findLocation(fullText, feed.name);

        allArticles.push({
          title: item.title.slice(0, 200),
          description: (item.description || "").slice(0, 300),
          source: feed.name,
          type,
          lat: coords[0],
          lng: coords[1],
          timestamp: new Date().toISOString(),
        });
        count++;
      }
      console.log(`✅ ${count} haber`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  const order = {
    war: 0,
    attack: 1,
    coup: 2,
    election: 3,
    protest: 4,
    diplomacy: 5,
    sanction: 6,
  };
  allArticles.sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99));

  const output = {
    fetchedAt: new Date().toISOString(),
    total: allArticles.length,
    articles: allArticles,
  };

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, "news.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log("=".repeat(60));
  console.log(`📊 Toplam: ${allArticles.length} haber -> data/news.json`);

  const byType = {};
  allArticles.forEach((a) => {
    byType[a.type] = (byType[a.type] || 0) + 1;
  });
  for (const [type, count] of Object.entries(byType))
    console.log(`   ${type}: ${count}`);
  console.log("=".repeat(60));

  // Kaynak bazında dağılım
  const bySource = {};
  allArticles.forEach((a) => {
    bySource[a.source] = (bySource[a.source] || 0) + 1;
  });
  console.log("📰 Kaynak dagilimi:");
  for (const [src, count] of Object.entries(bySource))
    console.log(`   ${src}: ${count}`);
  console.log("=".repeat(60));
}

main().catch(console.error);

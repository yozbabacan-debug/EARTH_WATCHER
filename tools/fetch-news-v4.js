/**
 * Earth Watcher v4 — Advanced RSS Aggregator + Risk Engine
 *
 * Kullanim: node tools/fetch-news-v4.js
 *
 * 2 makro katmanli mimari:
 *   - physical (Cevresel & Dogal Riskler)
 *   - socio-political (Sosyo-Politik & Guvenlik)
 *
 * Risk = Severity x Credibility x TimeDecay x Sentiment
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ============================================================
// RSS KAYNAKLARI (cred = source credibility 0-1)
// ============================================================
const RSS_FEEDS = [
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", name: "NYT", cred: 1.0 },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC", cred: 1.0 },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera", cred: 0.95 },
  { url: "https://tass.com/rss/v2.xml", name: "TASS", cred: 0.85 },
  { url: "https://www.scmp.com/rss/4/feed", name: "SCMP", cred: 0.90 },
  { url: "https://feeds.washingtonpost.com/rss/world", name: "WaPo", cred: 1.0 },
  { url: "https://www.theguardian.com/world/rss", name: "Guardian", cred: 1.0 },
  { url: "https://www.trtworld.com/rss", name: "TRT World", cred: 0.90 },
  { url: "https://www.trthaber.com/sondakika_articles.rss", name: "TRT Haber", cred: 0.85 },
  { url: "https://www.france24.com/en/rss", name: "France 24", cred: 0.95 },
  { url: "https://en.mercopress.com/rss", name: "MercoPress", cred: 0.80 },
  { url: "https://www.japantimes.co.jp/feed/", name: "Japan Times", cred: 0.90 },
  { url: "https://www.chinadaily.com.cn/rss/world_rss.xml", name: "China Daily", cred: 0.75 },
  { url: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms", name: "Times of India", cred: 0.80 },
  { url: "https://www.abc.net.au/news/feed/51120/rss.xml", name: "ABC Au", cred: 0.95 },
  { url: "https://feeds.npr.org/1001/rss.xml", name: "NPR", cred: 0.95 },
  { url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416", name: "CNA", cred: 0.85 },
];

// ============================================================
// KONUM EŞLEME
// ============================================================
const BASE_COORDS = {
  US:[38,-97], "United States":[38,-97], USA:[38,-97], Canada:[56,-106], Mexico:[23,-102],
  GB:[55,-3], UK:[55,-3], England:[52,-1], France:[46,2], Germany:[51,10], Italy:[42,12],
  Spain:[40,-4], Netherlands:[52,5], Poland:[52,19], Czech:[50,15], Hungary:[47,19],
  Romania:[46,25], Bulgaria:[43,25], Greece:[39,22], Turkey:[39,35], Turkiye:[39,35],
  Ukraine:[49,31], Belarus:[53.9,27.6], Serbia:[44,21], Sweden:[62,15], Norway:[62,10],
  Denmark:[56,10], Finland:[64,26], CN:[35,105], China:[35,105], Japan:[36,138],
  "South Korea":[37,127], "North Korea":[40,127], India:[20,78], Pakistan:[30,70],
  Indonesia:[-5,120], Philippines:[13,122], Vietnam:[14,108], Thailand:[15,101],
  Singapore:[1.3,103.8], Iran:[32,53], Iraq:[33,43], Syria:[35,39], Israel:[31,34.8],
  Palestine:[31.9,35.2], Jordan:[31,36], Lebanon:[34,36], Yemen:[15,48], UAE:[24,54],
  "Saudi Arabia":[24,45], Qatar:[25,51], Egypt:[26,30], Libya:[26,17], Tunisia:[34,9],
  Algeria:[28,3], Morocco:[32,-6], Ethiopia:[9,38.7], Kenya:[1,38], Nigeria:[8,8],
  "South Africa":[-30,25], Australia:[-25,135], "New Zealand":[-42,174], Brazil:[-14,-55],
  Argentina:[-35,-60], Chile:[-35,-70], Colombia:[4,-72], Venezuela:[8,-66], Peru:[-10,-75],
  RU:[61,40], Russia:[61,40],
  // source fallback
  NYT:[40.7,-74], BBC:[51.5,-0.1], TASS:[55.8,37.6], SCMP:[22.3,114.2],
  "Al Jazeera":[25.3,51.5], WaPo:[38.9,-77], Guardian:[51.5,-0.1], NPR:[38.9,-77],
  TRT:[39.9,32.9], "ABC Au":[-33.9,151.2], CNA:[1.3,103.8], "France 24":[48.9,2.3],
  MercoPress:[-34.9,-56.2], "Japan Times":[35.7,139.7], "China Daily":[39.9,116.4],
  "Times of India":[28.6,77.2],
};

const CITIES = {
  washington:[38.9,-77], london:[51.5,-0.1], moscow:[55.8,37.6], beijing:[39.9,116.4],
  paris:[48.9,2.3], berlin:[52.5,13.4], tokyo:[35.7,139.7], "new york":[40.7,-74],
  dubai:[25.2,55.3], istanbul:[41,28.9], ankara:[39.9,32.9], kyiv:[50.4,30.5],
  kiev:[50.4,30.5], minsk:[53.9,27.6], warsaw:[52.2,21], prague:[50.1,14.4],
  budapest:[47.5,19], belgrade:[44.8,20.5], bucharest:[44.4,26.1], sofia:[42.7,23.3],
  brussels:[50.8,4.3], rome:[41.9,12.5], madrid:[40.4,-3.7], seoul:[37.6,126.9],
  delhi:[28.6,77.2], "hong kong":[22.3,114.2], sydney:[-33.9,151.2], cairo:[30,31.2],
  riyadh:[24.7,46.7], tehran:[35.7,51.4], baghdad:[33.3,44.4], damascus:[33.5,36.3],
  telaviv:[32.1,34.8], gaza:[31.5,34.5], tripoli:[32.9,13.2], nairobi:[-1.3,36.8],
  lagos:[6.5,3.4], jakarta:[-6.2,106.8], manila:[14.6,121], bangkok:[13.8,100.5],
};

// ============================================================
// KATEGORI + MAKRO KATMAN
// ============================================================
function analyzeCategory(title, desc) {
  const t = (title + " " + (desc || "")).toLowerCase();
  // PHYSICAL
  if (/(earthquake|tsunami|volcano|hurricane|typhoon|cyclone|tornado|flood|wildfire|drought)/.test(t))
    return { macroLayer: "physical", category: /(catastrophic|deadly|devastating)/.test(t) ? "catastrophic_disaster" : "natural_disaster" };
  if (/(climate|global warming|emission|carbon|pollution|environmental)/.test(t))
    return { macroLayer: "physical", category: "climate_anomaly" };
  // SOCIO-POLITICAL
  if (/(nuclear|atomic|radioactive)/.test(t)) return { macroLayer: "socio-political", category: "nuclear_threat" };
  if (/(war|invasion|military|missile|offensive|airstrike|troops)/.test(t))
    return { macroLayer: "socio-political", category: "military_conflict" };
  if (/(bomb|explosion|terror|assassination|shooting|massacre)/.test(t))
    return { macroLayer: "socio-political", category: "terror_attack" };
  if (/(protest|riot|clash|demonstrat|strike|unrest|coup|revolution)/.test(t))
    return { macroLayer: "socio-political", category: "civil_unrest" };
  if (/(sanctions|embargo|summit|treaty|diplomat|ceasefire)/.test(t))
    return { macroLayer: "socio-political", category: "diplomatic_crisis" };
  return { macroLayer: "socio-political", category: "civil_unrest" };
}

// ============================================================
// v4 RISK ENGINE
// ============================================================
function calculateRisk(article) {
  const SEVERITY = {
    nuclear_threat:100, military_conflict:85, terror_attack:70, civil_unrest:45,
    diplomatic_crisis:30, catastrophic_disaster:90, natural_disaster:55, climate_anomaly:35
  };
  const baseSeverity = SEVERITY[article.category] || 20;
  const feed = RSS_FEEDS.find(f => f.name === article.source);
  const sourceWeight = feed ? feed.cred : 0.75;
  const pubDate = new Date(article.pubDate);
  const hoursElapsed = Math.abs(new Date() - pubDate) / 36e5;
  const timeDecayFactor = Math.exp(-hoursElapsed / 18);
  let ctxMult = 1.0;
  const text = `${article.title} ${article.description||""}`.toLowerCase();
  ["urgent","breaking","deadly","critical","clash","retaliation","massacre","invasion"].forEach(w => {if(text.includes(w))ctxMult+=0.05});
  ["postponed","peaceful","resolved","condemns","statement","discussed","ceasefire"].forEach(w => {if(text.includes(w))ctxMult-=0.05});
  ctxMult = Math.max(0.7, Math.min(1.3, ctxMult));
  const score = Math.max(0, Math.min(100, Math.round(baseSeverity * sourceWeight * timeDecayFactor * ctxMult)));
  return { liveRiskScore: score, baseScore: baseSeverity, decayFactor: timeDecayFactor, isHotspot: score > 75 };
}

// ============================================================
// HELPERS
// ============================================================
function applyJitter(c) { return [c[0]+(Math.random()-0.5)*0.5, c[1]+(Math.random()-0.5)*0.5]; }
function findLocation(text, source) {
  const t = text.toLowerCase();
  for (const [city,c] of Object.entries(CITIES)) if (t.includes(city)) return applyJitter(c);
  for (const [name,c] of Object.entries(BASE_COORDS)) if (name.length>2 && t.includes(name.toLowerCase())) return applyJitter(c);
  return applyJitter(BASE_COORDS[source] || [20,0]);
}

function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const gf = (tag) => { const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(b); return r ? r[1].replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]*>/g,"").trim() : ""; };
    const title = gf("title"), desc = gf("description"), pub = gf("pubDate") || new Date().toISOString();
    if (title) items.push({ title, description: desc, pubDate: pub });
  }
  return items;
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    (url.startsWith("https")?https:http).get(url, { timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve(d));
    }).on("error", reject).on("timeout", function(){this.destroy();reject(new Error("timeout"))});
  });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("🌍 Earth Watcher v4 — RSS + Risk Engine");
  console.log(`📅 ${new Date().toISOString()}`);
  console.log("=".repeat(60));
  let articles = []; const seen = new Set();
  for (const feed of RSS_FEEDS) {
    process.stdout.write(`  📡 ${feed.name.padEnd(16)}... `);
    try {
      const xml = await fetchURL(feed.url);
      const items = parseRSS(xml);
      if (!items.length) { console.log("❌ bos"); continue; }
      let count = 0;
      for (const item of items) {
        const key = item.title.slice(0, 100);
        if (seen.has(key)) continue;
        seen.add(key);
        const { macroLayer, category } = analyzeCategory(item.title, item.description);
        const coords = findLocation(item.title + " " + item.description, feed.name);
        const article = { title: item.title.slice(0,200), description: (item.description||"").slice(0,300), source: feed.name, coordinates: coords, macroLayer, category, pubDate: item.pubDate };
        const risk = calculateRisk(article);
        articles.push({ ...article, ...risk, timestamp: item.pubDate });
        count++;
      }
      console.log(`✅ ${count} haber`);
    } catch (e) { console.log(`❌ ${e.message}`); }
  }
  articles.sort((a,b) => b.liveRiskScore - a.liveRiskScore);
  const dir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "news-v4.json"), JSON.stringify(articles, null, 2));
  console.log("=".repeat(60));
  console.log(`📊 ${articles.length} haber → data/news-v4.json`);
  const bc = {}; articles.forEach(a => { bc[a.category] = (bc[a.category]||0)+1 });
  for (const [k,v] of Object.entries(bc)) console.log(`   ${k}: ${v}`);
  console.log(`🔥 Hotspot (>75): ${articles.filter(a=>a.isHotspot).length}`);
  console.log("=".repeat(60));
}
main().catch(console.error);

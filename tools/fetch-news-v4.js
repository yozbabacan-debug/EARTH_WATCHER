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
  // North America
  washington:[38.9,-77], "new york":[40.7,-74], "los angeles":[34.1,-118.2], chicago:[41.9,-87.6],
  houston:[29.8,-95.4], miami:[25.8,-80.2], "san francisco":[37.8,-122.4], seattle:[47.6,-122.3],
  boston:[42.4,-71.1], atlanta:[33.7,-84.4], dallas:[32.8,-96.8], phoenix:[33.4,-112.1],
  detroit:[42.3,-83.0], portland:[45.5,-122.7], denver:[39.7,-105.0], toronto:[43.7,-79.4],
  montreal:[45.5,-73.6], vancouver:[49.3,-123.1], calgary:[51.0,-114.1], ottawa:[45.4,-75.7],
  "mexico city":[19.4,-99.1], albany:[42.7,-73.8], sacramento:[38.6,-121.5], austin:[30.3,-97.7],
  "san diego":[32.7,-117.2], "las vegas":[36.2,-115.1], nashville:[36.2,-86.8], philadelphia:[39.9,-75.1],
  pittsburgh:[40.4,-80.0], columbus:[40.0,-83.0], charlotte:[35.2,-80.8], indianapolis:[39.8,-86.2],
  orlando:[28.5,-81.4], tampa:[28.0,-82.5], minneapolis:[45.0,-93.3], "st louis":[38.6,-90.2],
  "kansas city":[39.1,-94.6], cincinnati:[39.1,-84.5], milwaukee:[43.0,-87.9], cleveland:[41.5,-81.7],
  raleigh:[35.8,-78.6], omaha:[41.3,-95.9], albuquerque:[35.1,-106.6], tucson:[32.2,-110.9],
  fresno:[36.7,-119.8], "salt lake city":[40.8,-111.9], boise:[43.6,-116.2], helena:[46.6,-112.0],
  "quebec city":[46.8,-71.2], winnipeg:[49.9,-97.1], edmonton:[53.5,-113.5], halifax:[44.6,-63.6],
  "guatemala city":[14.6,-90.5], tegucigalpa:[14.1,-87.2], "san salvador":[13.7,-89.2],
  managua:[12.1,-86.3], "san jose":[9.9,-84.1], "panama city":[9.0,-79.5], havana:[23.1,-82.4],
  "santo domingo":[18.5,-69.9], "port-au-prince":[18.5,-72.3], kingston:[18.0,-76.8],
  nassau:[25.1,-77.3], bridgetown:[13.1,-59.6], "port of spain":[10.7,-61.5],
  // Europe
  london:[51.5,-0.1], paris:[48.9,2.3], berlin:[52.5,13.4], rome:[41.9,12.5], madrid:[40.4,-3.7],
  brussels:[50.8,4.3], amsterdam:[52.4,4.9], vienna:[48.2,16.4], prague:[50.1,14.4],
  budapest:[47.5,19.0], belgrade:[44.8,20.5], bucharest:[44.4,26.1], sofia:[42.7,23.3],
  warsaw:[52.2,21.0], kyiv:[50.4,30.5], kiev:[50.4,30.5], minsk:[53.9,27.6], moscow:[55.8,37.6],
  "st petersburg":[59.9,30.3], stockholm:[59.3,18.1], oslo:[59.9,10.8], copenhagen:[55.7,12.6],
  helsinki:[60.2,25.0], dublin:[53.3,-6.3], edinburgh:[55.9,-3.2], lisbon:[38.7,-9.1],
  zurich:[47.4,8.5], geneva:[46.2,6.1], barcelona:[41.4,2.2], milano:[45.5,9.2], napoli:[40.9,14.3],
  munich:[48.1,11.6], hamburg:[53.6,10.0], frankfurt:[50.1,8.7], cologne:[50.9,7.0],
  rotterdam:[51.9,4.5], antwerp:[51.2,4.4], strasbourg:[48.6,7.8], marseille:[43.3,5.4],
  lyon:[45.8,4.8], valencia:[39.5,-0.4], seville:[37.4,-6.0], porto:[41.2,-8.6],
  zagreb:[45.8,16.0], sarajevo:[43.9,18.4], skopje:[42.0,21.4], tirana:[41.3,19.8],
  pristina:[42.7,21.2], podgorica:[42.4,19.3], vilnius:[54.7,25.3], riga:[56.9,24.1],
  tallinn:[59.4,24.8], reykjavik:[64.1,-21.9], malmo:[55.6,13.0], gothenburg:[57.7,12.0],
  birmingham:[52.5,-1.9], manchester:[53.5,-2.2], glasgow:[55.9,-4.3], cardiff:[51.5,-3.2],
  belfast:[54.6,-5.9], istanbul:[41.0,28.9], ankara:[39.9,32.9], izmir:[38.4,27.1],
  antalya:[36.9,30.7], athens:[38.0,23.7], thessaloniki:[40.6,22.9],
  // Middle East & Central Asia
  dubai:[25.2,55.3], abudhabi:[24.5,54.4], doha:[25.3,51.5], riyadh:[24.7,46.7],
  jeddah:[21.5,39.2], mecca:[21.4,39.8], medina:[24.5,39.6], kuwaitcity:[29.4,48.0],
  muscat:[23.6,58.5], manama:[26.2,50.6], baghdad:[33.3,44.4], basra:[30.5,47.8],
  mosul:[36.3,43.1], tehran:[35.7,51.4], isfahan:[32.7,51.7], shiraz:[29.6,52.5],
  damascus:[33.5,36.3], aleppo:[36.2,37.2], amman:[32.0,36.0], beirut:[33.9,35.5],
  jerusalem:[31.8,35.2], telaviv:[32.1,34.8], gaza:[31.5,34.5], ramallah:[31.9,35.2],
  sanaa:[15.4,44.2], aden:[12.8,45.0], baku:[40.4,49.9], tbilisi:[41.7,44.8],
  yerevan:[40.2,44.5], astana:[51.2,71.4], almaty:[43.3,76.9], tashkent:[41.3,69.2],
  ashgabat:[38.0,58.4], dushanbe:[38.6,68.8], bishkek:[42.9,74.6], kabul:[34.5,69.2],
  // South Asia
  delhi:[28.6,77.2], mumbai:[19.1,72.9], kolkata:[22.6,88.4], chennai:[13.1,80.3],
  bengaluru:[13.0,77.6], hyderabad:[17.4,78.5], ahmedabad:[23.0,72.6], pune:[18.5,73.9],
  jaipur:[26.9,75.8], lucknow:[26.8,80.9], islamabad:[33.7,73.0], karachi:[24.9,67.1],
  lahore:[31.6,74.3], dhaka:[23.8,90.4], chittagong:[22.4,91.8], colombo:[6.9,79.9],
  kathmandu:[27.7,85.3], thimphu:[27.5,89.6], male:[4.2,73.5],
  // East Asia
  tokyo:[35.7,139.7], osaka:[34.7,135.5], yokohama:[35.4,139.6], nagoya:[35.2,137.0],
  sapporo:[43.1,141.4], fukuoka:[33.6,130.4], hiroshima:[34.4,132.5], beijing:[39.9,116.4],
  shanghai:[31.2,121.5], guangzhou:[23.1,113.3], shenzhen:[22.5,114.1], chengdu:[30.6,104.1],
  wuhan:[30.6,114.3], xian:[34.3,109.0], nanjing:[32.1,118.8], tianjin:[39.1,117.2],
  "hong kong":[22.3,114.2], macau:[22.2,113.5], taipei:[25.0,121.5], seoul:[37.6,126.9],
  busan:[35.2,129.1], pyongyang:[39.0,125.8], ulaanbaatar:[47.9,106.9],
  // Southeast Asia
  bangkok:[13.8,100.5], singapore:[1.3,103.8], jakarta:[-6.2,106.8], manila:[14.6,121.0],
  hanoi:[21.0,105.9], "ho chi minh city":[10.8,106.7], "kuala lumpur":[3.1,101.7],
  yangon:[16.8,96.2], phnompenh:[11.6,104.9], vientiane:[18.0,102.6],
  "bandar seri begawan":[4.9,114.9], surabaya:[-7.2,112.7], bandung:[-6.9,107.6],
  medan:[3.6,98.7], cebu:[10.3,123.9], davo:[7.1,125.6], chiangmai:[18.8,98.9],
  // Oceania
  sydney:[-33.9,151.2], melbourne:[-37.8,145.0], brisbane:[-27.5,153.0], perth:[-32.0,115.9],
  adelaide:[-34.9,138.6], canberra:[-35.3,149.1], auckland:[-36.8,174.8], wellington:[-41.3,174.8],
  christchurch:[-43.5,172.6], suva:[-18.1,178.4], "port moresby":[-9.4,147.2],
  // Africa
  cairo:[30.0,31.2], alexandria:[31.2,29.9], tripoli:[32.9,13.2], tunis:[36.8,10.2],
  algiers:[36.8,3.0], rabat:[34.0,-6.8], casablanca:[33.6,-7.6], khartoum:[15.5,32.5],
  addisababa:[9.0,38.7], nairobi:[-1.3,36.8], mombasa:[-4.0,39.7], "dar es salaam":[-6.8,39.3],
  kampala:[0.3,32.6], kigali:[-2.0,30.1], lagos:[6.5,3.4], abuja:[9.1,7.5],
  accra:[5.6,-0.2], dakar:[14.7,-17.5], bamako:[12.6,-8.0], ouagadougou:[12.4,-1.5],
  niamey:[13.5,2.1], ndjamena:[12.1,15.0], yaounde:[3.9,11.5], douala:[4.1,9.7],
  kinshasa:[-4.3,15.3], brazzaville:[-4.3,15.3], luanda:[-8.8,13.2], lusaka:[-15.4,28.3],
  harare:[-17.8,31.0], maputo:[-25.9,32.6], windhoek:[-22.6,17.1], gaborone:[-24.6,25.9],
  pretoria:[-25.7,28.2], johannesburg:[-26.2,28.0], "cape town":[-33.9,18.4],
  durban:[-29.9,31.0], bloemfontein:[-29.1,26.2], antananarivo:[-18.9,47.5],
  // South America
  "sao paulo":[-23.5,-46.6], "rio de janeiro":[-22.9,-43.2], brasilia:[-15.8,-47.9],
  "buenos aires":[-34.6,-58.4], santiago:[-33.4,-70.7], lima:[-12.1,-77.0],
  bogota:[4.6,-74.1], medellin:[6.2,-75.6], caracas:[10.5,-66.9], quito:[-0.2,-78.5],
  guayaquil:[-2.2,-79.9], "la paz":[-16.5,-68.1], "santa cruz":[-17.8,-63.2],
  asuncion:[-25.3,-57.6], montevideo:[-34.9,-56.2],
};
;

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
  // 1. Once sehirleri tara (en uzun isimden basla, substring match'i engelle)
  const sortedCities = Object.entries(CITIES).sort((a,b) => b[0].length - a[0].length);
  for (const [city,c] of sortedCities) {
    // Word-boundary check: "ankara" matches ama "ankara mali" de Mali'yi ezmesin
    const regex = new RegExp("\\b" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    if (regex.test(t)) {
      // Context check: eger "mali" de geciyorsa ve ankara'dan daha gucluyse
      if (city === "ankara" && /\bmali\b/.test(t)) continue; // skip Ankara if Mali is also mentioned
      return applyJitter(c);
    }
  }
  // 2. Ulke kontrolu (yine uzun isimden basla)
  const sortedCountries = Object.entries(BASE_COORDS).sort((a,b) => b[0].length - a[0].length);
  for (const [name,c] of sortedCountries) {
    if (name.length <= 2) continue; // "US", "GB", "CN" gibi kisaltmalari atla
    const regex = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    if (regex.test(t)) return applyJitter(c);
  }
  // 3. Kaynak bazli fallback
  const srcKey = Object.keys(BASE_COORDS).find(k => k.toLowerCase() === source.toLowerCase()) || source;
  return applyJitter(BASE_COORDS[srcKey] || [20,0]);
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

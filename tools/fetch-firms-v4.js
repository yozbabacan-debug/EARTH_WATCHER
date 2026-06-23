/**
 * Earth Watcher v4 — NASA FIRMS Backend Fetcher
 *
 * NASA FIRMS API'den aktif yangin verilerini ceker,
 * data/firms-v4.json olarak kaydeder.
 *
 * Kullanim:
 *   node tools/fetch-firms-v4.js
 *   node tools/fetch-firms-v4.js --bbox=-180,-90,180,90 --days=3
 *
 * API Key: https://firms.modaps.eosdis.nasa.gov/api/map_key/
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ============================================================
// CONFIG
// ============================================================
const FIRMS_KEY = process.env.NASA_FIRMS_KEY || "ec79b73de125772b42739d679870409a";
const OUTPUT = path.join(__dirname, "../data/firms-v4.json");

// Parse CLI args
const args = process.argv.slice(2);
let bbox = "-180,-90,180,90"; // tum dunya
let days = 3;

args.forEach((arg, i) => {
  if (arg === "--bbox" && args[i + 1]) bbox = args[i + 1];
  if (arg === "--days" && args[i + 1]) days = parseInt(args[i + 1]);
});

// ============================================================
// FETCH
// ============================================================
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 30000 }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("JSON parse error: " + e.message));
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("🚀 Earth Watcher v4 — NASA FIRMS Fetcher");
  console.log(`   BBox: ${bbox} | Days: ${days}`);

  const allFires = [];

  // MODIS + VIIRS dual fetch
  const sources = [
    { name: "MODIS_NRT", label: "MODIS" },
    { name: "VIIRS_SNPP_NRT", label: "VIIRS" },
  ];

  for (const src of sources) {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/json/${FIRMS_KEY}/${src.name}/${bbox}/${days}`;
    console.log(`  📡 Fetching ${src.label}...`);

    try {
      const data = await fetchJSON(url);
      console.log(`     ✅ ${data.length} fires from ${src.label}`);

      data.forEach((f) => {
        allFires.push({
          lat: parseFloat(f.latitude),
          lng: parseFloat(f.longitude),
          brightness: parseFloat(f.bright_ti4) || 300,
          frp: parseFloat(f.frp) || 30,
          acq_date: f.acq_date,
          acq_time: f.acq_time || "",
          confidence: parseInt(f.confidence) || 80,
          scan: parseFloat(f.scan) || 0.5,
          track: parseFloat(f.track) || 0.5,
          satellite: src.label,
          instrument: src.label,
        });
      });
    } catch (e) {
      console.log(`     ⚠️ ${src.label} error: ${e.message}`);
    }
  }

  // Dedup by coordinate
  const seen = new Map();
  const deduped = [];
  allFires.forEach((f) => {
    const key = f.lat.toFixed(4) + "," + f.lng.toFixed(4);
    if (!seen.has(key)) {
      seen.set(key, f);
      deduped.push(f);
    } else {
      const existing = seen.get(key);
      if (f.frp > existing.frp) {
        existing.frp = f.frp;
        existing.brightness = Math.max(existing.brightness, f.brightness);
        if (f.satellite !== existing.satellite)
          existing.satellite = "MODIS+VIIRS";
      }
    }
  });

  // Save
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(deduped, null, 2));
  console.log(`\n✅ ${deduped.length} unique fires saved to data/firms-v4.json`);
}

main().catch((e) => {
  console.error("❌ Fatal:", e.message);
  process.exit(1);
});

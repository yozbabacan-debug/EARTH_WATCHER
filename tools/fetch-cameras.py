#!/usr/bin/env python3
"""
Earth Watcher v4 — IPTV-Org Camera Fetcher

iptv-org/iptv GitHub reposundan webcam/kamera akislarini ceker,
ulkelerine gore koordinatlandirir ve cameras.json formatinda kaydeder.

Kullanim:
    python3 tools/fetch-cameras.py              # Temel fetch (~50-100 kamera)
    python3 tools/fetch-cameras.py --merge      # Mevcut cameras.json ile birlestir
    python3 tools/fetch-cameras.py --max 500    # Max stream sayisi

Kaynaklar:
    https://github.com/iptv-org/iptv (m3u playlists by country)
"""

import json
import re
import sys
import urllib.request
import ssl
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================
IPTV_BASE = "https://raw.githubusercontent.com/iptv-org/iptv/master"
STREAM_TYPES = ["streams", "m3u"]

# Webcam/kamera anahtar kelimeleri
CAMERA_KEYWORDS = [
    "webcam", "camera", "live cam", "kamera", "canli", "live view",
    "traffic", "weather cam", "beach cam", "city cam", "street view",
    "surf cam", "harbor cam", "mountain cam", "wildlife cam",
    "construction cam", "airport cam", "port cam", "coast cam",
]

# Ulke -> [lat, lng] mapping (merkez koordinatlar)
COUNTRY_COORDS = {
    "us": [39.8, -98.5], "gb": [55.0, -3.0], "de": [51.0, 9.0],
    "fr": [46.6, 2.2], "it": [41.9, 12.5], "es": [40.4, -3.7],
    "pt": [39.4, -8.2], "nl": [52.1, 5.3], "be": [50.5, 4.5],
    "ch": [46.8, 8.2], "at": [47.5, 13.3], "pl": [51.9, 19.1],
    "cz": [49.8, 15.5], "sk": [48.7, 19.7], "hu": [47.2, 19.5],
    "ro": [45.9, 25.0], "bg": [42.7, 25.5], "gr": [39.1, 22.0],
    "tr": [39.0, 35.0], "ru": [61.0, 40.0], "ua": [48.4, 31.2],
    "se": [62.0, 15.0], "no": [62.0, 10.0], "fi": [64.0, 26.0],
    "dk": [56.0, 10.0], "ee": [58.6, 25.0], "lv": [56.9, 24.6],
    "lt": [55.2, 24.0], "ie": [53.1, -7.7], "is": [64.9, -19.0],
    "jp": [36.0, 138.0], "kr": [36.0, 127.5], "cn": [35.0, 105.0],
    "tw": [23.7, 121.0], "hk": [22.3, 114.2], "sg": [1.35, 103.8],
    "th": [13.7, 100.5], "vn": [14.0, 108.0], "ph": [12.8, 121.8],
    "my": [4.2, 109.0], "id": [-2.5, 118.0], "in": [20.6, 79.0],
    "pk": [30.4, 69.3], "bd": [23.7, 90.4], "lk": [7.9, 81.0],
    "au": [-25.3, 133.8], "nz": [-41.3, 174.8],
    "br": [-10.0, -53.0], "ar": [-38.4, -63.6], "cl": [-35.7, -71.5],
    "co": [4.6, -74.1], "pe": [-9.2, -75.0], "mx": [23.6, -102.5],
    "ca": [56.1, -106.3], "za": [-30.6, 23.0], "eg": [26.8, 30.8],
    "ma": [31.8, -7.1], "ng": [9.1, 8.7], "ke": [-0.0, 37.9],
    "ae": [23.4, 53.8], "sa": [23.9, 45.1], "il": [31.0, 34.9],
    "ir": [32.4, 53.7], "iq": [33.2, 43.7],
}

# Sehir bazli daha hassas koordinatlar
CITY_COORDS = {
    "london": [51.51, -0.13], "paris": [48.86, 2.35], "berlin": [52.52, 13.41],
    "rome": [41.90, 12.50], "madrid": [40.42, -3.70], "amsterdam": [52.37, 4.90],
    "brussels": [50.85, 4.35], "vienna": [48.21, 16.37], "prague": [50.09, 14.42],
    "warsaw": [52.23, 21.01], "budapest": [47.50, 19.04], "bucharest": [44.43, 26.10],
    "sofia": [42.70, 23.32], "athens": [37.98, 23.73], "istanbul": [41.01, 28.98],
    "ankara": [39.93, 32.86], "moscow": [55.75, 37.62], "kyiv": [50.45, 30.52],
    "stockholm": [59.33, 18.07], "oslo": [59.91, 10.75], "helsinki": [60.17, 24.94],
    "copenhagen": [55.68, 12.57], "dublin": [53.35, -6.26], "reykjavik": [64.15, -21.94],
    "tokyo": [35.68, 139.76], "seoul": [37.57, 126.98], "beijing": [39.90, 116.41],
    "shanghai": [31.23, 121.47], "hong kong": [22.30, 114.17], "singapore": [1.35, 103.82],
    "bangkok": [13.75, 100.50], "hanoi": [21.03, 105.85], "manila": [14.60, 120.98],
    "kuala lumpur": [3.14, 101.69], "jakarta": [-6.21, 106.85], "delhi": [28.61, 77.23],
    "mumbai": [19.08, 72.88], "sydney": [-33.87, 151.21], "melbourne": [-37.81, 144.96],
    "auckland": [-36.85, 174.76], "wellington": [-41.29, 174.78],
    "sao paulo": [-23.55, -46.63], "rio": [-22.91, -43.20],
    "buenos aires": [-34.60, -58.38], "santiago": [-33.45, -70.67],
    "bogota": [4.61, -74.08], "lima": [-12.05, -77.04],
    "mexico city": [19.43, -99.13], "toronto": [43.65, -79.38],
    "vancouver": [49.28, -123.12], "montreal": [45.50, -73.57],
    "new york": [40.71, -74.01], "los angeles": [34.05, -118.24],
    "chicago": [41.88, -87.63], "san francisco": [37.77, -122.42],
    "miami": [25.76, -80.19], "las vegas": [36.17, -115.14],
    "cairo": [30.04, 31.24], "cape town": [-33.92, 18.42],
    "dubai": [25.20, 55.27], "tel aviv": [32.09, 34.78],
}


def is_camera(name):
    """Check if stream name contains webcam/camera keywords."""
    name_lower = name.lower()
    return any(kw in name_lower for kw in CAMERA_KEYWORDS)


def guess_coords(name, country_code):
    """Guess coordinates from stream name or fall back to country center."""
    name_lower = name.lower()
    # Try city match first
    for city, coords in CITY_COORDS.items():
        if city in name_lower:
            # Add small random jitter to avoid exact overlap
            import random
            jitter = 0.05
            return [coords[0] + random.uniform(-jitter, jitter),
                    coords[1] + random.uniform(-jitter, jitter)]
    # Fall back to country center
    if country_code in COUNTRY_COORDS:
        import random
        c = COUNTRY_COORDS[country_code]
        jitter = 0.5
        return [c[0] + random.uniform(-jitter, jitter),
                c[1] + random.uniform(-jitter, jitter)]
    return [0.0, 0.0]


def fetch_m3u(url):
    """Fetch and parse M3U playlist."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EarthWatcher/4.0"})
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            data = resp.read().decode("utf-8", errors="ignore")
        return data
    except Exception as e:
        print(f"  ⚠️ Fetch error: {e}")
        return ""


def parse_m3u(data, country_code):
    """Parse M3U data into camera entries."""
    cameras = []
    lines = data.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("#EXTINF"):
            # Extract name
            name = ""
            # Try group-title or comma-separated name
            title_match = re.search(r'group-title="([^"]*)"', line)
            comma_idx = line.rfind(",")
            if comma_idx > 0:
                name = line[comma_idx + 1:].strip()
            if not name and title_match:
                name = title_match.group(1)

            # Next line should be the URL
            if i + 1 < len(lines):
                url = lines[i + 1].strip()
                if url and not url.startswith("#") and is_camera(name):
                    coords = guess_coords(name, country_code)
                    cameras.append({
                        "name": name,
                        "lat": coords[0],
                        "lng": coords[1],
                        "country": country_code.upper(),
                        "type": "video",
                        "stream": url,
                        "provider": "iptv-org",
                    })
            i += 2
        else:
            i += 1
    return cameras


def fetch_countries():
    """Fetch available country codes from iptv-org repo."""
    # Known countries with most webcam streams
    priority_countries = [
        "us", "gb", "de", "fr", "it", "es", "nl", "ch", "at",
        "jp", "kr", "au", "ca", "br", "tr", "ru", "se", "no",
        "pl", "cz", "pt", "be", "ie", "dk", "fi", "gr", "hu",
        "ro", "bg", "ar", "cl", "co", "pe", "mx", "za", "ae",
        "in", "sg", "th", "my", "id", "ph", "vn", "nz",
    ]
    return priority_countries


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Earth Watcher Camera Fetcher")
    parser.add_argument("--merge", action="store_true", help="Merge with existing cameras.json")
    parser.add_argument("--max", type=int, default=200, help="Max cameras to fetch")
    parser.add_argument("--output", default=None, help="Output file path")
    args = parser.parse_args()

    output_path = args.output or str(
        Path(__file__).resolve().parent.parent / "data" / "cameras.json"
    )

    all_cameras = []
    countries = fetch_countries()
    fetched = 0

    print(f"🔍 Fetching webcam streams from iptv-org/iptv...")
    for cc in countries:
        if fetched >= args.max:
            break

        url = f"{IPTV_BASE}/streams/{cc}.m3u"
        print(f"  📡 {cc.upper()}...", end=" ")
        data = fetch_m3u(url)
        if data:
            cams = parse_m3u(data, cc)
            all_cameras.extend(cams)
            fetched += len(cams)
            print(f"{len(cams)} kamera")
        else:
            print("gecildi")

    # Merge with existing?
    if args.merge and Path(output_path).exists():
        with open(output_path) as f:
            existing = json.load(f)
        old_cams = existing.get("cameras", [])
        old_names = {c.get("stream", "") for c in old_cams}
        new_cams = [c for c in all_cameras if c["stream"] not in old_names]
        all_cameras = old_cams + new_cams
        print(f"\n📦 Merged: {len(old_cams)} existing + {len(new_cams)} new = {len(all_cameras)} total")

    # Save
    result = {"cameras": all_cameras}
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\n✅ {len(all_cameras)} cameras saved to {output_path}")
    print(f"   Tip: cameras.json'u GitHub Pages'e pushlayin, harita otomatik guncellenir.")


if __name__ == "__main__":
    main()

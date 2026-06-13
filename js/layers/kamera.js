/**
 * Earth Watcher — Layer 9: Kameralar (Canlı Web Kameraları)
 * Dünyanın dört bir yanından halka açık web kamera yayınları
 *
 * Kaynaklar:
 *   - NYC DOT: New York trafik kameraları (snapshot)
 *   - EarthCam: Dünya şehirleri (snapshot)
 *   - Gelecekte: Windy API, OpenStreetCam, yerel yönetim API'leri
 */

let cameraMarkers = [];
let cameraCluster = null;
let cameraData = [];

function initKameraLayer(map) {
  console.log("📷 Kamera katmanı başlatılıyor...");

  // data/cameras.json'dan kameraları yükle
  fetch("data/cameras.json")
    .then((r) => r.json())
    .then((data) => {
      if (!data.cameras || !data.cameras.length) {
        console.log("📷 Kamera verisi bulunamadı");
        return;
      }
      cameraData = data.cameras;
      console.log(`📷 ${cameraData.length} kamera yükleniyor...`);
      placeCameras(map);
    })
    .catch((err) => console.error("❌ Kamera verisi alınamadı:", err));
}

function destroyKameraLayer(map) {
  console.log("📷 Kamera katmanı temizleniyor...");

  if (cameraCluster) {
    map.removeLayer(cameraCluster);
    cameraCluster = null;
  }
  cameraMarkers = [];
}

function placeCameras(map) {
  // MarkerCluster oluştur (çok sayıda kamerayı grupla)
  cameraCluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      let size = "small";
      if (count > 10) size = "medium";
      if (count > 50) size = "large";
      return L.divIcon({
        html: `<div class="cam-cluster cam-cluster-${size}">${count}</div>`,
        className: "cam-cluster-div",
        iconSize: L.point(40, 40),
      });
    },
  });

  cameraData.forEach((cam) => {
    const marker = createCameraMarker(cam);
    if (marker) {
      cameraCluster.addLayer(marker);
      cameraMarkers.push(marker);
    }
  });

  map.addLayer(cameraCluster);
  console.log(`📷 ${cameraMarkers.length} kamera haritaya eklendi`);
}

function createCameraMarker(cam) {
  if (!cam.lat || !cam.lng) return null;

  // Kamera ikonu
  const icon = L.divIcon({
    className: "camera-icon-div",
    html: `<div class="camera-icon">📷</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const marker = L.marker([cam.lat, cam.lng], { icon });

  // Popup içeriği
  const popupContent = `
    <div class="camera-popup" style="width:300px;font-family:inherit;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b style="font-size:0.9rem">${cam.name}</b>
        <span style="font-size:0.7rem;color:#888">${cam.provider || ""}</span>
      </div>
      <div class="cam-image-container" style="position:relative;width:100%;height:180px;background:#111;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
        <img src="${cam.url}" alt="${cam.name}"
             style="max-width:100%;max-height:100%;object-fit:cover;border-radius:6px;"
             onerror="this.parentElement.innerHTML='<span style=color:#666;font-size:0.8rem>📷 Kamera kullanılamıyor</span>'"
             loading="lazy" />
        <div style="position:absolute;top:6px;left:6px;background:rgba(220,38,38,0.85);color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px;display:flex;align-items:center;gap:3px;">
          <span style="display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;animation:pulse 1.5s infinite;"></span>
          CANLI
        </div>
      </div>
      <div style="font-size:0.75rem;color:#888;margin-top:6px;text-align:center;">
        📍 ${cam.lat.toFixed(4)}, ${cam.lng.toFixed(4)}
      </div>
    </div>
  `;

  marker.bindPopup(popupContent, {
    maxWidth: 320,
    className: "camera-popup-container",
  });

  return marker;
}

// Kamera verisini manuel güncellemek için (ileride Windy API vs. ile)
function updateCameraData(newCameras, map) {
  if (cameraCluster) {
    map.removeLayer(cameraCluster);
  }
  cameraMarkers = [];
  cameraData = newCameras;
  placeCameras(map);
}

window.initKameraLayer = initKameraLayer;
window.destroyKameraLayer = destroyKameraLayer;
window.updateCameraData = updateCameraData;

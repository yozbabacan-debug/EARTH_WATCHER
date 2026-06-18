#!/usr/bin/env python3
"""
Sonarr Simple - Temiz ve stabil versiyon
"""

import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
from pathlib import Path

import pandas as pd
import requests
from nicegui import ui

# ============== AYARLAR ==============
SONARR_HOST = "http://192.168.2.100:8989"  # Mac Mini IP
SONARR_API_KEY = "5ec6c183d156404c8342d622e1678eb8"
MACMINI_USER = "yamanoozbabacan"
MACMINI_HOST = "192.168.2.100"
SSH_OPTS = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
# Plex medya klasoru - su an bagli degil (kontrol ekrana eklendi)
PLEX_PATH = "/Volumes/video"
# Alternatif Plex yolu (yorum satirini acip kullanabilirsin):
# PLEX_PATH = "/Volumes/YAMAN_i_BackUp/PLEX"
EXCEL_NAME = "/Users/yamanoozbabacan/SONARR_EXPORT/Sonarr_Simple.xlsx"


def _get_volume(path):
    """Sonarr path'inden volume (disk) kök dizinini çıkar.
    Örn: /Volumes/FILMLER_AR/The Boys -> /Volumes/FILMLER_AR"""
    if not path:
        return None
    parts = path.split("/")
    # parts = ['', 'Volumes', 'FILMLER_AR', 'The Boys', ...]
    if len(parts) >= 3 and parts[1] == "Volumes":
        return f"/{parts[1]}/{parts[2]}"
    # Fallback: path'in ilk 2 seviyesi (örn: /pool/TV)
    if len(parts) >= 3:
        return f"/{parts[1]}/{parts[2]}"
    return path


def _ssh(cmd):
    """SSH ile Mac Mini'de komut calistir"""
    full_cmd = f"ssh {SSH_OPTS} {MACMINI_USER}@{MACMINI_HOST} {shlex.quote(cmd)}"
    return subprocess.run(
        full_cmd, shell=True, capture_output=True, text=True, timeout=60
    )


def _find_on_disk(disk, name):
    """Mac Mini'de diskte klasor adiyla ara"""
    try:
        r = _ssh(f'ls "{disk}" 2>/dev/null')
        if r.returncode != 0:
            return None
        for line in r.stdout.strip().split("\n"):
            if name.lower() in line.lower():
                return line.strip()
        return None
    except Exception:
        return None


# ============== VERİ ==============
all_series = []  # Tüm diziler
selected = {}  # Seçimler {id: 'kopya'/'sil'}
display_count = 20  # İlk gösterilecek dizi sayısı


# ============== SONARR ==============
def load_series():
    """Sonarr'dan dizileri yükle"""
    global all_series
    try:
        response = requests.get(
            f"{SONARR_HOST}/api/v3/series",
            headers={"X-Api-Key": SONARR_API_KEY},
            timeout=30,
        )
        data = response.json()

        all_series = []
        for s in data:
            # Poster
            poster = ""
            for img in s.get("images", []):
                if img.get("coverType") == "poster":
                    poster = img.get("remoteUrl", "")
                    break

            # Son bölüm
            last_ep = get_last_episode(s.get("id"))

            # Plex kontrol - seri başlığına göre
            plex = check_plex_by_title(s.get("title"))

            all_series.append(
                {
                    "id": s.get("id"),
                    "title": s.get("title"),
                    "year": s.get("year") or 0,
                    "status": s.get("status"),  # continuing / ended
                    "poster": poster,
                    "last_ep": last_ep,
                    "plex": plex,
                    "path": s.get("path", ""),
                }
            )

        # Yıla göre sırala (yeni önce)
        all_series.sort(key=lambda x: x["year"], reverse=True)
        return True
    except Exception as e:
        print(f"Yükleme hatası: {e}")
        return False


def get_last_episode(series_id):
    """Son bölümü al - episode endpoint'i kullan"""
    try:
        response = requests.get(
            f"{SONARR_HOST}/api/v3/episode?seriesId={series_id}",
            headers={"X-Api-Key": SONARR_API_KEY},
            timeout=10,
        )
        episodes = response.json()

        # hasFile=True olan bölümleri filtrele (indirilmiş olanlar)
        downloaded = [e for e in episodes if e.get("hasFile")]

        if not downloaded:
            return "Yok"

        # En son sezon ve bölümü bul
        last = max(downloaded, key=lambda x: (x["seasonNumber"], x["episodeNumber"]))
        return f"S{last['seasonNumber']:02d}E{last['episodeNumber']:02d}"
    except Exception as e:
        return "Hata"


def isim_parmak_izi(metin):
    """Metni normalize et - Türkçe karakterleri de düzelt"""
    metin = str(metin).lower()
    # Türkçe karakterleri normalize et
    turkce_map = str.maketrans("çğıöşü", "cgiosu")
    metin = metin.translate(turkce_map)
    metin = re.sub(r"\(.*?\)", "", metin)  # Parantez içini sil
    metin = re.sub(
        r"\b19\d{2}\b|\b20\d{2}\b", "", metin
    )  # Sadece 1900-2099 yılları sil
    metin = re.sub(r"[^a-z0-9]", "", metin)  # Sadece harf/rakam
    result = metin.strip()
    # Sadece rakam kaldıysa (örn: "1899" -> "1899"), başka işlem yapma
    return result if result else metin  # Boşsa orijinali döndür


# Plex klasör listesi önbelleği (tek SSH'da çekilir)
_plex_cache = None
_plex_cache_time = 0


def _load_plex_list():
    """SSH ile Mac Mini'den Plex klasör listesini al (önbellekli)"""
    global _plex_cache, _plex_cache_time
    import time

    now = time.time()
    if _plex_cache is not None and now - _plex_cache_time < 300:
        return _plex_cache  # 5 dk önbellek

    try:
        cmd = (
            f'ssh {SSH_OPTS} {MACMINI_USER}@{MACMINI_HOST} "ls {PLEX_PATH} 2>/dev/null"'
        )
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
        if r.returncode == 0 and r.stdout.strip():
            _plex_cache = [x.strip() for x in r.stdout.strip().split("\n")]
            _plex_cache_time = now
            return _plex_cache
        return []
    except Exception:
        return []


def check_plex_by_title(title):
    """Plex'te var mı? - SSH onbellekten kontrol et"""
    try:
        if not title:
            return False

        plex_list = _load_plex_list()
        if not plex_list:
            return False

        sonarr_parmak = isim_parmak_izi(title)

        for plex_name in plex_list:
            plex_parmak = isim_parmak_izi(plex_name)
            if sonarr_parmak == plex_parmak:
                return True

        return False
    except Exception as e:
        return False


def check_plex(path):
    """Plex'te var mı? - Geriye uyumluluk için (PATH'e göre)"""
    try:
        if not path or not os.path.exists(PLEX_PATH):
            return False

        sonarr_name = os.path.basename(path)
        sonarr_parmak = isim_parmak_izi(sonarr_name)

        # PLEX'deki tüm klasörleri listele
        for plex_name in os.listdir(PLEX_PATH):
            plex_parmak = isim_parmak_izi(plex_name)

            # Parmak izleri eşleşiyorsa
            if sonarr_parmak == plex_parmak:
                return True

        return False
    except Exception as e:
        return False


# ============== UI ==============
@ui.page("/")
def main():
    ui.colors(primary="#6366f1", secondary="#8b5cf6", accent="#ec4899")

    # Plex listesini hemen yuklemeye basla (arka planda)
    threading.Thread(target=_load_plex_list, daemon=True).start()

    # iPhone Web App meta tag'leri (Ana Ekrana Ekle özelliği için)
    ui.add_head_html("""
        <!-- iPhone Web App -->
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Sonarr">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    """)

    # Veriyi yükle (arka planda thread ile — UI kilitlenmesin)
    if not all_series:
        with ui.column().classes(
            "w-full h-screen items-center justify-center bg-gray-900 text-white"
        ):
            ui.label("📺 Yükleniyor...").classes("text-2xl")
            loading_label = ui.label("Sonarr'a bağlanılıyor...").classes(
                "text-sm text-gray-400"
            )
            ui.spinner(size="lg")

        # Thread'de yükle
        load_done = threading.Event()

        def load_thread():
            nonlocal load_done
            if load_series():
                load_done.set()

        threading.Thread(target=load_thread, daemon=True).start()

        def check_loaded():
            if load_done.is_set():
                ui.navigate.reload()
            else:
                loading_label.set_text("Hala yükleniyor...")

        ui.timer(0.5, check_loaded)
        return

    # === ÜST MENÜ ===
    with ui.row().classes(
        "w-full bg-gray-900 text-white p-2 items-center justify-between"
    ):
        ui.label("🎬 Sonarr Master").classes("text-xl font-bold")

        with ui.row().classes("gap-2"):
            ui.button("📥 Excel", on_click=export_excel).classes(
                "bg-secondary text-sm px-3 py-1"
            )
            ui.button("⚙️ İşlemler", on_click=show_operations).classes(
                "bg-accent text-sm px-3 py-1"
            )

    # === FİLTRELER ===
    with ui.row().classes("w-full bg-gray-800 p-2 gap-2"):
        filter_opt = ui.select(
            options=["Tümü", "Devam Eden", "Bitti", "Plex Var", "Plex Yok"],
            value="Tümü",
            label="Filtre",
        ).classes("w-36 text-sm")

        sort_opt = ui.select(
            options=["Yıl ↓", "Yıl ↑", "İsim A-Z", "İsim Z-A"],
            value="Yıl ↓",
            label="Sırala",
        ).classes("w-32 text-sm")

        ui.button("🔄 Uygula", on_click=lambda: grid_container.refresh()).classes(
            "bg-primary text-sm px-3 py-1"
        )
        ui.label(f"{len(all_series)} dizi").classes("text-gray-400 ml-auto self-center")

    # === RESPONSIVE CSS ===
    ui.add_css("""
    .poster-card {
        flex: 1 1 calc(100% - 1rem);
        max-width: calc(100% - 1rem);
        min-width: 280px;
    }
    @media (min-width: 640px) {
        .poster-card { flex: 1 1 calc(50% - 1rem); max-width: calc(50% - 1rem); }
    }
    @media (min-width: 1024px) {
        .poster-card { flex: 1 1 calc(25% - 1rem); max-width: calc(25% - 1rem); }
    }
    """)

    # === DİZİ GRİDİ (Refreshable) ===
    @ui.refreshable
    def grid_container():
        filtered = get_filtered(filter_opt.value, sort_opt.value)
        show_count = min(display_count, len(filtered))

        # Responsive flex wrap
        with ui.row().classes("w-full gap-4 flex-wrap justify-center"):
            for series in filtered[:show_count]:
                with ui.element("div").classes("poster-card"):
                    make_card(series)

        # === DAHA FAZLA BUTONU ===
        if show_count < len(filtered):
            with ui.row().classes("w-full justify-center p-4"):

                def load_more():
                    global display_count
                    display_count += 20
                    grid_container.refresh()

                ui.button(
                    f"📥 Daha Fazla Göster ({show_count} / {len(filtered)})",
                    on_click=load_more,
                ).classes("bg-primary text-white px-6 py-2")

    with ui.column().classes("w-full p-4"):
        grid_container()


def get_filtered(filtre, siralama):
    """Filtrele ve sırala - PLEX'i canlı kontrol et"""
    result = all_series[:]

    # PLEX filtrelerinde canlı kontrol - seri başlığına göre
    if filtre in ["Plex Var", "Plex Yok"]:
        # Her seri için PLEX'i yeniden kontrol et
        for s in result:
            s["plex"] = check_plex_by_title(s["title"])

        # DEBUG: PLEX'te olanları yazdır
        if filtre == "Plex Var":
            plex_olanlar = [s["title"] for s in result if s["plex"]]
            with open("/tmp/plex_debug.log", "a") as f:
                f.write(f"PLEX'te olanlar ({len(plex_olanlar)}): {plex_olanlar}\n")

    # Filtre
    if filtre == "Devam Eden":
        result = [s for s in result if s["status"] == "continuing"]
    elif filtre == "Bitti":
        result = [s for s in result if s["status"] == "ended"]
    elif filtre == "Plex Var":
        result = [s for s in result if s["plex"]]
    elif filtre == "Plex Yok":
        result = [s for s in result if not s["plex"]]

    # Sırala
    if siralama == "Yıl ↓":
        result.sort(key=lambda x: x["year"], reverse=True)
    elif siralama == "Yıl ↑":
        result.sort(key=lambda x: x["year"])
    elif siralama == "İsim A-Z":
        result.sort(key=lambda x: x["title"].lower())
    elif siralama == "İsim Z-A":
        result.sort(key=lambda x: x["title"].lower(), reverse=True)

    return result


def make_card(s):
    """Dizi kartı"""
    with ui.card().classes(
        "bg-gray-800 text-white overflow-hidden hover:bg-gray-700 w-full h-full"
    ):
        # Poster (responsive: mobile kısa, desktop uzun)
        if s["poster"]:
            ui.image(s["poster"]).classes("w-full h-64 sm:h-80 lg:h-96 object-cover")
        else:
            ui.label("📺").classes(
                "w-full h-64 sm:h-80 lg:h-96 flex items-center justify-center text-6xl bg-gray-700"
            )

        # Bilgiler
        with ui.column().classes("p-3 gap-1"):
            ui.label(s["title"]).classes("font-bold text-sm truncate")

            # Yıl + Son Bölüm
            with ui.row().classes("gap-2 items-center"):
                ui.label(f"📅 {s['year']}").classes("text-xs text-gray-400")
                if s["last_ep"]:
                    ui.label(f"🎬 {s['last_ep']}").classes(
                        "text-xs bg-yellow-600 px-1 rounded font-bold"
                    )

            # Durum badge
            durum = "▶️ Devam" if s["status"] == "continuing" else "⏹️ Bitti"
            renk = "bg-green-600" if s["status"] == "continuing" else "bg-gray-600"
            ui.label(durum).classes(f"text-xs {renk} px-2 py-0.5 rounded w-fit")

            # PLEX badge
            if s["plex"]:
                ui.label("✅ PLEX").classes(
                    "text-xs bg-green-800 text-green-400 px-2 rounded w-fit"
                )

            # Checkbox'lar
            with ui.row().classes("gap-2 mt-2 pt-2 border-t border-gray-700"):

                def on_kopya(e, sid=s["id"]):
                    if e.value:
                        selected[sid] = "kopya"
                    elif sid in selected:
                        del selected[sid]

                def on_sil(e, sid=s["id"]):
                    if e.value:
                        selected[sid] = "sil"
                    elif sid in selected:
                        del selected[sid]

                is_kopya = selected.get(s["id"]) == "kopya"
                is_sil = selected.get(s["id"]) == "sil"
                ui.checkbox("📋", value=is_kopya, on_change=on_kopya).classes("text-xs")
                ui.checkbox("🗑️", value=is_sil, on_change=on_sil).classes(
                    "text-xs text-red-400"
                )


def export_excel():
    """Excel export"""
    try:
        data = []
        for s in all_series:
            data.append(
                {
                    "DİZİ": s["title"],
                    "YIL": s["year"],
                    "DURUM": "Devam" if s["status"] == "continuing" else "Bitti",
                    "SON BÖLÜM": s["last_ep"],
                    "PLEX": "VAR" if s["plex"] else "YOK",
                    "SEÇİM": selected.get(s["id"], ""),
                }
            )

        os.makedirs(os.path.dirname(EXCEL_NAME), exist_ok=True)
        pd.DataFrame(data).to_excel(EXCEL_NAME, index=False)
        ui.notify(f"✅ {len(data)} dizi Excelde", type="positive")
    except Exception as e:
        ui.notify(f"❌ Hata: {e}", type="negative")


def show_operations():
    """Dosya işlemleri — ŞİMDİ veya GECE seçeneği ile"""
    sil_list = [s for s in all_series if selected.get(s["id"]) == "sil"]
    kopya_list = [s for s in all_series if selected.get(s["id"]) == "kopya"]

    with ui.dialog() as dlg:
        with ui.card().classes("bg-gray-900 text-white"):
            ui.label("⚙️ Dosya İşlemleri").classes("text-xl font-bold mb-4")

            ui.label(f"🗑️ Silinecek: {len(sil_list)}").classes("text-red-400")
            ui.label(f"📋 Kopyalanacak: {len(kopya_list)}").classes("text-green-400")

            # Gece çalıştırma seçeneği
            night_mode = ui.checkbox("🌙 Gece çalıştır (02:00)", value=False)
            night_mode.classes("text-sm mt-2")

            with ui.row().classes("gap-2 mt-4"):
                ui.button("İptal", on_click=dlg.close).classes("bg-gray-600")
                ui.button(
                    "🚀 ŞİMDİ Başlat",
                    on_click=lambda: [
                        dlg.close(),
                        baslat_islemler(sil_list, kopya_list),
                    ],
                ).classes("bg-green-600")
                ui.button(
                    "🌙 Gece 02:00",
                    on_click=lambda: [
                        dlg.close(),
                        do_ops(sil_list, kopya_list, night_mode=True),
                    ],
                ).classes("bg-indigo-600")

    dlg.open()


def _schedule_night(sil_list, kopya_list, saat=2):
    """İşlemleri gece belirtilen saatte çalıştır (nohup ile — app kapansa da çalışır)."""
    import json
    from datetime import datetime, timedelta

    now = datetime.now()
    hedef = now.replace(hour=saat, minute=0, second=0, microsecond=0)
    if hedef <= now:
        hedef += timedelta(days=1)

    bekle_saniye = int((hedef - now).total_seconds())
    bekle_saat = bekle_saniye / 3600

    # İşlem kuyruğunu kaydet
    ops = {
        "sil": [s["id"] for s in sil_list],
        "kopya": [s["id"] for s in kopya_list],
        "zaman": hedef.isoformat(),
    }
    ops_path = "/tmp/sonarr_night_ops.json"
    with open(ops_path, "w") as f:
        json.dump(ops, f)

    # nohup ile arka plana gönder (Terminal kapansa da çalışır)
    python_exe = sys.executable
    script_runner = Path(__file__).resolve()
    script = (
        f"sleep {bekle_saniye} && "
        f'{python_exe} -c "'
        f"import json, subprocess; "
        f"ops=json.load(open('{ops_path}')); "
        f"subprocess.run(['{python_exe}', "
        f"'{script_runner}', '--run-ops', '{ops_path}'])"
        f'" > /tmp/sonarr_night.log 2>&1'
    )
    cmd = f"nohup bash -c '{script}' &"
    subprocess.run(cmd, shell=True)

    simdi_str = now.strftime("%H:%M")
    ui.notify(
        f"🌙 Gece {saat:02d}:00'de çalışacak (şimdi: {simdi_str}, "
        f"bekle: {bekle_saat:.1f} saat) — app'i kapatabilirsin!",
        type="info",
        duration=15000,
    )


def baslat_islemler(sil_list, kopya_list):
    """İşlemleri arka planda başlat (Thread) — UI kilitlenmesin"""
    toplam = len(sil_list) + len(kopya_list)
    if toplam == 0:
        ui.notify("❌ Seçim yapılmadı", type="warning")
        return

    # Paylasimli liste (thread ile ana thread arasinda)
    progress_list = []
    progress_list.append(
        f"⏳ Başlatılıyor... ({len(sil_list)} sil, {len(kopya_list)} kopya)"
    )

    # İlerleme dialogu
    progress_dlg = ui.dialog()
    with progress_dlg, ui.card().classes("bg-gray-900 text-white w-96"):
        ui.label("⚙️ İşlemler Devam Ediyor...").classes("text-xl font-bold mb-4")
        durum = ui.label("Başlatılıyor...").classes("text-sm text-gray-300")
        sayac = ui.label(f"0 / {toplam}").classes("text-sm text-gray-400")
        bar = ui.linear_progress(value=0).classes("mt-2")
        ui.spinner(size="lg").classes("mt-2")
    progress_dlg.open()

    # Thread'de calistir (paylasimli listeyi gonder)
    thread = threading.Thread(
        target=do_ops,
        args=(sil_list, kopya_list, progress_list),
        kwargs={"night_mode": False, "show_ui": False},
        daemon=True,
    )
    thread.start()

    # Timer ile ilerleme kontrolü
    def check():
        _check_progress(thread, progress_list, toplam, durum, sayac, bar, progress_dlg)

    ui.timer(0.5, check)


def _check_progress(thread, results_holder, toplam, durum_label, sayac_label, bar, dlg):
    """Timer callback — thread ilerlemesini kontrol et"""
    if thread.is_alive():
        r = results_holder[:]
        if r:
            son = r[-1][:60]
            durum_label.set_text(f"{son}...")
            sayac_label.set_text(f"{len(r)} / {toplam}")
        return

    # Thread bitti
    dlg.close()
    t = results_holder
    if t:
        with ui.dialog() as result_dlg:
            with ui.card().classes(
                "bg-gray-900 text-white max-w-2xl max-h-96 overflow-y-auto"
            ):
                ui.label(f"📋 {len(t)} İşlem Tamam").classes("text-xl font-bold mb-2")
                for r in t[:25]:
                    color = (
                        "text-green-400"
                        if "✅" in r
                        else "text-red-400"
                        if "❌" in r
                        else "text-yellow-400"
                    )
                    ui.label(r).classes(f"text-sm {color}")
                if len(t) > 25:
                    ui.label(f"... ve {len(t) - 25} diğer").classes(
                        "text-gray-400 text-sm"
                    )
                ui.button("Kapat", on_click=result_dlg.close).classes("mt-4 bg-primary")
        result_dlg.open()

    selected.clear()
    try:
        load_series()
        ui.navigate.reload()
    except Exception:
        pass


def do_ops(sil_list, kopya_list, progress_list=None, night_mode=False, show_ui=True):
    """İşlemleri yap (rsync + gece modu)"""
    if night_mode:
        _schedule_night(sil_list, kopya_list)
        return []

    results = progress_list if progress_list is not None else []
    toplam = len(sil_list) + len(kopya_list)

    # 1. Sil
    for s in sil_list:
        name = s["title"]
        results.append(f"🗑️ Siliniyor: {name}...")

        # --- Mac Mini (Sonarr path'inden diski belirle) ---
        try:
            path = s.get("path", "")
            if not path:
                results.append(f"❌ {name}: Sonarr path bilgisi yok")
            else:
                disk = _get_volume(path)
                folder = _find_on_disk(disk, name)
                if folder:
                    cmd2 = f"rm -rf '{disk}/{folder}'"
                    r2 = _ssh(cmd2)
                    if r2.returncode == 0:
                        results.append(f"✅ Mac Mini silindi: {name}")
                    else:
                        results.append(f"❌ Mac Mini silinemedi: {name}")
                else:
                    results.append(f"❌ Mac Mini'de bulunamadı: {name}")
        except subprocess.TimeoutExpired:
            results.append(f"❌ {name}: SSH zaman aşımı")
        except Exception as e:
            results.append(f"❌ Mac Mini silme hatası: {name} - {e}")

        # --- Plex (/Volumes/video) - SSH ile Mac Mini'den sil ---
        try:
            plex_klasor = f"{PLEX_PATH}/{name}"
            r_check = _ssh(f'test -d "{plex_klasor}" && echo "VAR"')
            if "VAR" in r_check.stdout:
                _ssh(f'rm -rf "{plex_klasor}"')
                results.append(f"✅ Plex silindi: {name}")
            else:
                results.append(f"❌ Plex'te bulunamadı: {name}")
        except Exception as e:
            results.append(f"❌ Plex silme hatası: {name} - {e}")

        # --- Sonarr API: veritabanindan sil ---
        try:
            sid = s.get("id")
            if sid:
                resp = requests.delete(
                    f"{SONARR_HOST}/api/v3/series/{sid}?deleteFiles=false",
                    headers={"X-Api-Key": SONARR_API_KEY},
                    timeout=15,
                )
                if resp.status_code in (200, 202):
                    results.append(f"✅ Sonarr'dan silindi: {name}")
                else:
                    results.append(f"❌ Sonarr API hatası ({resp.status_code}): {name}")
            else:
                results.append(f"❌ {name}: Sonarr ID bulunamadı")
        except Exception as e:
            results.append(f"❌ Sonarr API silme hatası: {name} - {e}")

    # 2. Kopyala — paralel + ilerleme gostergeli
    import concurrent.futures

    def copy_one_series(s):
        """Tek bir diziyi kopyala"""
        name = s.get("title", "Bilinmeyen")
        try:
            path = s.get("path", "")
            if not path:
                return f"❌ {name}: Sonarr path bilgisi yok"

            disk = _get_volume(path)
            src_folder = _find_on_disk(disk, name)
            if not src_folder:
                return f"❌ Mac Mini'de bulunamadı: {name}"

            src = f"{disk}/{src_folder}/"
            dst = f"{PLEX_PATH}/{name}/"

            remote_cmd = f'rsync -a -W --no-o --no-g --info=progress2 "{src}" "{dst}"'
            r = _ssh(remote_cmd)
            if r.returncode == 0:
                return f"✅ Kopyalandı: {name}"
            else:
                hata = r.stderr.strip()[:100] if r.stderr else "bilinmiyor"
                return f"❌ Kopyalama hatası: {name} - {hata}"
        except Exception as e:
            return f"❌ Hata: {name} - {e}"

    if kopya_list:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(copy_one_series, s): s for s in kopya_list}
            for future in concurrent.futures.as_completed(futures):
                try:
                    results.append(future.result())
                except Exception as e:
                    s = futures[future]
                    results.append(f"❌ {s.get('title')}: {e}")

    # Thread'den cagrildiysa (show_ui=False) sadece sonuclari dondur
    if not show_ui:
        return results

    # show_ui=True: gecelik mod veya background cagri
    if results:
        with ui.dialog() as dlg:
            with ui.card().classes(
                "bg-gray-900 text-white max-w-2xl max-h-96 overflow-y-auto"
            ):
                ui.label(f"📋 {len(results)} İşlem Tamam").classes(
                    "text-xl font-bold mb-2"
                )
                for r in results[:25]:
                    color = (
                        "text-green-400"
                        if "✅" in r
                        else "text-red-400"
                        if "❌" in r
                        else "text-yellow-400"
                    )
                    ui.label(r).classes(f"text-sm {color}")
                if len(results) > 25:
                    ui.label(f"... ve {len(results) - 25} diğer").classes(
                        "text-gray-400 text-sm"
                    )
                ui.button("Kapat", on_click=dlg.close).classes("mt-4 bg-primary")
        dlg.open()

    selected.clear()
    try:
        load_series()
        ui.navigate.reload()
    except Exception:
        pass
    return results


if __name__ == "__main__":
    # Gece modu: nohup ile çağrıldığında direkt işlemleri yap, UI açma
    if len(sys.argv) > 2 and sys.argv[1] == "--run-ops":
        import json

        ops_path = sys.argv[2]
        with open(ops_path) as f:
            ops = json.load(f)

        sil_ids = ops.get("sil", [])
        kopya_ids = ops.get("kopya", [])

        # all_series'i yükle
        load_series()

        sil_list = [s for s in all_series if s["id"] in sil_ids]
        kopya_list = [s for s in all_series if s["id"] in kopya_ids]

        print(f"🌙 Gece modu basladi — Sil: {len(sil_list)}, Kopya: {len(kopya_list)}")
        do_ops(sil_list, kopya_list, night_mode=False, show_ui=False)

        # Sonuçları logla
        print(f"🌙 Gece modu tamam — /tmp/sonarr_night.log")
        sys.exit(0)

    # Normal mod: UI
    # launchd ile calisiyorsa native=False (pencere acilmaz)
    import os as _os

    _is_launchd = _os.environ.get("LAUNCHD") == "1" or not _os.environ.get("DISPLAY")
    ui.run(
        title="Sonarr Master",
        host="0.0.0.0",
        port=8080,
        dark=True,
        reload=None,
        native=not _is_launchd,
    )

"""
Earth Analogs – measured terrain axes
-------------------------------------
Replaces the literature estimates of five terrain axes with values MEASURED
from open data, over the same 15 km window used for relief:

  basalt, salts, sediment  <- Macrostrat geologic map units (CC-BY 4.0), sampled
                              at 9 points (3 x 3 grid, 7.5 km step) and scored
                              from each unit's lithology text
  sediment (water history) <- JRC Global Surface Water occurrence 1984-2021
                              (Microsoft Planetary Computer)
  ice                      <- MODIS Terra MOD11A2 land-surface temperature,
                              12 monthly 8-day composites of 2023 (NASA, via
                              Planetary Computer) + ESA WorldCover 2021
                              "permanent snow and ice" fraction
  regolith                 <- ALOS PALSAR L-band HV backscatter, 2021 mosaic
                              (JAXA, via Planetary Computer): loose fines are
                              smooth at 24 cm wavelength and look dark, blocky
                              lava and vegetation look bright. Same physics as
                              LRO Mini-RF roughness maps on the Moon.

Only raw measurements are cached here; build_data.py turns them into 0-1 axes
(see geo_axes() below, also used by build_data.py).

No third-party packages: the Planetary Computer data API computes the zonal
statistics server-side.

Output: data/geology_cache.json  (merged into js/data.js by build_data.py)
Usage:  python pipeline/geology.py              (all sites, resumable)
        python pipeline/geology.py id1 id2 ...  (only these site ids, prints the result)
"""
import json
import math
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "geology_cache.json"
CTX = ssl.create_default_context()
UA = {"User-Agent": "EarthAnalogs/1.0 (NASA Space Apps 2026 student project)", "Content-Type": "application/json"}
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
STATS = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics"
MACRO = "https://macrostrat.org/api/v2/geologic_units/map?lat={lat:.4f}&lng={lon:.4f}"
RADIUS_KM = 15.0
LST_YEAR = 2023


# ---------------------------------------------------------------- helpers
def http_json(url, body=None, tries=3):
    data = None if body is None else json.dumps(body).encode()
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=75, context=CTX) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (400, 404, 422):  # no data for this window: not worth retrying
                return None
            time.sleep(3 * (attempt + 1))
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None


def window(lat, lon, km=RADIUS_KM):
    dlat = km / 111.2
    dlon = km / (111.2 * max(math.cos(math.radians(lat)), 0.05))
    return [lon - dlon, max(lat - dlat, -89.9), lon + dlon, min(lat + dlat, 89.9)]


def feature(b):
    w, s, e, n = b
    return {"type": "Feature", "properties": {},
            "geometry": {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}}


def search(collection, bbox, datetime=None, limit=100):
    body = {"collections": [collection], "bbox": bbox, "limit": limit}
    if datetime:
        body["datetime"] = datetime
    js = http_json(STAC, body)
    return js["features"] if js else []


def item_stats(collection, item_id, assets, bbox, extra=""):
    """Zonal statistics of one item over the window (pixels outside the item are masked)."""
    url = f"{STATS}?collection={collection}&item={urllib.parse.quote(item_id)}&assets={assets}{extra}"
    js = http_json(url, feature(bbox))
    if not js:
        return None
    return js.get("properties", {}).get("statistics", js)


def categorical(collection, bbox, asset, datetime=None):
    """Pixel counts per class value, summed over every item touching the window."""
    counts = {}
    for it in search(collection, bbox, datetime):
        st = item_stats(collection, it["id"], asset, bbox, "&categorical=true")
        band = next(iter(st.values())) if st else None
        if not band or not band.get("valid_pixels"):
            continue
        for n, v in zip(*band["histogram"]):
            counts[int(v)] = counts.get(int(v), 0) + n
    return counts


# ---------------------------------------------------------------- sources
BASALT_STRONG = re.compile(r"basalt|basanit|tholeiit|picrit|mafic|komatiit|gabbro|diabase|dolerit")
BASALT_WEAK = re.compile(r"lava|scoria|cinder|tephra|volcanic|pyroclast|tuff|ignimbrit|andesit")
SALT = re.compile(r"evaporit|halite|gypsum|anhydrit|salt|salar|playa|sabkha|nitrate|borate|trona")
SED_STRONG = re.compile(r"lacustrin|\blake|fluvi|alluvi|delta|river|stream|channel|floodplain|playa|terrace|outwash|glaciofluv")
SED_WEAK = re.compile(r"sediment|sand|silt|clay|mud|conglomerat|gravel|unconsolidated")
SCALE_ORDER = {"large": 0, "medium": 1, "small": 2, "tiny": 3}


# Which map scales can resolve each axis inside a 15 km window. Volcanic fields show up even on
# continental (1:5M, "small") maps; surface deposits such as salt crusts or lake beds only on
# regional/detailed maps. Outside the USA most of Macrostrat is small/tiny scale, so salts and
# sediment there keep the literature value instead of a misleading 0.
AXIS_SCALES = {"basalt": ("large", "medium", "small"), "salts": ("large", "medium"), "sediment": ("large", "medium")}


def macro_point(lat, lon):
    js = http_json(MACRO.format(lat=lat, lon=lon))
    units = (js or {}).get("success", {}).get("data", [])
    units = sorted(units, key=lambda u: SCALE_ORDER.get(u.get("scale"), 4))
    # most detailed map that says something about the rock
    for u in units:
        text = " ".join(str(u.get(k) or "") for k in ("name", "lith", "descrip")).lower()
        if len(text.strip()) < 4:
            continue
        return {
            "unit": (u.get("name") or u.get("lith") or "")[:80],
            "scale": u.get("scale"),
            "basalt": 1.0 if BASALT_STRONG.search(text) else 0.5 if BASALT_WEAK.search(text) else 0.0,
            "salts": 1.0 if SALT.search(text) else 0.0,
            "sediment": 1.0 if SED_STRONG.search(text) else 0.4 if SED_WEAK.search(text) else 0.0,
        }
    return None


def macrostrat(lat, lon):
    step = RADIUS_KM / 2
    kx = 111.2 * max(math.cos(math.radians(lat)), 0.05)
    pts = [(lat + i * step / 111.2, lon + j * step / kx) for i in (0, -1, 1) for j in (0, -1, 1)]
    with ThreadPoolExecutor(3) as ex:
        res = list(ex.map(lambda p: macro_point(*p), pts))
    ok = [r for r in res if r]
    if not ok:
        return None
    out = {"n": len(ok), "unit": (res[0] or ok[0])["unit"], "scale": (res[0] or ok[0])["scale"]}
    for k, scales in AXIS_SCALES.items():
        use = [r[k] for r in ok if r["scale"] in scales]
        if use:
            out[k] = round(sum(use) / len(use), 3)
            out[f"{k}_n"] = len(use)
    return out


def worldcover(bbox):
    c = categorical("esa-worldcover", bbox, "map")
    tot = sum(c.values())
    if not tot:
        return None
    return {"snow_ice": round(c.get(70, 0) / tot, 4), "bare": round(c.get(60, 0) / tot, 4),
            "water": round(c.get(80, 0) / tot, 4)}


def surface_water(bbox):
    c = categorical("jrc-gsw", bbox, "occurrence")
    c = {v: n for v, n in c.items() if v <= 100}  # 255 = no data
    tot = sum(c.values())
    if not tot:
        return None
    return {"ever_wet": round(sum(n for v, n in c.items() if v > 0) / tot, 4),
            "mostly_wet": round(sum(n for v, n in c.items() if v >= 50) / tot, 4)}


PALSAR_YEARS = ("2020", "2019", "2021")  # the 2021 mosaic has gaps (e.g. the Atacama); 2015 has artefacts


def palsar(bbox):
    for year in PALSAR_YEARS:
        num = den = 0.0
        for it in search("alos-palsar-mosaic", bbox, f"{year}-01-01/{year}-12-31"):
            st = item_stats("alos-palsar-mosaic", it["id"], "HV", bbox)
            band = next(iter(st.values())) if st else None
            if not band or not band.get("valid_pixels") or not band.get("median") or band["median"] < 10:
                continue
            db = 20 * math.log10(band["median"]) - 83.0  # JAXA calibration: gamma0 = 10 log10(DN^2) - 83
            num += db * band["valid_pixels"]
            den += band["valid_pixels"]
        if den:
            return {"hv_db": round(num / den, 2), "year": int(year)}
    return None


def lst(bbox):
    items = [it for it in search("modis-11A2-061", bbox, f"{LST_YEAR}-01-01/{LST_YEAR}-12-31", limit=500)
             if it["id"].startswith("MOD11A2")]
    by_date = {}
    for it in items:
        by_date.setdefault(it["properties"]["start_datetime"][:10], []).append(it)
    # first composite of every month
    months = {}
    for d in sorted(by_date):
        months.setdefault(d[:7], d)
    def one(d, k):
        num = den = 0.0
        for it in by_date[d]:
            st = item_stats("modis-11A2-061", it["id"], k, bbox)
            band = next(iter(st.values())) if st else None
            if band and band.get("valid_pixels") and band.get("mean"):
                num += band["mean"] * band["valid_pixels"]
                den += band["valid_pixels"]
        return num / den * 0.02 - 273.15 if den else None  # MOD11 scale factor 0.02 K

    with ThreadPoolExecutor(6) as ex:
        day = [v for v in ex.map(lambda d: one(d, "LST_Day_1km"), months.values()) if v is not None]
        night = [v for v in ex.map(lambda d: one(d, "LST_Night_1km"), months.values()) if v is not None]
    if not day and not night:
        return None
    vals = day + night
    return {"lst_mean_c": round(sum(vals) / len(vals), 2),
            "lst_day_c": round(sum(day) / len(day), 2) if day else None,
            "lst_night_c": round(sum(night) / len(night), 2) if night else None,
            "months": len(months)}


# Bump a source's version when its method changes: cached results of older versions are re-measured.
VERSION = {"macrostrat": 2, "worldcover": 1, "gsw": 1, "palsar": 2, "lst": 1}


def measure(site, prev=None):
    lat, lon = site["lat"], site["lon"]
    bbox = window(lat, lon)
    prev = prev or {}
    old = prev.get("_v", {})
    fns = {"macrostrat": lambda: macrostrat(lat, lon), "worldcover": lambda: worldcover(bbox),
           "gsw": lambda: surface_water(bbox), "palsar": lambda: palsar(bbox), "lst": lambda: lst(bbox)}
    redo = [k for k in fns if prev.get(k) is None or old.get(k, 1) < VERSION[k]]
    with ThreadPoolExecutor(5) as ex:
        jobs = {k: ex.submit(fns[k]) for k in redo}
        out = {k: (jobs[k].result() if k in jobs else prev[k]) for k in fns}
    out["_v"] = dict(VERSION)
    return out


def stale(g):
    return any(g.get(k) is None or g.get("_v", {}).get(k, 1) < v for k, v in VERSION.items())


# ---------------------------------------------------------------- 0-1 axes
def clamp(x):
    return min(max(x, 0.0), 1.0)


def geo_axes(g, relief_m=None):
    """Raw measurements -> 0-1 axes. Returns only the axes that could be measured.
    relief_m (P95-P5 elevation within 15 km) gates the radar: on steep slopes and vegetation,
    L-band brightness says more about topography and plants than about loose fines."""
    out = {}
    m = g.get("macrostrat") or {}
    for k in ("basalt", "salts", "sediment"):
        if m.get(k) is not None:
            out[k] = m[k]
    w = g.get("gsw")
    if w and "sediment" in out:  # surface water seen at least once since 1984 = active fluvial/lacustrine setting
        out["sediment"] = max(out["sediment"], clamp(w["ever_wet"] * 4))
    t, wc = g.get("lst"), g.get("worldcover")
    if t:
        # mean annual land-surface temperature <= -6 C: permafrost almost certain; >= +2 C: none
        ice = clamp((2.0 - t["lst_mean_c"]) / 8.0)
        if wc:
            ice = max(ice, clamp(wc["snow_ice"] * 2))
        out["ice"] = ice
    p = g.get("palsar")
    bare_flat = wc and wc["bare"] >= 0.5 and (relief_m is None or relief_m < 1000)
    if p and bare_flat:
        # smooth loose fines: HV <= -28 dB -> 1; rough rock / vegetation: HV >= -18 dB -> 0
        out["regolith"] = clamp((-18.0 - p["hv_db"]) / 10.0)
    return {k: round(v, 3) for k, v in out.items()}


# ---------------------------------------------------------------- main
def main():
    sys.stdout.reconfigure(encoding="utf-8")  # site names such as Ka'ū break the Windows console codec
    sites = json.loads((ROOT / "data" / "earth_sites.json").read_text(encoding="utf-8"))["sites"]
    only = sys.argv[1:]
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    key = lambda s: f"{s['lat']},{s['lon']}"
    # resumable: only sites never measured, or with a source that failed / was measured with an older method
    todo = [s for s in sites if (s["id"] in only if only else key(s) not in cache or stale(cache[key(s)]))]
    print(f"{len(todo)} sites to measure", flush=True)
    t0 = time.time()
    with ThreadPoolExecutor(3) as ex:  # 3 sites at a time, results saved as they arrive
        futs = {ex.submit(measure, s, cache.get(key(s))): s for s in todo}
        for i, f in enumerate(as_completed(futs), 1):
            s = futs[f]
            cache[f"{s['lat']},{s['lon']}"] = f.result()
            CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")
            ax = geo_axes(f.result())
            cur = {k: s.get(k) for k in ax}
            print(f"[{i}/{len(todo)}] {s['name']} ({time.time() - t0:.0f}s)\n   measured {ax}\n   curated  {cur}", flush=True)
    print("wrote", CACHE)


if __name__ == "__main__":
    main()

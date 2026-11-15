# Earth Analogs 🌍🌕🔴
**Find Earth's twin for every Moon & Mars base site.**

NASA Space Apps Challenge 2026: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

Earth Analogs turns every place (an Earth site, a Moon or Mars landing site, or **any point you click**) into a 15-axis **environmental fingerprint** measured from open NASA data. It then tells you, with evidence, **where on Earth to rehearse your mission**.

## The experience
1. **Crew.** Enter your name and role on board. The role steers the experience without changing any score: a **commander** is pointed to the general mission and the 3-site campaign with its logistics; a **geology specialist** to astrobiology and caves, the shared processes and the evidence; an **engineering specialist** to habitat and mobility, the regolith, relief and thermal-swing match and the field-ready sites. The app draws your mission patch live. The name stays in your browser and is never sent anywhere.
2. **Destination.** Pick a base or landing site on a 3D Moon or Mars, textured with LRO WAC and Viking MDIM 2.1 imagery from NASA Trek.
3. **Mission.** Choose what to test: ISRU and water ice, rover and EVA mobility, caves and radiation shelter, astrobiology, polar light and power, or habitat construction.
4. **Briefing.** A mission code (for example `EA-TRQ-CAV-01`), the destination's measured facts and why this mission is rehearsed on Earth first. You accept the mission.
5. **Journey.** Commander Vega, the mission guide, narrates every step in a speech bubble. When sound is on she speaks aloud through the browser's own speech synthesis. She reacts to each destination with its measured facts, and the viewer can fold her away.
   - Boarding: the hatch closes and the view moves inside the cabin, with a window frame around the globe.
   - Mission control polls the live data links GO or NO-GO with real requests (NASA POWER, Copernicus DEM, Planetary Computer, Macrostrat). A link that does not answer reports "GO on stored data", because the verdict uses the stored dataset.
   - A countdown, then lift-off.
   - A cockpit read-out counts down **today's real distance** to Earth (Moon: Meeus lunar theory; Mars: JPL mean orbital elements, both checked against known perigees and oppositions), speed in km/h, kilometres travelled and mission day. Time is compressed, and the HUD says so: about 3 days from the Moon, about 259 days and 587 million km on a Hohmann transfer from Mars.
   - Through the window: **NASA EPIC's latest real photograph of the whole Earth** (DSCOVR, 1.5 million km away), the frame whose centre is closest to the landing site.
   - **The International Space Station, live**: its real position, altitude and speed right now, shown on the globe.
   - Re-entry over the winning site (altitude, speed, phase), then touchdown.
   - The hatch opens: the first look outside is a real photograph of the site (Wikimedia Commons, credited) or its satellite view.
   - "Skip the journey" (or Esc) jumps straight to the verdict, and `prefers-reduced-motion` shortens every step.
6. **Verdict.** *"Jimmy, based on this data analysis, the best place on Earth to rehearse … is …"*, with the reasons, what the site **cannot** simulate, and a **side-by-side profile**: one row per characteristic with the Earth site (circle) and the destination (diamond) on the same 0–1 scale, the mission's key characteristics first. **Compare** on any reverse twin opens the same chart for that Moon or Mars site. A **guided tour** starts with the place itself (the twin, a real photo and same-scale view, why it was chosen, the profile, the shared processes) and then walks through Top 10, Campaign, Global map, Evidence and Scan. The **certificate is earned**: a 4-round **field test** built from your own analysis (closest match, biggest gap, a shared process, the campaign partner), 20 seconds per round, 3 right answers to pass. The PNG carries your patch, the mission code, the destination, the Earth twin, its score and your test result. The data downloads (site card .md, full ranking .csv) sit in the Evidence tab.
7. **Explore.** Five tabs:
   - **Top 10**: best match, *untapped* (new analogs) or *field-ready*.
   - **Campaign**: 3 complementary sites linked by arcs on the globe.
   - **Evidence**: the source of every number.
   - **Scan**: click any point on the planet to fingerprint it live.

**Start from Earth.** Tap any point (or a catalog site): the app measures it live and tells you which Moon or Mars site it resembles. **Fly to it**: you board at your own place, lift off from Earth, cruise with today's real distance, land (powered descent on the Moon, entry and parachutes on Mars) and open the hatch on the destination's orbital view. Then you pick a mission and the app finds the best place on Earth to rehearse it, which may be yours.

**Processes, not only places.** Seven surface processes (running water, evaporation, wind, ice, volcanism, thermal cycling, impacts). For each destination the app lists the ones its missions documented, active today or recorded in old rock (`js/processes.js`). On Earth they are read from measured data: mean wind (NASA POWER WS10M) over bare ground, temporary water that appears and dries out away from the sea (JRC Global Surface Water), salts with little rain, ground temperature below freezing (MODIS), volcanoes with eruptions this century, daily temperature swing. The verdict and the Compare card show the shared processes and what each pairing teaches; the most useful is a process **active on Earth today** that is **only ancient** at the destination, because it can be watched at work here to read the traces it left there.

**Colours follow the world on screen**: the globe's halo and the glow of space turn silver at the Moon, rust at Mars and blue back on Earth.

The interface is available in Spanish and English, including the site names, notes, countries and evidence lines that live in the data files (`js/i18n-data.js`). Quotes from sources (geologic map unit names, photo credits, English-only Wikipedia summaries) stay as written. Mission sounds are synthesised in the browser with Web Audio (no audio files) and are off until you turn them on.

## What makes it different
| Idea | What it does |
|---|---|
| **Same yardstick on three worlds** | Relief is measured identically (P95–P5 elevation within 15 km on a 2 km grid): LRO LOLA on the Moon, MGS MOLA on Mars, and the Copernicus DEM on Earth. |
| **Measured planetary profiles** | **Lunar ice and cold:** 2.88 M elements of the LRO Diviner Polar Resource Product, streamed from PDS. **Martian ice:** the Mars Odyssey neutron map plus SHARAD radar for buried glaciers. **Seasonal light:** an orbital insolation model. |
| **Earth climate from NASA POWER** | 25-year climatology (2001–2025) for aridity, cold, thermal swing, pressure (corrected to the true elevation), solar and UV exposure, and seasonal light. |
| **Provenance on every number** | Each axis carries a *measured*, *geologic map*, *mission* or *literature* badge, so judges and scientists can see exactly what is data and what is an estimate. |
| **Mission-aware scoring** | Weights depend on what you are testing. |
| **Untapped analog finder** | Opportunity = similarity × (1 − current analog usage). It surfaces places nobody has used yet. |
| **Analog Campaign Builder** | A greedy set-cover picks 3 complementary sites that cover 90–96% of the target, against about 60–70% for the best single site. |
| **🪨 Measured terrain** | Five terrain axes are no longer literature guesses (`pipeline/geology.py`): **ground ice** from MODIS land-surface temperature (12 monthly composites) plus ESA WorldCover glaciers; **loose regolith** from JAXA ALOS PALSAR L-band radar (fine loose material is smooth at 24 cm and looks dark, the same physics as LRO Mini-RF on the Moon); **basalt, salts and lake/river sediments** from Macrostrat geologic maps sampled at 9 points, plus JRC Global Surface Water (1984–2021) for water history. All raster statistics are computed server-side by Microsoft Planetary Computer. |
| **Live scan** | Click anywhere and the app queries NASA POWER, the DEM, MODIS, ALOS PALSAR, ESA WorldCover, JRC Global Surface Water and Macrostrat in the browser and fingerprints the point in seconds (up to 13 of 15 axes measured live). |
| **🔥 Global heat map** | The whole land surface is scored on a 2.5° grid of NASA POWER climatology (`pipeline/global_grid.py`). Bright = alike. The app lists the most promising **uncatalogued zones**: the best cells more than 700 km from any known analog, which are candidates for *new* analogs. |
| **🌿 Measured vegetation** | The "no vegetation" axis comes from MODIS Terra MOD13Q1 NDVI (250 m, ORNL DAAC web service) for every site and every live scan (`pipeline/ndvi.py`). |
| **📷 Get to know the place** | A "Get to know the place" window for every site. It shows a Wikimedia Commons photo with author and licence, and the Wikipedia summary (Spanish or English). Below them is a **same-scale slider**: a 40 × 40 km Landsat view of the Earth site against the LRO WAC or Viking view of the target, both in the same local projection with one scale bar (`pipeline/site_views.py`, `pipeline/wiki.py`). |
| **🔄 Reverse twin** | Start from Earth: tap any place (or a catalog site) and the app tells you which Moon or Mars site it most resembles, then flies the globe there. |

## Key findings
- **Lunar lava-tube base (Mare Tranquillitatis pit):** the best twin is **Harrat Khaybar and the Umm Jirsan lava tube** (Saudi Arabia), a hyperarid basaltic field almost never used as an analog.
- **Arcadia Planitia ice (ISRU):** the **Changtang Plateau** (Tibet) ranks #1.
- **Lunar south pole (polar light):** **McMurdo Dry Valleys** and the untapped **Miller Range blue-ice fields** come out on top. A 3-site campaign covers 96% of the fingerprint.
- **Jezero (astrobiology):** the untapped Saharan sites **Gilf Kebir** and **Aorounga** stand out, together with Licancabur.
- **🇪🇨 Ecuador:** Galápagos lava fields (**Sierra Negra #5, Fernandina #6**) are in the global top 10 for the lunar lava-tube pit, and Fernandina is the #2 untapped analog for lunar and Martian caves. **Arenal del Chimborazo** (4,300 m, 3 h from Quito) is #7 for habitat construction at Gale Crater. Measured MODIS surface temperature shows no permafrost there, so it is *not* an ice analog, which corrects our earlier literature estimate.
- **Processes at work today:** the Galápagos shields (Sierra Negra, Fernandina) and Kīlauea are building lava flows and tubes now, the process that shaped the Mare Tranquillitatis pit and the Arsia Mons caves more than 3 billion and hundreds of millions of years ago. The Qaidam Basin floods and dries today, a live version of the lake and evaporite record at Jezero, Gale and Meridiani. Living glaciers (Miller Range, McMurdo, Changtang) are the active counterpart of Deuteronilus Mensae's ancient debris-covered glaciers.
- **Robustness:** replacing literature guesses with measured terrain (MODIS, ALOS PALSAR, WorldCover, JRC, Macrostrat) left the main findings in place. Harrat Khaybar, Changtang, McMurdo / Miller Range and Gilf Kebir / Aorounga keep their places.

## Run it
No build step is needed.
```bash
python -m http.server 8765
```
Then open http://localhost:8765. Deep links work too, for example `#t=moon_shackleton&p=power&m=match`, which opens straight on a verdict for demos.

After changing any CSS/JS file, bump the `?v=` number on the `<link>`/`<script>` tags in `index.html` so browsers don't keep an old cached copy:
```bash
V=$(date +%Y%m%d%H%M); sed -i -E "s#(css/styles\.css|js/[a-z0-9]+\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
```

## Rebuild the datasets
```bash
python pipeline/planetary.py
```
This downloads LOLA, MOLA and the Odyssey neutron map (about 70 MB) and streams the 605 MB Diviner table. The result is written to `data/planetary_measurements.json`.

```bash
python pipeline/build_data.py
```
This fetches NASA POWER and the Copernicus DEM for the Earth sites, then merges everything into `js/data.js`.

```bash
python pipeline/textures.py
```
This builds the globe textures from NASA GIBS and NASA Trek.

```bash
python pipeline/ndvi.py
```
This fetches MODIS NDVI for the catalog sites. Run `build_data.py` afterwards so the values are merged.

```bash
python pipeline/geology.py
```
This measures the terrain axes (ice, regolith, basalt, salts, sediment) for every catalog site through the Microsoft Planetary Computer data API and Macrostrat. It is resumable, needs no extra Python packages and takes about 15 minutes. Run `build_data.py` afterwards so the values are merged.

```bash
python pipeline/site_views.py
```
```bash
python pipeline/wiki.py
```
These build the same-scale satellite views (NASA GIBS Landsat/MODIS and NASA Trek) and the photos and summaries (Wikipedia/Commons).

```bash
python pipeline/global_grid.py
```
This builds the global heat-map grid from the NASA POWER regional API. It is resumable and polite, and takes about 30 minutes.

## Project layout
```
index.html               UI shell
css/styles.css
js/engine.js             fingerprint, similarity, campaign builder (pure functions)
js/app.js                3D globe (globe.gl), guided flow, launch animation, verdict, live scan
js/i18n.js               Spanish / English
js/patch.js              mission patch and certificate (canvas)
js/sound.js              mission sounds (Web Audio, off by default)
js/guide.js              Commander Vega, the guide (speech bubble + optional voice)
js/astro.js              today's Earth–Moon and Earth–Mars distances
js/i18n-data.js          Spanish names, notes, countries and evidence lines for the data
js/data.js               generated dataset (45 Earth sites + 9 targets)
assets/                  globe textures (NASA GIBS Blue Marble, LRO WAC, Viking MDIM 2.1)
data/earth_sites.json    curated Earth catalog (terrain axes, usage, access)
data/targets.json        Moon/Mars targets, evidence, sources
data/planetary_measurements.json  output of planetary.py
pipeline/planetary.py    LOLA / MOLA / Diviner / Odyssey processing
pipeline/build_data.py   NASA POWER + DEM + merge
pipeline/geology.py      measured terrain axes (MODIS LST, ALOS PALSAR, WorldCover, JRC GSW, Macrostrat)
pipeline/textures.py     globe textures
docs/SUBMISSION.md       Space Apps project text and 30-s video script
```

## Data sources
- **NASA POWER** Climatology API v2 (2001–2025)
- **LRO LOLA** LDEM_16 and **MGS MOLA** MEGDR (16 px/deg), from the PDS Geosciences Node
- **LRO Diviner** Polar Resource Product (DLRE_PRP_SOUTH)
- **Mars Odyssey** Neutron Spectrometer epithermal map (GRS special products) and **MRO SHARAD** results (Plaut et al. 2009; Morgan et al. 2021)
- **NASA GIBS** Blue Marble and **NASA Trek** (LRO WAC, Viking MDIM 2.1) for the 3D globes
- **Copernicus GLO-90 DEM** through the Open-Meteo elevation API
- Through **Microsoft Planetary Computer**: **MODIS Terra MOD11A2** land-surface temperature 2023 (NASA), **ALOS PALSAR** annual L-band mosaic 2020 (JAXA), **ESA WorldCover** 2021, **JRC Global Surface Water** 1984–2021
- **Macrostrat** geologic map units (CC-BY 4.0)
- **NASA EPIC** (DSCOVR) natural-colour Earth images, **wheretheiss.at** for the live ISS position
- Mission measurements: MSL REMS and RAD, Mars 2020 MEDA, LADEE, LCROSS, CRaTER

## Honest limitations
- **What is measured:**
  - Earth sites: 6 climate axes, relief, vegetation (MODIS NDVI), ground ice (MODIS LST + WorldCover), loose regolith (ALOS PALSAR) and lithology (Macrostrat maps). Where a source has no coverage (radar and WorldCover over Antarctica, MODIS NDVI over ice sheets) the site keeps its literature value, and the Evidence tab says so.
  - Targets: relief, ice, seasonal light and polar cold.
  - Mission measurements fix the saturating axes (vacuum, cold, radiation).
- **What is estimated:** impact structures and caves come from the literature, because they cannot be detected globally from orbit. Outside the USA, Macrostrat mostly has continental-scale maps (1:5M): they resolve volcanic fields (basalt) but not salt crusts or lake beds, so salts and sediment keep the literature value there.
- **Proxies, not direct measurements:** mean land-surface temperature below 0 °C indicates permafrost but does not prove ground ice. L-band radar darkness indicates a smooth, fine surface, but slopes and vegetation also look bright, so the radar is used only on bare (≥50% WorldCover bare ground), non-mountainous (relief < 1,000 m) windows. Salt flats are smooth too, so the radar rates them like loose regolith.
- **Global heat map:** it uses only the 6 climate axes, so it is a first screening. Tapping a cell runs the full live scan.
- **Odyssey neutrons:** they sense only the top ~1 m, with a footprint of hundreds of km.
- **NASA POWER resolution:** its grid is about 0.5°, which smooths out microclimates.
- **Lunar seasons:** the Moon's 14-day night is not a seasonal effect, so the "seasonal light" axis does not capture it.
- **Always beyond Earth:** vacuum, low gravity, cosmic rays and cold traps below 40 K.

## Use of Super Intelligence (SI)
An AI coding assistant (Claude, by Anthropic) helped write the code (`js/`, `css/`, `index.html`), the data pipeline (`pipeline/`) and the documentation. The team reviewed the data choices, the scoring and the findings. The datasets in `data/` and `js/data.js` are computed by the pipeline from the NASA and partner sources listed above; no values are AI-generated. The app contains no AI-generated images, video or audio.

---

## 🇪🇸 Resumen en español
**Earth Analogs** busca el "gemelo terrestre" de cada sitio de base en la Luna o Marte.

**Perfiles medidos con datos reales de NASA:**
- **Relieve:** LOLA en la Luna, MOLA en Marte y DEM Copernicus en la Tierra, con la misma métrica en los tres mundos.
- **Hielo:** Diviner en la Luna; Mars Odyssey más radar SHARAD en Marte.
- **Clima terrestre:** 25 años de NASA POWER.
- **Luz estacional:** un modelo orbital.

**Experiencia guiada:**
1. Eliges el destino en un globo 3D de la Luna o Marte.
2. Eliges la misión (ISRU, cuevas, movilidad…).
3. Lanzas la nave. La "computadora de misión" muestra el análisis y la nave aterriza en el mejor sitio de la Tierra con el veredicto: *"Según este análisis de datos, el mejor lugar es…"*.

**Además, la app permite:**
- Ver por qué se eligió el sitio y qué no puede simular.
- Revisar la evidencia de cada número.
- Armar una campaña de 3 sitios que cubre el 90–96% del objetivo.
- Escanear en vivo cualquier punto del planeta (clima, relieve, vegetación, hielo, regolito y litología).
- Ver **geología medida**, no estimada: hielo con temperatura superficial MODIS, regolito con radar ALOS PALSAR (JAXA) y basalto, sales y sedimentos con mapas geológicos (Macrostrat) y agua superficial JRC, vía Microsoft Planetary Computer.
- Ver un **mapa de calor de toda la Tierra** con las zonas más parecidas que nadie ha catalogado.
- Usar el **gemelo inverso**: empiezas desde un lugar de la Tierra y te dice a qué sitio de la Luna o Marte se parece.

**Uso de IA:** un asistente de programación con IA (Claude) ayudó a escribir el código, el pipeline de datos y la documentación. El equipo revisó los datos, el puntaje y los hallazgos. Los datos vienen de las fuentes de NASA y agencias socias; ninguno es generado por IA.

**Ecuador:** Sierra Negra (#5) y Fernandina (#6), en Galápagos, están en el top 10 mundial para la cueva lunar de Mare Tranquillitatis, y Fernandina es el #2 de los análogos de cuevas sin explotar. El Arenal del Chimborazo es #7 para construir hábitats en el cráter Gale. La temperatura superficial medida con MODIS indica que allí no hay permafrost, así que no es un análogo de hielo, como suponíamos antes.

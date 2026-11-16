# Space Apps 2026 – Project submission (Earth Analogs, Team MIAUTECH)

> Copy each section into the field with the same name on the Space Apps project page. Everything in this file is in English, as the rules require. A Spanish copy for the team is in `SUBMISSION.es.md`; do not paste that one into the form.

## Before pressing "Submit for Judging"
- [ ] Deadline: **Sunday 15 November 2026, 23:59**, in the Team Owner's local time (Ecuador, UTC−5).
- [ ] Open every link below in a private window and check that it plays or loads without signing in.
- [ ] Paste each field, attach a screenshot if you like (`media/screenshot-verdict.png`, `media/screenshot-nasa.png`, under 10 MB each), tick the "Terms and Conditions" box and press **Submit for Judging**. Saving alone does not submit.
- [ ] Optional: request a FortiGuard web-filter rating for `jimmyguajan.github.io` (category: Education; company name: N/A), so judges' networks do not block the site.

## Team
**MIAUTECH**: Jimmy Guajan, Mary Claudio, Anderson Lema.

## Project name
**Earth Analogs: Find Earth's twin for every Moon & Mars base site**

## High-level project summary
Before astronauts build a base at the lunar south pole or drill for ice on Mars, they rehearse in places on Earth that behave like those worlds. Yet analog sites are rarely compared with their destination in numbers, and new candidates are seldom searched for.

Earth Analogs measures the Moon, Mars and 45 Earth sites on the same 15 axes with open data: 25 years of NASA POWER climate, LRO LOLA, MGS MOLA and Copernicus relief, LRO Diviner and Mars Odyssey ice, MODIS ground temperature and vegetation, JAXA ALOS PALSAR radar, ESA WorldCover and Macrostrat geology.

A guided 3D journey lets a planner pick a base site and a mission goal, fly back to Earth and land on the best twin, with an explained verdict: why it matches and what it cannot simulate. The app also shows where NASA already trains and how our ranking places those sites, finds untapped analogs, builds 3-site campaigns that cover 90–96% of a target, paints a global similarity map, and fingerprints any point on Earth live.

It matters because choosing the right place to rehearse saves time, money and risk before a crew leaves Earth.

## Link to project demo
- Video, English narration (28 s): https://jimmyguajan.github.io/earth-analogs/media/earth-analogs-demo-en.mp4
- Same video with Spanish narration and English subtitles (28 s): https://jimmyguajan.github.io/earth-analogs/media/earth-analogs-demo-es.mp4

## Link to final project
- Live app (opens in English; Spanish is one click away): https://jimmyguajan.github.io/earth-analogs/
- One click to a result: https://jimmyguajan.github.io/earth-analogs/#t=moon_shackleton&p=power&m=match
- Source code, data pipeline and tests: https://github.com/JimmyGuajan/earth-analogs

## Detailed project description
**What it does.** Earth Analogs answers one question for mission planners, scientists and students: *which place on Earth best rehearses this Moon or Mars base, for this mission, and what can it not rehearse?* A visitor registers as a crew member (commander, geology or engineering), picks a base site (3 on the Moon, 6 on Mars) and a mission (ISRU, caves, habitat, mobility, astrobiology, polar power or general), and flies back to Earth while the mission computer runs the analysis. The ship lands on the best twin and the verdict panel explains the result. A guided tour, a final quiz and a mission certificate turn the analysis into a learning experience.

**How it works**
1. **Earth fingerprint.** NASA POWER climatology gives six axes:
   - aridity, from PRECTOTCORR and RH2M
   - cold, from T2M
   - thermal swing, from T2M_RANGE
   - thin air, from PS corrected to the true DEM elevation
   - solar/UV exposure, from ALLSKY_SFC_SW_DWN and the UV index
   - seasonal light, from the darkest/brightest month ratio

   Relief comes from the Copernicus GLO-90 DEM.
2. **Measured planetary profiles** (`pipeline/planetary.py`, raw PDS data):
   - **Relief** uses the same P95–P5 / 15 km metric on all three worlds: LRO LOLA LDEM_16 on the Moon and MGS MOLA MEGDR on Mars.
   - **Lunar ice and cold:** we stream the 605 MB LRO Diviner Polar Resource Product (2.88 M mesh elements). For Shackleton, ice is stable within 1 m in 35% of the area and the mean surface temperature is 120 K.
   - **Martian ice:** the Mars Odyssey neutron epithermal map, combined with SHARAD radar results for buried glaciers.
   - **Seasonal light:** an orbital insolation model built from NASA Planetary Fact Sheet elements, using the same formula as Earth.
   - **Saturating axes** (vacuum or 0.6 kPa, -60 °C, radiation) use rover and orbiter measurements (REMS, MEDA, RAD, LADEE, CRaTER) and are clipped to Earth's extreme.
3. **Provenance.** Every axis is labeled *measured*, *geologic map*, *mission* or *literature* in an Evidence tab.
4. **Similarity.** The score is 100 × (1 − weighted RMS distance), with weights set by the mission profile.
5. **Untapped analogs.** The opportunity score is similarity × (1 − 0.75 × current usage).
6. **Campaign builder.** A greedy weighted max-coverage pass picks 3 complementary sites. The coverage gap shows what Earth cannot reproduce.
7. **Live scan.** For any clicked point, the browser calls NASA POWER, the DEM, the ORNL DAAC MODIS service, the Microsoft Planetary Computer data API and Macrostrat (all CORS-enabled, no key).
8. **Vegetation.** MODIS Terra MOD13Q1 NDVI (250 m), averaged over four 2023 seasonal composites in a 4 km window, replaces the literature value of the "no vegetation" axis.
9. **Measured terrain** (`pipeline/geology.py`, 15 km window like relief). Ground ice is the mean land-surface temperature of 12 monthly MODIS Terra MOD11A2 composites (2023) plus ESA WorldCover permanent snow and ice. Loose regolith is the JAXA ALOS PALSAR L-band HV backscatter (2020 mosaic): fine, loose material is smooth at 24 cm and looks dark, the same physics LRO Mini-RF uses on the Moon. It is applied only on bare, non-mountainous ground. Basalt, salts and lake/river sediments come from Macrostrat geologic map units sampled at 9 points, using each map scale only for what it can resolve, plus JRC Global Surface Water (1984–2021). The Planetary Computer computes all raster statistics server-side, so the pipeline needs no GIS libraries.
10. **Processes, not only places** (`js/processes.js`). Seven processes: running water, evaporation, wind, ice, volcanism, thermal cycling and impacts. Each destination lists the ones its missions documented, active today or ancient. On Earth they are read from measured data: NASA POWER mean wind (WS10M) over bare ground, temporary water away from the sea (JRC GSW), salts with little rain, sub-zero ground temperature (MODIS LST), eruptions this century, and the daily temperature swing. The verdict shows the shared processes and what each pairing teaches.
11. **Global heat map.** NASA POWER regional climatology for every 10°×10° land box, thinned to a 2.5° grid. Hotspots are the best-scoring cells more than 700 km from any catalogued analog.
12. **Get to know the place.** Each site opens a credited Commons photo and the Wikipedia summary. A slider compares a 40 × 40 km NASA view of the Earth site (Landsat WELD, or MODIS in Antarctica) with the Moon or Mars target (LRO WAC or Viking from NASA Trek). Both are resampled into the same local projection and scale, so the lunar south pole is not distorted.
13. **Reverse twin.** An Earth fingerprint is compared against all 9 targets with balanced weights.
14. **Where NASA trains** (`js/nasa.js`). 12 catalogue sites that NASA or NASA-funded teams have used (Holuhraun, where the Artemis II crew trained in geology in 2024; Haughton-Mars Project; Craters of the Moon; Meteor Crater; Ries; BASALT at Kaʻū; MARTE at Río Tinto; and others) carry a NASA badge and a credited photo from the NASA Image and Video Library. The Top 10 tab shows where our ranking places each one for the chosen mission. It also lists 7 NASA field sites outside the catalogue (Black Point Lava Flow, Cinder Lake, Sierra Blanca, Kapoho) that can be measured live, and the closed habitats (HI-SEAS, NEEMO, HERA/CHAPEA), labelled as isolation analogs rather than terrain analogs.

**Benefits**
- Mission teams get a quantitative, explainable reason to choose a test site, and they know what it *cannot* test.
- The tool points field science toward under-characterized regions.
- It is open and reproducible. It runs from static files, needs no API key, and the pipeline rebuilds everything from public archives.

**Findings from the current dataset**
- *Lunar lava-tube base (Mare Tranquillitatis pit, caves profile):* **Harrat Khaybar and the Umm Jirsan lava tube (Saudi Arabia)** score 64/100. It is a hyperarid basaltic field almost never used as a space analog.
- *Arcadia Planitia ice (ISRU):* the **Changtang Plateau (Tibet)** ranks #1, with 52 kPa pressure, permafrost and an arid climate.
- *Lunar south pole (polar light):* **McMurdo Dry Valleys** and the untapped **Miller Range blue-ice fields** come out on top. A 3-site campaign (McMurdo + Dome C + Aorounga) covers 96%.
- *Jezero (astrobiology):* the untapped Saharan sites **Gilf Kebir** and **Aorounga** stand out, together with Licancabur.
- *Checked against NASA's own choices:* for the lunar south pole (polar light and power) our #1 is the **McMurdo Dry Valleys**, and for Meridiani Planum (astrobiology) it is **Salar de Pajonales**. NASA-funded teams already work at both. Where our #1 is not a NASA site, the app names it as an untapped analog.
- *Validation:* without being told, the reverse twin pairs **Atacama with Meridiani Planum**, a pairing the literature already uses for sulfates and perchlorates. **Haughton Crater** comes out as a polar and impact analog.
- *Ecuador as an accessible node:* the Galápagos shields **Sierra Negra (#5)** and **Fernandina (#6)** rank in the global top 10 for the lunar lava-tube pit, and Fernandina is the #2 untapped cave analog for the Moon and Mars. **Arenal del Chimborazo** (4,300 m, 3 h from Quito) is #7 for habitat construction at Gale Crater; measured surface temperature rules it out as an ice analog.
- *Processes at work today:* the Galápagos shields (Sierra Negra, Fernandina) and Kīlauea build lava flows and tubes now, the process that shaped the Mare Tranquillitatis pit and the Arsia Mons caves billions and hundreds of millions of years ago. The Qaidam Basin floods and dries today, a live version of the lake and evaporite record at Jezero, Gale and Meridiani. Living glaciers (Miller Range, McMurdo, Changtang) are the active counterpart of Deuteronilus Mensae's buried glaciers.
- *Robustness:* when five terrain axes switched from literature estimates to measurements, the findings above kept their places.

**Tools**
HTML/CSS/JavaScript, globe.gl (Three.js), Web Audio and Web Speech APIs, Python 3 + NumPy + Pillow, Microsoft Planetary Computer data API.

**Creativity**
Analog selection becomes a recommender problem with measured, comparable fingerprints across three worlds. The question changes from "which famous site?" to "which combination of sites covers this mission, and what is left?". The result is told as a mission story: launch, travel, landing and verdict.

**Limitations**
- Impact structures and caves are still literature-based, because they cannot be detected globally from orbit. Outside the USA, Macrostrat maps are mostly continental-scale, so salts and sediments keep literature values there. The next step is the Earth Impact Database and finer lithology maps.
- Surface temperature indicates permafrost but does not prove ground ice; radar smoothness also rates salt flats as loose regolith.
- Odyssey neutrons see only the top ~1 m at coarse resolution.
- NASA POWER's grid is about 0.5°.
- Scores support decisions. They do not certify sites.

**What we hope to achieve**
- Give analog-site selection a transparent, repeatable yardstick that any team can audit and extend.
- Point field science toward untapped places, including accessible ones in Latin America such as the Galápagos lava fields and the Chimborazo ash plains.
- Let students and the public see how open NASA data turns into a real planning decision, in English and Spanish.

## Use of Super Intelligence (SI)
An AI coding assistant (Claude, by Anthropic) helped write the code (`js/`, `css/`, `index.html`), the data pipeline (`pipeline/`), the tests (`tests/`) and this text. The team chose the challenge approach, the data sources, the scoring and the findings, and reviewed every result. The datasets in `data/` and `js/data.js` are computed by the pipeline from the NASA and partner sources listed below; no data values are AI-generated. The app contains no AI-generated images. The demo video is made from screen captures of the app; its narration is a synthetic voice (Microsoft Windows text-to-speech), which the video's end card and file metadata state.

## NASA data
- NASA POWER Climatology API (2001–2025): https://power.larc.nasa.gov
- LRO LOLA LDEM_16; MGS MOLA MEGDR; LRO Diviner Polar Resource Product; Mars Odyssey GRS/NS epithermal map, all from the PDS Geosciences Node: https://pds-geosciences.wustl.edu
- MODIS Terra MOD13Q1 NDVI through the ORNL DAAC MODIS Web Service: https://modis.ornl.gov/data/modis_webservice.html
- MODIS Terra MOD11A2 land-surface temperature (2023) through Microsoft Planetary Computer
- NASA GIBS (Blue Marble): https://gibs.earthdata.nasa.gov
- NASA Moon Trek and Mars Trek (LRO WAC mosaic, Viking MDIM 2.1): https://trek.nasa.gov
- NASA Image and Video Library (credited training photos) and NASA's planetary-analogs overview: https://images.nasa.gov, https://science.nasa.gov/solar-system/planetary-analogs/
- Mission measurements cited: MRO SHARAD, MSL REMS and RAD, Mars 2020 MEDA, LADEE, LCROSS, LRO CRaTER, LRO Mini-RF
- NASA EPIC (DSCOVR) natural-colour Earth images, shown live during the journey: https://epic.gsfc.nasa.gov
- NASA Image and Video Library, for credited photos of NASA analog training: https://images.nasa.gov
- NASA's planetary-analogs overview and analog program pages (Haughton-Mars Project, Desert RATS, NEEMO, HI-SEAS, HERA and CHAPEA): https://science.nasa.gov/solar-system/planetary-analogs/

## Space agency partner data and other references
- Copernicus GLO-90 DEM (ESA) through the Open-Meteo elevation API
- ALOS PALSAR annual mosaic (JAXA), ESA WorldCover 2021 and JRC Global Surface Water, through Microsoft Planetary Computer (a Space Apps global offer): https://planetarycomputer.microsoft.com
- Macrostrat geologic map units (CC-BY 4.0): https://macrostrat.org
- Chandrayaan-1 M3 (ISRO) and Kaguya (JAXA), cited in the target evidence
- Live ISS position: https://wheretheiss.at; place names for scanned points: BigDataCloud reverse geocoding
- Site photos: Wikimedia Commons (author and licence shown with each photo); site summaries: Wikipedia (CC BY-SA)
- 3D globe: globe.gl and three.js (MIT licence); fonts: Inter, Space Grotesk and JetBrains Mono (SIL Open Font License) through Google Fonts
- The app uses the word "NASA" and credited NASA photos only; it contains no NASA logos, insignia or mission patches. The crew patch in the app is our own design.

## Demo video script (as recorded, 28 s)
| Time | On screen | Voice (English version) |
|---|---|---|
| 0–3 s | Earth globe, "Team MIAUTECH" title | "We are team MIAUTECH: Jimmy, Mary and Anderson." |
| 3–7 s | The 3D Moon at the Shackleton ridge | "Our challenge: find places on Earth that behave like the Moon and Mars base sites." |
| 7–9 s | The app's opening screen | "This is Earth Analogs." |
| 9–17 s | Mission choice, mission-control GO poll, NASA EPIC view of Earth, landing photo, verdict panel | "Pick a base and a mission. NASA data compares 15 features, and the ship lands on Earth's best twin: why it matches, and what it can't simulate." |
| 17–21 s | "Where does NASA train?" ranking and the Top 10 | "It also shows where NASA already trains, and untapped sites nobody uses yet." |
| 21–28 s | 3-site campaign arcs, global similarity map, end card with the link | "Open and free, so tomorrow's crews can rehearse the Moon and Mars, here on Earth." |

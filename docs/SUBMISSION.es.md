# Space Apps 2026 – Envío del proyecto (Earth Analogs, equipo MIAUTECH)

> Copia de trabajo en español para el equipo. **No la pegues en el formulario**: Space Apps exige que la página del proyecto esté en inglés. Lo que se pega es `SUBMISSION.md`, campo por campo, con los mismos títulos.

## Antes de pulsar «Submit for Judging»
- [ ] Plazo: **domingo 15 de noviembre de 2026, 23:59**, hora local del dueño del equipo (Ecuador, UTC−5).
- [ ] Abre cada enlace de abajo en una ventana privada y comprueba que carga o se reproduce sin iniciar sesión.
- [ ] Pega cada campo desde `SUBMISSION.md` (inglés). Si quieres, adjunta una captura (`media/screenshot-verdict.png`, `media/screenshot-nasa.png`; menos de 10 MB cada una). Marca la casilla de «Terms and Conditions» y pulsa **Submit for Judging**. Solo guardar no envía.
- [ ] Opcional: pide a FortiGuard que clasifique `jimmyguajan.github.io` (categoría: Education; nombre de la empresa: N/A), para que las redes de los jueces no bloqueen el sitio.

## Equipo
**MIAUTECH**: Jimmy Guajan, Mary Claudio, Anderson Lema.

## Nombre del proyecto
**Earth Analogs: encuentra el gemelo terrestre de cada base en la Luna y Marte**

## Resumen del proyecto
Antes de construir una base en el polo sur lunar o perforar hielo en Marte, los astronautas ensayan en lugares de la Tierra que se comportan como esos mundos. Pero casi nunca se compara en números un sitio análogo con su destino, y pocas veces se buscan candidatos nuevos.

Earth Analogs mide la Luna, Marte y 45 sitios de la Tierra con los mismos 15 ejes y datos abiertos: 25 años de clima de NASA POWER; relieve de LRO LOLA, MGS MOLA y Copernicus; hielo de LRO Diviner y Mars Odyssey; temperatura del suelo y vegetación de MODIS; radar ALOS PALSAR de JAXA; ESA WorldCover y geología de Macrostrat.

Un viaje guiado en 3D permite elegir un sitio de base y una misión, volar de vuelta a la Tierra y aterrizar en el mejor gemelo, con un veredicto explicado: por qué se parece y qué no puede simular. La app también muestra dónde entrena ya la NASA y en qué puesto los deja nuestro ranking, encuentra análogos sin explotar, arma campañas de 3 sitios que cubren el 90–96 % del destino, pinta un mapa de parecido de todo el planeta y mide en vivo cualquier punto de la Tierra.

Importa porque elegir bien dónde ensayar ahorra tiempo, dinero y riesgo antes de que una tripulación salga de la Tierra.

## Enlace a la demostración
- Video con narración en inglés (28 s): https://jimmyguajan.github.io/earth-analogs/media/earth-analogs-demo-en.mp4
- Mismo video con narración en español y subtítulos en inglés (28 s): https://jimmyguajan.github.io/earth-analogs/media/earth-analogs-demo-es.mp4

## Enlace al proyecto final
- App en vivo (abre en inglés; el español está a un clic): https://jimmyguajan.github.io/earth-analogs/
- Un clic a un resultado: https://jimmyguajan.github.io/earth-analogs/#t=moon_shackleton&p=power&m=match
- Código, pipeline de datos y pruebas: https://github.com/JimmyGuajan/earth-analogs

## Descripción detallada
**Qué hace.** Earth Analogs responde una pregunta para planificadores de misiones, científicos y estudiantes: *¿qué lugar de la Tierra ensaya mejor esta base en la Luna o Marte, para esta misión, y qué no puede ensayar?* La persona se registra como tripulante (comandante, geología o ingeniería), elige un sitio de base (3 en la Luna, 6 en Marte) y una misión (ISRU, cuevas, hábitat, movilidad, astrobiología, energía polar o general), y vuela de vuelta a la Tierra mientras la computadora de misión hace el análisis. La nave aterriza en el mejor gemelo y el panel de veredicto explica el resultado. Un recorrido guiado, una prueba final y un certificado de misión convierten el análisis en una experiencia de aprendizaje.

**Cómo funciona**
1. **Huella de la Tierra.** La climatología de NASA POWER da seis ejes: aridez (PRECTOTCORR y RH2M), frío (T2M), oscilación térmica (T2M_RANGE), aire fino (PS corregida a la altura real del DEM), exposición solar y UV (ALLSKY_SFC_SW_DWN e índice UV) y luz estacional (cociente entre el mes más oscuro y el más brillante). El relieve sale del DEM Copernicus GLO-90.
2. **Perfiles planetarios medidos** (`pipeline/planetary.py`, datos crudos del PDS):
   - **Relieve:** la misma métrica P95–P5 en 15 km en los tres mundos: LRO LOLA LDEM_16 en la Luna y MGS MOLA MEGDR en Marte.
   - **Hielo y frío lunar:** leemos los 605 MB del LRO Diviner Polar Resource Product (2,88 millones de elementos). En Shackleton el hielo es estable a menos de 1 m en el 35 % del área y la temperatura media de la superficie es 120 K.
   - **Hielo marciano:** el mapa de neutrones epitermales de Mars Odyssey, combinado con los resultados del radar SHARAD sobre glaciares enterrados.
   - **Luz estacional:** un modelo de insolación orbital con los elementos del NASA Planetary Fact Sheet, con la misma fórmula que en la Tierra.
   - **Ejes que saturan** (vacío o 0,6 kPa, −60 °C, radiación): usan medidas de rovers y orbitadores (REMS, MEDA, RAD, LADEE, CRaTER) y se recortan al extremo terrestre.
3. **Procedencia.** Cada eje lleva la etiqueta *medido*, *mapa geológico*, *misión* o *literatura* en la pestaña Evidencia.
4. **Parecido.** El puntaje es 100 × (1 − distancia RMS ponderada), con pesos según la misión.
5. **Análogos sin explotar.** Oportunidad = parecido × (1 − 0,75 × uso actual).
6. **Campaña.** Un algoritmo voraz de cobertura máxima elige 3 sitios complementarios. Lo que queda sin cubrir muestra lo que la Tierra no puede reproducir.
7. **Escaneo en vivo.** Para cualquier punto, el navegador consulta NASA POWER, el DEM, el servicio MODIS de ORNL DAAC, Microsoft Planetary Computer y Macrostrat (todos sin clave). Se puede tocar el globo, elegir un sitio de la lista o escribir coordenadas, y se ve el avance de cada fuente.
8. **Vegetación.** El NDVI de MODIS Terra MOD13Q1 (250 m) reemplaza el valor de literatura del eje «sin vegetación».
9. **Terreno medido** (`pipeline/geology.py`, ventana de 15 km). Hielo en el suelo: temperatura media de superficie de 12 compuestos mensuales MODIS MOD11A2 (2023) más hielo y nieve permanentes de ESA WorldCover. Regolito suelto: retrodispersión HV en banda L de ALOS PALSAR (JAXA, mosaico 2020); el material fino y suelto se ve oscuro, la misma física que usa LRO Mini-RF en la Luna. Basalto, sales y sedimentos: unidades de mapas geológicos de Macrostrat en 9 puntos, más JRC Global Surface Water (1984–2021). Planetary Computer calcula todas las estadísticas en su servidor.
10. **Procesos, no solo lugares** (`js/processes.js`). Siete procesos: agua corriente, evaporación, viento, hielo, vulcanismo, ciclos térmicos e impactos, activos hoy o antiguos. El veredicto muestra los procesos compartidos y qué enseña cada pareja.
11. **Mapa de calor mundial.** Climatología regional de NASA POWER en una malla de 2,5°. Las zonas candidatas son las mejores celdas a más de 700 km de cualquier análogo catalogado.
12. **Conoce el lugar.** Foto con crédito de Commons, resumen de Wikipedia y un control deslizante que compara 40 × 40 km de la Tierra (Landsat WELD o MODIS en la Antártida) con el destino (LRO WAC o Viking desde NASA Trek), a la misma escala y proyección.
13. **Gemelo inverso.** Una huella terrestre se compara con los 9 destinos con pesos iguales.
14. **Dónde entrena la NASA** (`js/nasa.js`). 12 sitios del catálogo que la NASA o equipos financiados por la NASA han usado (Holuhraun, donde entrenó geología la tripulación de Artemis II en 2024; Haughton-Mars Project; Craters of the Moon; Meteor Crater; Ries; BASALT en Kaʻū; MARTE en Río Tinto; y otros) llevan una insignia NASA y una foto con crédito de la NASA Image and Video Library. El Top 10 muestra en qué puesto queda cada uno para la misión elegida. También lista 7 sitios de la NASA fuera del catálogo (Black Point Lava Flow, Cinder Lake, Sierra Blanca, Kapoho) que se pueden medir en vivo, y los hábitats cerrados (HI-SEAS, NEEMO, HERA/CHAPEA), marcados como análogos de aislamiento y no de terreno.

**Beneficios**
- Los equipos de misión obtienen una razón cuantitativa y explicada para elegir un sitio de prueba, y saben lo que *no* puede probar.
- Orienta la ciencia de campo hacia regiones poco estudiadas.
- Es abierto y reproducible: funciona con archivos estáticos, no necesita claves y el pipeline reconstruye todo desde archivos públicos.

**Hallazgos con los datos actuales**
- *Base en tubo de lava lunar (pozo del Mare Tranquillitatis, cuevas):* **Harrat Khaybar y el tubo de lava de Umm Jirsan (Arabia Saudí)** sacan 64/100. Es un campo basáltico hiperárido que casi nunca se ha usado como análogo.
- *Hielo de Arcadia Planitia (ISRU):* la **meseta de Changtang (Tíbet)** es #1, con 52 kPa de presión, permafrost y clima árido.
- *Polo sur lunar (luz polar):* los **Valles Secos de McMurdo** y los **campos de hielo azul de la cordillera Miller**, sin explotar, quedan arriba. Una campaña de 3 sitios (McMurdo + Domo C + Aorounga) cubre el 96 %.
- *Jezero (astrobiología):* destacan los sitios saharianos sin explotar **Gilf Kebir** y **Aorounga**, junto con Licancabur.
- *Comparado con las elecciones de la NASA:* para el polo sur lunar (luz polar y energía) nuestro #1 son los **Valles Secos de McMurdo**, y para Meridiani Planum (astrobiología) el **Salar de Pajonales**. En ambos ya trabajan equipos financiados por la NASA. Cuando nuestro #1 no es un sitio de la NASA, la app lo presenta como análogo sin explotar.
- *Validación:* sin decírselo, el gemelo inverso empareja **Atacama con Meridiani Planum**, una pareja que la literatura ya usa por sus sulfatos y percloratos. El **cráter Haughton** sale como análogo polar y de impacto.
- *Ecuador como nodo accesible:* los volcanes de Galápagos **Sierra Negra (#5)** y **Fernandina (#6)** están en el top 10 mundial para el pozo lunar de tubos de lava, y Fernandina es el #2 de los análogos de cuevas sin explotar para la Luna y Marte. El **Arenal del Chimborazo** (4.300 m, a 3 h de Quito) es #7 para construir hábitats en el cráter Gale; la temperatura de superficie medida lo descarta como análogo de hielo.
- *Procesos activos hoy:* Sierra Negra, Fernandina y Kīlauea construyen hoy coladas y tubos de lava, el proceso que formó el pozo del Mare Tranquillitatis y las cuevas de Arsia Mons. La cuenca de Qaidam se inunda y se seca hoy, una versión viva del registro de lagos y evaporitas de Jezero, Gale y Meridiani. Los glaciares vivos (Miller Range, McMurdo, Changtang) son la contraparte activa de los glaciares enterrados de Deuteronilus Mensae.
- *Solidez:* al pasar cinco ejes de terreno de estimaciones de literatura a medidas, los hallazgos mantuvieron su lugar.

**Herramientas**
HTML, CSS y JavaScript; globe.gl (Three.js); Web Audio y Web Speech; Python 3 con NumPy y Pillow; la API de datos de Microsoft Planetary Computer. Las pruebas automáticas (`tests/run.mjs`, 28 comprobaciones) usan solo Node.js.

**Creatividad**
La elección de análogos se convierte en un problema de recomendación con huellas medidas y comparables en tres mundos. La pregunta pasa de «¿qué sitio famoso?» a «¿qué combinación de sitios cubre esta misión y qué queda fuera?». El resultado se cuenta como una misión: registro, lanzamiento, viaje, aterrizaje y veredicto.

**Limitaciones**
- Las estructuras de impacto y las cuevas siguen saliendo de la literatura, porque no se detectan globalmente desde órbita. Fuera de EE. UU., los mapas de Macrostrat son casi todos a escala continental, así que sales y sedimentos conservan allí el valor de literatura.
- La temperatura de superficie indica permafrost, pero no prueba que haya hielo; el radar también ve los salares como regolito suelto.
- Los neutrones de Odyssey solo ven ~1 m de profundidad con baja resolución.
- La malla de NASA POWER es de ~0,5°.
- Los puntajes apoyan decisiones; no certifican sitios.

**Qué esperamos lograr**
- Dar a la elección de sitios análogos una vara de medir transparente y repetible, que cualquier equipo pueda revisar y ampliar.
- Llevar la ciencia de campo a lugares sin explotar, incluidos lugares accesibles de América Latina como los campos de lava de Galápagos y los arenales del Chimborazo.
- Que estudiantes y público vean cómo los datos abiertos de la NASA se convierten en una decisión de planificación real, en inglés y en español.

## Uso de Súper Inteligencia (SI)
Un asistente de programación con IA (Claude, de Anthropic) ayudó a escribir el código (`js/`, `css/`, `index.html`), el pipeline de datos (`pipeline/`), las pruebas (`tests/`) y este texto. El equipo eligió el enfoque del reto, las fuentes de datos, el puntaje y los hallazgos, y revisó cada resultado. Los datos de `data/` y `js/data.js` los calcula el pipeline a partir de las fuentes de la NASA y de agencias socias; ningún valor es generado por IA. La app no tiene imágenes generadas por IA. El video está hecho con capturas de la app; su narración es una voz sintética (texto a voz de Microsoft Windows), y así lo dicen la tarjeta final del video y los metadatos del archivo.

## Datos de la NASA
- NASA POWER Climatology API (2001–2025): https://power.larc.nasa.gov
- LRO LOLA LDEM_16, MGS MOLA MEGDR, LRO Diviner Polar Resource Product y mapa epitermal de Mars Odyssey GRS/NS, del PDS Geosciences Node: https://pds-geosciences.wustl.edu
- NDVI MODIS Terra MOD13Q1 vía el servicio web MODIS de ORNL DAAC: https://modis.ornl.gov/data/modis_webservice.html
- Temperatura de superficie MODIS Terra MOD11A2 (2023) vía Microsoft Planetary Computer
- NASA GIBS (Blue Marble): https://gibs.earthdata.nasa.gov
- NASA Moon Trek y Mars Trek (LRO WAC, Viking MDIM 2.1): https://trek.nasa.gov
- Medidas de misiones citadas: MRO SHARAD, MSL REMS y RAD, Mars 2020 MEDA, LADEE, LCROSS, LRO CRaTER, LRO Mini-RF
- Imágenes de la Tierra de NASA EPIC (DSCOVR), en vivo durante el viaje: https://epic.gsfc.nasa.gov
- NASA Image and Video Library, para las fotos con crédito de entrenamientos de la NASA: https://images.nasa.gov
- Página de la NASA sobre análogos planetarios y sus programas (Haughton-Mars Project, Desert RATS, NEEMO, HI-SEAS, HERA y CHAPEA): https://science.nasa.gov/solar-system/planetary-analogs/

## Datos de agencias socias y otras referencias
- DEM Copernicus GLO-90 (ESA) vía la API de elevación de Open-Meteo
- Mosaico anual ALOS PALSAR (JAXA), ESA WorldCover 2021 y JRC Global Surface Water, vía Microsoft Planetary Computer (oferta global de Space Apps): https://planetarycomputer.microsoft.com
- Unidades de mapas geológicos de Macrostrat (CC-BY 4.0): https://macrostrat.org
- Chandrayaan-1 M3 (ISRO) y Kaguya (JAXA), citados en la evidencia de los destinos
- Posición de la ISS en vivo: https://wheretheiss.at; nombres de lugares escaneados: geocodificación inversa de BigDataCloud
- Fotos de los sitios: Wikimedia Commons (autor y licencia junto a cada foto); resúmenes: Wikipedia (CC BY-SA)
- Globo 3D: globe.gl y three.js (licencia MIT); tipografías Inter, Space Grotesk y JetBrains Mono (SIL Open Font License) vía Google Fonts
- La app usa solo la palabra «NASA» y fotos de la NASA con crédito; no tiene logotipos, insignias ni parches de misión de la NASA. El parche de tripulación de la app es diseño propio.

## Guion del video (como quedó grabado, 28 s)
| Tiempo | En pantalla | Voz (versión en español) |
|---|---|---|
| 0–3 s | Globo terrestre y el título «Team MIAUTECH» | «Somos el equipo MIAUTECH: Jimmy, Mary y Anderson.» |
| 3–7 s | La Luna en 3D en la cresta Shackleton | «Nuestro reto: encontrar lugares de la Tierra que se comportan como las bases de la Luna y Marte.» |
| 7–9 s | La portada de la app | «Esto es Earth Analogs.» |
| 9–17 s | Elección de misión, sondeo GO del control de misión, vista de la Tierra de NASA EPIC, foto del aterrizaje, panel de veredicto | «Eliges una base y una misión. Con datos de la NASA compara quince características y aterriza en el mejor gemelo terrestre: por qué se parece y qué no puede simular.» |
| 17–21 s | Ranking «¿Dónde entrena la NASA?» y el Top 10 | «También muestra dónde ya entrena la NASA, y sitios nuevos que nadie usa.» |
| 21–28 s | Arcos de la campaña de 3 sitios, mapa de parecido mundial y tarjeta final con el enlace | «Abierto y gratis, para que las tripulaciones ensayen aquí la Luna y Marte.» |

Los subtítulos de ambos videos están en inglés, como pide Space Apps cuando la narración es en otro idioma.

/* Earth Analogs – where NASA itself trains and tests on Earth.
 * catalog: sites already in our 45-site catalogue that NASA (or a NASA-funded team) has used.
 * field: NASA analog sites outside the catalogue; indoor ones test isolation, not terrain.
 * Photos: NASA Image and Video Library (images.nasa.gov), credited per NASA media guidelines. */
(function (global) {
  const IMG = id => `https://images-assets.nasa.gov/image/${id}/${id}~thumb.jpg`;
  const PAGE = id => `https://images.nasa.gov/details/${id}`;
  const ANALOGS = "https://science.nasa.gov/solar-system/planetary-analogs/10-things-to-know-about-planetary-analogs";
  global.NASA_ANALOGS = {
    img: IMG, page: PAGE,
    catalog: {
      holuhraun: {
        es: "Astronautas del programa Apollo (1965 y 1967) y la tripulación de Artemis II (2024) entrenaron geología en esta zona de Islandia, junto a Askja.",
        en: "Apollo astronauts (1965 and 1967) and the Artemis II crew (2024) trained in geology in this part of Iceland, next to Askja.",
        photo: "jsc2024e055261", credit: "NASA/Robert Markowitz",
      },
      haughton: {
        es: "Haughton-Mars Project (NASA Ames), desde 1997: caminatas tipo Marte y robótica en un cráter de impacto polar.",
        en: "Haughton-Mars Project (NASA Ames), since 1997: Mars-style EVAs and robotics in a polar impact crater.",
        photo: "ARC-2007-ACD07-0170-005", credit: "NASA/Matt Deans",
      },
      craters_of_the_moon: {
        es: "Los astronautas de Apollo 14 entrenaron aquí, y el proyecto FINESSE de la NASA estudia sus coladas como las de la Luna.",
        en: "Apollo 14 astronauts trained here, and NASA's FINESSE project studies its flows as lunar ones.",
      },
      meteor_crater: {
        es: "Campo de entrenamiento de astronautas de Apollo y de Artemis: el cráter de impacto simple mejor conservado.",
        en: "Training ground for Apollo and Artemis astronauts: the best-preserved simple impact crater.",
      },
      ries: {
        es: "La tripulación de Apollo 14 entrenó aquí en 1970, y astronautas de Artemis han vuelto para aprender geología de impactos.",
        en: "The Apollo 14 crew trained here in 1970, and Artemis astronauts have returned to learn impact geology.",
      },
      kau_desert: {
        es: "Programa BASALT de la NASA: ensayos de caminatas tipo Marte sobre basalto fresco.",
        en: "NASA's BASALT program: Mars-style EVA trials on fresh basalt.",
      },
      mauna_kea: {
        es: "Pruebas de campo de la NASA para extraer recursos del suelo (ISRU) en las laderas del Mauna Kea.",
        en: "NASA field tests of resource extraction from the ground (ISRU) on the slopes of Mauna Kea.",
      },
      rio_tinto: {
        es: "Experimento MARTE de la NASA: perforación en busca de vida bajo tierra, como se haría en Marte.",
        en: "NASA's MARTE experiment: drilling for life underground, the way it would be done on Mars.",
      },
      atacama_yungay: {
        es: "NASA Ames llevó aquí su programa Spaceward Bound (2006) y prueba rovers e instrumentos para detectar vida.",
        en: "NASA Ames ran its Spaceward Bound program here (2006) and tests rovers and life-detection instruments.",
        photo: "ARC-2006-ACD06-0113-012", credit: "NASA/William Moede",
      },
      svalbard_bockfjorden: {
        es: "Expedición AMASE: prueba de instrumentos para rovers de Marte, con equipos de la NASA.",
        en: "AMASE expedition: field tests of Mars rover instruments, with NASA teams.",
      },
      pajonales: {
        es: "Investigación de astrobiología del SETI Institute financiada por la NASA, a 3.500 m y con UV extrema.",
        en: "NASA-funded SETI Institute astrobiology research, at 3,500 m under extreme UV.",
      },
      mcmurdo_dry_valleys: {
        es: "Estudios de astrobiología financiados por la NASA sobre la vida en el frío y la sequedad extremos.",
        en: "NASA-funded astrobiology studies of life in extreme cold and dryness.",
      },
    },
    field: [
      { id: "black_point", lat: 35.68, lon: -111.36, name: { es: "Colada de lava Black Point, Arizona", en: "Black Point Lava Flow, Arizona" },
        es: "Desert RATS (2008–2009) y ensayos de caminatas de Artemis (2024): rovers presurizados y equipos científicos.",
        en: "Desert RATS (2008–2009) and Artemis EVA field tests (2024): pressurized rovers and science teams.",
        photo: "jsc2008e138809", credit: "NASA/Regan Geeseman", src: "https://science.nasa.gov/earth/earth-observatory/black-point-lava-flow-arizona-40076/" },
      { id: "cinder_lake", lat: 35.31, lon: -111.51, name: { es: "Campo de cráteres Cinder Lake, Arizona", en: "Cinder Lake Crater Field, Arizona" },
        es: "Cráteres excavados a propósito para imitar la Luna: aquí practicó la tripulación de Apollo 15 con un simulador del rover (1970).",
        en: "Craters dug on purpose to mimic the Moon: the Apollo 15 crew practised here with a rover simulator (1970).",
        photo: "S70-53300", credit: "NASA", src: PAGE("S70-53300") },
      { id: "sierra_blanca", lat: 31.25, lon: -105.44, name: { es: "Sierra Blanca, Texas", en: "Sierra Blanca, Texas" },
        es: "Armstrong y Aldrin practicaron aquí la toma de muestras de rocas antes de Apollo 11 (1969).",
        en: "Armstrong and Aldrin practised rock sampling here before Apollo 11 (1969).", src: ANALOGS },
      { id: "kapoho", lat: 19.5, lon: -154.84, name: { es: "Kapoho, Hawái", en: "Kapoho, Hawaiʻi" },
        es: "Entrenamiento de recorridos de Apollo 14 sobre basalto reciente (1970).",
        en: "Apollo 14 traverse training on fresh basalt (1970).", photo: "S70-34415", credit: "NASA", src: PAGE("S70-34415") },
      { id: "hi_seas", lat: 19.6024, lon: -155.4872, indoor: true, name: { es: "HI-SEAS, Mauna Loa", en: "HI-SEAS, Mauna Loa" },
        es: "Hábitat tipo Marte con misiones de aislamiento financiadas por la NASA (2013–2018).",
        en: "Mars-like habitat with NASA-funded isolation missions (2013–2018).", src: "https://www.hi-seas.org/about-hi-seas" },
      { id: "neemo", lat: 24.9502, lon: -80.4534, indoor: true, name: { es: "NEEMO, estación submarina Aquarius", en: "NEEMO, Aquarius undersea station" },
        es: "Astronautas viven bajo el mar, a 19 m, para ensayar caminatas y misiones largas (2001–2019).",
        en: "Astronauts live under the sea, 19 m down, to rehearse EVAs and long missions (2001–2019).",
        photo: "jsc2014e068003", credit: "NASA", src: ANALOGS },
      { id: "hera_chapea", lat: 29.559, lon: -95.09, indoor: true, name: { es: "HERA y CHAPEA, NASA Johnson (Houston)", en: "HERA and CHAPEA, NASA Johnson (Houston)" },
        es: "Hábitats cerrados donde tripulaciones viven hasta un año como en Marte (CHAPEA, desde 2023).",
        en: "Closed habitats where crews live for up to a year as on Mars (CHAPEA, since 2023).",
        src: "https://www.nasa.gov/humans-in-space/chapea/" },
    ],
  };
})(window);

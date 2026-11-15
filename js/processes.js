/* Earth Analogs – processes, not only places.
 * Seven surface processes. Each destination lists the ones its missions documented,
 * active today ("now") or recorded in old rock ("old"). On Earth the same processes are
 * read from measured data in app.js (earthProcesses). A process that is active on Earth
 * today and only ancient on Mars or the Moon is the most useful pairing: it can be watched
 * at work here to read the traces it left there. */
window.PROCESSES = {
  order: ["water", "evap", "wind", "ice", "volcanic", "thermal", "impact"],
  label: {
    es: { water: "Agua que corre y deposita sedimentos", evap: "Evaporación: agua que se seca y deja sales", wind: "Viento: erosión, polvo y dunas",
          ice: "Hielo: congelación, sublimación y glaciares", volcanic: "Vulcanismo: coladas y tubos de lava", thermal: "Ciclos térmicos que agrietan la roca",
          impact: "Impactos de meteoritos" },
    en: { water: "Running water laying down sediment", evap: "Evaporation: water drying out into salts", wind: "Wind: erosion, dust and dunes",
          ice: "Ice: freezing, sublimation and glaciers", volcanic: "Volcanism: lava flows and tubes", thermal: "Thermal cycling that cracks rock",
          impact: "Meteorite impacts" },
  },
  // documented on each destination (mission literature)
  target: {
    moon_shackleton: {
      ice: ["now", "Las trampas frías en sombra permanente siguen guardando hielo de agua.", "Permanently shadowed cold traps still hold water ice."],
      thermal: ["now", "Sin atmósfera, la superficie se calienta y se enfría de forma extrema.", "With no atmosphere, the surface heats and cools to extremes."],
      impact: ["now", "Los micrometeoritos siguen removiendo el regolito.", "Micrometeorites keep stirring the regolith."],
    },
    moon_malapert: {
      thermal: ["now", "Sin atmósfera, la superficie se calienta y se enfría de forma extrema.", "With no atmosphere, the surface heats and cools to extremes."],
      impact: ["now", "Los micrometeoritos siguen removiendo el regolito.", "Micrometeorites keep stirring the regolith."],
    },
    moon_tranquillitatis_pit: {
      volcanic: ["old", "Las coladas de basalto del mar se formaron hace más de 3.000 millones de años; el pozo es un tubo de lava de entonces.", "The mare basalt flows formed more than 3 billion years ago; the pit is a lava tube from that time."],
      thermal: ["now", "Fuera, la superficie va de -170 a +120 °C entre la noche y el día.", "Outside, the surface swings from -170 to +120 °C between night and day."],
      impact: ["now", "Los micrometeoritos siguen removiendo el regolito.", "Micrometeorites keep stirring the regolith."],
    },
    mars_jezero: {
      water: ["old", "Un río llenó el cráter y formó un delta hace unos 3.500 millones de años.", "A river filled the crater and built a delta about 3.5 billion years ago."],
      evap: ["old", "Los carbonatos guardan la química de aquel lago.", "Carbonates keep the chemistry of that lake."],
      wind: ["now", "Hoy el viento mueve polvo y ondulaciones de arena.", "Today wind moves dust and sand ripples."],
    },
    mars_gale: {
      water: ["old", "Las capas del monte Sharp son de un lago de hace unos 3.500 millones de años.", "Mount Sharp's layers come from a lake about 3.5 billion years old."],
      evap: ["old", "Las capas pasan de arcillas a sulfatos: el agua se fue secando.", "The layers change from clays to sulfates as the water dried up."],
      wind: ["now", "Las dunas de Bagnold avanzan hoy con el viento.", "The Bagnold dunes advance with the wind today."],
      thermal: ["now", "La temperatura oscila hasta 90 K entre el día y la noche.", "Temperature swings up to 90 K between day and night."],
    },
    mars_arcadia: {
      ice: ["now", "El hielo bajo la superficie se sublima, e impactos recientes lo dejan a la vista.", "Shallow ground ice sublimates, and fresh impacts expose it."],
      wind: ["now", "El polvo se mueve con el viento y las tormentas.", "Dust moves with the wind and the storms."],
    },
    mars_deuteronilus: {
      ice: ["old", "Glaciares de hace cientos de millones de años, todavía conservados bajo escombros.", "Glaciers hundreds of millions of years old, still preserved under debris."],
      wind: ["now", "El polvo se mueve con el viento y las tormentas.", "Dust moves with the wind and the storms."],
    },
    mars_arsia_caves: {
      volcanic: ["old", "Las coladas de Arsia Mons tienen cientos de millones de años; sus tubos de lava se hundieron en tragaluces.", "Arsia Mons flows are hundreds of millions of years old; its lava tubes collapsed into skylights."],
      wind: ["now", "El polvo se mueve con el viento y las tormentas.", "Dust moves with the wind and the storms."],
    },
    mars_meridiani: {
      evap: ["old", "Aguas subterráneas ácidas se evaporaron y dejaron sulfatos y hematita hace más de 3.000 millones de años.", "Acidic groundwater evaporated and left sulfates and hematite more than 3 billion years ago."],
      wind: ["now", "Las ondulaciones de arena migran hoy con el viento.", "Sand ripples migrate with the wind today."],
    },
  },
  // Earth sites with an eruption in this century: their volcanism is a process at work, not only a rock type
  activeVolcano: ["kau_desert", "holuhraun", "fernandina", "sierra_negra", "tolbachik"],
  text: {
    es: {
      title: "Procesos que puedes estudiar aquí",
      none: "No comparten ningún proceso medido: el parecido viene del clima y del terreno.",
      earthTag: { now: "Aquí, hoy", old: "Aquí, huellas antiguas" },
      targetTag: { now: t => `${t}, hoy`, old: t => `${t}, hace mucho` },
      lesson: {
        "now-old": "Aquí ocurre hoy; allí ocurrió hace mucho. Verlo en acción ayuda a leer las huellas que dejó.",
        "now-now": "Ocurre hoy en los dos: se puede observar en directo y comparar.",
        "old-old": "Los dos guardan las huellas de este proceso antiguo.",
        "old-now": "Allí sigue activo; aquí quedan sus huellas.",
      },
      ev: {
        wind: v => `Viento medio de ${v} m/s sobre suelo desnudo (NASA POWER, MODIS).`,
        waterNow: p => `Agua temporal, que aparece y se seca, en el ${p} del área desde 1984 (JRC).`,
        waterOld: "Sedimentos de lago o de río en el terreno.",
        evap: mm => `Solo ${mm} mm de lluvia al año y sales en la superficie (NASA POWER).`,
        ice: t => `Temperatura media del suelo de ${t} °C (MODIS).`,
        iceLit: "Hielo y permafrost descritos en la literatura.",
        volcanicNow: "Volcán con erupciones en este siglo.",
        volcanicOld: "Rocas volcánicas basálticas en el mapa geológico.",
        thermal: d => `Oscilación diaria de ${d} °C (NASA POWER).`,
        impact: "Estructura de impacto conservada.",
      },
    },
    en: {
      title: "Processes you can study here",
      none: "They share no measured process: the similarity comes from climate and terrain.",
      earthTag: { now: "Here, today", old: "Here, ancient traces" },
      targetTag: { now: t => `${t}, today`, old: t => `${t}, long ago` },
      lesson: {
        "now-old": "Here it happens today; there it happened long ago. Watching it at work helps read the traces it left.",
        "now-now": "Active today in both: it can be watched live and compared.",
        "old-old": "Both keep the traces of this ancient process.",
        "old-now": "It is still active there; here only its traces remain.",
      },
      ev: {
        wind: v => `Mean wind of ${v} m/s over bare ground (NASA POWER, MODIS).`,
        waterNow: p => `Temporary water, appearing and drying out, on ${p} of the area since 1984 (JRC).`,
        waterOld: "Lake or river sediments in the ground.",
        evap: mm => `Only ${mm} mm of rain a year and salts at the surface (NASA POWER).`,
        ice: t => `Mean ground temperature of ${t} °C (MODIS).`,
        iceLit: "Ice and permafrost described in the literature.",
        volcanicNow: "Volcano with eruptions this century.",
        volcanicOld: "Basaltic volcanic rocks on the geologic map.",
        thermal: d => `Daily swing of ${d} °C (NASA POWER).`,
        impact: "Preserved impact structure.",
      },
    },
  },
};

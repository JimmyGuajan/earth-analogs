/* Earth Analogs – today's real Earth–Moon and Earth–Mars distances.
 * Moon: the main periodic terms of Meeus, Astronomical Algorithms (ch. 47), good to ~0.1%.
 * Mars: JPL mean Keplerian elements (Standish, valid 1800–2050), good to ~1%. */
(function (global) {
  const rad = d => (d * Math.PI) / 180;
  const centuries = date => (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;

  /** Earth–Moon centre distance in km */
  function moonKm(date = new Date()) {
    const T = centuries(date);
    const D = rad(297.8501921 + 445267.1114034 * T);
    const M = rad(357.5291092 + 35999.0502909 * T);
    const Mp = rad(134.9633964 + 477198.8675055 * T);
    const F = rad(93.2720950 + 483202.0175233 * T);
    const terms = [
      [-20905.355, Mp], [-3699.111, 2 * D - Mp], [-2955.968, 2 * D], [-569.925, 2 * Mp], [48.888, M], [-3.149, 2 * F],
      [246.158, 2 * D - 2 * Mp], [-152.138, 2 * D - M - Mp], [-170.733, 2 * D + Mp], [-204.586, 2 * D - M], [-129.620, M - Mp],
      [108.743, D], [104.755, M + Mp], [10.321, 2 * D - 2 * F], [79.661, Mp - 2 * F], [-34.782, 4 * D - Mp], [-23.210, 3 * Mp],
      [-21.636, 4 * D - 2 * Mp], [24.208, 2 * D + M - Mp], [30.824, 2 * D + M],
    ];
    return 385000.56 + terms.reduce((s, [c, a]) => s + c * Math.cos(a), 0);
  }

  // [a AU, e, I deg, L deg, long. perihelion deg, long. node deg] and their rates per century
  const ELEMENTS = {
    earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  };
  function helio(planet, T) {
    const [e0, r] = ELEMENTS[planet];
    const [a, e, I, L, wbar, O] = e0.map((v, i) => v + r[i] * T);
    const M = rad(((L - wbar) % 360 + 540) % 360 - 180), w = rad(wbar - O), inc = rad(I), node = rad(O);
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const x1 = a * (Math.cos(E) - e), y1 = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), cI = Math.cos(inc), sI = Math.sin(inc);
    return [
      (cw * cO - sw * sO * cI) * x1 + (-sw * cO - cw * sO * cI) * y1,
      (cw * sO + sw * cO * cI) * x1 + (-sw * sO + cw * cO * cI) * y1,
      sw * sI * x1 + cw * sI * y1,
    ];
  }
  /** Earth–Mars distance in km */
  function marsKm(date = new Date()) {
    const T = centuries(date), m = helio("mars", T), e = helio("earth", T);
    return Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]) * 149597870.7;
  }

  global.Astro = { moonKm, marsKm, HOHMANN_KM: 586.7e6 }; // half of the Earth–Mars Hohmann ellipse (a = 1.262 AU, e = 0.208)
})(window);

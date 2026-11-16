/* Earth Analogs – mission patch and mission certificate, drawn on canvas
 * with the page's own colour tokens, so they match the interface. */
(function (global) {
  const tok = name => getComputedStyle(document.body).getPropertyValue(name).trim(); // body: it carries the destination colour (data-dest)
  const C = () => ({
    bg: tok("--bg"), surface: tok("--surface"), surface2: tok("--surface-2"), line: tok("--line-strong"),
    text: tok("--text"), muted: tok("--muted"), star: tok("--star"),
    earth: tok("--earth"), accent: tok("--accent"), target: tok("--target"), bad: tok("--bad"), hull: tok("--hull"),
    dest: tok("--dest") || tok("--target"),
  });
  const FONT = tok("--display"), BODY = tok("--font"), MONO = tok("--mono");

  // deterministic pseudo-random from a string, so a crew member's patch is stable
  function seeded(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
  }

  // top arc reads clockwise, bottom arc counter-clockwise, so both stay upright
  function arcText(ctx, text, cx, cy, r, centre, bottom) {
    const chars = [...text], gap = 0.012;
    const ang = chars.map(ch => ctx.measureText(ch).width / r);
    const total = ang.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    let a = bottom ? centre + total / 2 : centre - total / 2;
    chars.forEach((ch, i) => {
      const mid = bottom ? a - ang[i] / 2 : a + ang[i] / 2;
      ctx.save();
      ctx.translate(cx + r * Math.cos(mid), cy + r * Math.sin(mid));
      ctx.rotate(mid + (bottom ? -Math.PI / 2 : Math.PI / 2));
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a = bottom ? a - ang[i] - gap : a + ang[i] + gap;
    });
  }

  function world(ctx, x, y, r, body, c) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    if (body === "Mars") { g.addColorStop(0, c.target); g.addColorStop(0.65, c.bad); g.addColorStop(1, c.surface); }
    else if (body === "Earth") { g.addColorStop(0, c.earth); g.addColorStop(0.6, c.accent); g.addColorStop(1, c.surface); }
    else { g.addColorStop(0, c.hull); g.addColorStop(0.6, c.muted); g.addColorStop(1, c.surface2); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  /** opts: { name, role, code, body: "Moon" | "Mars" | null } */
  function drawPatch(ctx, cx, cy, R, opts) {
    const c = C(), rnd = seeded((opts.name || "") + (opts.code || ""));
    ctx.save();
    // outer band
    ctx.fillStyle = c.surface; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = R * 0.03; ctx.strokeStyle = c.dest; ctx.stroke();
    ctx.lineWidth = R * 0.012; ctx.strokeStyle = c.line;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2); ctx.stroke();
    // band text
    ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `700 ${R * 0.12}px ${FONT}`;
    arcText(ctx, "EARTH ANALOGS", cx, cy, R * 0.86, -Math.PI / 2, false);
    ctx.fillStyle = c.target; ctx.font = `700 ${R * 0.11}px ${FONT}`;
    const nm = (opts.name || "").toUpperCase().slice(0, 22) || "CREW";
    arcText(ctx, nm, cx, cy, R * 0.86, Math.PI / 2, true);
    [Math.PI, 0].forEach(a => { ctx.fillStyle = c.target; ctx.beginPath(); ctx.arc(cx + R * 0.86 * Math.cos(a), cy + R * 0.86 * Math.sin(a), R * 0.025, 0, Math.PI * 2); ctx.fill(); });
    // inner field
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = c.bg; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.fillStyle = c.star;
    for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.3 + rnd() * 0.6; ctx.fillRect(cx - R * 0.7 + rnd() * R * 1.4, cy - R * 0.7 + rnd() * R * 1.4, R * 0.012, R * 0.012); }
    ctx.globalAlpha = 1;
    const wx = cx + R * 0.3, wy = cy - R * 0.26, ex = cx - R * 0.26, ey = cy + R * 0.18;
    if (opts.body) world(ctx, wx, wy, R * 0.17, opts.body, c);
    else { ctx.setLineDash([R * 0.03, R * 0.03]); ctx.strokeStyle = c.muted; ctx.lineWidth = R * 0.012; ctx.beginPath(); ctx.arc(wx, wy, R * 0.17, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    world(ctx, ex, ey, R * 0.27, "Earth", c);
    // trajectory from the destination back to Earth
    ctx.strokeStyle = c.target; ctx.lineWidth = R * 0.016; ctx.setLineDash([R * 0.04, R * 0.03]);
    ctx.beginPath(); ctx.moveTo(wx - R * 0.12, wy + R * 0.1);
    ctx.quadraticCurveTo(cx + R * 0.15, cy + R * 0.25, ex + R * 0.24, ey - R * 0.06); ctx.stroke(); ctx.setLineDash([]);
    // ship mark
    ctx.save(); ctx.translate(cx + R * 0.12, cy + R * 0.12); ctx.rotate(2.3);
    ctx.fillStyle = c.hull; ctx.beginPath(); ctx.moveTo(0, -R * 0.06); ctx.lineTo(R * 0.03, R * 0.04); ctx.lineTo(-R * 0.03, R * 0.04); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // code banner
    if (opts.code) {
      ctx.font = `600 ${R * 0.09}px ${MONO}`;
      const w = ctx.measureText(opts.code).width + R * 0.12, h = R * 0.15, by = cy + R * 0.5;
      ctx.fillStyle = c.target; ctx.beginPath(); ctx.roundRect(cx - w / 2, by - h / 2, w, h, h / 2); ctx.fill();
      ctx.fillStyle = c.bg; ctx.fillText(opts.code, cx, by + R * 0.005);
    }
    ctx.restore();
  }

  /** draw the patch into a <canvas> element at device resolution */
  function paint(canvas, opts) {
    if (!canvas || !canvas.isConnected) return;
    const size = canvas.clientWidth || 200, dpr = global.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawPatch(ctx, size / 2, size / 2, size / 2 - 2, opts);
  }

  /** a 1600 x 1000 PNG certificate; rows: [[label, value], ...] */
  async function certificate({ title, name, role, patch, rows, statement, footer, result }) {
    try { await Promise.all([document.fonts.load(`700 40px "Space Grotesk"`), document.fonts.load(`500 20px "JetBrains Mono"`), document.fonts.load(`400 20px "Inter"`)]); } catch { /* fonts optional */ }
    const c = C(), W = 1600, H = 1000;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
    const rnd = seeded(name + patch.code);
    ctx.fillStyle = c.star;
    for (let i = 0; i < 160; i++) { ctx.globalAlpha = 0.15 + rnd() * 0.5; ctx.fillRect(rnd() * W, rnd() * H, 2, 2); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.line; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80);
    drawPatch(ctx, 340, 480, 230, patch);
    const x = 650;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = c.target; ctx.font = `700 34px ${FONT}`; ctx.fillText(title, x, 170);
    ctx.fillStyle = c.text; fit(ctx, name, 700, 76, FONT, W - x - 100); ctx.fillText(name, x, 262);
    ctx.fillStyle = c.muted; ctx.font = `400 30px ${BODY}`; ctx.fillText(role, x, 310);
    ctx.fillStyle = c.text; ctx.font = `400 26px ${BODY}`;
    wrap(ctx, statement, x, 372, W - x - 110, 36).forEach((l, i) => ctx.fillText(l, x, 372 + i * 36));
    let y = 504;
    if (result) {
      const ls = wrap(ctx, statement, x, 372, W - x - 110).length;
      y = 372 + ls * 36 + 40;
      ctx.fillStyle = c.dest; fit(ctx, result, 700, 40, FONT, W - x - 110); ctx.fillText(result, x, y);
      y += 64;
    }
    rows.forEach(([k, v]) => {
      ctx.fillStyle = c.muted; ctx.font = `400 22px ${BODY}`; ctx.fillText(k, x, y);
      ctx.fillStyle = c.text; fit(ctx, v, 600, 28, FONT, W - x - 380); ctx.fillText(v, x + 260, y);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(W - 110, y + 18); ctx.stroke();
      y += 52;
    });
    ctx.fillStyle = c.muted; ctx.font = `400 19px ${BODY}`;
    footer.forEach((l, i) => ctx.fillText(l, 110, H - 120 + i * 30, W - 220));
    return new Promise(res => cv.toBlob(res, "image/png"));
  }

  function fit(ctx, text, weight, size, family, max) {
    let px = size;
    do { ctx.font = `${weight} ${px}px ${family}`; px -= 2; } while (ctx.measureText(text).width > max && px > size * 0.5);
  }
  function wrap(ctx, text, x, y, max) {
    const out = []; let line = "";
    for (const w of text.split(" ")) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  global.Patch = { paint, drawPatch, certificate };
})(window);

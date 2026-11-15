/* Earth Analogs – Commander Vega, the guide who talks you through the mission.
 * Each line is typed into a speech bubble sentence by sentence. When sound is on,
 * the browser's own speech synthesis reads every sentence and the typing follows
 * the voice. Lines said during the journey queue up instead of cutting each other
 * off; a line the viewer triggers (a click) replaces whatever was playing.
 * Short utterances also dodge Chrome's habit of stopping long ones after ~15 s. */
(function (global) {
  const $ = s => document.querySelector(s);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const synth = "speechSynthesis" in global ? global.speechSynthesis : null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pref = {
    get() { try { return localStorage.getItem("ea.guideHidden") === "1"; } catch { return false; } },
    set(v) { try { localStorage.setItem("ea.guideHidden", v ? "1" : "0"); } catch { /* private mode */ } },
  };
  let token = 0, chain = Promise.resolve(), lastText = "", voiceOn = () => false, lang = () => "es";

  const folded = () => $("#guide").classList.contains("folded");
  function apply(hidden) {
    $("#guide").classList.toggle("folded", hidden);
    $("#guideAvatar").setAttribute("aria-expanded", String(!hidden));
  }
  // split into sentences at punctuation followed by a space ("403.830 km" stays whole)
  const sentences = t => t.split(/(?<=[.!?…][»"”]?)\s+/).filter(s => s.trim()).map((s, i, a) => (i < a.length - 1 ? s + " " : s));

  function pickVoice(u) {
    const want = lang() === "es" ? "es" : "en";
    const voices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(want));
    u.voice = voices.find(v => /female|mujer|helena|sabina|paulina|monica|laura|elvira|dalia|zira|aria|jenny|samantha/i.test(v.name)) || voices[0] || null;
    u.lang = u.voice?.lang || (want === "es" ? "es-ES" : "en-US");
    u.rate = 1; u.pitch = 1.05;
  }
  function speakOne(text) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text.replace(/[«»"“”]/g, "").trim());
      pickVoice(u);
      let guard;
      const done = () => { clearTimeout(guard); res(); };
      u.onend = done; u.onerror = done;
      guard = setTimeout(done, 1500 + text.length * 120); // some engines never fire onend
      synth.speak(u);
    });
  }

  async function present(text, my, quiet) {
    if (my !== token) return;
    const el = $("#guideText"), box = $("#guide");
    lastText = text;
    box.hidden = false;
    box.classList.add("talking");
    const voice = !quiet && voiceOn() && synth && !folded();
    let shown = "";
    for (const s of sentences(text)) {
      if (my !== token) return;
      const speaking = voice ? speakOne(s) : null;
      if (reduced()) el.textContent = shown + s;
      else {
        const cps = voice ? 16 : 40; // with the voice the text keeps pace with it
        for (let i = 1; i <= s.length; i++) {
          if (my !== token) return;
          el.textContent = shown + s.slice(0, i);
          await sleep(1000 / cps);
        }
      }
      shown += s;
      el.textContent = shown;
      if (speaking) await speaking;
    }
    if (my === token) box.classList.remove("talking");
  }

  const Guide = {
    init(opts) {
      voiceOn = opts.voiceOn; lang = opts.lang;
      apply(pref.get());
      $("#guideAvatar").onclick = () => { const h = !folded(); apply(h); pref.set(h); if (!h && lastText) Guide.say(lastText, { quiet: true }); };
      $("#guideX").onclick = () => { apply(true); pref.set(true); Guide.hush(); };
    },
    /** Say a line. queue: wait for the lines already playing (the journey);
     *  otherwise interrupt them (a line the viewer asked for). Resolves when spoken. */
    say(text, { queue = false, quiet = false } = {}) {
      if (!text) return Promise.resolve();
      if (!queue) Guide.hush();
      const my = token;
      chain = chain.then(() => present(text, my, quiet));
      return chain;
    },
    /** resolves once every queued line has been typed and spoken */
    idle() { return chain; },
    repeat() { if (lastText) Guide.say(lastText); },
    hush() {
      token++; chain = Promise.resolve();
      $("#guide").classList.remove("talking");
      if (synth) synth.cancel();
    },
    show(on) { $("#guide").hidden = !on; if (!on) Guide.hush(); },
  };
  global.Guide = Guide;
})(window);

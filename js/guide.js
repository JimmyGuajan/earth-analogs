/* Earth Analogs – Commander Vega, the guide who talks you through the mission.
 * Text is typed into a speech bubble; when sound is on, the browser's own speech
 * synthesis reads it aloud. The viewer can fold the bubble away; the choice is kept. */
(function (global) {
  const $ = s => document.querySelector(s);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pref = {
    get() { try { return localStorage.getItem("ea.guideHidden") === "1"; } catch { return false; } },
    set(v) { try { localStorage.setItem("ea.guideHidden", v ? "1" : "0"); } catch { /* private mode */ } },
  };
  let token = 0, lastText = "", voiceOn = () => false, lang = () => "es";

  function apply(hidden) {
    $("#guide").classList.toggle("folded", hidden);
    $("#guideAvatar").setAttribute("aria-expanded", String(!hidden));
  }

  function speak(text) {
    if (!voiceOn() || !("speechSynthesis" in global)) return;
    const synth = global.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[«»"]/g, ""));
    const want = lang() === "es" ? "es" : "en";
    const voices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(want));
    u.voice = voices.find(v => /female|mujer|helena|sabina|paulina|monica|zira|aria|jenny|samantha/i.test(v.name)) || voices[0] || null;
    u.lang = u.voice?.lang || (want === "es" ? "es-ES" : "en-US");
    u.rate = 1.04; u.pitch = 1.05;
    synth.speak(u);
  }

  const Guide = {
    init(opts) {
      voiceOn = opts.voiceOn; lang = opts.lang;
      apply(pref.get());
      $("#guideAvatar").onclick = () => { const h = !$("#guide").classList.contains("folded"); apply(h); pref.set(h); if (!h && lastText) Guide.say(lastText, { quiet: true }); };
      $("#guideX").onclick = () => { apply(true); pref.set(true); Guide.hush(); };
    },
    /** type a line into the bubble (and read it aloud when sound is on) */
    async say(text, { quiet = false } = {}) {
      if (!text) return;
      const my = ++token, el = $("#guideText"), box = $("#guide");
      lastText = text;
      box.hidden = false;
      if (!quiet && !box.classList.contains("folded")) speak(text);
      box.classList.add("talking");
      if (reduced()) el.textContent = text;
      else {
        for (let i = 1; i <= text.length; i += 2) {
          if (my !== token) return;
          el.textContent = text.slice(0, i);
          await new Promise(r => setTimeout(r, 16));
        }
        el.textContent = text;
      }
      if (my === token) box.classList.remove("talking");
    },
    repeat() { if (lastText) Guide.say(lastText); },
    hush() { token++; $("#guide").classList.remove("talking"); if ("speechSynthesis" in global) global.speechSynthesis.cancel(); },
    show(on) { $("#guide").hidden = !on; if (!on) Guide.hush(); },
  };
  global.Guide = Guide;
})(window);

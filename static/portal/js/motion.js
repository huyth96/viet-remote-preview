/* Việt Remote — motion.js: the site motion kit (HOME_V4_SPEC.md §6, §7.4).
   Vendored, self-hosted: GSAP 3.15.0 (+ ScrollTrigger, SplitText, CustomEase) and Lenis 1.3.27.
   Load order (all defer): common.js · gsap · ScrollTrigger · SplitText · CustomEase · lenis · motion.js · page.js

   VR.motionOK          GSAP present and reduced motion off. When false nothing is hidden: every element
                        keeps the final state the server rendered (no-JS = reduced motion = failed JS).
   VR.fine              (hover:hover) and (pointer:fine)
   VR.pinScenes         MediaQueryList for the two sticky scenes (desktop, fine pointer, ≥ 720 px tall)
   VR.motion.init()     plugins, CustomEases ("vr.expo" "vr.quart" "vr.in" "vr.settle" "vr.pop"), defaults,
                        Lenis on fine pointers (kill switch: ?smooth=0 or localStorage vr.smooth = "0")
   VR.motion.lines(el)  SplitText line reveal inside padded masks (no clipped Vietnamese marks), once
   VR.motion.rise(els)  y + fade, once, batched; elements already on screen at init are left alone
   VR.motion.odometer(el) -> {set(v), to(v, {duration, ease}), value}
                        digit reels moved by transforms; widths reserved, so a count never shifts layout;
                        the value lives in an sr-only span (reels are CSS-drawn, aria-hidden)
   VR.motion.from(el, vars)   one element arrives on scroll (start state only when below the fold)
   VR.motion.hold/done        pending reveals: a focused element inside one is shown at once
   VR.motion.magnet(el, px)   pointer magnet (quickTo), one delegated rAF-throttled listener
   VR.motion.follow(el) -> {show, hide, move}   pointer follower (tool previews)
   VR.motion.scene(section, apply, opts)        sticky scrub when VR.pinScenes matches, else one tween on entry
   VR.motion.below(el)  true when el starts below the first screen (only those get start states)
*/
(function () {
  "use strict";
  const VR = (window.VR = window.VR || {});
  const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
  const reduced = mq("(prefers-reduced-motion: reduce)").matches;
  const gsap = window.gsap;

  VR.reducedMotion = VR.reducedMotion || reduced;
  VR.motionOK = !reduced && !!gsap && !!window.ScrollTrigger;
  VR.fine = mq("(hover: hover) and (pointer: fine)").matches;
  VR.pinScenes = mq("(min-width: 1024px) and (min-height: 720px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const small = mq("(max-width: 767px)").matches;
  const K = { dist: small ? 0.6 : 1, dur: small ? 0.85 : 1, para: small ? 0.5 : 1 };

  const M = (VR.motion = { K, lenis: null, ready: false });

  M.below = (el) => !!el && el.getBoundingClientRect().top > window.innerHeight * 0.92;

  /* ---------------- init: plugins, eases, smooth scroll ---------------- */
  M.init = () => {
    if (M.ready || !VR.motionOK) return VR.motionOK;
    const { ScrollTrigger, SplitText, CustomEase } = window;
    gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
    CustomEase.create("vr.expo", ".16,1,.3,1");
    CustomEase.create("vr.quart", ".25,1,.5,1");
    CustomEase.create("vr.in", ".55,0,1,.45");
    // springs (craft-motion/springs.py): settle 720 ms ζ .82, 1.1 % overshoot · pop 520 ms ζ .62, 8 %
    CustomEase.create("vr.settle", "M0,0 L0.005,0.001 L0.017,0.006 L0.032,0.020 L0.050,0.047 L0.072,0.089 L0.096,0.146 L0.123,0.216 L0.152,0.297 L0.183,0.385 L0.217,0.476 L0.253,0.567 L0.290,0.652 L0.330,0.731 L0.371,0.800 L0.415,0.858 L0.460,0.905 L0.507,0.942 L0.555,0.969 L0.605,0.988 L0.657,1.000 L0.711,1.007 L0.765,1.010 L0.822,1.011 L0.880,1.010 L0.939,1.009 L1.000,1.000");
    CustomEase.create("vr.pop", "M0,0 L0.005,0.001 L0.017,0.010 L0.032,0.035 L0.050,0.082 L0.072,0.153 L0.096,0.249 L0.123,0.363 L0.152,0.490 L0.183,0.620 L0.217,0.745 L0.253,0.855 L0.290,0.946 L0.330,1.013 L0.371,1.057 L0.415,1.079 L0.460,1.083 L0.507,1.075 L0.555,1.059 L0.605,1.041 L0.657,1.024 L0.711,1.010 L0.765,1.001 L0.822,0.995 L0.880,0.993 L0.939,0.993 L1.000,1.000");
    gsap.defaults({ ease: "vr.expo", duration: 0.72 * K.dur });
    ScrollTrigger.config({ ignoreMobileResize: true });
    M.ready = true;
    M.smooth();
    return true;
  };

  /* Lenis on fine pointers only (notched wheels jump 100 px and make scrubbed scenes step). It drives
     the real window scroll, so CSS scroll-driven animations and IntersectionObservers keep working. */
  M.smooth = () => {
    let off = new URLSearchParams(location.search).get("smooth") === "0";
    try { off = off || window.localStorage.getItem("vr.smooth") === "0"; } catch (_) { /* storage blocked */ }
    if (off || !VR.fine || !window.Lenis) return null;
    const lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false });
    lenis.on("scroll", window.ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // in-page anchors land under the header (-72) on the same expo curve as everything else
    document.addEventListener("click", (event) => {
      const a = event.target.closest && event.target.closest('a[href^="#"]');
      if (!a || a.getAttribute("href").length < 2) return;
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: -72, duration: 1.1, easing: (t) => 1 - Math.pow(2, -10 * t) });
      history.pushState(null, "", a.getAttribute("href"));
    });
    M.lenis = lenis;
    return lenis;
  };

  /* ---------------- pending reveals: keyboard focus never lands on something invisible ----------------
     Every element that motion hides until it scrolls in (rise, lines, from) is registered here with a
     finisher. One delegated focusin listener completes any pending target that contains the focused
     element at once (WCAG 2.4.7 / 2.4.11): a Tab into a not-yet-revealed row shows it immediately. */
  const pending = new Map();
  M.hold = (el, finish) => { if (el) pending.set(el, finish); };
  M.done = (el) => { pending.delete(el); };
  document.addEventListener("focusin", (event) => {
    if (!pending.size) return;
    const target = event.target;
    pending.forEach((finish, el) => {
      if (el === target || (el.contains && el.contains(target))) { pending.delete(el); finish(); }
    });
  });
  const show = (el) => () => gsap.set(el, { opacity: 1, x: 0, y: 0, rotation: 0, overwrite: true, clearProps: "transform,opacity" });

  /* ---------------- line reveal (SplitText lines inside .vr-line-mask, padded in base.css) ---------------- */
  M.lines = (el, opts) => {
    if (!el || !M.ready) return null;
    const o = Object.assign({ start: "top 86%", stagger: 0.09, duration: 0.9, delay: 0 }, opts);
    if (!M.below(el) && !o.force) return null;
    return window.SplitText.create(el, {
      type: "lines", mask: "lines", linesClass: "vr-line", autoSplit: true, aria: "auto",
      onSplit(self) {
        const tween = gsap.from(self.lines, {
          yPercent: 112, duration: o.duration * K.dur, stagger: o.stagger, delay: o.delay, ease: "vr.expo",
          scrollTrigger: { trigger: el, start: o.start, once: true }, onComplete: () => M.done(el),
        });
        M.hold(el, () => tween.progress(1));
        return tween;
      },
    });
  };

  /* ---------------- rise: y + fade, once, batched ---------------- */
  M.rise = (els, opts) => {
    if (!M.ready) return;
    const o = Object.assign({ y: 16, start: "top 88%", stagger: 0.07, duration: 0.72, cap: 0.42 }, opts);
    const list = Array.from(els || []).filter((el) => M.below(el));
    if (!list.length) return;
    gsap.set(list, { opacity: 0, y: o.y * K.dist });
    list.forEach((el) => M.hold(el, show(el)));
    window.ScrollTrigger.batch(list, {
      start: o.start, once: true,
      onEnter: (batch) => {
        const todo = batch.filter((el) => pending.has(el));  // a focused one was already shown
        todo.forEach(M.done);
        if (!todo.length) return;
        gsap.to(todo, {
          opacity: 1, y: 0, duration: o.duration * K.dur, ease: "vr.expo",
          stagger: { each: o.stagger, amount: Math.min(o.cap, o.stagger * (todo.length - 1)) },
          clearProps: "transform,opacity",
        });
      },
    });
  };

  /* ---------------- from: one element arrives from a start state when it scrolls in (pending-safe) ---------------- */
  M.from = (el, vars, opts) => {
    if (!el || !M.ready || !M.below(el)) return null;
    const o = Object.assign({ start: "top 85%" }, opts);
    const tween = gsap.from(el, Object.assign({ duration: 0.72, ease: "vr.expo", clearProps: "transform,opacity",
      onComplete: () => M.done(el) }, vars, { scrollTrigger: { trigger: o.trigger || el, start: o.start, once: true } }));
    M.hold(el, () => tween.progress(1));
    return tween;
  };

  /* ---------------- odometer (§6.6) ----------------
     <span class="odo" data-odo="989">989</span>: the server renders the final text. JS rebuilds it as
       <span class="sr-only">989</span>                         the value for assistive tech, copy-paste, find
       <span class="odo__vis" aria-hidden="true">reels</span>   the picture
     Each digit is a reel whose ten digits are drawn by CSS (::before content), so innerText, reader view
     and find-in-page never meet "0123456789" soup; separators ("." "," "+") are drawn the same way.
     Reels are one tabular digit wide and never change width: a reel above the value's leading digit stays
     in place as a dimmed zero (a mechanical counter), so a count never shifts or slides the numeral
     sideways. data-odo-max="99.9" widens the template (a slider output); data-odo-collapse drops leading
     reels instead (only where the user's own input causes the change). While reels roll, their window
     fades at the top and bottom edges (.is-rolling), so no half-digit is ever cut hard. */
  const fmt = (v, decimals) => Number(v).toLocaleString("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: true });
  M.odometer = (el) => {
    if (!el) return null;
    if (el._odo) return el._odo;
    const decimals = Number(el.dataset.decimals || 0);
    const finalValue = Number(el.dataset.odo);
    const max = Number(el.dataset.odoMax || finalValue);
    const collapse = el.hasAttribute("data-odo-collapse");
    const trim = decimals > 0 && el.hasAttribute("data-odo-trim");  // "20" not "20,0" when the value is whole
    const template = fmt(max, decimals);
    const decimalSep = ",";
    const intDigits = template.split(decimalSep)[0].replace(/\D/g, "").length;
    let place = Math.pow(10, intDigits - 1);
    const lowest = Math.pow(10, -decimals);
    const reels = [];
    const sr = document.createElement("span");
    sr.className = "sr-only";
    const vis = document.createElement("span");
    vis.className = "odo__vis";
    vis.setAttribute("aria-hidden", "true");
    let lastReel = null;
    let inDecimals = false;
    for (const ch of template) {
      if (/\d/.test(ch)) {
        const reel = document.createElement("span");
        reel.className = "odo__reel" + (inDecimals ? " odo__dec" : "");
        const strip = document.createElement("span");
        strip.className = "odo__strip";
        reel.appendChild(strip);
        vis.appendChild(reel);
        lastReel = { el: reel, strip, place, seps: [] };
        reels.push(lastReel);
        place = place / 10;
      } else {
        const sep = document.createElement("span");
        if (decimals && ch === decimalSep) inDecimals = true;
        sep.className = "odo__sep" + (inDecimals ? " odo__dec" : "") + (ch === "." || ch === "," ? " odo__sep--mark" : "");
        sep.dataset.ch = ch;
        vis.appendChild(sep);
        if (lastReel) lastReel.seps.push(sep);  // a separator is "leading" while the reel to its left is
      }
    }
    el.removeAttribute("aria-label");
    el.textContent = "";
    el.append(sr, vis);
    el.classList.add("is-odo");
    if (collapse) el.classList.add("odo--collapse");
    const state = { value: finalValue, whole: false };
    const say = (v) => {
      const whole = trim && Math.abs(v - Math.round(v)) < lowest / 2;
      const text = whole ? fmt(Math.round(v), 0) : fmt(v, decimals);
      if (sr.textContent !== text) sr.textContent = text;
    };
    const render = (v) => {
      const value = Math.max(0, v);
      reels.forEach((r) => {
        let pos;
        if (Math.abs(r.place - lowest) < 1e-9) pos = (value / r.place) % 10;
        else {
          const below = value % r.place;
          pos = (Math.floor(value / r.place + 1e-9) % 10) + Math.max(0, (below - (r.place - lowest)) / lowest);
        }
        r.strip.style.transform = `translate3d(0, ${(-pos * 100 / 11).toFixed(3)}%, 0)`;
        const lead = r.place > 1 && value < r.place - lowest - 1e-9;
        r.el.classList.toggle("is-lead", lead);
        r.seps.forEach((s) => { if (!s.classList.contains("odo__dec")) s.classList.toggle("is-lead", lead); });
      });
      if (trim) el.classList.toggle("is-trim", state.whole || Math.abs(value - Math.round(value)) < lowest / 2);
    };
    const stop = () => { if (api._tw) { api._tw.kill(); api._tw = null; } el.classList.remove("is-rolling"); };
    const api = {
      get value() { return state.value; },
      set(v) { stop(); state.value = v; render(v); say(v); },
      to(v, o) {
        const opts = Object.assign({ duration: 1.3, ease: "vr.expo" }, o);
        if (!gsap || VR.reducedMotion) { api.set(v); return null; }
        stop();
        state.whole = !!opts.whole && Math.abs(v - Math.round(v)) < lowest / 2;  // count whole numbers only (an entry count to "20")
        say(v);  // assistive tech and copy get the destination at once, never a mid-roll figure
        el.classList.add("is-rolling");
        api._tw = gsap.to(state, { value: v, duration: opts.duration * K.dur, ease: opts.ease, delay: opts.delay || 0,
          onUpdate: () => render(state.value),
          onComplete: () => { state.whole = false; render(v); say(v); el.classList.remove("is-rolling"); api._tw = null; } });
        return api._tw;
      },
      label(v) { say(v); },
    };
    render(finalValue);
    say(finalValue);
    el._odo = api;
    return api;
  };

  /* ---------------- magnet: the three community CTAs lean toward the pointer (6 px) ---------------- */
  const magnets = [];
  let magnetFrame = 0;
  let pointer = null;
  const magnetTick = () => {
    magnetFrame = 0;
    if (!pointer) return;
    magnets.forEach((m) => {
      const r = m.el.getBoundingClientRect();
      const pad = 24;
      const inside = pointer.x > r.left - pad && pointer.x < r.right + pad && pointer.y > r.top - pad && pointer.y < r.bottom + pad;
      if (inside) {
        const dx = (pointer.x - (r.left + r.width / 2)) / (r.width / 2 + pad);
        const dy = (pointer.y - (r.top + r.height / 2)) / (r.height / 2 + pad);
        m.x(dx * m.px); m.y(dy * m.px); m.on = true;
      } else if (m.on) {
        m.on = false;
        gsap.to(m.el, { x: 0, y: 0, duration: 0.72, ease: "vr.settle", overwrite: "auto" });
      }
    });
  };
  M.magnet = (el, px) => {
    if (!el || !M.ready || !VR.fine) return;
    const strength = px || 6;
    magnets.push({ el, px: strength, on: false,
      x: gsap.quickTo(el, "x", { duration: 0.6, ease: "vr.expo" }),
      y: gsap.quickTo(el, "y", { duration: 0.6, ease: "vr.expo" }) });
    if (magnets.length === 1) {
      document.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        pointer = { x: e.clientX, y: e.clientY };
        if (!magnetFrame) magnetFrame = requestAnimationFrame(magnetTick);
      }, { passive: true });
    }
  };

  /* ---------------- pointer follower (tool previews) ---------------- */
  M.follow = (el) => {
    if (!el || !M.ready) return null;
    gsap.set(el, { xPercent: 0, yPercent: 0, x: -999, y: -999 });
    const qx = gsap.quickTo(el, "x", { duration: 0.5, ease: "vr.expo" });
    const qy = gsap.quickTo(el, "y", { duration: 0.5, ease: "vr.expo" });
    let shown = false;
    return {
      move(x, y, jump) {
        if (jump) { gsap.set(el, { x, y }); qx(x); qy(y); return; }
        qx(x); qy(y);
      },
      show() {
        if (shown) return; shown = true;
        el.classList.add("is-on");
        gsap.fromTo(el, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, ease: "vr.expo", overwrite: "auto" });
      },
      hide() {
        if (!shown) return; shown = false;
        gsap.to(el, { opacity: 0, scale: 0.96, duration: 0.16, ease: "vr.in", overwrite: "auto",
          onComplete: () => { if (!shown) el.classList.remove("is-on"); } });
      },
    };
  };

  /* ---------------- scenes: sticky scrub on desktop, one tween on entry elsewhere ----------------
     apply(p) draws the scene at progress p (0 = start, 1 = the final state the server rendered).
     The default DOM is the final state; a scene sets its start state only when it builds, and only
     when it is not already on screen (mobile) — a scrub scene simply follows the scroll position. */
  M.scene = (section, apply, opts) => {
    if (!section || !M.ready) return null;
    const o = Object.assign({ duration: 2.4, ease: "vr.quart", start: "top 60%", trigger: section }, opts);
    const proxy = { p: 1 };
    const draw = () => apply(proxy.p);
    if (VR.pinScenes.matches) {
      proxy.p = 0;
      draw();
      return gsap.to(proxy, {
        p: 1, ease: "none", onUpdate: draw,
        scrollTrigger: { trigger: section, start: o.pinStart || "top top", end: "bottom bottom", scrub: 0.5 },
      });
    }
    if (!M.below(o.trigger)) { apply(1); return null; }
    proxy.p = 0;
    draw();
    const tween = gsap.to(proxy, { p: 1, duration: o.duration * K.dur, ease: o.ease, paused: true, onUpdate: draw });
    window.ScrollTrigger.create({ trigger: o.trigger, start: o.start, once: true, onEnter: () => tween.play() });
    return tween;
  };

  /* parallax helper: y from +a to -a across the element's pass (scrub .5), amplitude × K.para */
  M.parallax = (el, amp, trigger) => {
    if (!el || !M.ready) return null;
    const a = amp * K.para;
    return gsap.fromTo(el, { y: a }, { y: -a, ease: "none", immediateRender: false,
      scrollTrigger: { trigger: trigger || el, start: "top bottom", end: "bottom top", scrub: 0.5 } });
  };
})();

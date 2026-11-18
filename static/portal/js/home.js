/* Việt Remote — home.js (HOME V6.4 "Đường bay", round 4: portal/HOME_ROUND4_SPEC.md over HOME_ROUND3_SPEC.md,
   HOME_FLIGHT_SPEC.md §4 and HOME_V6_SPEC.md §4). No libraries.

   html.hm          motion allowed: set in the page head (home.html) before the first paint when reduced motion is
                    off and IntersectionObserver exists; this file says it is running (VR.homeLive), otherwise the
                    head lets the hero's intro play without it after 1.2 s (html.hm-free) and drops the class
                    after 2.5 s, and the finished page shows. Every CSS start state and the pins (the hero's run,
                    1B's loop, 2B's hold) live under html.hm, so no-JS, failed JS and reduced motion all show the DOM's
                    final state: no pins, waypoints lit, toggles on, replies shown, 2B's finished stage, Chặng 02's
                    cards out and stamped, the dawn risen over the horizon, the plane resting in the final pill.
   One rAF ticker   runs only while something needs a frame; listeners are passive; frames write transform,
                    opacity, filter, z-index, CSS variables, text and the path mask's stroke-dashoffset only (never
                    layout); every rect is read in measure() (load, fonts, resize) and cached. Easings use dt.
     orbit()        the hero's orbit (ROUND4 §1): three concentric, coplanar rings (one tilt, one axis ratio, three
                    sizes) round the orb; every portrait and light dot travels its ring from the phase the server
                    placed it at (a translate from there: no layout shift), its centre always ON the ring; depth is
                    the shared plane's (rx sin θ over the outer ring's rx: scale, blur, a cool wash, behind the orb
                    or in front of it); the pointer moves the whole picture by one offset; paused off screen and in a
                    hidden tab. Geometry twins: views._orbit_point, views._depth_style (point(), look() here). T1
                    (T1.p, written by flight()) eases the orbit to a stop, draws the eight faces into the orb
                    (translate, scale, blur, then gone), folds the rings in and shrinks the orb into the flash
                    (.hv-burst) the plane forms in.
     flight()       the journey's scroll engine. measure(): every [data-anchor] shown at this width (the desktop
                    curve's set from 900 px, the gutter set below), in DOM order, joined into smooth cubic curves
                    (tangents from the neighbours or data-tan, handles never past the next point along the tangent
                    nor across the side bounds: 48 px inside the window on desktop, the lane on phones) and
                    sampled into a lookup table; one curve per layer: the pinned hero's launch (its own SVG), the
                    page (bands of the overlay SVG over .fl), the pinned 1B's loop and the pinned 2B stage's stretch (their
                    own SVGs), joined at door points; each pin's door in sits at its very top and its door out at its
                    foot, so once the pin holds, the page's stretch and the pin's meet out of sight and the line never
                    shows a gap (§2); but the plane crosses each door where it flies (data-f: a door in is keyed while
                    the layer still rides the page, a door out, data-out, once it rides on again), so it never rises
                    up the window nose down nor ducks under the header. Each point's scroll key starts where it sits
                    at data-f of the window (default .55), at data-p of a pin, or for the orb at T1K.launch of the
                    hero's pin; then the
                    scroll is shared out by length (PACE: at most 2.8 px of path per px of scroll, the last curve into
                    the pill its own LAND budget) with an isotonic fit that keeps the keys as near the layout's as
                    that allows and holds the doors. Phones keep the keys through the browser bar's height changes.
                    frame(): the drawn length follows the (eased) scroll through those keys; the mask reveals the
                    dotted stroke (each stretch's dots in phase with the one before, a soft fade-in at the launch);
                    the plane rides the tip (position and tangent from the table, eased turn: its nose on its own
                    line, at most 10° of screen motion while the page scrolls fast), forms in the hero during T1 on
                    its launch heading and docks on the final pill's right end (over the last 260 px it shrinks
                    and eases to the docked mark's angle, data-rest; the pill glows once); waypoints light as it passes, and what
                    they stand for ([data-lit]: a 1B reply that springs out, a Chặng 02 toggle that switches on); T2
                    flies Chặng 01's Q&A card into 1B's centre (transform only, its question crossfading mid-flight;
                    1B's heading comes in once the card is clear of it; phones: a crossfade); Chặng 02's three cards
                    lift out of their rows (--pop, scrubbed, reversible) and each gets its stamp once it is out.
                    Reduced motion: the whole path drawn once, nothing moves.
     stage()        2B, the product stage (HOME_ROUND5_SPEC §2, scrubbed by scroll as §2b): the floor reflections
                    (always), and with motion every beat a pure function of the scroll (reversible, no timers): the
                    lights and the paid price come up as the stage does, the price rolls down like a real odometer
                    to a flat "0đ" (crisp digits on strips following the value, the leading zeros folding away, what
                    is left centred), "0đ" lands, the 3D pop with the small struck price, the panels rise one by one,
                    each demo after it lands. The pin's progress (from 1200 px on tall windows), or each part's place
                    in the window in flow (phones, short windows, 900-1199 px). It tells flight() when "0đ" stands
                    landed (VR.homeStageDone): the plane fades behind it only from then.
     dawn()         the landing (HOME_ROUND4_SPEC §2b), scrubbed by scroll (reversible): the horizon draws out from
                    the centre and brightens (--h), the rays fan up (--r), the portraits rise one by one from behind
                    the horizon (centre first), the dawn risen just before the plane docks in the pill on the horizon.
     counters()     [data-hm-count] figures count up once (Chặng 02's line of real figures, on screen).
   reveals()        [data-fade] (opacity only: those blocks hold anchors), [data-clip] (the Chặng 01 photo) get
                    .is-in on screen; a focused element is always revealed.
   focusCards()     a focused job card, tool panel or the final pill scrolls whole into view (scroll-margin keeps
                    the focus ring clear of the window's edge and the sticky header).
*/
(function () {
  "use strict";
  const root = document.documentElement;
  const VR = (window.VR = window.VR || {});
  const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false });
  const canObserve = "IntersectionObserver" in window;
  const motion = canObserve && !mq("(prefers-reduced-motion: reduce)").matches && root.classList.contains("hm");
  // running: the pins (html.hm-on) exist only from here, so a page whose script never ran has no sticky layer to drop
  if (motion) { VR.homeLive = true; root.classList.add("hm-on"); }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const back = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const ready = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());
  // an easing step of `rate` per 60 Hz frame, the same speed at 30, 60 or 120 frames a second
  const ease = (rate, dt) => 1 - Math.pow(1 - rate, dt / 16.67);
  const T1 = { p: 0 };                       // the hero's pin progress: flight() writes it, orbit() reads it
  // the eased scroll every scrubbed effect follows: flight() writes it each frame (its task runs first), stage() reads it
  const SCR = { sm: null };

  /* ---------------------------------------------------------------- the ticker */
  const tasks = new Set();
  let raf = 0;
  let last = 0;
  function tick(now) {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16.67;
    last = now;
    let again = false;
    tasks.forEach((fn) => { if (fn(dt)) again = true; });
    if (again) raf = requestAnimationFrame(tick); else last = 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  // runs fn once img is decoded (or failed, or after `wait` ms), at once when it already is
  function decoded(img, fn, wait = 2500) {
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    if (!img || (img.complete && img.naturalWidth) || !img.decode) go();
    else { img.decode().then(go, go); setTimeout(go, wait); }
  }

  /* ---------------------------------------------------------------- the orbit (+ T1) */
  // A point on a ring of the orbit (views._orbit_point's twin): the stage is sx × sy units (data-stage), the rings
  // concentric circles in one tilted plane, each pictured as the ellipse (rx cos θ, ry sin θ) turned by the common
  // tilt about the centre; depth is the real one of that plane, rx sin θ over the outer ring's rx (rmax: data-rmax),
  // 1 the outer ring's nearest point
  const RAD = Math.PI / 180;
  function point(r, deg, sx, sy, rmax) {
    const th = deg * RAD, t = r.tilt * RAD;
    const lx = r.rx * Math.cos(th), ly = r.ry * Math.sin(th);
    return { x: sx / 2 + lx * Math.cos(t) - ly * Math.sin(t), y: sy / 2 + lx * Math.sin(t) + ly * Math.cos(t), d: r.rx * Math.sin(th) / rmax };
  }
  // depth as the faces show it (views._depth_style's twin): the near half over the orb (z 32-40), the far half behind
  // it (z 10-18); dots always under the faces at their depth
  function look(d) {
    const f = (d + 1) / 2;
    return { s: 0.52 + 0.43 * f, b: Math.max(0, 0.6 - f) * 4.1, w: Math.max(0, 0.68 - 0.8 * f), o: 0.36 + 0.64 * f,
      z: d >= 0 ? 32 + Math.round(d * 8) : 10 + Math.round(f * 16), dz: d >= 0 ? 31 : 9 };
  }

  function orbit() {
    const sky = $("[data-sky]");
    const hero = sky && sky.closest(".hv");
    if (!sky || !hero) return;
    let rings;
    try { rings = JSON.parse(sky.dataset.rings); } catch (e) { return; }
    const [SX, SY] = (sky.dataset.stage || "1240 500").split(" ").map(Number);
    const RMAX = Number(sky.dataset.rmax) || Math.max(...rings.map((r) => r.rx));
    const movers = $$("[data-ring]", sky).map((el) => {
      const r = rings[Number(el.dataset.ring)];
      const phase = Number(el.dataset.phase);
      const p0 = r ? point(r, phase, SX, SY, RMAX) : null;   // where the server placed it (left/top %): moves are deltas
      return { el, r, phase, x0: p0 && p0.x, y0: p0 && p0.y, face: el.classList.contains("hv-av"), z: -1, f: "", w: "", o: -1 };
    }).filter((m) => m.r);
    movers.filter((m) => m.face).forEach((m, i) => { m.i = i; });
    // the near arcs' cuts (home_atom_rings.html): a disc under each face in its own ring's mask, moved with the face,
    // so a face always covers its own ring (stage units: the rings' SVG is the stage)
    movers.filter((m) => m.face).forEach((m) => {
      m.cut = $(`.hv-rings--front [data-cut="${m.i}"], .hm-rings--front [data-cut="${m.i}"]`, sky);
      m.k = parseFloat(m.el.style.getPropertyValue("--k")) || 1;
      m.cx = ""; m.cy = ""; m.cr = "";
    });
    const orb = $(".hv-orb", sky);
    const halo = $(".hv-halo", sky);
    const burst = $(".hv-burst", sky);
    const ringEls = $$(".hv-rings", sky);
    const line = $(".hv-line", sky);
    // the stage's scale on screen: kx px per stage unit across, ky down (equal from 768 px, where the stage keeps its
    // ratio; phones stretch it taller); the portraits' radius (avR, px per unit of --k and scale: measured, as phones
    // size them larger) and the sphere's (orbR, px: the render's sphere fills 89 % of it)
    let W = 0, H = 0, kx = 1, ky = 1, avR = 0, orbR = 0;
    const size = () => {
      if (!sky.clientWidth) return;                  // not laid out (hidden, printing): keep the last scale
      W = sky.clientWidth; H = sky.clientHeight || W * SY / SX; kx = W / SX; ky = H / SY;
      const f = movers.find((m) => m.face);
      avR = (f && f.el.offsetWidth ? f.el.offsetWidth / (f.k || 1) : (Number(sky.dataset.av) || 128) * kx) / 2;
      orbR = orb ? orb.offsetWidth * 0.89 / 2 : 120 * kx;
    };
    size();
    let onScreen = true, elapsed = 0, tx = 0, ty = 0, px = 0, py = 0, lastT = -1;
    const q = (v, step) => (Math.round(v / step) * step).toFixed(2);

    // Every face's centre sits ON its ring at all times: the pointer moves the whole orbit (rings, orb, faces, dots) by
    // one offset, never a face against its ring. T1, in pin progress p: the faces converge (one ease each, staggered
    // by index) on the orb's centre, where the plane forms (flight(): T1K.form0 .27 → form1 .42) WHILE they arrive:
    // the last faces are still folding in, shrinking, as the plane grows out of the flash, so they are seen folding
    // into it (no beat with only a glow point). The rings fold into the orb and are gone before they are small,
    // handing over to ONE clean hairline that draws out from the orb and shrinks back into the launch point; the orb
    // shrinks and fades into the flash as the plane appears (never a white plane on a blue disc)
    function place() {
      const p = T1.p;
      const fold = smooth(0.08, 0.34, p);
      const gone = smooth(0.2, 0.36, p);            // the orb shrinks into the flash
      for (const m of movers) {
        // (the last face is in by p .31, before the flash passes .8 of its peak: the peak frame is the clean plane in
        // its bloom, review 18/11)
        const c = m.face ? smooth(0.04 + 0.01 * m.i, 0.26 + 0.006 * m.i, p) : smooth(0.02, 0.24, p);
        const pt = point(m.r, m.phase + m.r.dir * 360 * elapsed / m.r.period, SX, SY, RMAX);
        const L = look(pt.d);
        let x = (pt.x - m.x0) * kx + px, y = (pt.y - m.y0) * ky + py;
        if (c > 0) {                                     // T1: drawn into the orb's centre in a slow spiral
          const rx = (pt.x - SX / 2) * kx, ry = (pt.y - SY / 2) * ky;
          const th = 1.5 * c * m.r.dir, co = Math.cos(th), si = Math.sin(th), shrink = 1 - c;
          x = (SX / 2 - m.x0) * kx + px + (rx * co - ry * si) * shrink;
          y = (SY / 2 - m.y0) * ky + py + (rx * si + ry * co) * shrink;
        }
        const s = L.s * (1 - 0.72 * c);
        m.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
        if (m.cut) {                                     // its ring's cut follows it (gone once T1 draws it in)
          const cx = pt.x.toFixed(1), cy = pt.y.toFixed(1), cr = (c > 0 ? 0 : avR / kx * m.k * L.s + 1).toFixed(1);
          if (cx !== m.cx) { m.cx = cx; m.cut.setAttribute("cx", cx); }
          if (cy !== m.cy) { m.cy = cy; m.cut.setAttribute("cy", cy); }
          if (cr !== m.cr) { m.cr = cr; m.cut.setAttribute("r", cr); }
        }
        if (m.face) {
          const f = `blur(${q(L.b * (1 - c) + 1.5 * c, 0.25)}px)`;
          if (f !== m.f) { m.f = f; m.el.style.filter = f; }
          const w = q(L.w * (1 - c), 0.02);
          if (w !== m.w) { m.w = w; m.el.style.setProperty("--w", w); }
          // converging: in front of the orb all the way in, so they melt into the flash (never hidden behind it)
          const z = c > 0.12 ? 32 : L.z;
          if (z !== m.z) { m.z = z; m.el.style.zIndex = String(z); }
          // a face on the far half is hidden while it is inside the orb's silhouette (its last sliver showed through
          // the render's soft rim as a cobalt smudge) and comes out of it as it emerges past the rim
          let hid = 1;
          if (pt.d < 0 && c === 0) {                     // (in px: phones stretch the stage)
            const rad = avR * m.k * L.s, dist = Math.hypot((pt.x - SX / 2) * kx, (pt.y - SY / 2) * ky);
            hid = smooth(orbR - rad * 0.9, orbR - rad * 0.1, dist);
          }
          const o = Math.round((1 - smooth(0.66, 0.96, c)) * hid * 50) / 50;     // melting into the glow
          if (o !== m.o) { m.o = o; m.el.style.opacity = o === 1 ? "" : String(o); }
        } else {
          const o = Math.round(L.o * (1 - c) * 50) / 50;
          if (o !== m.o) { m.o = o; m.el.style.opacity = String(o); }
          if (L.dz !== m.z) { m.z = L.dz; m.el.style.zIndex = String(L.dz); }
        }
      }
      const drift = `translate(-50%,-50%) translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0)`;
      if (orb) {
        orb.style.transform = gone ? `${drift} scale(${(1 - 0.86 * gone).toFixed(4)})` : drift;
        // gone as the plane's wings open over it (T1K.form0 .27 → .42): never a white plane on a blue disc
        orb.style.opacity = p > 0.2 ? (1 - smooth(0.24, 0.34, p)).toFixed(3) : "";
      }
      if (halo) {
        halo.style.transform = p ? `${drift} scale(${(1 - 0.5 * gone).toFixed(4)})` : drift;
        halo.style.opacity = p > 0.3 ? (1 - smooth(0.36, 0.56, p)).toFixed(3) : "";
      }
      ringEls.forEach((el) => {
        el.style.transform = `translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0)` + (fold ? ` scale(${(1 - 0.62 * fold).toFixed(4)}) rotate(${(24 * fold).toFixed(2)}deg)` : "");
        el.style.opacity = p > 0.15 ? (1 - smooth(0.18, 0.32, p)).toFixed(3) : "";
      });
      if (p !== lastT) {
        lastT = p;
        // the rings' soft glow goes first
        ringEls.forEach((el) => el.style.setProperty("--glow", (1 - smooth(0.06, 0.18, p)).toFixed(3)));
        if (line) {                                      // the hairline: out from the orb, then back into the launch point
          const grow = smooth(0.18, 0.3, p), shrink = smooth(0.3, 0.38, p);
          line.style.setProperty("--ls", (grow * (1 - shrink)).toFixed(4));
          line.style.setProperty("--lo", (Math.min(1, grow * 1.6) * (1 - smooth(0.31, 0.37, p))).toFixed(3));
        }
        if (burst) {                                     // the flash where the faces meet the orb
          burst.style.setProperty("--burst", (smooth(0.24, 0.34, p) * (1 - smooth(0.4, 0.56, p))).toFixed(3));
          burst.style.setProperty("--burst-s", (0.4 + 1.2 * smooth(0.24, 0.56, p)).toFixed(3));
        }
      }
    }

    tasks.add((dt) => {
      if (!onScreen || document.hidden) return false;
      elapsed += dt / 1000 * (1 - smooth(0, 0.3, T1.p));     // T1: the orbit eases to a stop
      const e = ease(0.06, dt);
      px += (tx - px) * e;
      py += (ty - py) * e;
      place();
      return true;
    });
    place();

    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) wake(); }).observe(hero);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
    const measure = () => { size(); place(); };
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(sky);
    else window.addEventListener("resize", measure, { passive: true });
    // the pointer parallax: mouse only (touch scrolls), the whole orbit ±8 px against the pointer
    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = hero.getBoundingClientRect();
      tx = -clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 16;
      ty = -clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 16;
      wake();
    }, { passive: true });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; wake(); }, { passive: true });
    // each portrait pops in once its photo is decoded, the orb and its halo once the orb's render is (at most 2.5 s
    // of waiting): never an empty disc or a bare halo that animates before its picture is there
    // (its ring's cut opens with it: home.css hm-cut)
    movers.filter((m) => m.face).forEach((m) => decoded($("img", m.el), () => {
      m.el.classList.add("is-ready");
      if (m.cut) m.cut.classList.add("is-ready");
    }));
    decoded(orb && $("img", orb), () => sky.classList.add("is-orb"));
    wake();
  }

  /* ---------------------------------------------------------------- the flight path */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (name, attrs, parent) => {
    const el = document.createElementNS(NS, name);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(el);
    return el;
  };

  // a point's own heading (degrees; data-tan, "v" = straight down), or null: from its neighbours. From 1200 px a
  // point may have its own (data-tan-xl: 1B's wide loop; "auto" = from its neighbours), below 900 px too
  // (data-tan-m: the landing's dock, reached from below on the gutter line)
  function tanOf(el) {
    let t = el && el.dataset.tan;
    if (el && el.dataset.tanXl && window.innerWidth >= 1200) t = el.dataset.tanXl === "auto" ? "" : el.dataset.tanXl;
    if (el && el.dataset.tanM && window.innerWidth < 900) t = el.dataset.tanM;     // the gutter line's own (phones)
    if (!t) return null;
    const deg = t === "v" ? 90 : Number(t);
    return Number.isFinite(deg) ? { x: Math.cos(deg * RAD), y: Math.sin(deg * RAD) } : null;
  }
  // how far a handle from (x, y) along (dx, dy) may reach before it crosses the side bounds [lo, hi]
  function reach(x, dx, lo, hi) {
    if (dx > 1e-6) return Math.max(0, (hi - x) / dx);
    if (dx < -1e-6) return Math.max(0, (lo - x) / dx);
    return Infinity;
  }
  // one smooth curve through the points: tangents from the neighbours (or the point's own), handles a third of
  // each span but never much longer than the span's run along the tangent (a quarter turn becomes a quarter ellipse:
  // little overshoot past the next point), never shorter than min(a third, 40 px) (no corner where the run is
  // short or the tangent turns away), and never across the side bounds (lo, hi), so
  // the whole curve stays inside them (it lies in the hull of its control points). Each handle is shortened
  // along its own tangent, so the heading stays continuous through every point. Sampled every few pixels into
  // {xs, ys, ls} (the lookup table) and each point's length along the curve (pt.len)
  function curve(pts, lo, hi) {
    const n = pts.length;
    const tan = pts.map((p, i) => {
      if (p.tan) return p.tan;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    });
    const f = (v) => v.toFixed(1);
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    const spans = [];
    const xs = [pts[0].x], ys = [pts[0].y], ls = [0];
    let len = 0;
    pts[0].len = 0;
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const dx = q.x - p.x, dy = q.y - p.y, dist = Math.hypot(dx, dy);
      const run1 = dx * tan[i].x + dy * tan[i].y, run2 = dx * tan[i + 1].x + dy * tan[i + 1].y;
      // the handle floor: a short run along the tangent (or a tangent turned away from the next point) must not
      // shrink a handle to a few px, which leaves a corner in the line (a dotted flight path never turns a corner)
      const floor = Math.min(dist / 3, 40);
      // a wide turn (up to a quarter turn between the two headings: onto a lane, into the arc behind the "0đ")
      // may take handles up to half the span, so it is a true quarter ellipse (its tightest radius where it should
      // be, never a corner squeezed into one end); gentle spans (the loop's eighths, an S between lanes) a third,
      // and between 45 and 90 degrees the one grows into the other (a 60 degree bend keeps near a circle's own)
      const turn = Math.acos(clamp(tan[i].x * tan[i + 1].x + tan[i].y * tan[i + 1].y, -1, 1));
      const cap = dist * (1 / 3 + smooth(0.785, 1.571, turn) / 6);
      const h1 = Math.min(cap, Math.max(floor, run1 * 0.55), reach(p.x, tan[i].x, lo, hi));
      const h2 = Math.min(cap, Math.max(floor, run2 * 0.55), reach(q.x, -tan[i + 1].x, lo, hi));
      const c1x = p.x + tan[i].x * h1, c1y = p.y + tan[i].y * h1;
      const c2x = q.x - tan[i + 1].x * h2, c2y = q.y - tan[i + 1].y * h2;
      spans.push(` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(q.x)} ${f(q.y)}`);
      d += spans[i];
      const steps = Math.max(8, Math.ceil(dist / 5));
      let lx = p.x, ly = p.y;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, u = 1 - t;
        const x = u * u * u * p.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * q.x;
        const y = u * u * u * p.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * q.y;
        len += Math.hypot(x - lx, y - ly);
        xs.push(x); ys.push(y); ls.push(len);
        lx = x; ly = y;
      }
      q.len = len;
    }
    return { d, xs, ys, ls, spans, total: len };
  }
  // the stretch of a curve from point i to point j as its own path
  const subPath = (seg, i, j) => `M${seg.pts[i].x.toFixed(1)} ${seg.pts[i].y.toFixed(1)}` + seg.spans.slice(i, j).join("");
  // the point and heading (radians) at length L along a sampled curve
  function at(c, L) {
    const ls = c.ls;
    let lo = 0, hi = ls.length - 1;
    L = clamp(L, 0, c.total);
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ls[mid] < L) lo = mid; else hi = mid; }
    const span = ls[hi] - ls[lo] || 1, t = (L - ls[lo]) / span;
    let a = Math.max(0, lo - 1), b = Math.min(ls.length - 1, hi + 1);
    // the heading from a span at least 2 px long (two samples at one place would give atan2(0, 0) = 0: the plane
    // would point right whatever the line does)
    while (Math.hypot(c.xs[b] - c.xs[a], c.ys[b] - c.ys[a]) < 2 && (a > 0 || b < ls.length - 1)) {
      if (a > 0) a--;
      if (b < ls.length - 1) b++;
    }
    return { x: lerp(c.xs[lo], c.xs[hi], t), y: lerp(c.ys[lo], c.ys[hi], t), a: Math.atan2(c.ys[b] - c.ys[a], c.xs[b] - c.xs[a]) };
  }
  // the drawn length at scroll s, through a segment's (S, len) keys
  function lengthAt(keys, s) {
    if (s <= keys[0].S) return 0;
    for (let i = 1; i < keys.length; i++) {
      if (s < keys[i].S) return lerp(keys[i - 1].len, keys[i].len, (s - keys[i - 1].S) / (keys[i].S - keys[i - 1].S));
    }
    return keys[keys.length - 1].len;
  }
  // the plane's scale at length L of a segment (data-sc on its points: smaller in narrow gaps)
  function scaleAt(seg, L) {
    const pts = seg.pts;
    for (let i = 1; i < pts.length; i++) {
      if (L <= pts[i].len) return lerp(pts[i - 1].sc, pts[i].sc, clamp((L - pts[i - 1].len) / ((pts[i].len - pts[i - 1].len) || 1), 0, 1));
    }
    return pts[pts.length - 1].sc;
  }
  // isotonic regression (pool adjacent violators): the non-decreasing sequence closest to u, weighted by w
  function pava(u, w) {
    const blocks = [];
    u.forEach((v, i) => {
      blocks.push({ v, w: w[i], n: 1 });
      while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
        const b = blocks.pop(), a = blocks[blocks.length - 1];
        a.v = (a.v * a.w + b.v * b.w) / (a.w + b.w); a.w += b.w; a.n += b.n;
      }
    });
    const out = [];
    blocks.forEach((b) => { for (let k = 0; k < b.n; k++) out.push(b.v); });
    return out;
  }

  // T1's beats in T1.p: the plane forms in the flash while the last faces fold into it (orbit()), already on its
  // launch heading, then launches along the hero's own stretch of path (drawn in the pinned hero) while Chặng 01 rises
  // over the pin's tail (home.css: .fc's overlap). T1.p runs `scale` times slower than the pin, so the launch falls
  // at .46 × 1.4 ≈ 64 % of the pin and its tail (no faces, no copy, only the plane) is short: Chặng 01 is coming up
  const T1K = { form0: 0.27, form1: 0.42, launch: 0.46, scale: 1.4 };
  // at least 0.36 px of scroll for each pixel of path (≤ 2.8 : 1). At 0.5 the path below 1B (as long as twice the
  // page it runs down) had no slack left: every key sat at that pace from the loop's door, the plane ran down the
  // lanes faster than the page and spent 500 px of scroll under the window's foot in 2B. With slack, the fit keeps
  // the keys near the layout's (data-f) and only a long level stretch runs faster than the scroll
  const PACE = 0.36;
  // the dotted line's period (home.css .fl-dots: a .1 px dash, a 10 px gap) and the mask's lead-in: each stretch's
  // mask starts LEAD px back along its first heading, so a dot at a stretch's very start (a door between two SVGs,
  // the launch) is never cut in half by the mask's square end; the lead-in opens only as the tip moves off (vis())
  const DOT_P = 10.1, LEAD = 5;
  // the drawn mask's dash offset for `L` px of a stretch `total` px long (its dash is total + 2 + LEAD long)
  const maskOff = (total, L) => (total + 2 + LEAD - (L + Math.min(LEAD, L))).toFixed(1);

  function flight(withMotion) {
    const fl = $("[data-flight]");
    const svg = fl && $("[data-flight-svg]", fl);
    if (!fl || !svg) return () => {};
    const loopSvg = $("[data-loop-svg]", fl), heroSvg = $("[data-hero-svg]", fl);
    const plane = $("[data-plane]", fl);
    const heroPin = $(".hv-pin", fl), hero = $(".hv", fl), sky = $("[data-sky]", fl);
    const loopWrap = $(".fq__run", fl), loopPin = $("[data-loop]", fl);
    const toolsWrap = $(".ft__run", fl), toolsPin = $("[data-tools-pin]", fl), toolsSvg = $("[data-tools-svg]", fl);
    const drawEl = $("[data-draw]", fl);       // Chặng 01's "01", drawn as the plane comes in
    const dock = $("[data-dock]", fl), pill = dock && dock.closest("a");
    // the angle the plane rests at in the pill, as the docked mark (desktop: its right end, nose left; phones,
    // data-rest-m: its left end, nose right)
    const restOf = () => {
      const v = dock && (window.innerWidth < 900 && dock.dataset.restM != null ? dock.dataset.restM : dock.dataset.rest);
      return (Number.isFinite(Number(v)) ? Number(v) : 0) * RAD;
    };
    let restA = restOf();
    const fades = $$("[data-t1-fade]", fl);
    const qaSrc = $("[data-qa-src]", fl), qaDst = $("[data-qa-dst]", fl), qHead = $("[data-fq-head]", fl);
    // Chặng 02: the cards that lift out of the phone and their rows (scrubbed: --pop), the stage they rise with
    const popStage = $("[data-pop]", fl);
    const popCards = popStage ? $$("[data-card]", popStage).map((el, i) => ({ el, i, row: $(`.fj-row--slot[data-slot="${i}"]`, popStage), v: -1, stamped: false })) : [];
    const coarse = mq("(pointer: coarse)").matches;
    let geo = null;                        // everything measure() caches
    let sm = window.scrollY;               // the eased scroll every scrubbed effect follows
    let angle = null, docked = false, fadeO = -1, floorO = -1, t2q = -1, drawV = -1, looping = null, lowV = "", dockV = "", lastSm = sm;
    let vhKeys = 0, lastW = 0;             // the window height the keys were measured with, and the width
    let vwC = document.documentElement.clientWidth;   // the window's width without its scrollbar (measure, resize)

    // the pinned layers (hero, loop: 1B, tools: 2B), each sticky only with motion and at the widths its CSS pins it
    function layerOf(el) {
      const host = el.closest("[data-layer]");
      if (!host || !geo) return null;
      return geo.layers[host.dataset.layer] || null;
    }
    const layerFor = (kind) => (geo.layers[kind] || null);
    // a sticky layer's top in the window at scroll s
    function layerY(L, s) {
      const natural = geo.flTop + L.top - s;
      return natural > L.stickyTop ? natural : Math.min(L.stickyTop, natural + L.run);
    }
    // the scroll at which a point of a sticky layer (local y) sits at fraction f of the window: before the pin takes
    // the layer (the layer still rides the page), or, for a way out (data-out), after it lets go. A point that cannot
    // sit that low before the pin is keyed at the pin's start (never after its end by mistake)
    function layerS(L, y, f, p, out) {
      if (p != null) return L.s0 + p * L.run;
      const T = f * geo.vh - y;
      if (Math.abs(T - L.stickyTop) < 1) return out ? L.s0 + L.run : L.s0;
      if (out) return T < L.stickyTop ? geo.flTop + L.top + L.run - T : L.s0 + L.run;
      return T > L.stickyTop ? geo.flTop + L.top - T : L.s0;
    }

    function measure() {
      const sy = window.scrollY, vw = window.innerWidth;
      // phones: the browser's bar shows and hides on every change of scroll direction (the window's height changes
      // by up to ~120 px); the keys keep the height they were measured with unless the width changes too
      if (!vhKeys || !coarse || vw !== lastW || Math.abs(window.innerHeight - vhKeys) > 150) vhKeys = window.innerHeight;
      lastW = vw;
      vwC = document.documentElement.clientWidth;
      const vh = vhKeys;
      restA = restOf();
      if (withMotion && hero) {
        // a hero taller than the window pins with its foot at the window's foot
        const over = hero.offsetHeight - vh;
        if (over > 0) hero.style.setProperty("--hv-top", `${-over}px`); else hero.style.removeProperty("--hv-top");
      }
      // the rest positions: the card where it lands, the replies' springs at rest (home.css .fl.is-measure)
      if (qaDst) { qaDst.style.transform = "none"; qaDst.style.clipPath = ""; }
      if (qaSrc) { qaSrc.style.transform = ""; qaSrc.style.clipPath = ""; }
      fl.classList.add("is-measure");
      const flR = fl.getBoundingClientRect();
      const g = { vh, flTop: flR.top + sy, W: fl.clientWidth, H: fl.offsetHeight, segs: [] };
      geo = g;
      const desk = vw >= 900;
      const sticky = (el) => withMotion && el && getComputedStyle(el).position === "sticky";
      const mkLayer = (wrap, el) => {
        const wr = wrap.getBoundingClientRect(), er = el.getBoundingClientRect();
        const L = { top: wr.top - flR.top, run: Math.max(0, wr.height - er.height), stickyTop: parseFloat(getComputedStyle(el).top) || 0, rect: er, h: er.height, w: er.width };
        L.s0 = g.flTop + L.top - L.stickyTop;
        return L;
      };
      g.hero = sticky(hero) ? mkLayer(heroPin, hero) : null;
      g.loop = sticky(loopPin) ? mkLayer(loopWrap, loopPin) : null;
      g.tools = sticky(toolsPin) ? mkLayer(toolsWrap, toolsPin) : null;
      g.layers = { hero: g.hero, loop: g.loop, tools: g.tools };
      Object.keys(g.layers).forEach((k) => { if (g.layers[k]) g.layers[k].kind = k; });
      if (plane && withMotion) { g.pw = plane.offsetWidth || 84; g.ph = plane.offsetHeight || 56; }
      const hdrEl = $(".site-header");
      g.hdrB = hdrEl ? hdrEl.offsetHeight : 0;          // the sticky header's foot in the window
      // the docked mark's own (untransformed) width over the plane's: the flying plane ends at exactly its size (its
      // turned bounding box is wider, which left the flying plane 52 px against the mark's 42)
      g.dockSc = dock && g.pw ? clamp(dock.offsetWidth / g.pw, 0.3, 1) : 0.5;
      // the points, in the DOM's order, shown at this width (display: none ones have no box)
      const pts = [];
      const add = (el, x, y, layer, extra) => pts.push(Object.assign({ el, x, y, layer, wp: !!el && el.hasAttribute("data-wp"),
        cut: el ? (el.hasAttribute("data-loop-in") ? "in" : el.hasAttribute("data-loop-out") ? "out" : "") : "",
        bub: (el && el.dataset.bub) || "", tan: tanOf(el), sc: el && el.dataset.sc ? Number(el.dataset.sc) : 1, fixed: false }, extra));
      const heroR = hero ? hero.getBoundingClientRect() : null;
      if (withMotion && g.hero && sky) {                // the orb: where the plane forms and launches from
        const sr = sky.getBoundingClientRect();
        add(null, sr.left + sr.width / 2 - flR.left, sr.top + sr.height / 2 - heroR.top, "hero", { S: g.hero.s0 + T1K.launch * T1K.scale * g.hero.run, orb: true, fixed: true });
      }
      $$("[data-anchor]", fl).forEach((el) => {
        if (!el.getClientRects().length) return;
        if (el.hasAttribute("data-motion") && !g.hero) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - flR.left, cy = r.top + r.height / 2;
        const L = layerOf(el);
        // the height in the window the plane flies at as it passes this point: data-f on the desktop curve (default
        // .55), data-fm on the phones' gutter line (default .68: the launch from T1 reaches the gutter about there,
        // and the line holds that height down the page, so the plane never climbs the window nose down)
        const f = desk ? (el.dataset.f ? Number(el.dataset.f) : 0.55) : (el.dataset.fm ? Number(el.dataset.fm) : 0.68);
        const p = el.dataset.p != null && el.dataset.p !== "" ? Number(el.dataset.p) : null;
        if (L) add(el, cx, cy - L.rect.top, L.kind, { f, p, out: el.hasAttribute("data-out") });
        else add(el, cx, cy - flR.top, "doc", { f });
      });
      // without the hero's pin (reduced motion) the line starts under the hero's member line and link (never over the
      // faces or the copy) and fades in out of the hero's cobalt floor glow over its first 180 px (g.fadeIn): never an
      // abrupt end in mid air (HOME_ROUND3_SPEC §2)
      g.fadeIn = null;
      if (!g.hero && hero && pts.length) {
        const foot = $(".hv__foot", hero);
        const y0 = (foot ? foot.getBoundingClientRect().bottom : heroR.bottom - 120) - flR.top + 16;
        pts.unshift({ el: null, x: pts[0].x, y: y0, layer: "doc", f: 0.55, sc: 1, tan: null });
        g.fadeIn = y0;
      }
      // the side bounds: desktop 48 px inside the window; the phone gutter line never left of its lane
      const lo = desk ? 48 : Math.min(...pts.map((pt) => pt.x));
      const hi = desk ? g.W - 48 : g.W - lo;
      pts.forEach((pt) => { pt.x = clamp(pt.x, lo, hi); });
      // scroll keys, as laid out: each point when it sits at data-f of the window (data-p of a pin)
      pts.forEach((pt) => {
        if (pt.S != null) return;
        if (pt.layer === "doc") pt.S = g.flTop + pt.y - pt.f * vh;
        else pt.S = layerS(layerFor(pt.layer), pt.y, pt.f, pt.p, pt.out);
      });
      // the landing (desktop): the plane docks as the section's top comes clear of the header (the h2, the risen
      // arc, the horizon, the pill and the note in the window together), or, on a window too short for all of it,
      // once the note is 24 px over the window's foot (later: the pill and the plane always in view)
      const land = desk ? $(".hn", fl) : null, note = land && $(".hn__note", land);
      const dockPt = pts.find((pt) => pt.el && pt.el.hasAttribute("data-dock"));
      if (withMotion && land && note && dockPt) {
        dockPt.S = Math.max(land.getBoundingClientRect().top + sy - g.hdrB, note.getBoundingClientRect().bottom + sy + 24 - vh);
      }
      // segments: the page's (doc), the pinned hero's launch and the pinned 1B's loop, each in its own SVG. Where
      // the path crosses into a pinned layer or out of it, the two segments share a door point that holds its scroll
      // key (the layer meets the page only before its pin starts, or after it ends)
      const segs = [];
      let cur = null;
      pts.forEach((pt) => {
        const kind = pt.layer;
        const node = { el: pt.el, wps: pt.wp ? [pt.el] : [], bub: pt.bub, cut: pt.cut, tan: pt.tan, sc: pt.sc, x: pt.x, y: pt.y, S: pt.S, fixed: !!pt.fixed };
        if (!cur) { cur = { kind, pts: [] }; segs.push(cur); }
        else if (cur.kind !== kind) {
          // out of a layer (also straight into the next one: 1B's loop, then 2B's): a page stretch from its door at
          // the layer's place after the pin
          if (cur.kind !== "doc") {
            const lastPt = cur.pts[cur.pts.length - 1], L = layerFor(cur.kind);
            lastPt.fixed = true;
            cur = { kind: "doc", pts: [{ wps: [], x: lastPt.x, y: L.top + L.run + lastPt.y, S: lastPt.S, tan: lastPt.tan, sc: lastPt.sc, fixed: true }] };
            segs.push(cur);
          }
          if (kind !== "doc") {                          // into a layer: its door at the layer's place before the pin
            const L = layerFor(kind);
            cur.pts.push({ wps: [], x: pt.x, y: L.top + pt.y, S: pt.S, tan: pt.tan, sc: pt.sc, fixed: true });
            node.fixed = true;
            cur = { kind, pts: [] };
            segs.push(cur);
          }
        }
        cur.pts.push(node);
      });
      // two points at one place (a door and the next section's first point; two replies side by side on the tablet
      // grid, whose waypoints meet on the gutter line) are one point: a zero-length span has no heading. The merged
      // point keeps a held key and both waypoints
      segs.forEach((seg) => {
        const out = [];
        seg.pts.forEach((pt) => {
          const prev = out[out.length - 1];
          if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1.5) {
            prev.wps = prev.wps.concat(pt.wps);
            if (pt.fixed && !prev.fixed) { prev.S = pt.S; prev.fixed = true; }
            prev.bub = prev.bub || pt.bub;
            prev.cut = prev.cut || pt.cut;
            prev.tan = prev.tan || pt.tan;
            return;
          }
          out.push(pt);
        });
        seg.pts = out;
      });
      // the curves (their lengths), then the scroll is shared out by length: every stretch of path gets at least
      // PACE px of scroll per px (no teleport on a horizontal run, whatever its height), the last curve into the
      // pill at least LAND px of its own; the keys stay as close to the layout's as that allows (isotonic fit),
      // the doors, the orb and the end hold theirs
      segs.forEach((seg) => { if (seg.pts.length >= 2) Object.assign(seg, curve(seg.pts, lo, hi)); });
      const live = segs.filter((seg) => seg.pts.length >= 2);
      const flat = [];
      let need = 0;
      live.forEach((seg) => seg.pts.forEach((pt, i) => {
        if (i) need += PACE * (pt.len - seg.pts[i - 1].len);
        flat.push({ pt, c: need });
      }));
      const maxS = Math.max(0, document.documentElement.scrollHeight - vh);
      if (withMotion && flat.length > 1) {
        const end = flat[flat.length - 1], prev = flat[flat.length - 2];
        // (phones: shorter, the U under the pill is short and must be drawn while the pill is in the window)
        const LAND = desk ? Math.max(170, vh * 0.19) : 120;
        if (end.c - prev.c < LAND) end.c = prev.c + LAND;
        end.pt.S = Math.min(end.pt.S, maxS - 2);
        end.pt.fixed = true;
        // where the pace asks for more scroll than two held keys leave between them, that stretch's pace gives way,
        // never a held key (the isotonic fit would pool them: a door moved off its pin's end makes the plane jump,
        // and the landing slid to the page's foot)
        const inc = flat.map((e, i) => (i ? Math.max(0, e.c - flat[i - 1].c) : 0));
        let i0 = 0;
        for (let j = 1; j < flat.length; j++) {
          if (!flat[j].pt.fixed) continue;
          const avail = Math.max(0, (flat[j].pt.S - flat[i0].pt.S) * 0.96);
          let need = 0;
          for (let k = i0 + 1; k <= j; k++) need += inc[k];
          if (need > avail) for (let k = i0 + 1; k <= j; k++) inc[k] *= avail / need;
          i0 = j;
        }
        let acc = 0;
        flat.forEach((e, i) => { acc += inc[i]; e.c = acc; });
        const T = pava(flat.map((e) => e.pt.S - e.c), flat.map((e) => (e.pt.fixed ? 1e6 : 1)));
        flat.forEach((e, i) => { e.pt.S = T[i] + e.c; });
      }
      live.forEach((seg) => seg.pts.forEach((pt, i) => { if (i) pt.S = Math.max(pt.S, seg.pts[i - 1].S + 0.5); }));
      // the way in to the pill (desktop: the landing's stretch, from the last point before the section to the dock).
      // The plane never flies below .83 of the window (review 18/11: it dived under the fold). Along the horizon
      // the line runs level into the pill at its height, so the page carries that run up as the plane flies it. The stretch gets keys every ~20 px of path: each no earlier than where that
      // sample sits .83 down the window (the plane waits for the page as it comes down the wing's edge, riding at that
      // height), never later than the dock; and never flat (at most 8 px of path per px of scroll: no jump). The last
      // run into the pill gets what scroll the window leaves (faster than PACE there, never out of sight)
      function landKeys(seg) {
        const pts = seg.pts, end = pts[pts.length - 1];
        if (!end.el || !end.el.hasAttribute("data-dock")) return;
        const i0 = pts.findIndex((pt) => pt.el && pt.el.closest(".hn"));
        if (i0 < 1) return;
        const keys = seg.keys, L0 = pts[i0 - 1].len, S0 = pts[i0 - 1].S, L1 = end.len, S1 = end.S;
        const cap = vh * 0.83, m = 1 / 8;
        const sOf = (L) => {                          // the scroll the fit gave length L (linear between its keys)
          for (let j = 1; j < keys.length; j++) {
            if (L <= keys[j].len) return lerp(keys[j - 1].S, keys[j].S, (L - keys[j - 1].len) / ((keys[j].len - keys[j - 1].len) || 1));
          }
          return S1;
        };
        // (the plane reaches the pill's end 30 px of scroll before the dock's key: room for the hold below, where
        // the flying plane and the docked mark crossfade in place)
        const S1a = S1 - 30;
        const dense = [];
        let lastL = L0;
        for (let k = 0; k < seg.ls.length; k++) {
          const L = seg.ls[k];
          if (L <= L0 || L >= L1 || L - lastL < 20) continue;
          lastL = L;
          const lb = g.flTop + seg.ys[k] - cap;
          dense.push({ len: L, S: Math.min(S1a, Math.max(sOf(L), lb)), y: seg.ys[k] });
        }
        dense.push({ len: L1, S: S1a, y: end.y });
        // from the line's lowest point under the wing to the pill: one even run (the window holds the plane back,
        // riding .83 down it, until it is there, then it flies the level run at one speed)
        const yLow = Math.max(...dense.map((d) => d.y));
        let jb = -1;
        dense.forEach((d, j) => { if (d.y >= yLow - 1) jb = j; });
        if (jb >= 0) {
          const a = dense[jb], span = L1 - a.len || 1;
          for (let j = jb + 1; j < dense.length; j++) dense[j].S = lerp(a.S, S1a, (dense[j].len - a.len) / span);
        }
        for (let j = dense.length - 2; j >= 0; j--) {     // never flat: at most 1 / m px of path a px of scroll
          dense[j].S = Math.min(dense[j].S, dense[j + 1].S - (dense[j + 1].len - dense[j].len) * m);
        }
        let prev = S0;
        dense.forEach((d) => { d.S = Math.max(d.S, prev + 0.5); prev = d.S; });
        dense[dense.length - 1].S = S1;
        seg.keys = keys.filter((kk) => kk.len <= L0).concat(dense);
      }
      // draw
      [svg, loopSvg, heroSvg, toolsSvg].forEach((el) => { if (el) el.textContent = ""; });
      $$(".fl-svg--band", fl).forEach((el) => el.remove());
      svg.setAttribute("viewBox", `0 0 ${g.W} ${g.H}`);
      [[loopSvg, g.loop], [heroSvg, g.hero], [toolsSvg, g.tools]].forEach(([el, L]) => { if (el && L) el.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`); });
      // what the plane slips behind (desktop): 2B's numeral (1B's loop runs round its replies, never under them; 2B's
      // panels stand clear of the path, and the plane passes their places before they rise), in each segment's own
      // coordinates. The numeral is "0đ" landed on its line; the path reaches it only after that (the keys, home.html
      // data-p) and the plane fades behind it only from then (gate: stage()'s VR.homeStageDone)
      const box = (r, dx, dy) => ({ l: r.left - dx, t: r.top - dy, r: r.right - dx, b: r.bottom - dy });
      const numEl = desk ? $(".fts-num__in", fl) : null;
      // the numeral's line box (1 em: its glyphs fill .12 to .87 em of it, the đ's stem from -.07 em with its depth)
      const numBox = (dy) => {
        if (!numEl || !numEl.getClientRects().length) return null;
        const r = numEl.getBoundingClientRect(), em = parseFloat(getComputedStyle(numEl).fontSize) || 300;
        return { l: r.left - flR.left, r: r.right - flR.left, t: r.top - dy, em };
      };
      // the ink's edges where the path crosses the glyphs: the left edge of the "0" (with its extrusion) at row f (em
      // down the line box; the "0" curves in toward its foot) and the right edge of the đ's stem, in em in from the
      // box's sides (measured on the site's font at weight 760; the arc crosses between .55 and .8 em)
      const INK_L = [[0.4, -0.008], [0.5, -0.008], [0.55, 0.006], [0.6, 0.019], [0.63, 0.03], [0.66, 0.051], [0.7, 0.078], [0.75, 0.113], [0.8, 0.162], [0.85, 0.256]];
      const INK_R = 0.016;
      const inkL = (f) => {
        f = clamp(f, INK_L[0][0], INK_L[INK_L.length - 1][0]);
        for (let k = 1; k < INK_L.length; k++) if (f <= INK_L[k][0]) return lerp(INK_L[k - 1][1], INK_L[k][1], (f - INK_L[k - 1][0]) / (INK_L[k][0] - INK_L[k - 1][0]));
        return INK_L[INK_L.length - 1][1];
      };
      // the line behind the numeral (HOME_ROUND5_SPEC §3): the glyphs (over the path's SVG) hide it; over the
      // numeral's line box a mask keeps it out of the counters and the gap between the glyphs: full .045 em outside
      // the ink, half at the ink's edge, nothing .05 em inside it, so the dots meet the glyphs and go in behind them,
      // and come out the other side the same way. ink: the box the plane fades behind (stageBoxes)
      const numFade = (dy, seg) => {
        const nb = numBox(dy);
        if (!nb || !seg || !seg.xs) return null;
        const em = nb.em, top = nb.t, foot = nb.t + em;
        let yl = null;                     // the row where the path reaches the numeral's left side
        for (let k = 0; k < seg.xs.length && yl == null; k++) {
          if (seg.ys[k] >= top && seg.ys[k] <= foot && seg.xs[k] >= nb.l) yl = seg.ys[k];
        }
        if (yl == null) return null;
        const xl = nb.l + inkL((yl - top) / em) * em, xr = nb.r - INK_R * em;
        const o = 0.045 * em, i = 0.05 * em, x0 = xl - o, x1 = xr + o, w = x1 - x0;
        return { x0, x1, y0: top - 0.2 * em, y1: foot + 0.2 * em,
          stops: [[0, 1], [(o + i) / w, 0], [(w - o - i) / w, 0], [1, 1]],
          ink: { l: xl, r: xr, t: top - 0.07 * em, b: top + 0.86 * em, em } };
      };
      // the plane fades as its nose goes in behind the ink (gone just inside it, about half way at its edge) and comes
      // back as its tail comes out the other side (never its tail over the đ), never over open stage: no pad for its
      // wings (it meets the glyphs head on)
      const stageBoxes = (dy, hide) => (desk && hide && hide.ink ? [{ l: hide.ink.l, r: hide.ink.r, t: hide.ink.t, b: hide.ink.b, from: 0, pad: 0.06 * hide.ink.em, flat: true, gate: true }] : []);
      // 1B from 1200 px: the loop runs behind the replies (as the concept), so the plane slips behind each one too
      const bubBoxes = (dy) => (desk ? $$(".fq-bub", fl).map((el) => Object.assign(box(el.getBoundingClientRect(), flR.left, dy), { from: 0, pad: 4 })) : []);
      // holes: boxes the line passes behind (1B's replies): the mask goes soft-black over each (a blurred rect, 2 px
      // outside the box), so the line fades out over ~12 px into a reply and back in out of it, never a hard cut
      // opt: { a: the stretch's first heading (radians, for the mask's lead-in), ph: the dots' phase (the length of
      // path before this stretch, so the dots run on evenly across every seam), fade: [x, y, r] a soft start (the
      // launch: the line comes out of nothing under the plane, never a hard end where the orb was) }
      // the numeral's fade (numFade) as a mask round a group: white, and over the numeral's line box the gradient
      const hideWrap = (parent, defs, id, hide, x, y, w, h) => {
        const lg = svgEl("linearGradient", { id: `${id}-hg`, gradientUnits: "userSpaceOnUse", x1: hide.x0.toFixed(1), y1: 0, x2: hide.x1.toFixed(1), y2: 0 }, defs);
        hide.stops.forEach(([o, v]) => svgEl("stop", { offset: o.toFixed(4), "stop-color": "#fff", "stop-opacity": v }, lg));
        const hm = svgEl("mask", { id: `${id}-h`, maskUnits: "userSpaceOnUse", x, y, width: w, height: h }, defs);
        svgEl("rect", { x, y, width: w, height: h, fill: "#fff" }, hm);
        const r = { x: hide.x0.toFixed(1), y: hide.y0.toFixed(1), width: (hide.x1 - hide.x0).toFixed(1), height: (hide.y1 - hide.y0).toFixed(1) };
        svgEl("rect", Object.assign({ fill: "#000" }, r), hm);
        svgEl("rect", Object.assign({ fill: `url(#${id}-hg)` }, r), hm);
        return svgEl("g", { mask: `url(#${id}-h)` }, parent);
      };
      const dashed = (host, id, d, total, x, y, w, h, cls, holes, opt = {}) => {
        const defs = svgEl("defs", {}, host);
        let wrap = host;
        if (opt.fade) {
          const [fx, fy, fr] = opt.fade;
          const rg = svgEl("radialGradient", { id: `${id}-fg`, gradientUnits: "userSpaceOnUse", cx: fx.toFixed(1), cy: fy.toFixed(1), r: fr }, defs);
          svgEl("stop", { offset: 0, "stop-color": "#000" }, rg);
          svgEl("stop", { offset: 0.3, "stop-color": "#000" }, rg);
          svgEl("stop", { offset: 1, "stop-color": "#fff" }, rg);
          const fm = svgEl("mask", { id: `${id}-f`, maskUnits: "userSpaceOnUse", x, y, width: w, height: h }, defs);
          svgEl("rect", { x, y, width: w, height: h, fill: `url(#${id}-fg)` }, fm);
          wrap = svgEl("g", { mask: `url(#${id}-f)` }, host);
        }
        if (opt.hide) wrap = hideWrap(wrap, defs, id, opt.hide, x, y, w, h);
        const g2 = svgEl("g", cls ? { class: cls } : {}, wrap);
        const m = svgEl("mask", { id, maskUnits: "userSpaceOnUse", x, y, width: w, height: h }, defs);
        let md = d;
        const m0 = /^M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(d);
        if (m0 && opt.a != null) {
          const sx = Number(m0[1]), sy = Number(m0[2]);
          md = `M${(sx - Math.cos(opt.a) * LEAD).toFixed(1)} ${(sy - Math.sin(opt.a) * LEAD).toFixed(1)} L${m0[1]} ${m0[2]}` + d.slice(m0[0].length);
        }
        const mask = svgEl("path", { class: "fl-mask", d: md, "stroke-dasharray": `${total + 2 + LEAD} ${total + 40 + LEAD}`, "stroke-dashoffset": total + 2 + LEAD }, m);
        if (holes && holes.length) {
          // feathered without an SVG filter (a blur in a mask is rastered on the CPU the first time the pin nears the
          // window: one 60 ms frame at T1's start): four nested rounded rects, the outer ones faint, so the mask's
          // luminance steps 1 → .78 → .55 → .3 → 0 over the 12 px outside the box (a dot every 10 px sees one step)
          const hg = svgEl("g", {}, m);
          [[12, 0.22], [8, 0.3], [4, 0.45], [0, 1]].forEach(([d, a]) => holes.forEach((o) => svgEl("rect", {
            x: (o.l - 2 - d).toFixed(1), y: (o.t - 2 - d).toFixed(1), width: (o.r - o.l + 4 + 2 * d).toFixed(1), height: (o.b - o.t + 4 + 2 * d).toFixed(1),
            rx: 22 + d, fill: "#000", "fill-opacity": a }, hg)));
        }
        g2.setAttribute("mask", `url(#${id})`);
        const ph = ((opt.ph || 0) % DOT_P).toFixed(2);
        svgEl("path", { class: "fl-glow", d, "stroke-dashoffset": ph }, g2);
        svgEl("path", { class: "fl-dots", d, "stroke-dashoffset": ph }, g2);
        return mask;
      };
      const hostOf = (kind) => (kind === "loop" ? loopSvg : kind === "hero" ? heroSvg : kind === "tools" ? toolsSvg : svg);
      g.draw = null;
      let cum = 0;                                     // the length of path before each stretch (the dots' phase)
      live.forEach((seg, n) => {
        const ph = cum;
        cum += seg.total;
        const a0 = at(seg, 0.5).a;
        const host = hostOf(seg.kind);
        if (!host) return;
        const id = `fl-m${n}`;
        const Ly = layerFor(seg.kind);
        const dim = seg.kind === "doc" ? [g.W, g.H] : [Ly.w, Ly.h];
        seg.mask = null; seg.bands = null; seg.parts = null; seg.drawn = -1;
        const iIn = seg.pts.findIndex((pt) => pt.cut === "in"), iOut = seg.pts.findIndex((pt) => pt.cut === "out");
        const hide = seg.kind === "tools" ? numFade(Ly.rect.top, seg) : seg.kind === "doc" && !g.tools ? numFade(flR.top, seg) : null;
        if (withMotion && seg.kind === "doc") {
          // the page's long stretch in bands about 0.6 window tall, each a small SVG of its own with the same
          // path (clipped to its band): one page-tall masked SVG repainted all of itself every frame the tip moved
          // (jank over Chặng 02's photo layers); now a band whose part of the path is all drawn, or not drawn yet,
          // never changes
          const bh = Math.max(480, Math.round(vh * 0.6));
          const y0 = Math.floor(Math.min(...seg.ys) / bh) * bh, y1 = Math.max(...seg.ys);
          seg.bands = [];
          for (let top = y0; top <= y1; top += bh) {
            let lmin = Infinity, lmax = -Infinity;
            seg.ys.forEach((y, i) => { if (y >= top - 24 && y <= top + bh + 24) { lmin = Math.min(lmin, seg.ls[i]); lmax = Math.max(lmax, seg.ls[i]); } });
            if (lmax < lmin) continue;
            // placed once here (measure), never per frame
            const el = svgEl("svg", { class: "fl-svg fl-svg--band", viewBox: `0 ${top} ${g.W} ${bh}`, style: `top:${top}px;height:${bh}px`, "aria-hidden": "true", focusable: "false" });
            fl.insertBefore(el, svg);
            const mask = dashed(el, `${id}-${top}`, seg.d, seg.total, -60, top - 60, g.W + 120, bh + 120, "", null, { a: a0, ph, hide });
            seg.bands.push({ el, mask, lmin: Math.max(0, lmin - 8), lmax: lmax + 8, v: -1 });
          }
        } else if (withMotion && seg.kind === "loop" && iIn > 0 && iOut > iIn) {
          // 1B: the lane in, the loop and the lane out drawn as three stretches; while the plane flies the loop the
          // lane in dims to 30 % (CSS .is-looping), so the loop reads as one clean ellipse round the card. The loop
          // alone is pre-traced faintly (it comes in with the heading)
          const last = seg.pts.length - 1;
          host.appendChild(svgEl("path", { class: "fl-ghost", d: subPath(seg, iIn, iOut), "stroke-dashoffset": ((ph + seg.pts[iIn].len) % DOT_P).toFixed(2) }));
          const holes = bubBoxes(Ly.rect.top);
          seg.parts = [[0, iIn, "in"], [iIn, iOut, "mid"], [iOut, last, "out"]].map(([i, j, k]) => {
            const l0 = seg.pts[i].len, l1 = seg.pts[j].len;
            const mask = dashed(host, `${id}-${k}`, subPath(seg, i, j), l1 - l0, -60, -60, dim[0] + 120, dim[1] + 120, `fl-part fl-part--${k}`, holes,
              { a: at(seg, l0 + 0.5).a, ph: ph + l0 });
            return { mask, l0, l1, v: -1 };
          });
          seg.loopLen = [seg.pts[Math.min(last, iIn + 1)].len, seg.pts[iOut].len];
        } else if (withMotion) {
          // the launch (the hero's stretch) comes out of nothing under the plane: a soft radial fade round the orb
          const fade = seg.kind === "hero" ? [seg.pts[0].x, seg.pts[0].y, 170] : null;
          seg.mask = dashed(host, id, seg.d, seg.total, -60, -60, dim[0] + 120, dim[1] + 120, "", null, { a: a0, ph, fade, hide });
        } else {
          const g2 = svgEl("g", {}, hide ? hideWrap(host, svgEl("defs", {}, host), id, hide, -60, -60, dim[0] + 120, dim[1] + 120) : host);
          svgEl("path", { class: "fl-glow", d: seg.d, "stroke-dashoffset": (ph % DOT_P).toFixed(2) }, g2);
          svgEl("path", { class: "fl-dots", d: seg.d, "stroke-dashoffset": (ph % DOT_P).toFixed(2) }, g2);
          if (g.fadeIn != null && n === 0) {               // reduced motion: the line fades in under the hero
            const defs = svgEl("defs", {}, host);
            const lg = svgEl("linearGradient", { id: "fl-in-g", gradientUnits: "userSpaceOnUse", x1: 0, y1: g.fadeIn, x2: 0, y2: g.fadeIn + 180 }, defs);
            svgEl("stop", { offset: 0, "stop-color": "#000" }, lg);
            svgEl("stop", { offset: 1, "stop-color": "#fff" }, lg);
            const m = svgEl("mask", { id: "fl-in", maskUnits: "userSpaceOnUse", x: -60, y: -60, width: dim[0] + 120, height: dim[1] + 120 }, defs);
            svgEl("rect", { x: -60, y: -60, width: dim[0] + 120, height: dim[1] + 120, fill: "url(#fl-in-g)" }, m);
            g2.setAttribute("mask", "url(#fl-in)");
          }
        }
        seg.keys = seg.pts.map((pt) => ({ S: pt.S, len: pt.len }));
        if (withMotion && desk && n === live.length - 1) landKeys(seg);
        // a waypoint lights itself and what it stands for ([data-lit]: a check's name, a reply that springs out)
        seg.wps = [];
        seg.pts.forEach((pt) => (pt.wps || []).forEach((el) => {
          seg.wps.push({ el, len: pt.len, li: el.closest("[data-lit]"), lit: null, cls: "is-lit" });
          if (el.hasAttribute("data-draw-to")) g.draw = { seg, len: pt.len };
        }));
        // (1B's pinned loop needs none: the plane flies inside the pin there, under the replies' plates, see frame())
        seg.occ = seg.kind === "tools" ? stageBoxes(Ly.rect.top, hide)
          : seg.kind === "doc" && !g.tools ? stageBoxes(flR.top, hide).concat(g.loop ? [] : bubBoxes(flR.top)) : [];
        // 1B (desktop): each reply springs out as the plane reaches it: from 1200 px the loop runs behind the replies,
        // so the moment is where the path first comes within 72 px of the reply's box (the reply opens as the plane
        // arrives, and the plane then slips behind it); below, where the loop runs round them, as the plane comes within 150 px of the portrait
        // (never earlier than 160 px of path before the ring). Its portrait rings once at the sample of the path
        // nearest its centre (searched from that moment to the next reply's own point, data-bub)
        if (seg.kind === "loop") {
          const idxOf = (len) => { let k = 0; while (k < seg.ls.length - 1 && seg.ls[k] < len) k++; return k; };
          const bubs = seg.pts.filter((pt) => pt.bub && $(`.fq-bub--${pt.bub}`, fl));
          let i0 = 0;
          seg.ringAt = [];
          bubs.forEach((pt, n) => {
            const bub = $(`.fq-bub--${pt.bub}`, fl), av = $(".fq-bub__av", bub) || bub;
            const ar = av.getBoundingClientRect(), br = box(bub.getBoundingClientRect(), flR.left, Ly.rect.top);
            const ax = ar.left + ar.width / 2 - flR.left, ay = ar.top + ar.height / 2 - Ly.rect.top;
            const i1 = n + 1 < bubs.length ? idxOf(bubs[n + 1].len) : seg.ls.length - 1;
            let enter = -1;
            for (let k = i0; k <= i1 && enter < 0; k++) {
              if (seg.xs[k] > br.l - 72 && seg.xs[k] < br.r + 72 && seg.ys[k] > br.t - 72 && seg.ys[k] < br.b + 72) enter = k;
            }
            let ring = idxOf(pt.len), best = Infinity;
            for (let k = Math.max(i0, enter); k <= i1; k++) {
              const dd = Math.hypot(seg.xs[k] - ax, seg.ys[k] - ay);
              if (dd < best) { best = dd; ring = k; }
            }
            let from = ring;
            if (enter >= 0 && window.innerWidth >= 1200) from = enter;
            else while (from > i0 && seg.ls[ring] - seg.ls[from - 1] < 160 && Math.hypot(seg.xs[from - 1] - ax, seg.ys[from - 1] - ay) < 150) from--;
            seg.wps.push({ el: bub, len: seg.ls[from], li: null, lit: null, cls: "is-lit" });
            seg.wps.push({ el: bub, len: seg.ls[ring], li: null, lit: null, cls: "is-ring" });
            seg.ringAt.push({ key: pt.bub, len: seg.ls[ring], d: Math.round(best) });
            i0 = ring + 1;
          });
        }
        g.segs.push(seg);
      });
      // the landing's hold: the plane arrives at the pill's end a few px of scroll before it docks (the last key's
      // length, held), so the flying plane and the docked mark crossfade in place over 30-48 px of scroll
      g.hold = 0;
      const lastLive = g.segs[g.segs.length - 1];
      g.endA = lastLive ? at(lastLive, lastLive.total - 0.5).a : restA;     // the line's heading into the pill
      if (withMotion && dock && lastLive && lastLive.keys.length >= 2) {
        const k = lastLive.keys, n = k.length - 1;
        const X = clamp((k[n].S - k[n - 1].S) * 0.2, 30, 48);
        k.push({ S: k[n].S, len: k[n].len });
        k[n] = { S: k[n].S - X, len: k[n].len };
        g.hold = X;
      }
      fl.classList.add("is-drawn");
      // T2: the photo's card lifts off and becomes 1B's question card. From 900 px 1B's card is an exact scaled copy of
      // the photo's (home.css: every measure in --u), so at lift-off the two swap in one frame with every line
      // registered; then it flies (window space, never up across 1B's heading: no lift) and grows into the centre,
      // its question crossfading mid-flight. The flight is short: it starts as the photo's card nears the header and
      // lands in the stage a little before the pin takes it (the card rides up with the stage for the last
      // stretch), and 1B's heading, its faint loop and the waiting replies come in by half way (--fqh), so the card
      // lands on a stage that already has its title. Phones (the stacked layout): a crossfade (HOME_FLIGHT_SPEC §3).
      g.t2 = null;
      if (withMotion && qaSrc && qaDst) {
        const a = qaSrc.getBoundingClientRect(), b = qaDst.getBoundingClientRect();
        const L = g.loop;
        const bTop = L ? g.flTop + L.top + (b.top - L.rect.top) : b.top + sy;
        const aTop = a.top + sy;
        const hdr = parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 64;
        const T = { dx: a.left - b.left, aTop, bTop, k: a.width / (b.width || 1), fly: desk,
          s0: desk ? aTop - Math.max(hdr + 16, vh * 0.1) : aTop - vh * 0.24, s1: bTop + b.height / 2 - vh * 0.5 };
        if (L) T.s1 = L.s0 - Math.min(120, vh * 0.14);
        T.s1 = Math.max(T.s1, T.s0 + vh * 0.4);
        // the flight in window space: from where the photo's card sits as it lifts off to where 1B's card sits at
        // the flight's end (in the stage, before the pin); its first 8 % still follows the page, so the swap is exact
        T.yA = aTop - T.s0; T.yB = bTop - T.s1;
        // 1B's heading (chip and h2) at rest: it comes in only once the flying card is below it (never covered)
        if (qHead) { const hr = qHead.getBoundingClientRect(); T.headB = L ? hr.bottom - L.rect.top : hr.bottom + sy; }
        T.w = b.width;
        g.t2 = T;
        t2q = -1;
        // a reply never springs out (nor shows its waiting portrait) while the card in flight, or held in the window
        // while the stage rises to it (q .7 → 1), is over its box: each reply's gate is the scroll from which its box
        // (at rest, where it springs to) stays clear of the card's, 8 px apart (the card's tilt and scale included);
        // the reply then lights at the later of the plane's arrival and its gate
        if (T.fly) {
          const bubs = $$(".fq-bub", fl).map((el) => {
            const r = el.getBoundingClientRect();
            return { el, l: r.left, r: r.right, t: L ? r.top - L.rect.top : r.top + sy, h: r.height, gate: null };
          });
          const yAt = (s) => (L ? layerY(L, s) : -s);
          for (let s = T.s0; s <= T.s1 + 2; s += 2) {
            const q = clamp((s - T.s0) / (T.s1 - T.s0), 0, 1);
            if (q >= 1) break;
            const e = eio(clamp(q / 0.7, 0, 1)), arc = Math.sin(Math.PI * e), k = lerp(T.k, 1, e) * (1 + 0.04 * arc);
            const top = t2Top(T, q, e, arc, s), cw = T.w * k, ch = b.height * k, tilt = cw * Math.sin(3 * arc * RAD);
            const cl = b.left + T.dx * (1 - e) - 8, cr = cl + cw + 16, ct = top - tilt - 8, cb = top + ch + tilt + 8;
            bubs.forEach((o) => {
              const bt = yAt(s) + o.t;
              if (o.r > cl && o.l < cr && bt + o.h > ct && bt < cb) o.gate = s + 2;
            });
          }
          g.segs.forEach((seg) => seg.wps.forEach((w) => {
            const o = bubs.find((bb) => bb.el === w.el);
            if (o && o.gate != null) w.gate = o.gate;
          }));
          bubs.forEach((o) => o.el.style.removeProperty("--fqa"));
          g.bubGates = bubs.filter((o) => o.gate != null).map((o) => ({ el: o.el, S: o.gate, v: -1 }));
        }
      }
      // Chặng 02: each card lifts out of its row from when the stage's top is at 76 % of the window until it is
      // about 30 % up (each card a little after the one above it), so the three are out and stamped while the whole phone is
      // in view; reversible (the stamp stays once pressed)
      if (popStage) {
        const r = popStage.getBoundingClientRect(), top = r.top + sy;
        const span = Math.min(vh * 0.4, Math.max(220, r.height * 0.5)), s0 = top - vh * 0.62;
        // phones (the flat stack below the phone): the lowest card first, each well ahead of the one above it, so a
        // card never passes over another's text while it lifts (each settles below the next one's whole path)
        const flat = vw < 768;
        const lag = (c) => (flat ? (popCards.length - 1 - c.i) * vh * 0.12 : c.i * vh * 0.07);
        g.pop = popCards.map((c) => ({ c, s0: s0 + lag(c), s1: s0 + lag(c) + span }));
        popCards.forEach((c) => { c.v = -1; });
      }
      fl.classList.remove("is-measure");
      angle = null;
      frame(true, 16.67);
    }

    // T2: the flying card's top in the window at progress q (eased e, arc) and scroll s
    function t2Top(T, q, e, arc, s) {
      const start = lerp(T.aTop - s, T.yA, smooth(0, 0.08, q));
      return lerp(start, T.yB, e) + 10 * arc;        // a slight dip, never a lift up into 1B's heading
    }

    function frame(force, dt) {
      if (!geo) return;
      const s = window.scrollY;
      const g = geo;
      // T1: the hero's pin progress; the copy and the member line fade back as the faces converge
      if (g.hero) {
        T1.p = clamp((sm - g.hero.s0) / ((g.hero.run || 1) * T1K.scale), 0, 1);
        // the copy and the member line stay through the first flick (phones too), then dissolve where they are: opacity
        // with a soft blur and a hair of scale on each block as a whole (the h1 never travels up under the header; the
        // pills fade as one group, so the white pill never reads as a grey, disabled one)
        const o = Math.round((1 - smooth(0.08, 0.3, T1.p)) * 100) / 100;
        if (o !== fadeO) {
          fadeO = o;
          fades.forEach((el) => {
            el.style.opacity = o === 1 ? "" : String(o);
            el.style.transform = o === 1 ? "" : `scale(${(1 - 0.03 * (1 - o)).toFixed(4)})`;
            el.style.filter = o === 1 ? "" : `blur(${(8 * (1 - o)).toFixed(1)}px)`;
          });
        }
        // the hero's cobalt pool and floor glow go out with the orb, so its foot never shows as an edge where
        // Chặng 01 rises over the pin
        const fo = Math.round((1 - smooth(0.36, 0.62, T1.p)) * 100) / 100;
        if (fo !== floorO) { floorO = fo; hero.style.setProperty("--floor", String(fo)); }
      }
      // the path: each segment drawn to its length at this scroll; waypoints light as the tip passes them (and
      // what they stand for: the checks' names, 1B's replies)
      let active = null, activeL = 0;
      g.segs.forEach((seg) => {
        const L = withMotion ? lengthAt(seg.keys, sm) : seg.total;
        seg.L = L;
        if (seg.mask && (force || Math.abs(L - seg.drawn) > 0.4)) {
          seg.drawn = L;
          seg.mask.setAttribute("stroke-dashoffset", maskOff(seg.total, L));
        }
        if (seg.parts) {
          seg.parts.forEach((pa) => {
            const v = clamp(L - pa.l0, 0, pa.l1 - pa.l0);
            if (force || Math.abs(v - pa.v) > 0.4 || (v !== pa.v && (v === 0 || v === pa.l1 - pa.l0))) {
              pa.v = v;
              pa.mask.setAttribute("stroke-dashoffset", maskOff(pa.l1 - pa.l0, v));
            }
          });
          // the lane in dims once the plane is on the loop past Designer, until it leaves the loop
          const lp = L > seg.loopLen[0] && L < seg.loopLen[1] + 40;
          if (lp !== looping && loopSvg) { looping = lp; loopSvg.classList.toggle("is-looping", lp); }
        }
        if (seg.bands) seg.bands.forEach((b) => {
          const v = clamp(L, b.lmin, b.lmax);
          if (force || Math.abs(v - b.v) > 0.4 || (v !== b.v && (v === b.lmin || v === b.lmax))) {
            b.v = v;
            b.mask.setAttribute("stroke-dashoffset", maskOff(seg.total, v));
          }
        });
        if (withMotion) seg.wps.forEach((w) => {
          const lit = L >= w.len - 1 && !(w.gate > sm);
          if (lit === w.lit) return;
          w.lit = lit;
          w.el.classList.toggle(w.cls, lit);
          if (w.li) w.li.classList.toggle(w.cls, lit);
        });
        if (sm >= seg.keys[0].S) { active = seg; activeL = L; }
      });
      if (!withMotion) return;
      // Chặng 01: the "01" draws itself over the last stretch of path before its waypoint (the plane coming in from T1)
      if (g.draw && drawEl) {
        const v = Math.round(smooth(Math.max(0.5, g.draw.len - 340), g.draw.len + 10, g.draw.seg.L || 0) * 200) / 200;
        if (v !== drawV) { drawV = v; drawEl.style.setProperty("--draw", String(v)); }
      }
      // the plane. On 1B's pinned loop it flies inside the pin, BEHIND the replies as the line does (home.css: z 8,
      // under the replies' opaque plates): where the loop meets a reply the plane slips under it and out the other
      // side, never across a reply's text; everywhere else it flies over the page (z 8 in .fl)
      if (plane) {
        const host = active && active.kind === "loop" && loopPin ? loopPin : fl;
        if (plane.parentNode !== host) host.appendChild(plane);
        let x, y, a, sc = 1, op = 1, fold = 1, snap = !!force, low = 1, dk = 0;
        // how fast the page scrolls (the eased scroll's step per 60 Hz frame): 0 below 6 px, 1 from 24 px
        const fast = force ? 0 : smooth(6, 24, Math.abs(sm - lastSm) * 16.67 / (dt || 16.67));
        lastSm = sm;
        const first = g.segs[0];
        const lastSeg = g.segs[g.segs.length - 1];
        const lk = lastSeg ? lastSeg.keys : null, n = lk ? lk.length - 1 : 0;
        // the landing: over the final approach (the last 260 px of scroll on a desktop, 28 % of the window on a
        // tall one; 220 px on phones) the plane shrinks to the docked mark's size, one ease in and out, so it
        // arrives at the pill's end exactly as the mark (arrive), never a snap; its nose stays on the line and only
        // the small difference between the line's last heading and the mark's angle is eased in with it; then it holds
        // there for the hold key's scroll (measure(): 30-48 px) while the two crossfade, the plane's darker lower wing
        // first (no shadow-side ghost beside the mark), docked at land1
        const land1 = lk ? lk[n].S : 0;
        const arrive = lk && geo.hold && n >= 2 ? lk[n - 1].S : land1;
        const land0 = arrive - (window.innerWidth >= 900 ? Math.max(260, geo.vh * 0.28) : 220);
        const isDocked = !!(lastSeg && active === lastSeg && sm >= land1 - 0.5);
        if (!active && first && first.kind === "hero") {
          // T1: the plane forms where the faces meet, twice its cruising size, ALREADY on its launch heading (it
          // grows and opens its wings, it never turns), and waits for the launch
          const p = T1.p, f = smooth(T1K.form0, T1K.form1, p);
          const o = first.pts[0];
          x = o.x; y = layerY(g.hero, s) + o.y;
          a = at(first, 2).a;
          sc = 2 * (0.3 + 0.7 * back(f));
          op = smooth(T1K.form0, T1K.form0 + 0.08, p);
          fold = 0.5 + 0.5 * f;
          snap = true;
        } else if (active) {
          const pt = at(active, activeL);
          const L = layerFor(active.kind);
          x = pt.x;
          y = L ? layerY(L, s) + pt.y : g.flTop + pt.y - s;
          a = pt.a;
          // the nose points along its own dotted line (the path's tangent). Only while the page scrolls fast does a
          // little of its screen motion lean in (the page carrying it up while it flies level reads as a slide): at
          // most 10°, faded out as the scroll slows, so at rest it always points along the line
          if (fast > 0) {
            const ks = active.keys;
            let r = 0;
            for (let i = 1; i < ks.length; i++) {
              if (sm < ks[i].S || i === ks.length - 1) { r = (ks[i].len - ks[i - 1].len) / ((ks[i].S - ks[i - 1].S) || 1); break; }
            }
            const ride = L ? clamp(layerY(L, s) - layerY(L, s + 1), 0, 1) : 1;
            const tx = Math.cos(a), ty = Math.sin(a);
            const va = Math.atan2(ty * r - ride, tx * r);
            let d = va - a;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            a += clamp(d, -10 * RAD, 10 * RAD) * fast;
          }
          sc = scaleAt(active, activeL);
          if (active.kind === "hero") sc *= lerp(2, 1, eio(clamp(activeL / (active.total || 1), 0, 1)));
          // behind a reply, 2B's numeral or a tool panel, as the line is: the plane fades as its nose (the centre plus
          // half its length along its heading) comes within its half-width of the box (and the box's own margin), so
          // it never rests on a reply's text, the numeral or a panel
          let hide = 0;
          if (active.occ && active.occ.length) {
            const half = (g.pw || 84) * 0.42 * sc, wide = (g.ph || 56) * 0.42 * sc;
            const probes = [[pt.x, pt.y], [pt.x + Math.cos(pt.a) * half, pt.y + Math.sin(pt.a) * half]];
            const tail = [pt.x - Math.cos(pt.a) * half, pt.y - Math.sin(pt.a) * half];
            const landed = VR.homeStageDone ? VR.homeStageDone() : null;
            active.occ.forEach((o) => {
              if (activeL < o.from || (o.gate && landed != null && sm < landed)) return;
              const pad = o.pad + (o.flat ? 0 : wide);
              (o.flat ? probes.concat([tail]) : probes).forEach(([px, py]) => {
                const d = Math.min(px - o.l, o.r - px, py - o.t, o.b - py);
                if (d > -pad) hide = Math.max(hide, smooth(-pad, 4, d));
              });
            });
          }
          op *= 1 - hide;
          if (active === lastSeg) {
            // the landing: it shrinks to the docked mark's size and its nose eases from the line's last heading to
            // the mark's angle (a few degrees: never a turn the wrong way round the hook into the pill)
            const e = eio(clamp((sm - land0) / ((arrive - land0) || 1), 0, 1));
            sc *= lerp(1, g.dockSc, e);
            let da = restA - g.endA;
            while (da > Math.PI) da -= 2 * Math.PI;
            while (da < -Math.PI) da += 2 * Math.PI;
            // the nose keeps to the line until the last 50 px before it arrives, then turns the difference in over
            // those and the hold (phones' hook meets the pill some 30° off the mark: never a plane crabbing up it)
            const a0 = arrive - 50;
            a += da * eio(clamp((sm - a0) / ((land1 - a0) || 1), 0, 1));
            const X = land1 - arrive;
            if (X > 1) {
              dk = smooth(arrive, land1, sm);
              low = 1 - smooth(arrive, arrive + 0.5 * X, sm);
              op *= 1 - smooth(arrive + 0.25 * X, land1, sm);
            } else dk = isDocked ? 1 : 0;
            if (isDocked) { op = 0; dk = 1; }
          }
        } else { op = 0; x = -100; y = -100; a = 0; }
        // the turn eases (shortest way round, the same speed at any frame rate); the position follows the tip
        if (angle == null) angle = a;
        let da = a - angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        angle += da * (snap ? 1 : ease(0.35, dt));
        // never out of the window: the plane's box's half-extent across (its turned box, a little wider than its ink)
        if (op > 0 && g.pw) {
          const vw = vwC;
          const hx = (Math.abs(Math.cos(angle)) * 0.5 * g.pw + Math.abs(Math.sin(angle)) * 0.5 * g.ph) * sc + 2;
          if (vw > 2 * hx) x = clamp(x, hx, vw - hx);
          // never sliced by the opaque header (the pins' doors meet under it): gone before its top touches the
          // header's foot, back as it comes clear (the line's tip is under the header there too)
          if (g.hdrB && !(g.hero && active === g.segs[0] && g.segs[0].kind === "hero")) {
            const hy = (Math.abs(Math.sin(angle)) * 0.46 * g.pw + Math.abs(Math.cos(angle)) * 0.42 * g.ph) * sc;
            op *= smooth(g.hdrB + hy - 2, g.hdrB + hy + 30, y);
          }
          // nor by the window's foot (a pin's door out sits there, and the line turns on it): gone before its lower
          // half-extent reaches the foot, back in as it rises clear of it
          const vy = (Math.abs(Math.sin(angle)) * 0.46 * g.pw + Math.abs(Math.cos(angle)) * 0.42 * g.ph) * sc;
          const foot = window.innerHeight;
          op *= 1 - smooth(foot - vy - 26, foot - vy - 2, y);
        }
        plane.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(angle / RAD).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        plane.style.opacity = op.toFixed(3);
        plane.style.setProperty("--fold", fold.toFixed(3));
        const lv = low.toFixed(3);
        if (lv !== lowV) { lowV = lv; plane.style.setProperty("--low", lv); }
        // docked: the plane rests in the pill's right end (crossfaded in by scroll) and the pill glows once
        if (dock) {
          dock.classList.toggle("is-docked", isDocked || dk > 0);
          const dv = dk.toFixed(3);
          if (dv !== dockV) { dockV = dv; dock.style.setProperty("--dk", dv); }
        }
        if (dock && isDocked !== docked) {
          docked = isDocked;
          if (pill) {
            // the arrival: the pill grows, pulses, sweeps and keeps its glow; the horizon flares (home.css)
            const land = pill.closest(".hn");
            pill.classList.remove("is-glow");
            if (land) land.classList.remove("is-landed");
            if (docked) { void pill.offsetWidth; pill.classList.add("is-glow"); if (land) land.classList.add("is-landed"); }
          }
        }
      }
      // T2: the card lifts off the photo (swapped in one frame for 1B's card, an exact scaled copy) and flies into 1B's
      // centre, its question crossfading mid-flight; 1B's faint loop and waiting replies come in as it lands, its heading
      // only once the card is below it (never covered)
      if (g.t2) {
        const T = g.t2;
        const q = clamp((sm - T.s0) / (T.s1 - T.s0), 0, 1);
        const ride = g.loop ? clamp(s - g.loop.s0, 0, g.loop.run) : 0;   // already pinned: the card rides the pin
        if (force || Math.abs(q - t2q) > 0.0005 || ((q === 0 || q === 1) && q !== t2q) || (ride && q < 1)) {
          t2q = q;
          if (T.fly) {
            const e = eio(clamp(q / 0.7, 0, 1)), arc = Math.sin(Math.PI * e);
            const k = lerp(T.k, 1, e) * (1 + 0.04 * arc);
            // its top in the window, less where it sits untransformed (in the flow, or riding the pin)
            const top = t2Top(T, q, e, arc, s);
            const dy = top - (T.bTop - s + ride);
            const still = q >= 1 || Math.abs(dy) < 0.5 && e >= 1;
            qaDst.style.transform = still ? "" : `translate3d(${(T.dx * (1 - e)).toFixed(1)}px,${dy.toFixed(1)}px,0) rotate(${(-3 * arc).toFixed(2)}deg) scale(${k.toFixed(4)})`;
            // its corners stay the system's 20 px on screen whatever the flight's scale (home.css .qa: 20 px / --qk)
            qaDst.style.setProperty("--qk", still ? "1" : k.toFixed(4));
            // the swap, in one frame: 1B's card (the same card, line for line) takes the photo's place
            qaSrc.style.opacity = q > 0 ? "0" : "";
            qaDst.style.opacity = q > 0 ? "" : "0";
            qaDst.style.setProperty("--tip", (1 - smooth(0, 0.07, q)).toFixed(3));
            qaDst.style.setProperty("--glo", smooth(0.45, 1, q).toFixed(3));
            // one question out, then the other in, quickly (never both washed out at once)
            qaDst.style.setProperty("--gho", (1 - smooth(0.34, 0.42, e)).toFixed(3));
            qaDst.style.setProperty("--qo", smooth(0.42, 0.5, e).toFixed(3));
            if (loopPin) {
              // the waiting replies and the faint loop come in once the card sits in the stage (q 1; it holds still in the
              // window from q .7 while the stage rises to it): the flying
              // card never passes under a waiting portrait (from 1200 px they sit close round it)
              const h = smooth(0.93, 1, q);
              loopPin.style.setProperty("--fqh", h >= 1 ? "1" : h.toFixed(3));
              // the heading: hidden while the card is over it or above it, in once the card's top (its tilt's
              // highest corner) is 24 px or more below the heading's foot
              if (T.headB != null) {
                const headB = g.loop ? layerY(g.loop, s) + T.headB : T.headB - s;
                const cardTop = top - T.w * k * Math.sin(3 * arc * RAD);
                const v = q >= 1 ? 1 : Math.round(smooth(24, 64, cardTop - headB) * 200) / 200;
                loopPin.style.setProperty("--fqt", String(v));
              }
            }
          } else {
            // phones: a crossfade, in px of scroll. The photo's card lifts a little off the photo and fades out whole
            // (its text with its surface, never clipped: no hairline across the photo) over 40 px; 1B's card starts
            // to come in 12 px later (the two overlap by about 28 px: never a beat with neither card), quickly (a
            // fast-start fade over 26 px, so it is never long a grey slab over the night) while it rises 22 px and
            // grows from .965 into its place over 100 px, its text in from the first frame
            const px = q * (T.s1 - T.s0) - 0.02 * (T.s1 - T.s0);
            const out = smooth(0, 40, px), lift = eio(clamp(px / 60, 0, 1));
            const inO = 1 - Math.pow(1 - clamp((px - 12) / 26, 0, 1), 3), inn = eio(clamp((px - 12) / 100, 0, 1));
            qaSrc.style.opacity = out > 0 ? (1 - out).toFixed(3) : "";
            qaSrc.style.transform = lift > 0 && out < 1 ? `translate3d(0,${(-14 * lift).toFixed(1)}px,0) scale(${(1 - 0.03 * lift).toFixed(4)})` : "";
            qaSrc.style.clipPath = "";
            qaSrc.style.setProperty("--qc", "1");
            qaDst.style.opacity = inO >= 1 ? "" : inO.toFixed(3);
            const kd = 0.965 + 0.035 * inn;              // (its transform origin is its top left: grown about its centre)
            qaDst.style.transform = inn > 0 && inn < 1 ? `translate3d(${(T.w * (1 - kd) / 2).toFixed(1)}px,${(22 * (1 - inn)).toFixed(1)}px,0) scale(${kd.toFixed(4)})` : "";
            qaDst.style.clipPath = "";
            qaDst.style.setProperty("--qc", "1");
            qaDst.style.setProperty("--qo", "1");
            qaDst.style.setProperty("--gho", "0");
          }
        }
        // a gated reply's waiting portrait comes in only once its box is clear of the card (measure())
        if (g.bubGates) g.bubGates.forEach((o) => {
          const v = Math.round(smooth(o.S, o.S + 36, sm) * 100) / 100;
          if (v !== o.v) { o.v = v; o.el.style.setProperty("--fqa", String(v)); }
        });
      }
      // Chặng 02: the cards lift out of their rows (--pop on the card and on its row, which empties into a dashed
      // slot); a card that is out gets its stamp pressed on, once
      if (g.pop) g.pop.forEach(({ c, s0, s1 }) => {
        const v = Math.round(eio(smooth(s0, s1, sm)) * 400) / 400;
        if (v === c.v) return;
        c.v = v;
        c.el.style.setProperty("--pop", String(v));
        if (c.row) c.row.style.setProperty("--pop", String(v));
        if (v >= 0.97 && !c.stamped) { c.stamped = true; c.el.classList.add("is-stamped"); }
      });
    }

    if (withMotion) {
      tasks.add((dt) => {
        const s = window.scrollY;
        sm += (s - sm) * ease(0.22, dt);
        if (Math.abs(s - sm) < 0.4) sm = s;
        SCR.sm = sm;
        frame(false, dt);
        return sm !== s;
      });
      // a focused hero link is never left faded in the pin: the page goes back to the hero's start (and the CSS
      // shows a focused block at once, html.hm [data-t1-fade]:focus-within)
      if (hero) hero.addEventListener("focusin", () => {
        if (geo && geo.hero && window.scrollY > geo.hero.s0 + 2) window.scrollTo({ top: geo.hero.s0 });
      });
      // a focused job card is out of its row whole (CSS :focus-within) and gets its stamp at once
      if (popStage) popStage.addEventListener("focusin", (e) => {
        const card = e.target.closest && e.target.closest("[data-card]");
        const c = card && popCards.find((pc) => pc.el === card);
        if (c && !c.stamped) { c.stamped = true; card.classList.add("is-stamped"); }
      });
      // a focused link in 1B is never under a heading still waiting for the card: the pin's start, where both are in
      if (loopPin) loopPin.addEventListener("focusin", () => {
        if (geo && geo.loop && window.scrollY < geo.loop.s0 - 2) window.scrollTo({ top: geo.loop.s0 });
      });
    }
    let timer = 0;
    // every measure of the path tells the others that read its keys (dawn(): the dock's scroll, VR.homeLand), so a
    // resize or a rotation never leaves them on the old window's keys
    const measured = () => document.dispatchEvent(new Event("vr:flight-measured"));
    const remeasure = () => { clearTimeout(timer); timer = setTimeout(() => { measure(); measured(); wake(); }, 150); };
    // phones: a height-only change smaller than the browser's bar (it shows and hides as the scroll turns) keeps
    // the measured path, so the plane never jumps
    const onResize = () => {
      vwC = document.documentElement.clientWidth;
      if (coarse && window.innerWidth === lastW && Math.abs(window.innerHeight - vhKeys) <= 150) { wake(); return; }
      remeasure();
    };
    window.addEventListener("scroll", () => wake(), { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    if ("ResizeObserver" in window) {
      let lastH = 0;
      new ResizeObserver(() => { const h = fl.offsetHeight; if (h !== lastH) { lastH = h; remeasure(); } }).observe(fl);
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => remeasure());
    window.addEventListener("load", remeasure);
    wake();
    setTimeout(measured);
    // read-only, for the layout checks (the review scripts): the measured keys
    VR.homeFlight = () => geo && { vh: geo.vh, segs: geo.segs.map((seg) => ({ kind: seg.kind, total: seg.total, keys: seg.keys, pts: seg.pts.map((pt) => [Math.round(pt.x), Math.round(pt.y), Math.round(pt.S), Math.round(pt.len), pt.el ? pt.el.className.baseVal === undefined ? pt.el.className : "" : "door"]) })),
      loop: geo.loop && { s0: geo.loop.s0, run: geo.loop.run }, tools: geo.tools && { s0: geo.tools.s0, run: geo.tools.run },
      t2: geo.t2 && { s0: geo.t2.s0, s1: geo.t2.s1 } };
    // the scroll at which the plane docks in the final pill (focusCards takes a focused pill there)
    VR.homeLand = () => {
      const last = geo && geo.segs[geo.segs.length - 1];
      return withMotion && last ? Math.ceil(last.keys[last.keys.length - 1].S) + 1 : null;
    };
    // print: the finished picture
    return () => {
      sm = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (geo) geo.segs.forEach((seg) => {
        if (seg.mask) seg.mask.setAttribute("stroke-dashoffset", "0");
        if (seg.bands) seg.bands.forEach((b) => b.mask.setAttribute("stroke-dashoffset", "0"));
      });
      $$("[data-wp], [data-lit]", fl).forEach((el) => el.classList.add("is-lit"));
      popCards.forEach((c) => { c.el.style.setProperty("--pop", "1"); if (c.row) c.row.style.setProperty("--pop", "1"); c.el.classList.add("is-stamped"); });
      if (dock) { dock.classList.add("is-docked"); dock.style.setProperty("--dk", "1"); }
      if (pill) pill.classList.add("is-glow");
    };
  }

  /* ---------------------------------------------------------------- 2B: the product stage */
  // HOME_ROUND5_SPEC §2 as the approved prototype (proto/2b-stage), SCRUBBED BY SCROLL (§2b, the client 18/11: "hiệu
  // ứng xuất hiện theo cuộn"). Always (also reduced motion): the floor reflections; each panel's content and the pill
  // are cloned ONCE into their mirrored node (aria-hidden, inert, links turned into spans; home.css flips, blurs and
  // masks them). The DOM and the CSS are the finished stage. With motion every beat is a pure function of the scroll:
  // no timers, no "plays once" latch, the same frame for the same scroll whichever way it is reached (a fling, a jump,
  // a reload mid-section), back again on the way up. It follows the home's eased scroll (flight(): SCR.sm), so a
  // wheel step never stutters.
  //   pinned (from 1200 px on windows tall enough): the approach a (0 → 1 while the pin's top comes up from 60 % of
  //     the window to the header) brings the lights and the paid price up, so the pin opens on a lit stage and goes
  //     straight into the roll; then p, the pin's own progress (its run home.css --t-run);
  //   in flow (phones, tablets, 900-1199 px, short windows): the numeral's beats by its centre's place in the window
  //     (from 125 % of its height: the lights; from 95 %: the countdown; to 40 %, or higher while the h2 is still clear
  //     of the header: the pop done), each panel by its own (its top from the window's foot: its rise; to half way up:
  //     its demo done; never before the numeral has popped, so the row just under it waits and then rises in turn),
  //     the pill by its own, after the last panel.
  // The beats (p). Scroll-mapped motion eases in and out (an ease-out spent most of a beat in its first wheel step):
  //   .015 – .34     countdown: the value is a function of p (a soft start and a short settle, 1.990.000đ → 0đ);
  //                  every digit's wheel follows it like a real odometer (the thousands wheel rolls each step over
  //                  the middle fifth of its thousand, so wherever the scroll rests the digits are mostly whole; each
  //                  wheel above turns only while the one below passes from 0 to 9: high digits slow), crisp digits
  //                  on strips, FLAT. The price sits centred, at most 60 % of the frame wide and lifted (on desktop
  //                  .27 em: under the h2, clear of the path's arc); each leading glyph fades out where it stands
  //                  once its wheel rests on 0, then the glyphs on its left close up behind it, one glyph at a time,
  //                  and what is left stays centred under the h2
  //   .37 – .44      "0đ" grows and drops onto its line in ONE move (it is already centred)
  //   .44 – .56      3D pop: the extrusion grows (6 composited groups of 4 copies slide apart: transforms only), the
  //                  spot flares once on the cap line, the contact shadow and the reflection come in, the struck price
  //                  fades in and its strike draws left → right
  //   .52 – .93      the panels rise one by one, each over its own .2 (starts .07 apart, left → right): 28 u up over
  //                  its first 55 % (opaque by half of that), then its demo over the rest (the slider and the rate,
  //                  the CV ring and its ticks, the invoice's amounts and the total, the risky phrases and then
  //                  "Rủi ro cao"); a landed card already reads as a tool (its bars, a first figure)
  //   .86 – .93      the pill fades in and rises 10 u
  //   .93 – 1        the finished stage holds, then the pin lets go
  // The path's keys in the numeral's row (home.html data-p) follow these: the plane reaches the numeral only once
  // "0đ" has landed (B.land's end), slips behind it during the pop and is out on the right as the first panel lands.
  // A frame writes transforms, opacity, a few custom properties on the elements that read them, and the counters'
  // text when their figure changes; nothing is read from the layout per frame (measure(): load, fonts, resize, and
  // every time flight() measures the path), and nothing is written when the beats' inputs have not changed. A focused
  // panel or the pill: the page goes to the finished stage when pinned (home.css shows a focused panel whole at once);
  // in flow the focused panel shows its finished demo; printing: the finished stage.
  function stage(withMotion) {
    const root = $("#cong-cu");
    if (!root) return;
    // the floor reflections (once, static): a clone with its links turned into spans (nothing to focus or click)
    const deaden = (node) => {
      const swap = (a) => { const sp = document.createElement("span"); sp.className = a.className; while (a.firstChild) sp.appendChild(a.firstChild); return sp; };
      if (node.tagName === "A") node = swap(node);
      node.querySelectorAll("a").forEach((a) => a.replaceWith(swap(a)));
      node.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      return node;
    };
    const seal = (el) => { el.setAttribute("aria-hidden", "true"); el.inert = true; el.setAttribute("inert", ""); };
    $$("[data-panel]", root).forEach((p) => {
      const r = $(":scope > .fts-refl", p);
      if (!r || r.childElementCount) return;
      Array.from(p.children).forEach((c) => { if (c !== r) r.appendChild(deaden(c.cloneNode(true))); });
      seal(r);
    });
    const pill = $(".fts-pill", root), prefl = $(".fts-prefl", root);
    if (pill && prefl && !prefl.childElementCount) { prefl.appendChild(deaden(pill.cloneNode(true))); seal(prefl); }
    if (!withMotion) return;

    const span = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
    const sstep = (x) => x * x * (3 - 2 * x);
    const backOut = (x) => { const c = 1.5; return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
    // a value is written only when it changes (4 decimals), on the few elements that read it (never on the section: a
    // write there restyles the whole stage every frame)
    const setVar = (el, k, v) => { if (!el) return; const sv = typeof v === "number" ? v.toFixed(4) : v; if (el["_" + k] !== sv) { el["_" + k] = sv; el.style.setProperty(k, sv); } };
    const setBoth = (el, k, v) => { setVar(el, k, v); setVar(el._twin, k, v); };      // a demo value and its reflection
    const setCls = (el, c, on) => { if (el && el["_c" + c] !== on) { el["_c" + c] = on; el.classList.toggle(c, on); } };
    // (a layer that comes up from nothing is drawn while still at .01, before it shows: never in its first frame)
    const lit = (v) => Math.max(0.01, v);

    // the beats, in p
    const B = {
      roll: [0.015, 0.34],               // the countdown: 1.990.000đ at its start, 0 at its end
      fold: 0.026, stagger: 0.008,       // a leading glyph's fold, and one glyph after another within a group
      land: [0.37, 0.44],                // "0đ" grows and drops onto its line
      depth: [0.44, 0.54], exo: [0.44, 0.47], flare: [0.44, 0.48, 0.56], ground: [0.46, 0.56], was: [0.47, 0.54], strike: [0.49, 0.56],
      panel0: 0.52, step: 0.07, span: 0.2, rise: 0.55,
      foot: [0.86, 0.93],
    };
    B.done = B.land[1];                  // "0đ" rests on its line: from here the path may pass behind it
    B.end = B.depth[1] + 0.02;           // in flow, the numeral's beats run from p 0 to here

    /* the odometer: the price's cells (.ft__lead) left of the last digit, each digit on a wheel 0 … 9, 0 */
    const odo = $("[data-odo]", root), lead = odo && $(".ft__lead", odo);
    const numIn = $(".fts-num__in", root), zero = $(".ft__zero", root), ex = $(".fts-ex", root);
    const bg = $(".fts-bg", root), was = $(".fts-was", root), flare = $(".fts-flare", root);
    const ground = $$(".fts-num__contact, .fts-num__refl", root);
    const frame = $("[data-fts]", root), foot = $(".ft__foot", root);
    if (!odo || !lead || !numIn || !ex) return;
    const mkStrip = (cell) => {
      const strip = document.createElement("span");
      strip.className = "ft__strip";
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((n) => { const sp = document.createElement("span"); sp.textContent = String(n); strip.appendChild(sp); });
      const d = Number(cell.dataset.d) || 0;
      cell.textContent = "";
      cell.appendChild(strip);
      return { cell, strip, d, place: 0, pos: "" };
    };
    const items = Array.from(lead.children).map((el) => ({ el, col: el.classList.contains("ft__cell") ? mkStrip(el) : null, w: 0, pf: 1, v: "" }));
    const zcol = mkStrip($(".ft__cell--z", odo));
    const cols = items.filter((it) => it.col).map((it) => it.col).concat([zcol]);
    cols.forEach((c, j) => { c.place = cols.length - 1 - j; });
    const PRICE = cols.reduce((v, c) => v * 10 + c.d, 0);       // 1990000
    const show = (c, q) => { const pos = (-q).toFixed(3); if (pos !== c.pos) { c.pos = pos; c.strip.style.transform = pos === "0.000" || pos === "-0.000" ? "" : `translate3d(0,${pos}em,0)`; } };
    // the value: a soft start and a short settle (x in [0, 1])
    const valueX = (x) => (x <= 0 ? PRICE : x >= 1 ? 0 : PRICE * Math.pow(1 - (0.35 * x + 0.65 * sstep(x)), 2.6));
    const valueAt = (p) => valueX(span(p, B.roll[0], B.roll[1]));
    const pUnder = (v) => {                                     // where the value first reaches v (it only falls)
      let a = B.roll[0], b = B.roll[1];
      for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (valueAt(m) <= v) b = m; else a = m; }
      return b;
    };
    // the wheels at value V, a real odometer's: the thousands wheel follows the value (the hundreds and below rest on
    // 0: the price is in thousands), each step one smooth roll over the middle fifth of its thousand (so wherever the
    // scroll stops the figure mostly rests on whole, crisp digits); each wheel above shows its digit and turns only
    // while the one below passes from 0 to 9 (counting down: 10 → 9 on its strip), by as much
    const step = (x) => { const n = Math.floor(x); return (n % 10) + sstep(span(x - n, 0.4, 0.6)); };
    function wheels(V) {
      let carry = 0;
      for (let j = cols.length - 1; j >= 0; j--) {
        const c = cols[j];
        const q = c.place < 3 ? 0 : c.place === 3 ? step(V / 1000 + 1e-9) : (Math.floor(V / Math.pow(10, c.place) + 1e-9) % 10) + carry;
        carry = Math.max(0, q - 9);
        show(c, q);
      }
    }
    // each leading item folds away once its wheel rests on 0 (a wheel at place k ≥ 4 when the value is down to
    // 10^k − 1000, its carry done; the thousands and below once the thousands wheel has rolled to 0), a separator
    // with the digit before it; the glyphs of one group one after another, left to right; all gone before the landing
    let prev = 0;
    items.forEach((it, i) => {
      const base = it.col ? (it.col.place >= 4 ? pUnder(Math.pow(10, it.col.place) - 1000) : pUnder(400)) : (i > 0 ? items[i - 1].base : 0);
      it.base = base;
      it.pf = Math.min(B.land[0] - B.fold, Math.max(prev + (i > 0 && items[i - 1].base === base ? B.stagger : 0), base));
      prev = it.pf;
    });
    // an item's advance: its box plus its margins (a digit's window is padded .1 em each side, cancelled by its −.1 em
    // margins; the computed width is the layout width, untouched by the odometer's transforms)
    const adv = (el) => {
      const cs = getComputedStyle(el), n = (k) => parseFloat(cs[k]) || 0;
      const bx = cs.boxSizing === "border-box" ? n("width") : n("width") + n("paddingLeft") + n("paddingRight") + n("borderLeftWidth") + n("borderRightWidth");
      return bx + n("marginLeft") + n("marginRight");
    };
    let geo = { L: 0, w0: 0, maxW: 1000, lift: 0 };
    function odometer(p) {
      const rolling = p < B.land[0], done = p >= B.done;
      setCls(odo, "is-rolling", rolling);
      setCls(odo, "is-done", done);
      if (done) {
        if (odo._rest) return;
        odo._rest = true;
        cols.forEach((c) => { c.pos = ""; c.strip.style.transform = ""; });
        items.forEach((it) => { it.v = ""; it.el.style.opacity = ""; it.el.style.transform = ""; });
        odo._tf = "";
        odo.style.transform = "";
        return;
      }
      odo._rest = false;
      wheels(valueAt(p));
      // a folding glyph fades out where it stands (over the first 40 % of its fold), then the glyphs on its left
      // close up over the rest (a move, never a squeeze: no ghost of a narrowed glyph)
      let shut = 0;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const x = span(p, it.pf, it.pf + B.fold);
        const v = `${x.toFixed(3)}|${shut.toFixed(1)}`;
        if (v !== it.v) {
          it.v = v;
          it.el.style.opacity = x > 0 ? (1 - sstep(span(x, 0, 0.4))).toFixed(3) : "";
          it.el.style.transform = shut > 0.05 ? `translate3d(${shut.toFixed(2)}px,0,0)` : "";
        }
        shut += it.w * sstep(span(x, 0.4, 1));
      }
      // the price holds still while it rolls and folds: what is left of it centred on the frame's axis under the h2
      // (the visible advance runs −(L − shut) … w0 around the odo's box, scaled about its centre), lifted; then "0đ"
      // (already centred) grows and drops onto its own line in ONE move, ending on the pop
      const sc0 = Math.min(0.7, geo.maxW / (geo.L + geo.w0 || 1));
      const e = eio(span(p, B.land[0], B.land[1]));
      const tf = `translate3d(${(sc0 * (geo.L - shut) / 2 * (1 - e)).toFixed(2)}px,${lerp(-geo.lift, 0, e).toFixed(2)}px,0) scale(${lerp(sc0, 1, e).toFixed(4)})`;
      if (tf !== odo._tf) { odo._tf = tf; odo.style.transform = tf; }
    }

    /* the panels and their demos: the card's own parts, each paired with its twin in the reflection */
    const own = (sel, el) => $$(sel, el).filter((n) => !n.closest(".fts-refl"));
    const pair = (sel, el) => { const a = own(sel, el), b = $$(".fts-refl " + sel, el); a.forEach((n, i) => { n._twin = b[i] || null; }); return a; };
    const panels = $$("[data-panel]", root).map((el) => ({ el, kind: el.dataset.kind, nums: pair(".ftd-n", el), rows: pair("li", el), marks: pair("mark", el), top: 0, lag: 0 }));
    const nums = panels.reduce((all, p) => all.concat(p.nums), []);
    // a counter keeps its final width (--cw, its layout width with the final figure: no shift while it counts)
    const fmtN = (v, f) => (f === "dec1" ? v.toFixed(1).replace(".", ",") : f === "usd" ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : String(Math.round(v)));
    const sizeNums = () => nums.forEach((n) => {
      const shown = n.textContent;
      n.style.removeProperty("--cw");
      n.textContent = fmtN(Number(n.dataset.n) || 0, n.dataset.fmt);
      const w = `${(n.offsetWidth + 0.5).toFixed(1)}px`;
      n.textContent = shown;
      n.style.setProperty("--cw", w);
      if (n._twin) n._twin.style.setProperty("--cw", w);
    });
    const count = (n, x) => {
      const sv = fmtN(lerp(Number(n.dataset.from) || 0, Number(n.dataset.n) || 0, x), n.dataset.fmt);
      if (sv !== n._last) { n._last = sv; n.textContent = sv; if (n._twin) n._twin.textContent = sv; }
    };
    // one panel at its own progress x (0 → 1): it rises over the first B.rise (opaque by half of its rise: never
    // see-through for long), then its demo d (0 → 1) over the rest; the demos' steps as the prototype's (ms of its
    // 850 ms demo, over 850). A landed card already reads as its tool: the CV ring at 3,0, the invoice's bars and its
    // first line's total, the slider at 12 USD/giờ
    const D = (ms) => ms / 850;
    function panel(p, x) {
      const r = span(x, 0, B.rise);
      setVar(p.el, "--r", eio(r));
      setVar(p.el, "--o", lit(sstep(span(r, 0, 0.5))));
      const d = span(x, B.rise, 1);
      if (p.kind === "rate") {
        const e = eio(span(d, 0, D(800)));
        setVar(p.el, "--rp", lerp(0.16, 0.58, e));
        p.nums.forEach((n) => count(n, e));
      } else if (p.kind === "cv") {
        const e = eio(d);
        setVar(p.el, "--cp", lerp(0.4, 1, e));
        p.nums.forEach((n) => count(n, e));
        p.rows.forEach((li, j) => setBoth(li, "--ck", backOut(span(d, D(200 + 170 * j), D(500 + 170 * j)))));
      } else if (p.kind === "invoice") {
        p.rows.forEach((li, j) => setBoth(li, "--li", eio(span(d, D(140 * j), D(140 * j + 420)))));
        p.nums.forEach((n) => count(n, eio(span(d, D(200), D(800)))));
      } else if (p.kind === "scam") {
        p.marks.forEach((m, j) => setBoth(m, "--mk", eio(span(d, D(220 * j), D(220 * j + 220)))));
        setVar(p.el, "--rk", backOut(span(d, D(650), 1)));
      }
    }

    /* the stage: the lights and the price by the approach a, the numeral and the pop by p */
    function beats(p, a) {
      const c = eio(span(a, 0, 0.75));
      setVar(bg, "--fts-cone", lit(c));
      setVar(bg, "--fts-pool", lit(eio(span(a, 0.3, 1))));
      const zo = sstep(span(a, 0.45, 0.9)).toFixed(3);
      if (zero._o !== zo) { zero._o = zo; zero.style.opacity = zo; }
      odometer(p);
      setVar(ex, "--fts-depth", eio(span(p, B.depth[0], B.depth[1])));
      setVar(ex, "--fts-ex-o", lit(sstep(span(p, B.exo[0], B.exo[1]))));
      const f = p < B.flare[1] ? sstep(span(p, B.flare[0], B.flare[1])) : 1 - sstep(span(p, B.flare[1], B.flare[2]));
      setVar(flare, "--fts-flare", 0.85 * f);
      const gr = lit(eio(span(p, B.ground[0], B.ground[1])));
      ground.forEach((el) => setVar(el, "--fts-ground", gr));
      setVar(was, "--fts-was", lit(eio(span(p, B.was[0], B.was[1]))));
      setVar(was, "--fts-strike", eio(span(p, B.strike[0], B.strike[1])));
    }
    const pillAt = (x) => setVar(foot, "--fts-foot", eio(x));

    /* where p comes from */
    const pin = $("[data-tools-pin]", root), wrap = pin && pin.parentElement;
    // a box's top in the page, its transforms aside (the panels' rise, the price's scale): the offset chain
    const docTop = (el) => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };
    let M = null, lastS = null, lastK = "";
    let held = null;                     // in flow: the panel that has the focus shows its finished demo
    function measure() {
      items.forEach((it) => { it.w = adv(it.el); });
      const em = parseFloat(getComputedStyle(odo).fontSize) || 1;
      const fw = frame.clientWidth || root.clientWidth;
      const arc = mq("(min-width: 1200px)").matches;          // the stage's arc (home.css: in flow below)
      // at most 60 % of the frame wide on the arc (the đ clear of the path's rise on the right); in flow the column
      // (phones: 45 px clear of each edge). While small it sits a little higher (its centre over the numeral's optical
      // centre on phones; on desktop .27 em up, under the h2, so the path's arc runs under it, and .15 em in the
      // 900-1199 px column), easing down onto the "0đ"'s own line as it grows
      geo = { L: items.reduce((sum, it) => sum + it.w, 0), w0: parseFloat(getComputedStyle(odo).width) || odo.offsetWidth,
        maxW: arc ? fw * 0.6 : Math.min(fw, root.clientWidth - 90),
        lift: (arc ? 0.27 : window.innerWidth >= 900 ? 0.15 : 0.03) * em };
      odo._tf = null;
      items.forEach((it) => { it.v = ""; });
      sizeNums();
      const vh = window.innerHeight;
      if (pin && getComputedStyle(pin).position === "sticky") {
        const top = parseFloat(getComputedStyle(pin).top) || 0;
        const s0 = wrap.getBoundingClientRect().top + window.scrollY - top;
        // the approach: from the pin's top at 60 % of the window to the header
        M = { pin: true, vh, s0, run: Math.max(1, wrap.offsetHeight - pin.offsetHeight), a0: s0 - Math.max(120, 0.6 * vh - top) };
        M.doneS = M.s0 + B.done * M.run;
      } else {
        // in flow: two panels side by side (the 2 × 2 grid) never rise together: the right one a tenth of the window
        // later. The numeral's beats end as its centre reaches 40 % of the window, or higher where its head (the h2,
        // the struck price) would by then be under the sticky header (a large numeral: tablets, short desktop windows)
        const num = docTop(numIn) + numIn.offsetHeight / 2, head = $(".ft__head", root), hdr = $(".site-header");
        const end = Math.max(0.4, ((hdr ? hdr.offsetHeight : 64) + 16 + num - (head ? docTop(head) : num)) / vh);
        M = { pin: false, vh, num, end: Math.min(0.6, end), foot: foot ? docTop(foot) : 0 };
        // the scroll at which "0đ" has landed (q at B.done of the numeral's run)
        M.doneS = num - (0.95 - (B.done / B.end) * (0.95 - M.end)) * vh;
        M.sMin = num - 1.3 * vh; M.sMax = Math.max(M.foot, num) + vh;
        panels.forEach((p, i) => {
          p.top = docTop(p.el);
          const left = i > 0 && Math.abs(panels[i - 1].top - p.top) < 4;
          p.lag = left ? panels[i - 1].lag + 0.1 : 0;
        });
      }
      lastS = null; lastK = "";
    }
    // the whole stage at the eased scroll s (skipped when its inputs are where they were: off screen, or holding)
    function render(s) {
      if (!M) return;
      if (M.pin) {
        const p = clamp((s - M.s0) / M.run, 0, 1);
        const a = clamp((s - M.a0) / (M.s0 - M.a0), 0, 1);
        const k = `${p}|${a}`;
        if (k === lastK) return;
        lastK = k;
        beats(p, a);
        panels.forEach((pa, i) => panel(pa, span(p, B.panel0 + B.step * i, B.panel0 + B.step * i + B.span)));
        pillAt(span(p, B.foot[0], B.foot[1]));
        return;
      }
      const vh = M.vh;
      // the numeral's centre in the window: from 1.25 to .8 of its height the lights and the price come up; from .95
      // to M.end it carries p from the countdown's start to the pop's end (q 0 → 1)
      s = clamp(s, M.sMin, M.sMax);      // (above or below this, nothing changes)
      const k = `${s}|${held ? held.kind : ""}`;
      if (k === lastK) return;
      lastK = k;
      const y = M.num - s;
      const a = clamp((1.25 * vh - y) / (0.45 * vh), 0, 1);
      const q = (0.95 * vh - y) / ((0.95 - M.end) * vh);
      beats(clamp(q * B.end, 0, 1), a);
      // a panel by its own top (from the window's foot: its rise; half way up: its demo done), but never before the
      // numeral has popped: the panels just under it (the first row, or the arc on a short window) wait for the pop,
      // then rise in turn (.12 apart); the pill by its own top, after the last panel
      panels.forEach((pa, i) => {
        if (pa === held) return;
        panel(pa, Math.min((vh * (1 - pa.lag) - (pa.top - s)) / (0.5 * vh), (q - 0.9 - 0.12 * i) / 0.5));
      });
      pillAt(Math.min(span(vh - (M.foot - s), 0, 0.16 * vh), span(q, 0.9 + 0.12 * panels.length, 1.15 + 0.12 * panels.length)));
    }
    // the progress at which the finished stage holds (a focused panel or the pill goes there: focusCards)
    VR.homeStageEnd = () => (M && M.pin ? Math.round(M.s0 + 0.97 * M.run) : null);
    // the scroll from which "0đ" stands landed on its line (flight(): the plane only fades behind it from there)
    VR.homeStageDone = () => (M ? M.doneS : null);
    // read-only, for the review scripts: where p comes from
    VR.homeStage = () => M && Object.assign({}, M, { beats: B, panels: panels.map((pa) => [pa.top, pa.lag]) });

    const now = () => (SCR.sm != null ? SCR.sm : window.scrollY);
    measure();
    render(now());
    // on the shared ticker: a frame only when the eased scroll moved (flight()'s task, which eases it, runs first)
    tasks.add(() => {
      const s = now();
      if (s !== lastS) { lastS = s; render(s); }
      return false;
    });
    const again = () => { measure(); wake(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    // every measure of the path (load, fonts, resize, a change of the page's height) measures the stage too
    document.addEventListener("vr:flight-measured", again);
    window.addEventListener("scroll", () => wake(), { passive: true });
    // in flow a focused panel shows its finished demo (its figures written here; home.css shows it whole) for as
    // long as the focus stays in it
    root.addEventListener("focusin", (e) => {
      const el = e.target.closest && e.target.closest("[data-panel]");
      const pa = el && !(M && M.pin) ? panels.find((o) => o.el === el) : null;
      if (pa === held) return;
      held = pa || null;
      if (held) panel(held, 1);
      lastS = null; lastK = ""; wake();
    });
    root.addEventListener("focusout", (e) => {
      if (held && !(e.relatedTarget && held.el.contains(e.relatedTarget))) { held = null; lastS = null; lastK = ""; wake(); }
    });
    // printing: the finished stage (and back to the scroll's frame after)
    window.addEventListener("beforeprint", () => { beats(1, 1); panels.forEach((pa) => panel(pa, 1)); pillAt(1); lastS = null; lastK = ""; });
    window.addEventListener("afterprint", () => { lastS = null; lastK = ""; wake(); });
  }

  /* ---------------------------------------------------------------- the landing: dawn over the horizon */
  // Scrubbed by scroll (HOME_ROUND4_SPEC §2b): one number p (0 → 1), from the horizon (the scene's foot) coming up
  // into the window to just before the plane docks in the pill (VR.homeLand, flight()'s own key for the dock: the dawn has
  // risen as the plane touches down), eased a little toward the scroll (dt-based), and back again on the way up. The
  // horizon draws out from the centre and brightens (--h over the first .4), the rays fan up (--r, .12 → .6), and the
  // portraits rise one by one from behind the horizon (the ground below it is opaque), the centre first, then outwards
  // (face k starts at .26 + .085 k, over .3 of the run): one ease out from under the horizon, a little growth, a
  // quick fade in. A frame writes the scene's two variables and the transform and opacity of the faces in motion only.
  // Positions are read in measure() (load, fonts, resize), never per frame.
  function dawn() {
    const el = $("[data-dawn]");
    if (!el) return;
    let s0 = 0, s1 = 1, cur = -1, shown = -1, on = false, hv = "", rv = "";
    let faces = [];
    const measure = () => {
      const r = el.getBoundingClientRect(), vh = window.innerHeight, top = r.top + window.scrollY;
      const land = VR.homeLand ? VR.homeLand() : null;
      const end = land != null ? land - Math.min(50, vh * 0.06) : r.bottom + window.scrollY - vh * 0.7;
      // from the horizon (the scene's foot) coming up into the window: every beat of the dawn is seen
      s0 = top + r.height - vh * 1.02;
      s1 = Math.max(s0 + vh * 0.22, end);
      // each face drops below the horizon by its own height over it plus its half size (and a little more)
      faces = $$(".hn-face", el).filter((f) => f.getClientRects().length).map((f) => {
        // (offsetTop: in the fan, which fills the scene; never moved by the transform written here)
        return { el: f, k: Number(f.style.getPropertyValue("--k")) || 0, drop: el.clientHeight - f.offsetTop + 8, t: -1 };
      });
      $$(".hn-face", el).forEach((f) => { if (!f.getClientRects().length) { f.style.transform = ""; f.style.opacity = ""; } });
      shown = -1;
      wake();
    };
    const paint = (p) => {
      const h = smooth(0, 0.4, p).toFixed(3), rr = smooth(0.12, 0.6, p).toFixed(3);
      if (h !== hv) { hv = h; el.style.setProperty("--h", h); }
      if (rr !== rv) { rv = rr; el.style.setProperty("--r", rr); }
      faces.forEach((o) => {
        const t = clamp((p - 0.26 - 0.085 * o.k) / 0.3, 0, 1);
        if (t === o.t) return;
        o.t = t;
        if (t >= 1) { o.el.style.transform = "none"; o.el.style.opacity = "1"; return; }
        const e = 1 - Math.pow(1 - t, 3);
        o.el.style.transform = `translate3d(0,${(o.drop * (1 - e)).toFixed(1)}px,0) scale(${(0.86 + 0.14 * e).toFixed(4)})`;
        o.el.style.opacity = Math.min(1, t * 2.5).toFixed(3);
      });
    };
    // (the first frame after a measure always paints, in or out of the window: never a stale state)
    tasks.add((dt) => {
      if (!on && shown >= 0) return false;
      const target = clamp((window.scrollY - s0) / (s1 - s0), 0, 1);
      cur = cur < 0 ? target : cur + (target - cur) * ease(0.22, dt);
      if (Math.abs(target - cur) < 0.0015) cur = target;
      const v = Math.round(cur * 1000) / 1000;
      if (v !== shown) { shown = v; paint(v); }
      return on && cur !== target;
    });
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) wake(); }, { rootMargin: "20% 0px 20% 0px" }).observe(el);
    // the photos load (lazy in the markup) a screen and a half ahead, so no face rises without its photo
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      $$("img[loading=lazy]", el).forEach((img) => { img.loading = "eager"; });
    }, { rootMargin: "150% 0px 150% 0px" });
    io.observe(el);
    const nudge = () => { if (on) wake(); };
    window.addEventListener("scroll", nudge, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    // the dock's scroll is flight()'s, measured 150 ms after a resize, the fonts or the load: measured again then
    document.addEventListener("vr:flight-measured", measure);
    window.addEventListener("load", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("beforeprint", () => { paint(1); shown = 1; cur = 1; });
    measure();
  }

  /* ---------------------------------------------------------------- figures that count up once */
  // [data-hm-count] (the home's own hook: common.js rolls every [data-count] on a page in its own format, which ran a
  // second count-up over these in its own format): the DOM holds the final figure; with motion it shows
  // its start (data-from, default 0) until it counts up (1.3 s, ease out) as it comes into the window (Chặng 02's line
  // of real figures; 2B's samples count as the scroll scrubs the stage, stage()). The box keeps the final
  // figure's width (--cw, measured on the final formatted text, again once the web font is in), so nothing moves.
  // Vietnamese figures throughout: thousands dots ("1.400 USD", as the page writes "1.990.000đ" and "70.000 USD/năm"),
  // a decimal comma ("7,5")
  const vnInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fmt = (el, n) => (el.dataset.fmt === "usd" ? `${vnInt(n)} USD`
    : el.dataset.fmt === "dec1" ? (Math.round(n * 10) / 10).toFixed(1).replace(".", ",")
    : vnInt(n));
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const to = Number(el.dataset.hmCount), from = Number(el.dataset.from || 0);
    if (!Number.isFinite(to)) return;
    let t = 0;
    tasks.add(function step(dt) {
      t = Math.min(1, t + dt / 1300);
      el.textContent = fmt(el, from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t >= 1) { tasks.delete(step); return false; }
      return true;
    });
    wake();
  }
  function counters() {
    const els = $$("[data-hm-count]");
    const size = (el) => {                           // the final figure's width (whatever is shown just now)
      const shown = el.textContent;
      el.style.removeProperty("--cw");
      el.textContent = fmt(el, Number(el.dataset.hmCount));
      const w = el.offsetWidth;                     // its layout width
      el.textContent = shown;
      el.style.setProperty("--cw", `${Math.ceil(w) + 1}px`);
    };
    els.forEach((el) => {
      el.classList.add("hm-num");                    // its box first (tabular figures), then its width
      size(el);
      // a real count (no data-from) starts at 80 % of itself: it never shows a false 0, only the last stretch counts
      if (el.dataset.from == null) el.dataset.from = String(Math.floor(Number(el.dataset.hmCount) * 0.8));
      el.textContent = fmt(el, Number(el.dataset.from));
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => els.forEach(size));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { io.unobserve(e.target); countUp(e.target); }
    }), { threshold: 0 });
    els.forEach((el) => io.observe(el));
    // print: the final figures
    window.addEventListener("beforeprint", () => els.forEach((el) => { el.dataset.counted = "1"; el.textContent = fmt(el, Number(el.dataset.hmCount)); }));
  }

  /* ---------------------------------------------------------------- reveals */
  function reveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        // the photo opens on its picture, not on the empty frame (at most 700 ms of waiting)
        decoded(el.matches("[data-clip]") ? $("img", el) : null, () => el.classList.add("is-in"), 700);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    $$("[data-fade]").forEach((el) => io.observe(el));
    // the Chặng 01 photo starts to open a little BEFORE its top comes up (its clip's 1.3 s opening is under way as it
    // enters): after T1 the plane is never alone on a black window waiting for it (it rises over the pin's tail)
    const early = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      early.unobserve(e.target);
      decoded($("img", e.target), () => e.target.classList.add("is-in"), 700);
    }), { rootMargin: "0px 0px 12% 0px", threshold: 0 });
    $$("[data-clip]").forEach((el) => early.observe(el));
    // a focused element never stays hidden (keyboard users tabbing ahead of the scroll)
    document.addEventListener("focusin", (event) => {
      const el = event.target.closest && event.target.closest("[data-fade], [data-clip]");
      if (el) el.classList.add("is-in");
    });
  }

  /* ---------------------------------------------------------------- focus: never a ring cut by the window */
  // Tabbing to a job card (the phone rail: its start edge at the gutter), a tool panel or the final pill
  // brings it whole into view, clear of the sticky header (the CSS scroll-margin), centred so the scrubbed
  // effects round it have finished.
  // html scrolls smoothly: a scroll still in flight from the previous focus (Shift+Tab, then Tab within 100 ms)
  // would carry the page away from the new one. So every focus here either starts its own scroll or, when its
  // target is already in view, stops the one in flight where it is (an instant scroll to the current place).
  // The final pill goes to the landing (VR.homeLand), so the plane is docked in it, never over its ring.
  function focusCards() {
    const fl = $("[data-flight]");
    if (!fl) return;
    const hold = () => window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: "instant" });
    // 2B pinned: its panels and its pill go to the scroll where the stage is finished (stage(): VR.homeStageEnd)
    const stageEnd = (t) => (VR.homeStageEnd && t.closest && t.closest("[data-tools-pin]") ? VR.homeStageEnd() : null);
    fl.addEventListener("focusin", (e) => {
      const t = e.target;
      const el = t.closest && t.closest(".fj-card, .ft-panel, .hn__pill");
      const top = (parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 64) + 16;
      const end = stageEnd(t);
      if (end != null) { if (Math.abs(window.scrollY - end) > 2) window.scrollTo({ top: end }); else hold(); return; }
      if (!el || !el.scrollIntoView) {
        // any other link of the journey (not in the pinned hero or the pinned 1B: flight() takes the page to the
        // pin's start): its ring (5 px outside the box) clear of the window's foot and the header, by its scroll-margin
        const pin = t.closest && t.closest("[data-loop]");
        if (!t.scrollIntoView || t.closest(".hv") || (pin && getComputedStyle(pin).position === "sticky")) return;
        const r = t.getBoundingClientRect();
        if (r.top - 6 < top || r.bottom + 6 > window.innerHeight - 8) t.scrollIntoView({ block: "nearest" }); else hold();
        return;
      }
      if (el.classList.contains("hn__pill") && VR.homeLand) {
        const land = VR.homeLand();
        if (land != null) { window.scrollTo({ top: land }); return; }
      }
      // a job card: its face (.fj-card__in: popped, lifted and turned in the phone's 3D frame, with its 7 px ring)
      // where it settles once focused (the card's focus lift is a .4 s transition: measured at its end, the
      // transitions skipped for this one read), never the card's row slot
      let r;
      const face = el.classList.contains("fj-card") && $(".fj-card__in", el);
      if (face) {
        const saved = [el.style.transition, face.style.transition];
        el.style.transition = "none"; face.style.transition = "none";
        const fr = face.getBoundingClientRect(), o = 8;
        r = { top: fr.top - o, bottom: fr.bottom + o, left: fr.left - o, right: fr.right + o };
        el.style.transition = saved[0]; face.style.transition = saved[1];
      } else r = el.getBoundingClientRect();
      if (r.top < top || r.bottom > window.innerHeight - 16 || r.left < 8 || r.right > window.innerWidth - 8) {
        // a card's face centred in the window under the header; anything else by its own box
        if (face) window.scrollTo({ top: Math.max(0, window.scrollY + (r.top + r.bottom) / 2 - (top + window.innerHeight) / 2) });
        else el.scrollIntoView({ block: "center", inline: "nearest" });
      } else hold();
    });
  }

  ready(() => {
    let finish = () => {};
    // each part on its own: an error in one never leaves a section in its start state (dark, hidden, waiting): the
    // motion classes go and the finished page shows (the DOM's final state), the error still reported
    const safe = (fn) => {
      try { return fn(); } catch (err) {
        root.classList.remove("hm", "hm-on", "hm-free");
        setTimeout(() => { throw err; });
        return undefined;
      }
    };
    safe(focusCards);
    if (motion) {
      safe(reveals);
      safe(orbit);
      finish = safe(() => flight(true)) || finish;
      safe(counters);
      safe(() => stage(true));
      safe(dawn);
    } else {
      safe(() => flight(false));
      safe(() => stage(false));
    }
    window.addEventListener("beforeprint", () => {
      $$("[data-fade], [data-clip]").forEach((el) => el.classList.add("is-in"));
      finish();
    });
  });
})();

/* Việt Remote — guides (index + article pages). Depends on common.js (window.VR).

   Article  [data-guide]
     - table of contents built from the h2s in [data-prose] (sticky rail on desktop,
       collapsible bar on phones), current section follows the scroll
     - a 2px position bar under the header (where you are, not what you read)
     - reading credit: the intro and every h2 section must each stay on screen for a while,
       in proportion to its length, while the tab is visible. A TOC jump or the End key
       reaches the bottom in one move but reads nothing, so it earns nothing. The TOC numbers
       of credited sections turn mint, and the TOC meter "Phần đã đọc n/6" (one segment per
       section) appears once the first section is credited, so a quick skim never shows a
       low percentage beside a long position bar. When every part is credited the guide is remembered per viewer in localStorage
       (vr.guides.read) and the index ticks it. Credited parts are kept too
       (vr.guides.seen), so a guide can be finished over several visits.
     - [data-checklist] ticks are remembered per viewer (vr.guides.checks) and counted
     - [data-copy-link] / [data-copy-phrase] copy to the clipboard
     - .g-sample lights its risky phrases when it scrolls into view
   Cards (index + "Đọc thêm")
     - each cover's checklist crop shows this viewer's own ticks (vr.guides.checks): the count,
       the bar and the first three items, so it moves once they tick items in the article
   Index  [data-path] (the six cards, in reading order)
     - read guides get an "Đã đọc" badge on their cards (and the card .is-read);
       "Bạn đã đọc n/6 bài" only appears once at least one guide is read
     - .gd-try: question 1 of the readiness quiz; an answer is handed to the quiz (vr.readiness)
*/
(function () {
  "use strict";

  const VR = window.VR || {};
  const store = VR.store || { get: (k, f) => f, set: () => false };
  const fold = VR.fold || ((s) => String(s || "").toLowerCase());
  const esc = VR.escape || ((s) => String(s));
  const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const reduced = Boolean(VR.reducedMotion);
  const READ_KEY = "vr.guides.read";
  const SEEN_KEY = "vr.guides.seen";
  const CHECK_KEY = "vr.guides.checks";
  const MOBILE = 1024;           // ≤ this width the TOC is a bar (matches guides.css)
  const TOC_BAR = 54;            // height of that bar
  // reading credit: a part needs (characters / CPS) seconds on screen, clamped to MIN_S..MAX_S.
  // 45 characters a second is about three times a normal Vietnamese reading pace: quick
  // skimming still counts, scrolling past does not.
  const CPS = 45;
  const MIN_S = 3;
  const MAX_S = 20;

  const readMap = () => store.get(READ_KEY, {}) || {};
  const onReady = VR.onReady || ((fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn()));

  /** Show the "Đã đọc" badge on every card of a guide this viewer finished. */
  function syncReadBadges(root) {
    const read = readMap();
    (root || document).querySelectorAll("[data-guide-card]").forEach((card) => {
      const badge = card.querySelector("[data-read-badge]");
      if (badge) badge.hidden = !read[card.dataset.guideCard];
    });
  }

  /** Fill every card cover's checklist crop from this viewer's ticks (vr.guides.checks, keyed
      "<slug>:<checklist>", one list of ticked indexes per checklist): "n/total" (or "Xong n/n"),
      the bar, and a tick on each of the three items shown (items 0–2 of the guide's checklist). */
  function syncCovers(root) {
    const checks = store.get(CHECK_KEY, {}) || {};
    (root || document).querySelectorAll("[data-cover]").forEach((cover) => {
      const countEl = cover.querySelector("[data-cover-count]");
      if (!countEl) return;
      const total = Number(countEl.dataset.total) || 0;
      const prefix = cover.dataset.cover + ":";
      const ticked = new Set();
      Object.keys(checks).forEach((key) => {
        if (key.indexOf(prefix) !== 0 || !Array.isArray(checks[key])) return;
        checks[key].forEach((i) => { if (Number.isInteger(i) && i >= 0 && i < total) ticked.add(i); });
      });
      const done = ticked.size;
      const all = total > 0 && done === total;
      countEl.textContent = all ? `Xong ${done}/${total}` : `${done}/${total}`;
      cover.classList.toggle("is-started", done > 0);
      cover.classList.toggle("is-done", all);
      const track = cover.querySelector(".gd-cover__track");
      if (track) track.style.setProperty("--p", total ? (done / total).toFixed(3) : 0);
      cover.querySelectorAll(".gd-cover__item").forEach((item, i) => item.classList.toggle("is-on", ticked.has(i)));
    });
  }

  function copyText(text, message) {
    if (VR.copy) return VR.copy(text, message);
    try { navigator.clipboard.writeText(text); } catch (_) { /* ignore */ }
    return Promise.resolve();
  }

  /* ================================================================ article */
  function initArticle(article) {
    const slug = article.dataset.guide;
    const prose = article.querySelector("[data-prose]");
    const toc = article.querySelector("[data-toc]");
    if (!prose) return;
    const header = document.querySelector("[data-header]");
    const headerH = () => (header ? header.offsetHeight : 64);
    const isMobile = () => window.innerWidth <= MOBILE;

    /* ---------- table of contents ---------- */
    const heads = Array.from(prose.querySelectorAll("h2"));
    const used = new Set();
    const items = heads.map((h, i) => {
      if (!h.id) {
        const base = slugify(h.textContent) || "phan-" + (i + 1);
        let id = base;
        let n = 2;
        while (used.has(id) || document.getElementById(id)) id = base + "-" + n++;
        h.id = id;
      }
      used.add(h.id);
      return { h, label: (h.dataset.toc || h.textContent).replace(/\s+/g, " ").trim(), num: String(i + 1).padStart(2, "0") };
    });

    const list = toc && toc.querySelector("[data-toc-list]");
    const current = toc && toc.querySelector("[data-toc-current]");
    const toggle = toc && toc.querySelector("[data-toc-toggle]");
    const count = toc && toc.querySelector("[data-toc-count]");
    let links = [];
    if (list) {
      // the number is decoration (the list is an <ol>): hidden from the link's accessible name
      list.innerHTML = items.map((it) =>
        `<li><a class="toc__link" href="#${esc(it.h.id)}"><span class="toc__num" aria-hidden="true">${it.num}</span><span>${esc(it.label)}</span></a></li>`
      ).join("");
      links = Array.from(list.querySelectorAll(".toc__link"));
      if (count) count.textContent = items.length + " phần";
    }
    if (toc && !items.length) { const aside = toc.closest(".gd-aside"); if (aside) aside.hidden = true; }

    const setOpen = (open) => {
      if (!toc) return;
      toc.classList.toggle("is-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    if (toggle) toggle.addEventListener("click", () => setOpen(!toc.classList.contains("is-open")));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toc && toc.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", (event) => {
      if (toc && toc.classList.contains("is-open") && !toc.contains(event.target)) setOpen(false);
    });
    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        if (!target) return;
        event.preventDefault();
        setOpen(false);
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        try { history.replaceState(null, "", link.hash); } catch (_) { /* file:// */ }
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    });

    /* ---------- scroll: current section + position bar ---------- */
    const bar = document.querySelector("[data-read-bar]");
    let active = -2;
    let ticking = false;

    const update = () => {
      ticking = false;
      const top = headerH();
      // a section becomes current once its heading passes ~a third of the visible area
      const line = top + (isMobile() ? TOC_BAR : 0) + Math.min(260, window.innerHeight * 0.28);

      let idx = -1;
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].h.getBoundingClientRect().top - line <= 0) idx = i; else break;
      }
      if (idx !== active) {
        active = idx;
        links.forEach((a, i) => {
          if (i === idx) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
        if (current) current.textContent = idx >= 0 ? `${items[idx].num} · ${items[idx].label}` : "Mở đầu";
      }

      if (bar) {
        const rect = prose.getBoundingClientRect();
        const span = rect.height - (window.innerHeight - top);
        const p = Math.min(1, Math.max(0, span > 0 ? (top - rect.top) / span : (rect.top < top ? 1 : 0)));
        bar.style.setProperty("--p", p.toFixed(4));
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    /* ---------- reading credit ---------- */
    // one part per TOC section, split on the prose's direct children. The intro has no TOC
    // row, so it is read together with section 01 (that part starts at the top of the prose):
    // the meter's "n/6" then always counts the same sections the TOC lists.
    // Keys stay what they were when the intro was a part of its own (section j = j + 1 after
    // an intro), so sections credited on an earlier visit (vr.guides.seen) still count.
    const parts = [];
    let part = { head: null, anchor: prose, chars: 0 };
    parts.push(part);
    Array.from(prose.children).forEach((el) => {
      if (el.tagName === "H2") {
        if (!part.head) { part.head = el; part.hadIntro = part.chars > 0; }   // intro + section 01
        else { part = { head: el, anchor: el, chars: 0 }; parts.push(part); }
      }
      part.chars += (el.textContent || "").replace(/\s+/g, " ").trim().length;
    });
    const reading = parts.filter((p) => p.chars > 0);
    const keyShift = reading.length && reading[0].hadIntro ? 1 : 0;
    reading.forEach((p, i) => {
      p.key = i + keyShift;
      p.need = Math.min(MAX_S, Math.max(MIN_S, Math.round(p.chars / CPS)));
      p.have = 0;
    });
    const partByHead = new Map(reading.filter((p) => p.head).map((p) => [p.head, p]));
    const isDone = (p) => p.have >= p.need;

    let markedRead = Boolean(readMap()[slug]);
    const seenBefore = (store.get(SEEN_KEY, {}) || {})[slug];
    reading.forEach((p) => {
      if (markedRead || (Array.isArray(seenBefore) && seenBefore.indexOf(p.key) !== -1)) p.have = p.need;
    });

    // the meter counts whole sections ("Phần đã đọc 2/6", one segment per TOC row) and stays
    // hidden until the first one is earned: a quick skim shows the position bar only, never
    // a "3%" next to a bar that is already halfway across
    const meter = toc && toc.querySelector("[data-read-meter]");
    const track = toc && toc.querySelector("[data-read-track]");
    const meterText = toc && toc.querySelector("[data-read-text]");
    const meterLabel = toc && toc.querySelector("[data-read-label]");
    const segs = [];
    if (track) {
      track.innerHTML = reading.map(() => "<i></i>").join("");
      segs.push(...track.children);
    }

    /** Parts that fill a real share of the visible area right now. */
    const partsOnScreen = () => {
      const top = headerH() + (isMobile() ? TOC_BAR : 0);
      const bottom = window.innerHeight;
      const band = bottom - top;
      const end = prose.getBoundingClientRect().bottom;
      const tops = reading.map((p) => p.anchor.getBoundingClientRect().top);
      return reading.filter((p, i) => {
        const a = tops[i];
        const b = i + 1 < reading.length ? tops[i + 1] : end;
        const shown = Math.min(b, bottom) - Math.max(a, top);
        return shown > 0 && shown >= Math.min(band * 0.4, (b - a) * 0.6);
      });
    };

    let shownBefore = null;
    const render = () => {
      const done = reading.every(isDone);
      const n = reading.filter(isDone).length;
      segs.forEach((seg, i) => seg.classList.toggle("is-on", isDone(reading[i])));
      const count = `${n}/${reading.length}<span class="sr-only"> phần</span>`;
      if (meterText && meterText.innerHTML !== count) meterText.innerHTML = count;
      if (meterLabel) meterLabel.textContent = done ? "Đã đọc xong" : "Phần đã đọc";
      if (meter) {
        meter.classList.toggle("is-done", done);
        const show = n > 0;
        meter.hidden = !show;
        // a fade the first time it appears during this visit, not on load for a returning reader
        if (show && shownBefore === false && !reduced) meter.classList.add("is-new");
        shownBefore = show;
      }
      links.forEach((a, i) => {
        const p = partByHead.get(items[i].h);
        a.classList.toggle("is-read", Boolean(p && isDone(p)));
      });
      return done;
    };

    let timer = 0;
    const stop = () => { clearInterval(timer); timer = 0; };
    const credit = () => {
      if (document.hidden) return;
      let changed = false;
      partsOnScreen().forEach((p) => {
        if (isDone(p)) return;
        p.have += 1;
        if (isDone(p)) changed = true;
      });
      if (changed) {
        const all = store.get(SEEN_KEY, {}) || {};
        all[slug] = reading.filter(isDone).map((p) => p.key);
        store.set(SEEN_KEY, all);
      }
      if (render() && !markedRead) {
        markedRead = true;
        const read = readMap();
        read[slug] = new Date().toISOString();
        store.set(READ_KEY, read);
        if (VR.toast) VR.toast("Đã đọc xong. Bài này được đánh dấu trong mục Hướng dẫn.");
      }
      if (markedRead) stop();
    };
    const start = () => { if (!timer && !markedRead && !document.hidden) timer = setInterval(credit, 1000); };
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    render();
    start();

    /* ---------- checklists ---------- */
    article.querySelectorAll("[data-checklist]").forEach((box) => {
      const key = slug + ":" + box.dataset.checklist;
      const inputs = Array.from(box.querySelectorAll('input[type="checkbox"]'));
      const countEl = box.querySelector("[data-checklist-count]");
      const fill = box.querySelector("[data-checklist-track]");
      const saved = (store.get(CHECK_KEY, {}) || {})[key] || [];
      inputs.forEach((input, i) => { input.checked = saved.indexOf(i) !== -1; });
      const renderList = () => {
        const done = inputs.filter((i) => i.checked).length;
        const all = inputs.length;
        box.classList.toggle("is-done", done === all && all > 0);
        if (countEl) countEl.textContent = done === all && all > 0 ? `Xong ${done}/${all}` : `${done}/${all}`;
        if (fill) fill.style.setProperty("--p", all ? (done / all).toFixed(3) : 0);
      };
      inputs.forEach((input) => input.addEventListener("change", () => {
        const all = store.get(CHECK_KEY, {}) || {};
        all[key] = inputs.map((x, i) => (x.checked ? i : -1)).filter((i) => i !== -1);
        store.set(CHECK_KEY, all);
        renderList();
        syncCovers(document);
        if (box.classList.contains("is-done") && VR.toast) VR.toast("Xong cả danh sách. Làm tốt lắm!");
      }));
      renderList();
    });

    /* ---------- copy link / copy phrase ---------- */
    document.querySelectorAll("[data-copy-link]").forEach((btn) => {
      btn.addEventListener("click", () => copyText(location.href.split("#")[0], "Đã sao chép liên kết bài viết"));
    });
    article.querySelectorAll("[data-copy-phrase]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".phrase");
        const text = row ? row.querySelector(".phrase__en").textContent.trim() : "";
        if (!text) return;
        copyText(text, "Đã sao chép câu tiếng Anh");
        const use = btn.querySelector("use");
        btn.classList.add("is-done");
        if (use) use.setAttribute("href", "#i-check");
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.classList.remove("is-done"); if (use) use.setAttribute("href", "#i-copy"); }, 1600);
      });
    });

    /* ---------- sample message ---------- */
    article.querySelectorAll(".g-sample").forEach((el) => {
      if (VR.inView && !reduced) VR.inView(el, () => el.classList.add("is-live"), { threshold: 0.6 });
      else el.classList.add("is-live");
    });

    syncReadBadges(document);
    syncCovers(document);
  }

  /* ================================================================ index */
  /** Read counter over the index's cards ("Bạn đã đọc n/6 bài", hidden at 0) + a class on each read card. */
  function initPath(root) {
    const read = readMap();
    const cards = Array.from(root.querySelectorAll("[data-guide-card]"));
    const slugs = new Set(cards.map((card) => card.dataset.guideCard));
    cards.forEach((card) => card.classList.toggle("is-read", Boolean(read[card.dataset.guideCard])));
    let n = 0;
    slugs.forEach((s) => { if (read[s]) n += 1; });
    const summary = root.querySelector("[data-read-summary]");
    const countEl = root.querySelector("[data-read-count]");
    if (countEl) countEl.textContent = String(n);
    if (summary) summary.hidden = n === 0;   // a first visit sees no "0/6" counter
  }

  /** Question 1 of the readiness quiz, live on the index: picking an answer saves it in the
      quiz's own state (tool-quiz.js, "vr.readiness": {answers[10], step, done, at, ticks}) and
      the link opens the tool on question 2. A finished quiz is never overwritten. */
  const QUIZ_KEY = "vr.readiness";
  const QUIZ_N = 10;
  function initQuizTry(root) {
    root.addEventListener("click", (event) => {
      const opt = event.target.closest("[data-quiz-answer]");
      if (!opt) return;
      const v = Number(opt.dataset.quizAnswer);
      if (!(v >= 0 && v <= 3)) return;
      const s = store.get(QUIZ_KEY, null);
      const valid = s && Array.isArray(s.answers) && s.answers.length === QUIZ_N;
      if (valid && s.done) return;
      const state = valid ? s : { answers: new Array(QUIZ_N).fill(null), step: 0, done: false, at: "", ticks: {} };
      state.answers[0] = v;
      state.step = Math.max(Number(state.step) || 0, 1);
      store.set(QUIZ_KEY, state);
    });
  }

  onReady(() => {
    const article = document.querySelector("[data-guide]");
    if (article) initArticle(article);
    const path = document.querySelector("[data-path]");
    if (path) { initPath(path); syncReadBadges(document); syncCovers(document); }
    const quizTry = document.querySelector(".gd-try");
    if (quizTry) initQuizTry(quizTry);
    // back from an article (page restored from the back/forward cache): its ticks and "Đã đọc" are new
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      if (path) initPath(path);
      syncReadBadges(document);
      syncCovers(document);
    });
  });
})();

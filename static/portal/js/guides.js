/* Việt Remote — guides (/huong-dan/, the six step-by-step guides). Needs common.js (VR). Direction A (INNER_A_SPEC).
   A guide page: the reader ticks each step's checkpoint; the ticks live in localStorage (vr.guides.steps:
   { slug: [step numbers] }, never sent anywhere) and drive the navigator (rail, sticky bar, bottom sheet), the bars,
   the finish line and, on /huong-dan/, each guide's progress. The navigator follows the step being read; the path's
   line under the numerals draws as you read (transform only).
   The index: the journey drives ONE large preview through the kit's switcher (ed.js, ed.css §12); here, each
   guide's progress on its row and its panel, and the quiz's panel handing question 1 to the readiness tool
   (vr.readiness). */
(function () {
  "use strict";

  const VR = window.VR;                      // common.js, loaded first on every page
  const { store, onReady } = VR;
  const toast = (text, tone) => VR.toast(text, { tone: tone || "ok" });
  const reduced = VR.reducedMotion;
  const STEPS = "vr.guides.steps";
  const QUIZ = "vr.readiness";
  const QN = 10;
  const allTicks = () => store.get(STEPS, {}) || {};
  const ticksOf = (slug, total) => new Set([].concat(allTicks()[slug] || []).filter((n) => Number.isInteger(n) && n >= 1 && n <= total));

  /* ---------------- a guide */
  function initGuide(guide) {
    const slug = guide.dataset.guide;
    const total = Number(guide.dataset.total) || 0;
    const steps = Array.from(guide.querySelectorAll("[data-step]"));
    const ticked = ticksOf(slug, total);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));
    const navLinks = $$("[data-nav-link]");
    const finish = guide.querySelector("[data-finish]");
    const finishLabel = guide.querySelector("[data-finish-label]");
    const list = guide.querySelector("[data-steps]");

    const paint = () => {
      const done = ticked.size;
      const first = steps.find((li) => !ticked.has(Number(li.dataset.step)));
      steps.forEach((li) => {
        const n = Number(li.dataset.step);
        const on = ticked.has(n);
        li.classList.toggle("is-done", on);
        li.classList.toggle("is-current", li === first);
        const box = li.querySelector("[data-step-check]");
        if (box) box.checked = on;
        const state = li.querySelector("[data-step-state]");
        if (state) state.hidden = !on;
      });
      navLinks.forEach((a) => {
        const on = ticked.has(Number(a.dataset.navLink));
        a.classList.toggle("is-done", on);
        const sr = a.querySelector("[data-nav-sr]");
        if (sr) sr.hidden = !on;
      });
      $$("[data-steps-done]").forEach((el) => VR.liveCount(el, String(done)));
      $$("[data-steps-bar]").forEach((el) => el.style.setProperty("--p", (done / total).toFixed(3)));
      $$("[data-steps-reset]").forEach((el) => { el.hidden = !done; });
      if (finish) finish.classList.toggle("is-done", done === total);
      list.classList.add("is-painted");
      if (finishLabel) {
        finishLabel.textContent = done === total ? `Xong cả ${total} bước. Làm tốt lắm!`
          : done ? `Đã xong ${done}/${total} bước · còn ${total - done}` : "Đánh dấu từng bước khi làm xong";
      }
    };
    const save = () => store.set(STEPS, Object.assign(allTicks(), { [slug]: Array.from(ticked).sort((a, b) => a - b) }));

    guide.addEventListener("change", (event) => {
      const box = event.target.closest("[data-step-check]");
      if (!box) return;
      const n = Number(box.closest("[data-step]").dataset.step);
      const was = ticked.size;
      if (box.checked) ticked.add(n); else ticked.delete(n);
      save();
      paint();
      if (was < total && ticked.size === total) toast(`Xong cả ${total} bước. Làm tốt lắm!`);
    });
    document.addEventListener("click", (event) => {
      const reset = event.target.closest("[data-steps-reset]");
      if (reset) {
        ticked.clear();
        save();
        paint();
        toast("Đã bỏ đánh dấu mọi bước.", "info");
        // from the sheet (phones, tablets): close it, focus goes back to the bar that opened it
        const sheet = reset.closest(".rv-sheet");
        if (sheet) { VR.sheet.close(sheet); return; }
        const first = guide.querySelector("[data-step-check]");
        if (first) first.focus({ preventScroll: true });
        return;
      }
      const link = event.target.closest("[data-nav-link]");
      const target = link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      const sheet = link.closest(".rv-sheet");
      if (sheet) VR.sheet.close(sheet);
      try { history.replaceState(history.state, "", "#" + target.id); } catch (_) { /* file:// */ }
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        const h = target.querySelector("h2");
        if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      });
    });

    /* the step being read: the navigator's lit row, the sticky bar's label; the position bar under the header */
    const header = document.querySelector("[data-header]");
    const bar = document.querySelector("[data-read-bar]");
    const labels = $$("[data-nav-current]");
    const nums = $$("[data-nav-num]");
    const poss = $$("[data-nav-pos]");
    let tops = [];
    let span = { top: 0, h: 1 };
    const measure = () => {
      const y = window.scrollY;
      tops = steps.map((li) => li.getBoundingClientRect().top + y);
      const r = list.getBoundingClientRect();
      span = { top: r.top + y, h: r.height };
    };
    let active = -1;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const off = header ? header.offsetHeight : 64;
      const line = y + off + Math.min(260, window.innerHeight * 0.32);
      let idx = 0;
      for (let i = 1; i < tops.length; i += 1) { if (tops[i] <= line) idx = i; else break; }
      if (idx !== active && steps.length) {
        active = idx;
        navLinks.forEach((a) => (Number(a.dataset.navLink) === idx + 1 ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
        const title = steps[idx].querySelector("h2");
        labels.forEach((el) => { el.textContent = title ? title.textContent.trim() : ""; });
        nums.forEach((el) => { el.textContent = String(idx + 1); });
        poss.forEach((el) => { el.textContent = String(idx + 1); });
      }
      if (bar) {
        const p = (y + off + window.innerHeight * 0.5 - span.top) / Math.max(1, span.h);
        bar.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    const remeasure = () => { measure(); onScroll(); };
    measure();
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", remeasure, { passive: true });
    addEventListener("load", remeasure);
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(list);
    if (document.fonts) document.fonts.ready.then(remeasure);
    paint();
    // back from the next guide (the back/forward cache): ticks made in another tab are new
    addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      ticked.clear();
      ticksOf(slug, total).forEach((n) => ticked.add(n));
      paint();
    });
  }

  /* the starter guide's last step: this viewer's own saved jobs, counted by status (common.js vr.saved) */
  function initTracker(box) {
    const items = Object.values((VR.saved && VR.saved.all()) || {});
    const counts = {};
    items.forEach((it) => { const k = it.status || "saved"; counts[k] = (counts[k] || 0) + 1; });
    const max = Math.max(1, ...Object.values(counts));
    box.querySelectorAll("[data-status]").forEach((row) => {
      const n = counts[row.dataset.status] || 0;
      row.querySelector("[data-tracker-n]").textContent = String(n);
      row.querySelector(".rv-bar").style.setProperty("--v", (n / max).toFixed(3));
    });
    const total = box.querySelector("[data-tracker-total]");
    if (total) total.textContent = `${items.length} việc`;
    const note = box.querySelector("[data-tracker-note]");
    if (note && items.length) note.textContent = "Từ Việc đã lưu trên máy bạn: mở để cập nhật trạng thái.";
  }

  /* ---------------- the index: each guide's progress (this viewer's ticks) */
  function syncIndex(root) {
    const ticks = allTicks();
    root.querySelectorAll("[data-guide-card]").forEach((card) => {
      const total = Number(card.dataset.total) || 1;
      const done = [].concat(ticks[card.dataset.guideCard] || []).filter((n) => n >= 1 && n <= total).length;
      card.classList.toggle("is-started", done > 0);
      card.classList.toggle("is-finished", done === total);
      card.querySelectorAll("[data-card-bar]").forEach((el) => el.style.setProperty("--p", (done / total).toFixed(3)));
      card.querySelectorAll("[data-card-done]").forEach((el) => { el.textContent = String(done); });
      card.querySelectorAll("[data-card-progress]").forEach((el) => { el.hidden = !done; });
      card.querySelectorAll("[data-card-tick]").forEach((el) => {
        el.classList.toggle("is-done", [].concat(ticks[card.dataset.guideCard] || []).includes(Number(el.dataset.cardTick)));
      });
      const go = card.querySelector("[data-card-go]");
      if (go) {
        const next = Array.from({ length: total }, (_, i) => i + 1).find((n) => ![].concat(ticks[card.dataset.guideCard] || []).includes(n));
        go.textContent = done === total ? "Xem lại các bước" : done ? `Làm tiếp bước ${next}` : go.dataset.cardGo;
      }
    });
  }

  /* question 1 of the readiness quiz: a returning viewer sees their answer and where they stopped; a pick is stored
     as the quiz does (never over a finished one), the tool opens on question 2 */
  function initQuiz(card) {
    const opts = Array.from(card.querySelectorAll("[data-quiz-answer]"));
    const state = () => { const s = store.get(QUIZ, null); return s && Array.isArray(s.answers) && s.answers.length === QN ? s : null; };
    const paint = () => {
      const s = state();
      const answered = s ? s.answers.filter((v) => [0, 1, 2, 3].includes(v)).length : 0;
      const done = Boolean(s && s.done && answered === QN);
      opts.forEach((a) => {
        a.classList.remove("is-picked");
        if (s && s.answers[0] === Number(a.dataset.quizAnswer)) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      const bar = card.querySelector("[data-quiz-bar]");
      if (bar) Array.from(bar.children).forEach((seg, i) => seg.classList.toggle("is-on", i < Math.max(1, answered)));
      const resume = card.querySelector("[data-quiz-resume]");
      const label = done ? "Xem kết quả của bạn" : `Đã trả lời ${answered}/${QN} · Làm tiếp`;
      resume.hidden = !answered;
      resume.textContent = label;
      const row = document.querySelector("[data-quiz-row]");
      if (row) {
        if (!row.dataset.text) row.dataset.text = row.textContent;
        row.textContent = answered ? label : row.dataset.text;
      }
    };
    card.addEventListener("click", (event) => {
      const opt = event.target.closest("[data-quiz-answer]");
      if (!opt) return;
      opts.forEach((a) => a.classList.toggle("is-picked", a === opt));  // the pick shows while the quiz loads
      const s = state() || { answers: new Array(QN).fill(null), step: 0, done: false, at: "", ticks: {} };
      if (s.done) return;
      s.answers[0] = Number(opt.dataset.quizAnswer);
      s.step = Math.max(Number(s.step) || 0, 1);
      store.set(QUIZ, s);
    });
    paint();
    return paint;
  }

  onReady(() => {
    const guide = document.querySelector("[data-guide]");
    if (guide) initGuide(guide);
    document.querySelectorAll("[data-tracker]").forEach(initTracker);
    const quiz = document.querySelector("[data-quiz]");
    const repaint = quiz ? initQuiz(quiz) : null;
    syncIndex(document);
    addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      syncIndex(document);
      if (repaint) repaint();
    });
  });
})();

/* Việt Remote — Blog (/blog/ and its posts). Needs common.js (VR). DS §13, §26.
   A post: the contents built from its h2s (card from 1200 px, the sticky bar + the kit's bottom sheet below), the
   section being read, the position bar under the header, "copy the address", the sample message lighting up, and a
   "read" mark once the end of the text is reached (localStorage vr.blog.read, never sent anywhere), which the index
   and the "Đọc tiếp" cards show as "Đã đọc"; a two-tab view inside the text ([data-ats]). */
(function () {
  "use strict";

  const VR = window.VR;
  const { store, fold, escape: esc, onReady } = VR;
  const reduced = VR.reducedMotion;
  const READ = "vr.blog.read";
  const readMap = () => store.get(READ, {}) || {};

  function syncRead(root) {
    const read = readMap();
    root.querySelectorAll("[data-post-card]").forEach((card) => {
      const on = Boolean(read[card.dataset.postCard]);
      card.classList.toggle("is-read", on);
      card.querySelectorAll("[data-read-badge], [data-read-sr]").forEach((el) => { el.hidden = !on; });
    });
  }

  function initPost(article) {
    const slug = article.dataset.post;
    const prose = article.querySelector("[data-prose]");
    if (!prose) return;
    const header = document.querySelector("[data-header]");
    const tocBar = article.querySelector(".bl-tocbar");

    /* contents */
    const items = Array.from(prose.querySelectorAll(":scope > h2")).map((h, i) => {
      const label = (h.dataset.toc || h.textContent).replace(/\s+/g, " ").trim();
      if (!h.id) {
        const base = fold(label).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "phan-" + (i + 1);
        let id = base;
        for (let k = 2; document.getElementById(id); k += 1) id = base + "-" + k;
        h.id = id;
      }
      return { h, label };
    });
    const html = items.map((it) => `<li><a class="bl-toc__link" href="#${esc(it.h.id)}">${esc(it.label)}</a></li>`).join("");
    const links = Array.from(article.querySelectorAll("[data-toc-list]")).map((list) => {
      list.innerHTML = html;
      return Array.from(list.children, (li) => li.firstElementChild);
    });
    const toc = article.querySelector("[data-toc]");
    if (toc && !items.length) toc.hidden = true;

    const jumpTo = (target, smooth) => {
      target.scrollIntoView({ behavior: smooth && !reduced ? "smooth" : "auto", block: "start" });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    article.addEventListener("click", (event) => {
      const copy = event.target.closest("[data-copy-link]");
      if (copy) {
        // from the sheet: close it first, so the toast is not drawn under it (the sheet sits above the toasts)
        const sheet = copy.closest(".rv-sheet");
        if (sheet) VR.sheet.close(sheet);
        VR.copy(location.href.split("#")[0], "Đã sao chép liên kết bài viết", copy);
        return;
      }
      const link = event.target.closest(".bl-toc__link");
      const target = link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      const sheet = link.closest(".rv-sheet");
      if (sheet) VR.sheet.close(sheet);
      try { history.replaceState(history.state, "", "#" + target.id); } catch (_) { /* file:// */ }
      requestAnimationFrame(() => jumpTo(target, true));
    });

    /* the section being read + the position bar */
    const bar = document.querySelector("[data-read-bar]");
    const labels = article.querySelectorAll("[data-toc-current]");
    const pos = article.querySelectorAll("[data-toc-pos]");
    let m = { tops: [], top: 0, h: 0, off: 64 };
    const measure = () => {
      const y = window.scrollY;
      const r = prose.getBoundingClientRect();
      const barOn = tocBar && tocBar.offsetParent && window.innerWidth <= 1199;
      m = { tops: items.map((it) => it.h.getBoundingClientRect().top + y), top: r.top + y, h: r.height,
            off: (header ? header.offsetHeight : 64) + (barOn ? tocBar.offsetHeight + 8 : 0) };
    };
    let active = -2;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const line = y + m.off + Math.min(240, window.innerHeight * 0.28);
      let idx = -1;                                       // -1: the intro, before the first h2
      for (let i = 0; i < m.tops.length; i += 1) { if (m.tops[i] <= line) idx = i; else break; }
      if (idx !== active) {
        active = idx;
        links.forEach((set) => set.forEach((a, i) => (i === idx ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"))));
        labels.forEach((el) => { el.textContent = idx >= 0 ? items[idx].label : "Mở đầu"; });
        pos.forEach((el) => { el.textContent = idx >= 0 ? `${idx + 1}/${items.length}` : ""; });
      }
      if (bar) {
        const span = m.h - (window.innerHeight - m.off);
        const p = span > 0 ? (y + m.off - m.top) / span : Number(y + m.off > m.top);
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
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(prose);
    if (document.fonts) document.fonts.ready.then(remeasure);
    const deep = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (deep && prose.contains(deep)) requestAnimationFrame(() => { jumpTo(deep, false); remeasure(); });

    /* the sample message lights up once on screen */
    article.querySelectorAll(".g-sample").forEach((el) => {
      if (!reduced) VR.inView(el, () => el.classList.add("is-live"), { threshold: 0.6 });
      else el.classList.add("is-live");
    });

    /* read: the end of the text reached after some time on the page (scrolling straight past does not count) */
    const end = article.querySelector("[data-post-end]");
    const born = Date.now();
    if (end && !readMap()[slug] && window.IntersectionObserver) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting) || Date.now() - born < 20000) return;
        io.disconnect();
        store.set(READ, Object.assign(readMap(), { [slug]: new Date().toISOString() }));
        syncRead(document);
      });
      io.observe(end);
    }
  }

  /* a two-tab view in the text (the ATS post: "Bạn thấy" / "ATS đọc"): the panes share one cell, so switching never
     moves the text below; arrows, Home and End move between the tabs. Without JS both panes show, one under the other. */
  function initTabs(fig) {
    const tabs = Array.from(fig.querySelectorAll("[data-ats-tab]"));
    const panes = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
    if (tabs.length < 2 || panes.some((pane) => !pane)) return;
    const show = (i, focus) => {
      tabs.forEach((tab, j) => {
        tab.setAttribute("aria-selected", j === i ? "true" : "false");
        tab.tabIndex = j === i ? 0 : -1;
        panes[j].classList.toggle("is-on", j === i);
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => show(i));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        const j = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[event.key];
        if (j === undefined) return;
        event.preventDefault();
        show(j, true);
      });
    });
    fig.classList.add("is-tabs");
    show(Math.max(0, tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true")));
  }

  onReady(() => {
    document.querySelectorAll("[data-ats]").forEach(initTabs);
    const article = document.querySelector("[data-post]");
    if (article) initPost(article);
    syncRead(document);
    addEventListener("pageshow", (event) => { if (event.persisted) syncRead(document); });
  });
})();

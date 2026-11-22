/* Việt Remote — jobs group (needs common.js / window.VR).

   1. Job board  [data-jobs]   /viec-lam/ and /nganh/<slug>/
      The server renders the first 30 rows; this loads /data/jobs.json and takes over:
      instant diacritic-insensitive search (word prefixes, phrases, Vietnamese → English synonyms),
      faceted filters with live counts, sort, URL query sync, "Xem thêm" pages of 30 (the depth is
      kept in history.state for Back), active-filter pills, an empty state that suggests which
      filter to drop, the "Tuyển ở Việt Nam" rail (hidden once anything is filtered), and the
      mobile bottom sheet (drag the grabber down to close).
      Query names: q · ky-nang (one exact skill) · nganh · trinh-do · hinh-thuc · mui-gio (comma lists) ·
      luong=1 · vn=1 · nguoi-moi=1 · dang-trong=1|3|7 · sap-xep=moi|luong (none = "Đề xuất")
      Sort: "Đề xuất" is the order of /data/jobs.json (catalog.rank_jobs on the server, the same order
      as the server-rendered rows); "Mới nhất" by posting time; "Lương cao nhất" by job.pay_rank.
      On a field page an empty ?nganh= means "every field" and shows a "Tất cả ngành" pill.
   2. Job detail [data-jd-body] readable description, the long-description fold (copy link and the phone
      action bar are the kit's: [data-copy-text], [data-actionbar]).
   3. Salary     [data-sl-chart] hourly / monthly toggle kept in the URL (every figure is in the server HTML).
*/
(function () {
  "use strict";

  const VR = window.VR;
  if (!VR || !VR.onReady) return;

  const PAGE = 30;
  const FACETS = ["nganh", "trinh-do", "hinh-thuc", "mui-gio"];
  const FLAGS = ["luong", "vn", "nguoi-moi"];
  const SORTS = new Set(["moi", "luong"]);
  const FACET_KEY = { nganh: "field", "trinh-do": "level", "hinh-thuc": "employment", "mui-gio": "timezone" };
  const FLAG_LABEL = { luong: "Lương công khai", vn: "Tuyển ở Việt Nam", "nguoi-moi": "Hợp người mới" };
  const WITHIN_LABEL = { 1: "Đăng trong 24 giờ", 3: "Đăng trong 3 ngày", 7: "Đăng trong 7 ngày" };
  const BEGINNER = new Set(["moi-bat-dau", "junior"]);
  const POPULAR = ["Video editor", "Virtual assistant", "Graphic design", "Social media", "Python", "Data entry", "Customer service"];

  /* Search. Most listings are English while people type Vietnamese, and Vietnamese words are
     several syllables ("kế toán"), so a plain substring AND matches noise ("ke" in marketing,
     "toan" in "Toàn thời gian"). The query is folded, known Vietnamese phrases become OR groups
     of English equivalents, every other token must start a word (2-letter tokens: the whole
     word), and a multi-word query is matched as a phrase when the phrase finds jobs. */
  const ZW = /[​-‍⁠﻿]/g;
  const norm = (s) => VR.fold(String(s ?? "").replace(ZW, "")).replace(/[^a-z0-9+#]+/g, " ").trim();
  const SYNONYMS = [
    ["ban hang", "sales", "telesales", "kinh doanh"],
    ["kinh doanh", "sales", "business development"],
    ["nhan vien kinh doanh", "sales", "account executive"],
    ["nhap lieu", "data entry"],
    ["bien tap video", "video edit", "dung video", "edit video"],
    ["dung video", "video edit", "bien tap video", "edit video"],
    ["edit video", "video edit", "dung video"],
    ["ke toan", "accounting", "accountant", "bookkeep"],
    ["gia su", "tutor$", "tutors$", "tutoring", "teacher", "giao vien"],
    ["giao vien", "teacher", "tutor$", "tutors$", "tutoring", "instructor"],
    ["tro ly ao", "virtual assistant", "tro ly"],
    ["tro ly", "assistant"],
    ["thiet ke do hoa", "graphic design", "graphic designer"],
    ["thiet ke", "design"],
    ["lap trinh vien", "developer", "engineer", "lap trinh"],
    ["lap trinh", "developer", "programming", "engineer"],
    ["ban thoi gian", "part time", "parttime"],
    ["part time", "ban thoi gian", "parttime"],
    ["toan thoi gian", "full time", "fulltime"],
    ["full time", "toan thoi gian", "fulltime"],
    ["cham soc khach hang", "customer service", "customer support", "cskh"],
    ["cskh", "customer service", "customer support", "cham soc khach hang"],
    ["tieng anh", "english"],
    ["tieng nhat", "japanese"],
    ["tieng trung", "chinese", "mandarin"],
    ["tieng han", "korean"],
    ["viet bai", "content writ", "copywrit", "writer"],
    ["dich thuat", "translat", "bien dich"],
    ["phien dich", "interpret", "translat"],
    ["nhan su", "human resource", "recruit", "tuyen dung"],
    ["tuyen dung", "recruit", "talent acquisition"],
    ["tiep thi", "marketing"],
    ["quang cao", "advertising", "media buy", "paid ads"],
    ["mang xa hoi", "social media"],
    ["phan tich du lieu", "data analy"],
    ["du lieu", "data"],
    ["kiem thu", "tester", "qa", "testing"],
    ["thuc tap", "intern"],
    ["nguoi moi", "entry level", "junior", "beginner", "moi bat dau"],
    ["chinh sua anh", "photo edit", "retouch"],
    ["hoat hinh", "animat", "motion graphic"],
    ["quan ly du an", "project manag"],
    ["tai chinh", "finance", "financial"],
    ["sang tao noi dung", "content creat", "ugc"],
    ["noi dung", "content"],
    ["full stack", "fullstack"],
    ["fullstack", "full stack"],
  ].map(([key, ...alts]) => [key, [key, ...alts]]).sort((a, b) => b[0].length - a[0].length);
  /** word-prefix match in a normalized " … " haystack; the last word must be whole when it has
      1–2 letters ("ai", "qa") or the synonym ends in "$" ("tutor$" is not "tutorial") */
  const hasWord = (hay, w) => {
    if (w.endsWith("$")) return hay.includes(" " + w.slice(0, -1) + " ");
    const last = w.slice(w.lastIndexOf(" ") + 1);
    return hay.includes(" " + w + (last.length <= 2 ? " " : ""));
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const icon = (name, cls) => VR.icon ? VR.icon(name, cls) : `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const fmtInt = (n) => (VR.fmt ? VR.fmt.int(n) : String(n));

  /* ================================================================ 1 job board */
  function initBoard(root) {
    const panel = $("[data-panel]", root);
    const results = $("[data-results]", root);
    const moreWrap = $("[data-more-wrap]", root);
    const moreBtn = $("[data-load-more]", root);
    const activeBox = $("[data-active]", root);
    const countLine = $("[data-count-line]", root);
    const fab = $("[data-open]", root);
    const openBtns = $$("[data-open-panel]", root);   // the inline "Bộ lọc" beside the quick filters (tablets, phones)
    const sortNote = $("[data-sort-note]", root);
    const scrim = $("[data-scrim]", root);
    const rail = $("[data-rail]", root);
    const searchForm = $("[data-search]");
    const qInput = searchForm ? $("[data-q]", searchForm) : null;
    const qClear = searchForm ? $("[data-q-clear]", searchForm) : null;
    const presetEl = document.getElementById("jl-preset");
    let preset = {};
    try { preset = JSON.parse(presetEl ? presetEl.textContent : "{}") || {}; } catch (_) { preset = {}; }
    const presetField = preset.field || "";

    // option labels straight from the server-rendered panel
    const labels = {};
    const known = {};
    FACETS.forEach((f) => { known[f] = new Set(); });
    $$("input[type=checkbox]", panel).forEach((input) => {
      if (!FACETS.includes(input.name)) return;
      known[input.name].add(input.value);
      const text = input.closest("label").querySelector(".fopt__label");
      labels[input.name + ":" + input.value] = text ? text.textContent.trim() : input.value;
    });

    const presetLabel = labels["nganh:" + presetField] || "";
    const defaults = () => ({
      q: "", skill: "", nganh: presetField ? [presetField] : [], "trinh-do": [], "hinh-thuc": [], "mui-gio": [],
      luong: false, vn: false, "nguoi-moi": false, "dang-trong": "", sort: "",
    });
    let state = defaults();
    let shown = PAGE;
    let jobs = null;
    let list = [];
    let loaded = false;
    let loadFailed = false;
    const countLineHtml = countLine ? countLine.innerHTML : "";

    /* ---- URL <-> state */
    function readQuery() {
      const p = new URLSearchParams(window.location.search);
      const st = defaults();
      st.q = cleanQ(p.get("q"));
      st.skill = (p.get("ky-nang") || "").trim().slice(0, 80);
      FACETS.forEach((f) => {
        if (!p.has(f)) return;
        st[f] = (p.get(f) || "").split(",").map((v) => v.trim()).filter((v) => known[f].has(v));
      });
      FLAGS.forEach((f) => { st[f] = p.get(f) === "1"; });
      const within = p.get("dang-trong");
      st["dang-trong"] = WITHIN_LABEL[within] ? within : "";
      st.sort = SORTS.has(p.get("sap-xep")) ? p.get("sap-xep") : "";
      return st;
    }
    const enc = (v) => encodeURIComponent(v).replace(/%2C/gi, ",").replace(/%20/g, "+");
    function writeQuery() {
      const parts = [];
      if (state.q) parts.push("q=" + enc(state.q));
      if (state.skill) parts.push("ky-nang=" + enc(state.skill));
      FACETS.forEach((f) => {
        const v = state[f];
        const isDefault = f === "nganh" && presetField ? v.length === 1 && v[0] === presetField : !v.length;
        if (!isDefault) parts.push(f + "=" + enc(v.join(",")));
      });
      FLAGS.forEach((f) => { if (state[f]) parts.push(f + "=1"); });
      if (state["dang-trong"]) parts.push("dang-trong=" + state["dang-trong"]);
      if (state.sort) parts.push("sap-xep=" + state.sort);
      const url = window.location.pathname + (parts.length ? "?" + parts.join("&") : "") + window.location.hash;
      saveDepth(url);
    }
    /* how deep the list was opened ("Xem thêm") and where the page was, kept in this history
       entry so Back from a job restores the same rows instead of the first 30 */
    function saveDepth(url) {
      try {
        const st = Object.assign({}, window.history.state, { jlShown: shown, jlY: Math.round(window.scrollY) });
        window.history.replaceState(st, "", url || window.location.href);
      } catch (_) { /* file:// or sandbox */ }
    }

    /* ---- matching */
    function prepare(data) {
      return (data.jobs || []).map((job, i) => {
        job._i = i;
        // the field slug adds Vietnamese words for English-only listings ("ban hang", "tro ly ao")
        job._hay = " " + norm([job.title, job.company, (job.skills || []).join(" "), job.field_label,
          String(job.field || "").replace(/-/g, " "), job.level_label, job.employment_label, job.location,
          job.source_label, job.summary].join(" ")) + " ";
        job._skills = new Set((job.skills || []).map((s) => VR.fold(s)));
        const posted = Date.parse(job.posted || "");
        if (Number.isFinite(posted)) job.age_hours = Math.max(0, (Date.now() - posted) / 36e5);
        job._t = Number.isFinite(posted) ? posted : 0;
        // "Lương cao nhất": the server's order (lower bound of the range; wide ranges, fixed-price
        // projects and undisclosed pay after), so the browser and the no-JS page agree
        job._pay = Number.isFinite(job.pay_rank) ? job.pay_rank : 1e9;
        return job;
      });
    }
    /* compiled query: {active, groups: [[alt, …]], plain: [token], phrase, mode}; cached per string */
    const qCache = new Map();
    function compileQuery(q) {
      const key = String(q || "");
      if (qCache.has(key)) return qCache.get(key);
      let rest = " " + norm(key) + " ";
      const groups = [];
      SYNONYMS.forEach(([phrase, alts]) => {
        if (!rest.includes(" " + phrase + " ")) return;
        groups.push(alts);
        rest = rest.replace(" " + phrase + " ", " ");
      });
      const plain = rest.trim().split(" ").filter((t) => t.length >= 2); // "đ" alone filters nothing
      const cq = { active: groups.length > 0 || plain.length > 0, groups, plain,
        phrase: plain.length >= 2 ? plain.join(" ") : "", mode: "tokens" };
      if (cq.phrase && jobs) {
        // phrase when it finds jobs: always for Vietnamese input (syllables of one word sit together),
        // for unaccented input when it keeps at least 60% of the token matches
        let ph = 0;
        let tk = 0;
        jobs.forEach((job) => {
          if (!groupsOk(job, cq) || !cq.plain.every((t) => hasWord(job._hay, t))) return;
          tk += 1;
          if (hasWord(job._hay, cq.phrase)) ph += 1;
        });
        const accented = VR.fold(key) !== key.toLowerCase().replace(/\s+/g, " ").trim();
        if (ph > 0 && (accented || ph * 5 >= tk * 3)) cq.mode = "phrase";
      }
      if (jobs) qCache.set(key, cq);
      return cq;
    }
    const groupsOk = (job, cq) => cq.groups.every((alts) => alts.some((a) => hasWord(job._hay, a)));
    function qMatch(job, cq) {
      if (!groupsOk(job, cq)) return false;
      if (cq.mode === "phrase") return hasWord(job._hay, cq.phrase);
      return cq.plain.every((t) => hasWord(job._hay, t));
    }
    const cleanQ = (v) => String(v || "").replace(ZW, "").replace(/\s+/g, " ").trim().slice(0, 120);

    /** does job pass st, ignoring the facet/flag named `skip`; `cq` is compileQuery(st.q) */
    function match(job, st, cq, skip) {
      for (const f of FACETS) {
        if (f === skip) continue;
        const v = st[f];
        if (v.length && !v.includes(job[FACET_KEY[f]])) return false;
      }
      if (st.luong && skip !== "luong" && !(job.pay && job.pay.disclosed)) return false;
      if (st.vn && skip !== "vn" && !job.vietnam_focus) return false;
      if (st["nguoi-moi"] && skip !== "nguoi-moi" && !BEGINNER.has(job.level)) return false;
      if (st["dang-trong"] && skip !== "dang-trong" && job.age_hours > Number(st["dang-trong"]) * 24) return false;
      if (st.skill && skip !== "skill" && !job._skills.has(VR.fold(st.skill))) return false;
      if (cq.active && skip !== "q" && !qMatch(job, cq)) return false;
      return true;
    }

    function compute() {
      const cq = compileQuery(state.q);
      list = jobs.filter((job) => match(job, state, cq));
      if (state.sort === "luong") list.sort((a, b) => (a._pay - b._pay) || (a._i - b._i));
      else if (state.sort === "moi") list.sort((a, b) => (b._t - a._t) || (a._i - b._i));
      return cq;
    }

    /* faceted counts: each option counted against every other active filter */
    function updateCounts(tokens) {
      const counts = {};
      FACETS.forEach((f) => {
        const key = FACET_KEY[f];
        const c = {};
        jobs.forEach((job) => { if (match(job, state, tokens, f)) c[job[key]] = (c[job[key]] || 0) + 1; });
        counts[f] = c;
      });
      FLAGS.forEach((f) => {
        const probe = Object.assign({}, state, { [f]: true });
        let n = 0;
        jobs.forEach((job) => { if (match(job, probe, tokens, null)) n += 1; });
        counts[f] = { 1: n };
      });
      $$("[data-n]", panel).forEach((el) => {
        const [f, v] = el.dataset.n.split(":");
        const n = (counts[f] && counts[f][v]) || 0;
        el.textContent = fmtInt(n);
        const row = el.closest(".fopt");
        if (row) row.classList.toggle("is-zero", n === 0);
      });
    }

    /* ---- active filters (pills, fab count, empty-state suggestions) */
    function activeFilters(st) {
      const out = [];
      if (st.q) out.push({ kind: "q", label: `“${st.q}”`, tip: `từ khóa “${st.q}”`, drop: (s) => { s.q = ""; } });
      if (st.skill) out.push({ kind: "skill", label: `Kỹ năng: ${st.skill}`, tip: `kỹ năng “${st.skill}”`, drop: (s) => { s.skill = ""; } });
      FACETS.forEach((f) => {
        const v = st[f];
        if (f === "nganh" && presetField && v.length === 1 && v[0] === presetField) return; // the page's own field
        if (f === "nganh" && presetField && !v.length) {
          // field page with its own field unticked: every field is listed, × goes back to this field
          out.push({ kind: f, label: "Tất cả ngành", aria: `Chỉ xem ngành ${presetLabel || presetField}`,
            tip: "“Tất cả ngành”", drop: (s) => { s[f] = [presetField]; } });
          return;
        }
        v.forEach((value) => out.push({
          kind: f, label: labels[f + ":" + value] || value,
          drop: (s) => { s[f] = s[f].filter((x) => x !== value); },
        }));
      });
      FLAGS.forEach((f) => { if (st[f]) out.push({ kind: f, label: FLAG_LABEL[f], drop: (s) => { s[f] = false; } }); });
      if (st["dang-trong"]) out.push({ kind: "dang-trong", label: WITHIN_LABEL[st["dang-trong"]], drop: (s) => { s["dang-trong"] = ""; } });
      return out;
    }
    const cloneState = (st) => JSON.parse(JSON.stringify(st));

    function renderActive() {
      const items = activeFilters(state);
      root.classList.toggle("is-preset", Boolean(presetField) && state.nganh.length === 1 && state.nganh[0] === presetField);
      const panelCount = items.filter((x) => x.kind !== "q" && x.kind !== "skill").length;
      // both "Xóa lọc" buttons (panel head on desktop, sheet footer on phones) only show with a filter on
      $$("[data-clear]", panel).forEach((b) => { b.hidden = panelCount === 0; });
      $$("[data-filter-n]", root).forEach((n) => { n.textContent = String(panelCount); n.hidden = panelCount === 0; });
      [fab, ...openBtns].forEach((b) => { if (b) b.setAttribute("aria-label", panelCount ? `Bộ lọc, ${panelCount} đang bật` : "Bộ lọc"); });
      // the "Tuyển ở Việt Nam" rail belongs to the untouched board only
      if (rail) rail.hidden = items.length > 0 || Boolean(state.sort);
      activeBox._items = items;
      if (!items.length) { activeBox.hidden = true; activeBox.innerHTML = ""; return; }
      activeBox.hidden = false;
      activeBox.innerHTML = items.map((x, i) =>
        `<button class="jl-pill" type="button" data-drop="${i}" aria-label="${VR.escape(x.aria || "Bỏ lọc " + x.label)}"><span>${VR.escape(x.label)}</span>${icon("x")}</button>`
      ).join("") + (items.length > 1 ? `<button class="jl-clear-all" type="button" data-clear-all>Xóa tất cả</button>` : "");
    }

    function renderCountLine() {
      const n = list.length;
      const filtered = activeFilters(state).length > 0;
      const scope = filtered ? "việc phù hợp" : presetField ? "việc trong ngành này" : "việc đang mở";
      countLine.innerHTML = `<strong class="num">${fmtInt(n)}</strong> ${scope}`;
      // the figures line keeps the board's own counts only while nothing narrows it
      root.classList.toggle("is-filtered", filtered);
      if (sortNote) sortNote.hidden = state.sort !== "luong";
      $$("[data-total-btn]", panel).forEach((el) => { el.textContent = fmtInt(n); });
    }

    const countFor = (st) => {
      const cq = compileQuery(st.q);
      let n = 0;
      jobs.forEach((job) => { if (match(job, st, cq)) n += 1; });
      return n;
    };
    function emptyHtml() {
      // the same objects the pills use (renderActive ran first), so data-drop indexes resolve on click
      const items = activeBox._items || [];
      const tips = items.map((x, idx) => {
        const st = cloneState(state);
        x.drop(st);
        return { x, idx, n: countFor(st) };
      }).filter((s) => s.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
      const tipButtons = tips.map((s) =>
        `<button class="rv-filter" type="button" data-drop="${s.idx}">Bỏ ${VR.escape(s.x.tip || s.x.label)} <span class="rv-filter__count">${fmtInt(s.n)}</span></button>`
      ).join("");
      // other searches, only ones that find something under the filters still on; a field page
      // offers its own frequent skills ("Kỹ năng hay gặp") rather than the site-wide list
      let popular = "";
      if (compileQuery(state.q).active) {
        // field page: the skill chips filter on the exact tag, so the counts match the chips above
        const own = Array.from(new Set($$("[data-skill]").map((chip) => chip.dataset.skill)));   // the row and the phone row share them
        const asSkill = own.length > 0;
        const pool = (asSkill ? own : POPULAR).filter((p) => VR.fold(p) !== VR.fold(state.q) && VR.fold(p) !== VR.fold(state.skill));
        popular = pool.map((p) => ({ p, n: countFor(Object.assign(cloneState(state), asSkill ? { q: "", skill: p } : { q: p })) }))
          .filter((s) => s.n > 0).sort((a, b) => b.n - a.n).slice(0, 4)
          .map((s) => `<button class="rv-filter" type="button" ${asSkill ? "data-try-skill" : "data-try"}="${VR.escape(s.p)}">${VR.escape(s.p)} <span class="rv-filter__count">${fmtInt(s.n)}</span></button>`).join("");
      }
      return `<div class="rv-empty jl-empty">
        <span class="rv-ico rv-ico--lg" aria-hidden="true">${icon("search")}</span>
        <p class="rv-empty__title">Chưa có việc khớp ${state.q ? `“${VR.escape(state.q)}”` : "bộ lọc này"}</p>
        <p class="rv-empty__text">${tips.length ? "Thử bỏ bớt một điều kiện, số việc hiện ngay bên cạnh:" : "Thử từ khóa ngắn hơn hoặc xóa bộ lọc. Tìm kiếm không cần gõ dấu."}</p>
        ${tipButtons ? `<div class="jl-suggest">${tipButtons}</div>` : ""}
        ${popular ? `<div class="jl-suggest"><span class="jl-suggest__label">Hoặc thử tìm</span>${popular}</div>` : ""}
        <button class="rv-pill rv-pill--primary rv-pill--sm jl-empty__clear" type="button" data-clear-all>Xóa tất cả bộ lọc</button>
      </div>`;
    }

    function renderMore() {
      const total = list.length;
      const n = Math.min(shown, total);
      moreWrap.hidden = total <= PAGE && n >= total;
      const shownEl = $("[data-shown]", moreWrap);
      const ofEl = $("[data-of]", moreWrap);
      const bar = $("[data-more-bar]", moreWrap);
      if (shownEl) shownEl.textContent = fmtInt(n);
      if (ofEl) ofEl.textContent = fmtInt(total);
      if (bar) bar.style.width = (total ? Math.max(2, Math.round(100 * n / total)) : 0) + "%";
      if (moreBtn) {
        const left = total - n;
        moreBtn.hidden = left <= 0;
        moreBtn.firstChild.textContent = `Xem thêm ${Math.min(PAGE, left)} việc `;
      }
    }

    function syncInputs() {
      $$("input", panel).forEach((input) => {
        if (FACETS.includes(input.name)) input.checked = state[input.name].includes(input.value);
        else if (FLAGS.includes(input.name)) input.checked = state[input.name];
        else if (input.name === "dang-trong") input.checked = input.value === state["dang-trong"];
      });
      $$("[data-quick]", root).forEach((chip) => {
        const k = chip.dataset.quick;
        const on = k === "dang-trong" ? state["dang-trong"] === "1" : Boolean(state[k]);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
      });
      $$("[data-sort]", root).forEach((b) => {
        const on = b.dataset.sort === state.sort;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1; // roving tabindex: Tab enters the group once, arrows move
      });
      $$("[data-skill]").forEach((chip) => chip.setAttribute("aria-pressed", VR.fold(chip.dataset.skill) === VR.fold(state.skill) ? "true" : "false"));
      if (qInput && cleanQ(qInput.value) !== state.q && document.activeElement !== qInput) qInput.value = state.q;
      if (qClear) qClear.hidden = !(qInput && qInput.value);
    }

    /** full re-render; `animate` for user changes, `keepRows` keeps the server rows on first load */
    function render(opts) {
      const o = opts || {};
      syncInputs();
      if (!loaded) {
        renderActive();
        // typed or filtered before /data/jobs.json arrived: dim the rows and say so, the boot
        // render below applies the state as soon as the data is in
        if (!loadFailed && JSON.stringify(state) !== JSON.stringify(defaults())) {
          results.classList.add("is-loading");
          results.setAttribute("aria-busy", "true");
          if (countLine) countLine.innerHTML = `<span class="jl-loading" role="status">Đang tải dữ liệu để lọc…</span>`;
        }
        return;
      }
      const tokens = compute();
      shown = Math.max(PAGE, Math.min(o.shown || PAGE, list.length));
      renderActive();
      if (!o.keepRows) {
        results.innerHTML = list.length ? list.slice(0, shown).map((job) => VR.jobRow(job)).join("") : emptyHtml();
        VR.syncSaveButtons(results);
        if (o.animate && !VR.reducedMotion) {
          results.classList.remove("is-fresh");
          void results.offsetWidth;
          results.classList.add("is-fresh");
          clearTimeout(results._fresh);
          results._fresh = setTimeout(() => results.classList.remove("is-fresh"), 600);
        }
      }
      results.classList.remove("is-loading");
      results.removeAttribute("aria-busy");
      renderCountLine();
      renderMore();
      updateCounts(tokens);
      updateFade();
      if (o.write !== false) writeQuery();
    }

    function keepInView() {
      const top = results.getBoundingClientRect().top;
      const header = document.querySelector("[data-header]");
      const offset = (header ? header.offsetHeight : 64) + 120;
      if (top < offset - 60) {
        const y = window.scrollY + root.getBoundingClientRect().top - (header ? header.offsetHeight : 64) - 12;
        window.scrollTo({ top: Math.max(0, y), behavior: VR.reducedMotion ? "auto" : "smooth" });
      }
    }
    function changed() {
      render({ animate: true });
      if (!panel.classList.contains("is-open")) keepInView();
    }

    /* ---- panel body scroll cue: a bottom fade while more groups sit below the fold */
    const panelBody = $(".jl-panel__body", panel);
    function updateFade() {
      if (!panelBody) return;
      const more = panelBody.scrollHeight - panelBody.clientHeight - panelBody.scrollTop > 6;
      panel.classList.toggle("has-more", more);
    }
    if (panelBody) {
      panelBody.addEventListener("scroll", updateFade, { passive: true });
      window.addEventListener("resize", updateFade, { passive: true });
      if ("ResizeObserver" in window) new ResizeObserver(updateFade).observe(panel);
    }

    /* ---- events */
    panel.addEventListener("change", (event) => {
      const input = event.target;
      if (FACETS.includes(input.name)) {
        const set = new Set(state[input.name]);
        if (input.checked) set.add(input.value); else set.delete(input.value);
        state[input.name] = Array.from(set);
      } else if (FLAGS.includes(input.name)) {
        state[input.name] = input.checked;
      } else if (input.name === "dang-trong") {
        state["dang-trong"] = input.value;
      } else {
        return;
      }
      changed();
    });
    panel.addEventListener("submit", (event) => event.preventDefault());
    panel.addEventListener("click", (event) => {
      const more = event.target.closest("[data-more]");
      if (more) {
        const group = more.closest(".fgroup");
        const open = !group.classList.contains("is-open");
        group.classList.toggle("is-open", open);
        more.setAttribute("aria-expanded", open ? "true" : "false");
        const label = $("[data-more-label]", more);
        if (label) label.textContent = open ? "Thu gọn" : "Xem tất cả ngành";
        updateFade();
        return;
      }
      if (event.target.closest("[data-panel-more]")) {
        if (panelBody) panelBody.scrollBy({ top: Math.round(panelBody.clientHeight * 0.7), behavior: VR.reducedMotion ? "auto" : "smooth" });
        return;
      }
      if (event.target.closest("[data-clear]")) {
        state = Object.assign(defaults(), { q: state.q, skill: state.skill, sort: state.sort });
        changed();
        return;
      }
      if (event.target.closest("[data-close]")) closePanel();
    });

    root.addEventListener("click", (event) => {
      const drop = event.target.closest("[data-drop]");
      if (drop) {
        const item = (activeBox._items || [])[Number(drop.dataset.drop)];
        if (item) { item.drop(state); changed(); }
        return;
      }
      if (event.target.closest("[data-clear-all]")) {
        state = Object.assign(defaults(), { sort: state.sort });
        if (qInput) qInput.value = "";
        changed();
        return;
      }
      const tryBtn = event.target.closest("[data-try]");
      if (tryBtn) {
        state.q = tryBtn.dataset.try;
        if (qInput) qInput.value = state.q;
        changed();
        return;
      }
      const trySkill = event.target.closest("[data-try-skill]");
      if (trySkill) {
        state.q = "";
        state.skill = trySkill.dataset.trySkill;
        if (qInput) qInput.value = "";
        changed();
        return;
      }
      const quick = event.target.closest("[data-quick]");
      if (quick) {
        const k = quick.dataset.quick;
        if (k === "dang-trong") state["dang-trong"] = state["dang-trong"] === "1" ? "" : "1";
        else state[k] = !state[k];
        render({ animate: true });
        return;
      }
      // the figures line's links (?luong=1, ?vn=1) are plain links; once the data is in they filter in place
      const fig = event.target.closest("[data-fig]");
      if (fig && loaded) {
        event.preventDefault();
        state[fig.dataset.fig] = true;
        changed();
        return;
      }
      const sort = event.target.closest("[data-sort]");
      if (sort) {
        if (state.sort === sort.dataset.sort) return;
        state.sort = sort.dataset.sort;
        changed();
      }
    });
    // arrow keys inside the sort radiogroup
    $$("[data-sort]", root).forEach((b, i, all) => {
      b.addEventListener("keydown", (event) => {
        const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!dir) return;
        event.preventDefault();
        const next = all[(i + dir + all.length) % all.length];
        next.focus();
        next.click();
      });
    });

    /* "Xem thêm" before /data/jobs.json is in: the pill shows its pending state (the kit's spinner, the width kept)
       and the rows come the moment the data does */
    let morePending = false;
    if (moreBtn) moreBtn.addEventListener("click", () => {
      if (!loaded) {
        if (loadFailed) return;
        morePending = true;
        if (VR.busy) VR.busy(moreBtn, true);
        return;
      }
      const from = shown;
      shown = Math.min(list.length, shown + PAGE);
      const html = list.slice(from, shown).map((job) => VR.jobRow(job)).join("");
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const firstNew = tmp.firstElementChild;
      results.append(...tmp.children);
      VR.syncSaveButtons(results);
      renderMore();
      saveDepth();
      // keyboard users land on the first new row
      if (firstNew) {
        const link = firstNew.querySelector("a");
        if (link && (document.activeElement === moreBtn || moreBtn.hidden)) link.focus({ preventScroll: true });
      }
    });

    if (searchForm && qInput) {
      let timer;
      qInput.addEventListener("input", () => {
        if (qClear) qClear.hidden = !qInput.value;
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = cleanQ(qInput.value); render({ animate: true }); }, 140);
      });
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        clearTimeout(timer);
        state.q = cleanQ(qInput.value);
        render({ animate: true });
        if (window.matchMedia("(max-width: 960px)").matches) qInput.blur();
        const top = root.getBoundingClientRect().top;
        if (top > window.innerHeight * 0.6 || top < 0) {
          const header = document.querySelector("[data-header]");
          window.scrollTo({ top: window.scrollY + top - (header ? header.offsetHeight : 64) - 12, behavior: VR.reducedMotion ? "auto" : "smooth" });
        }
      });
      if (qClear) qClear.addEventListener("click", () => {
        qInput.value = "";
        state.q = "";
        qClear.hidden = true;
        qInput.focus();
        render({ animate: true });
      });
    }
    // field page: "Kỹ năng hay gặp" chips filter on the exact skill tag (the chip count is that tag's count)
    $$("[data-skill]").forEach((chip) => {
      chip.addEventListener("click", (event) => {
        if (!loaded) return; // without data the link (?ky-nang=…) still works after a reload
        event.preventDefault();
        const same = VR.fold(state.skill) === VR.fold(chip.dataset.skill);
        state.skill = same ? "" : chip.dataset.skill;
        render({ animate: true });
        if (same) return;
        const header = document.querySelector("[data-header]");
        window.scrollTo({ top: window.scrollY + root.getBoundingClientRect().top - (header ? header.offsetHeight : 64) - 12, behavior: VR.reducedMotion ? "auto" : "smooth" });
      });
    });

    /* ---- mobile bottom sheet */
    const sheetMq = window.matchMedia("(max-width: 960px)");
    let lastFocus = null;
    function focusables() {
      return $$("button, input, a[href], select, textarea", panel)
        .filter((el) => !el.disabled && el.offsetParent !== null && !el.closest("[hidden]"));
    }
    function openPanel() {
      if (!sheetMq.matches) { const first = $("input", panel); if (first) first.focus(); return; }
      lastFocus = document.activeElement;
      panel.classList.add("is-open");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      if (scrim) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("is-on")); }
      document.documentElement.classList.add("jl-lock");
      if (fab) { fab.setAttribute("aria-expanded", "true"); fab.classList.add("is-hidden"); }
      openBtns.forEach((b) => b.setAttribute("aria-expanded", "true"));
      const close = $(".jl-panel__close", panel);
      setTimeout(() => { (close || panel).focus(); updateFade(); }, 60);
    }
    function closePanel() {
      if (!panel.classList.contains("is-open")) return;
      panel.classList.remove("is-open");
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
      if (scrim) { scrim.classList.remove("is-on"); setTimeout(() => { if (!panel.classList.contains("is-open")) scrim.hidden = true; }, 260); }
      document.documentElement.classList.remove("jl-lock");
      if (fab) { fab.setAttribute("aria-expanded", "false"); updateFab(); }
      openBtns.forEach((b) => b.setAttribute("aria-expanded", "false"));
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      keepInView();
    }
    if (fab) fab.addEventListener("click", openPanel);
    openBtns.forEach((b) => b.addEventListener("click", openPanel));
    if (scrim) scrim.addEventListener("click", closePanel);
    document.addEventListener("keydown", (event) => {
      if (!panel.classList.contains("is-open")) return;
      if (event.key === "Escape") { event.preventDefault(); closePanel(); return; }
      if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    const onMq = () => { if (!sheetMq.matches) closePanel(); };
    if (sheetMq.addEventListener) sheetMq.addEventListener("change", onMq); else if (sheetMq.addListener) sheetMq.addListener(onMq);

    // the sheet's grabber works: drag the head down past 80px to close, less springs back
    const head = $(".jl-panel__head", panel);
    if (head && window.PointerEvent) {
      let drag = null;
      head.addEventListener("pointerdown", (event) => {
        if (!panel.classList.contains("is-open") || event.button > 0 || event.target.closest("button")) return;
        drag = { y: event.clientY, dy: 0, id: event.pointerId };
        try { head.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
        panel.style.transition = "none";
      });
      head.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        drag.dy = Math.max(0, event.clientY - drag.y);
        panel.style.transform = `translateY(${drag.dy}px)`;
      });
      const end = (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const close = drag.dy > 80;
        drag = null;
        // clear the inline styles in the same frame as the class change, so the CSS transition
        // runs from where the finger left the sheet (to closed, or back to open)
        panel.style.transition = "";
        panel.style.transform = "";
        if (close) closePanel();
      };
      head.addEventListener("pointerup", end);
      head.addEventListener("pointercancel", end);
    }

    // the floating "Bộ lọc" button shows while the rows are on screen, never over the footer, and only once the
    // visitor has scrolled: on a field page the list starts in the first screen, and the button would sit on the
    // first row's title at load (it starts hidden in the markup)
    let listVisible = true;
    let footerVisible = false;
    let toolsVisible = false;   // the inline "Bộ lọc" on screen: the floating one would only repeat it
    let scrolled = window.scrollY > 40;
    function updateFab() {
      if (!fab) return;
      fab.classList.toggle("is-hidden", !scrolled || !listVisible || footerVisible || toolsVisible || panel.classList.contains("is-open"));
    }
    if (fab && !scrolled) {
      const onScroll = () => {
        if (window.scrollY <= 40) return;
        scrolled = true;
        window.removeEventListener("scroll", onScroll);
        updateFab();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    if (fab && !("IntersectionObserver" in window)) updateFab();
    if (fab && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { listVisible = entry.isIntersecting; });
        updateFab();
      }, { rootMargin: "-80px 0px -40px 0px" });
      io.observe(results);
      const tools = openBtns[0];
      if (tools) {
        new IntersectionObserver((entries) => {
          entries.forEach((entry) => { toolsVisible = entry.isIntersecting && entry.boundingClientRect.width > 0; });
          updateFab();
        }).observe(tools);
      }
      const footer = document.querySelector(".site-footer");
      if (footer) {
        new IntersectionObserver((entries) => {
          entries.forEach((entry) => { footerVisible = entry.isIntersecting; });
          updateFab();
        }).observe(footer);
      }
    }

    /* ---- boot: state from the URL first (inputs reflect it at once), then the data */
    state = readQuery();
    const startsDefault = JSON.stringify(state) === JSON.stringify(defaults());
    // Back from a job: this history entry remembers how many rows were open and the scroll spot
    const back = window.history.state || {};
    const restoreShown = Number(back.jlShown) > PAGE ? Number(back.jlShown) : 0;
    syncInputs();
    renderActive();
    updateFade();
    if (!startsDefault) render({ write: false });
    // remember the scroll spot when leaving for a job (pagehide covers the back/forward cache too)
    results.addEventListener("click", (event) => { if (event.target.closest("a[href]")) saveDepth(); });
    window.addEventListener("pagehide", () => saveDepth());

    VR.loadJobs().then((data) => {
      jobs = prepare(data);
      loaded = true;
      render({ keepRows: startsDefault && !restoreShown, write: false, shown: restoreShown });
      if (morePending && moreBtn) { morePending = false; if (VR.busy) VR.busy(moreBtn, false); moreBtn.click(); }
      if (restoreShown && Number.isFinite(back.jlY) && Math.abs(window.scrollY - back.jlY) > 40) {
        // the browser clamped its scroll restore to the 30-row page; go back to the row
        window.scrollTo({ top: back.jlY, behavior: "auto" });
      }
    }).catch(() => {
      loadFailed = true;
      if (moreBtn && VR.busy) VR.busy(moreBtn, false);
      if (morePending && VR.toast) VR.toast("Chưa tải được thêm việc. Tải lại trang để thử lại.", { tone: "error" });
      results.classList.remove("is-loading");
      results.removeAttribute("aria-busy");
      if (countLine) countLine.innerHTML = countLineHtml;
      const note = document.createElement("p");
      note.className = "rv-note rv-note--warn jl-error";
      note.innerHTML = `${icon("alert")}<span>Chưa tải được dữ liệu để lọc. Đang hiện 30 việc đầu danh sách, tải lại trang để thử lại.</span>`;
      results.parentNode.insertBefore(note, results);
    });
  }

  /* ================================================================ 2 job detail */
  const BULLET = /^\s*(?:[•·●▪◦‣∙]|[-*–]\s)\s*/;

  function linesOf(p) {
    const lines = [""];
    p.childNodes.forEach((node) => {
      if (node.nodeName === "BR") lines.push("");
      else lines[lines.length - 1] += node.textContent;
    });
    return lines.map((l) => l.trim()).filter(Boolean);
  }

  function enhanceDescription(body) {
    const blocks = Array.from(body.children);
    let list = null;
    blocks.forEach((el, i) => {
      if (el.tagName !== "P") { list = null; return; }
      const lines = linesOf(el);
      if (!lines.length) { list = null; return; }
      const bullets = lines.filter((l) => BULLET.test(l)).length;
      if (bullets && bullets === lines.length) {
        if (!list) { list = document.createElement("ul"); el.before(list); }
        lines.forEach((l) => {
          const li = document.createElement("li");
          li.textContent = l.replace(BULLET, "");
          list.append(li);
        });
        el.remove();
        return;
      }
      list = null;
      const text = lines.join(" ");
      const next = blocks[i + 1];
      const words = text.split(/\s+/).length;
      // a short single line without end punctuation is a section title ("What you'll do", "Yêu cầu:"),
      // but "Location: Remote, worldwide" is a fact line, not a title
      if (lines.length === 1 && next && text.length <= 64 && words <= 9 && !/[.!?;,…]$/.test(text) &&
          !/:\s*\S/.test(text) && !/^https?:/i.test(text)) {
        el.classList.add("jd-h");
      }
    });
  }

  function initDetail(body) {
    try { enhanceDescription(body); } catch (_) { /* keep the plain text */ }
    // a long description folds at 560 px (480 on phones) behind one outlined pill (the description sits below the
    // first screen at every width, so the fold never moves what the reader is looking at)
    const expand = $("[data-jd-expand]");
    const label = expand && $("[data-jd-expand-label]", expand);
    if (expand && body.scrollHeight > 760) {
      body.classList.add("is-clamped");
      expand.hidden = false;
      expand.addEventListener("click", () => {
        const open = body.classList.toggle("is-clamped") === false;
        expand.setAttribute("aria-expanded", open ? "true" : "false");
        if (label) label.textContent = open ? "Thu gọn mô tả" : "Đọc toàn bộ mô tả";
        if (!open && body.getBoundingClientRect().top < 0) {
          // folding back from far below: return to the description's top, not to an empty stretch of sheet
          const header = document.querySelector("[data-header]");
          const y = window.scrollY + body.getBoundingClientRect().top - (header ? header.offsetHeight : 64) - 96;
          window.scrollTo({ top: y, behavior: VR.reducedMotion ? "auto" : "smooth" });
        }
      });
    }
    // copy link ([data-copy-text]) and the phone action bar ([data-actionbar]) are the kit's (common.js); the link
    // copied is the page the reader is on (the server writes the canonical one for no-JS and crawlers)
    $$("[data-copy-text].jd-copy").forEach((btn) => { btn.dataset.copyText = window.location.origin + window.location.pathname; });
  }

  /* ================================================================ 3 salary */
  function initSalary() {
    // "Cách tính" 05's Upwork share is rendered on the server (jobs_tags.hourly_sources): no jobs.json download here.
    // Every figure is in the server HTML; "Theo tháng" swaps the figures (× 160 working hours) and keeps every
    // position on the shared axis, so nothing moves but the numbers. The choice is kept in the URL (?don-vi=thang)
    // with replaceState, so a shared link or Back opens the same view.
    const card = $("[data-sl-chart]");
    if (!card) return;
    const rows = $$(".sl-row[data-h]", card);
    const ticks = $$(".sl-ticks [data-v]", card);
    const sub = $("[data-sl-sub]", card);
    const axisUnit = $("[data-sl-axis-unit]", card);
    const colHead = $("[data-sl-colhead]", card);
    const monthNote = $("[data-sl-monthnote]", card);
    const radios = $$("[data-sl-unit]", card);
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
    const dec = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
    const kilo = (n) => (n >= 1000 ? (n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "k" : String(n));
    rows.forEach((row) => {
      row._hourly = { v: $("[data-sl-v]", row).textContent, r: $("[data-sl-r]", row).textContent };
    });

    function setUnit(unit, opts) {
      const monthly = unit === "monthly";
      card.dataset.unit = unit;
      radios.forEach((b) => {
        const on = b.dataset.slUnit === unit;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      rows.forEach((row) => {
        const v = $("[data-sl-v]", row);
        const r = $("[data-sl-r]", row);
        const h = num(row.dataset.h);
        if (!monthly || h === null) { v.textContent = row._hourly.v; r.textContent = row._hourly.r; return; }
        const a = num(row.dataset.p25);
        const b = num(row.dataset.p75);
        v.textContent = fmtInt(h * 160);
        r.textContent = a !== null && b !== null && b > a ? `${fmtInt(a * 160)}–${fmtInt(b * 160)}` : row._hourly.r;
      });
      ticks.forEach((t) => { const n = Number(t.dataset.v); t.textContent = monthly ? kilo(n * 160) : dec(n); });
      if (sub) sub.textContent = monthly
        ? "USD/tháng nếu làm 160 giờ. Dải màu là 50% số tin ở giữa."
        : "USD/giờ. Dải màu là 50% số tin ở giữa.";
      if (axisUnit) axisUnit.textContent = monthly ? "USD/tháng" : "USD/giờ";
      if (colHead) colHead.textContent = monthly ? "Trung vị/tháng" : "Trung vị";
      if (monthNote) monthNote.hidden = !monthly;
      if (opts && opts.write) {
        const url = new URL(window.location.href);
        if (monthly) url.searchParams.set("don-vi", "thang"); else url.searchParams.delete("don-vi");
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      }
    }
    radios.forEach((b, i, all) => {
      b.addEventListener("click", () => setUnit(b.dataset.slUnit, { write: true }));
      b.addEventListener("keydown", (event) => {
        const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!dir) return;
        event.preventDefault();
        const next = all[(i + dir + all.length) % all.length];
        next.focus();
        setUnit(next.dataset.slUnit, { write: true });
      });
    });
    if (new URLSearchParams(window.location.search).get("don-vi") === "thang") setUnit("monthly");
  }

  VR.onReady(() => {
    const board = document.querySelector("[data-jobs]");
    if (board) initBoard(board);
    const body = document.querySelector("[data-jd-body]");
    if (body) initDetail(body);
    if (document.querySelector("[data-sl-chart]")) initSalary();
  });
})();

/* Việt Remote — shared browser helpers (window.VR).
   No build step, no dependencies. Every page script may rely on:

   VR.onReady(fn)            run after DOM is parsed
   VR.escape(s) / VR.fold(s) HTML-escape / lower-case without diacritics
   VR.store.get/set          localStorage that never throws
   VR.saved.*                saved jobs + application status (vr.saved), emits "vr:saved"
   VR.STATUSES               tracker statuses [{key,label}]
   VR.syncSaveButtons(root)  refresh [data-save] buttons and [data-saved-count]
   VR.toast(msg) / VR.copy(text, msg)
   VR.fmt.int/usd/vnd        Vietnamese number formatting (1.423 · 27,5 USD)
   VR.loadJobs()             Promise of /data/jobs.json (also loads the logo manifest, so VR.iconLogo is ready)
   VR.iconLogo(job)          logo URL that reads at 32-56 px (local cached copy) or "" -> initials; twin of job|icon_logo
   VR.payLabel(job)          display pay string (HTML-safe) or "" when undisclosed
   VR.jobCard(job)           HTML twin of includes/job_card.html (short title, distinguishing badges)
   VR.jobRow(job, {note})    HTML twin of includes/job_row.html
   VR.cardBadges(job, n)     the badges a card/row shows (never the pay badge)
   VR.shortTitle(title)      compact title ("Podcast Producer"); [data-short-title] is applied automatically
   VR.shortCompany(name)     company without "(…)" suffixes ("Men's Therapy Online")
   VR.cardField(job)         field label a card prints, or "" when it is too long to fit
   VR.countTo(el, n, opts)   roll a number to n (data-count/data-decimals roll up on scroll)
   VR.tabs(root)             wire a [data-tabs] segmented control
   VR.inView(el, fn, opts)   call fn once when el scrolls into view (immediately if no IO / reduced motion)
   VR.reducedMotion          boolean
   VR.ageLabel(iso)          "3 giờ trước" / "Hôm qua" / "4 ngày trước" from a job's `posted` (twin of catalog._age_label);
                             [data-posted="<iso>"] elements are refreshed on load, so a static export never shows stale ages
   VR.keepVN(text)           joins Vietnamese compounds with a no-break space (twin of the vn_keep filter), plus keepRanges
   VR.keepRanges(text)       keeps "3–6+ năm" / "9:00–18:00" on one line (twin of keep_ranges / no_break_ranges)
   VR.vnNow()                {date "YYYY-MM-DD", minutes since 00:00, offsetOk} in Asia/Ho_Chi_Minh (VR.now() honours ?now=
                             only where the page sets VR.allowFakeNow, i.e. the DEBUG dev server)
   VR.relTime(iso) / VR.refreshRel()  "hôm nay" / "hôm qua" / "dd/mm" for time[data-rel datetime]
   VR.fieldHeader()          html[data-field] = the field under the header's centre line (home V4 sections carry data-field)
   view transitions          pageswap / pagereveal name a job card title and the job page h1 "vt-job-title" (title morph)

   V3 motion (elevated.css), all off under prefers-reduced-motion:
   VR.live(els, cls)         toggle cls (default "is-live") while each element is on screen; every
                             .obj gets it on load, so matte objects bob only while visible
   [data-tilt]               a floating card tilts ≤ 3° toward the pointer (fine pointers only);
                             data-tilt="5" sets the max angle
   .fan.reveal               a fanned card stack spreads on enter (common reveal; see .fan in CSS)
*/
(function () {
  "use strict";

  const VR = (window.VR = window.VR || {});

  /* static/portal/ URL this script was served from (dev server and static export alike) */
  const STATIC_BASE = (() => {
    const src = (document.currentScript && document.currentScript.src) || "";
    const cut = src.indexOf("/js/common.js");
    return cut > 0 ? src.slice(0, cut + 1) : "static/portal/";
  })();

  VR.onReady = (fn) =>
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn();

  VR.reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  VR.escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  /** lower-case, strip Vietnamese diacritics (đ -> d), collapse spaces */
  VR.fold = (value) =>
    String(value ?? "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();

  /** compact job title: drops (…) notes and everything after a dash, pipe, comma or ": ".
      Defined inline in base.html (runs before paint); this fallback is the same code.
      Python twin: shorten_title() in portal/templatetags/portal_tags.py */
  /** the source's labels around the role ("Job title: …", "URGENT: …", "Urgent - …", "Hiring: …", "[Remote] …").
      Defined inline in base.html; this fallback is the same code. Python twin: strip_title_labels() (services/titles.py) */
  VR.stripTitleLabels = VR.stripTitleLabels || ((t) => {
    const raw = String(t || "");
    const s = raw
      .replace(/^(?:\s*(?:\[[^\]]{1,40}\]\s*|(?:job\s*title|position|role|urgent(?:ly)?(?:\s+hiring)?|(?:now\s+|we(?:'re|\s+are)\s+)?hiring(?:\s+now)?|remote|tuyển\s+gấp|gấp|hot)\s*(?::|\s[-–—|]|[-–—|]\s)\s*))+/iu, "")
      .replace(/[\s,–—-]+(?:urgent(?:ly)?(?:\s+hiring)?|hiring(?:\s+(?:now|today))?|asap)\s*!*$/iu, "").trim();
    return (s.match(/\p{L}/gu) || []).length >= 3 ? s : raw;
  });
  VR.shortTitle = VR.shortTitle || ((t) => {
    const raw = String(t || "").trim();
    let s = VR.stripTitleLabels(raw);
    let prev;
    do { prev = s; s = s.replace(/\s*[(\[][^()\[\]]*[)\]]/g, ""); } while (s !== prev);
    ["(", "["].forEach((o) => { const i = s.indexOf(o); if (i > 0) s = s.slice(0, i); });
    s = s.split(/\s+[–-]\s+|\s*[—|]\s*/)[0].split(",")[0];
    const c = s.indexOf(": ");
    if (c >= 12) s = s.slice(0, c);
    s = s.replace(/\s+/g, " ").replace(/[\s:;.,–—-]+$/, "").trim();
    return VR.titleCase ? VR.titleCase(s || raw) : s || raw;  // VR.titleCase: ALL-CAPS de-shout (base.html)
  });
  VR.applyShortTitles = VR.applyShortTitles || ((root) => {
    (root || document).querySelectorAll("[data-short-title]").forEach((el) => {
      if (!el.dataset.full) { el.dataset.full = el.textContent; el.title = el.textContent.trim(); }
      el.textContent = VR.shortTitle(el.dataset.full);
    });
  });

  /** company name for compact UI: drops "(…)" suffixes, anything after "|", legal forms (Inc, LLC, Corporation,
      "CÔNG TY TNHH" …) and ALL-CAPS shouting ("SVTEK TECHNOLOGY CORPORATION" -> "Svtek Technology").
      Python twin: shorten_company() in portal/templatetags/portal_tags.py */
  const LEGAL = /(?:[\s,]+(?:corporation|corp\.?|incorporated|inc\.?|llc|l\.l\.c\.?|ltd\.?|limited|co\.?|jsc|plc|gmbh|pte\.?|pty\.?|s\.a\.?|b\.v\.?|joint stock company))+\.?$/i;
  const VN_PREFIX = /^(?:công ty|cty)(?:\s+(?:tnhh|cổ phần|cp|trách nhiệm hữu hạn))?(?:\s+(?:một thành viên|mtv))?\s+/i;
  const trimSeps = (s) => s.replace(/^[\s\-–—·,]+|[\s\-–—·,]+$/g, "");
  VR.shortCompany = (name) => {
    const raw = String(name || "").trim();
    if (raw === "Khách hàng trên Upwork" || raw === "Khách hàng Upwork") return "Khách Upwork";  // label saved before 11-14
    let s = trimSeps(raw.replace(/\s*[(\[|].*$/, ""));
    const bare = trimSeps(s.replace(LEGAL, "").replace(VN_PREFIX, ""));
    if (bare.length >= 2) s = bare;
    // ALL-CAPS names: words of 5+ letters and Vietnamese words to title case; short ASCII words (acronyms) kept
    const letters = s.replace(/[^\p{L}]/gu, "");
    if (letters.length >= 5 && letters === letters.toUpperCase()) {
      s = s.replace(/\p{L}+/gu, (w) => (w.length >= 5 || /[^\x00-\x7F]/.test(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w));
    }
    return s || raw;
  };
  /** field label for a card head, "" when longer than 20 characters (twin of card_field) */
  VR.cardField = (job) => {
    const label = String((job && job.field_label) || "");
    return label.length <= 20 ? label : "";
  };

  /* ---------- storage (never throws) ---------- */
  VR.store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (_) {
        return false;
      }
    },
  };

  /* ---------- saved jobs + application tracker ----------
     vr.saved = { [id]: {id,title,company,url,salary,field,status,note,savedAt,updatedAt} }
     status: saved | applied | interview | offer | rejected */
  const SAVED_KEY = "vr.saved";
  VR.STATUSES = [
    { key: "saved", label: "Đã lưu" },
    { key: "applied", label: "Đã ứng tuyển" },
    { key: "interview", label: "Phỏng vấn" },
    { key: "offer", label: "Nhận offer" },
    { key: "rejected", label: "Không phù hợp" },
  ];
  VR.saved = {
    all() { return VR.store.get(SAVED_KEY, {}); },
    has(id) { return Boolean(this.all()[id]); },
    add(job) {
      const items = this.all();
      const now = new Date().toISOString();
      items[job.id] = Object.assign({ status: "saved", note: "", savedAt: now }, items[job.id], job, { updatedAt: now });
      VR.store.set(SAVED_KEY, items);
      VR.saved.emit();
    },
    remove(id) {
      const items = this.all();
      delete items[id];
      VR.store.set(SAVED_KEY, items);
      VR.saved.emit();
    },
    update(id, patch) {
      const items = this.all();
      if (!items[id]) return;
      items[id] = Object.assign(items[id], patch, { updatedAt: new Date().toISOString() });
      VR.store.set(SAVED_KEY, items);
      VR.saved.emit();
    },
    count() { return Object.keys(this.all()).length; },
    /** {saved, applied, interview, offer, rejected} counts */
    counts() {
      const out = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
      Object.values(this.all()).forEach((item) => { out[item.status in out ? item.status : "saved"] += 1; });
      return out;
    },
    emit() { document.dispatchEvent(new CustomEvent("vr:saved")); },
  };

  function jobFromElement(el) {
    const row = el.closest("[data-job-id]");
    if (!row) return null;
    return {
      id: Number(row.dataset.jobId),
      title: row.dataset.title || "",
      company: row.dataset.company || "",
      url: row.dataset.url || "",
      salary: row.dataset.salary || "",
      field: row.dataset.field || "",
    };
  }

  function syncSaveButtons(root) {
    const saved = VR.saved.all();
    (root || document).querySelectorAll("[data-save]").forEach((btn) => {
      const job = jobFromElement(btn);
      if (!job) return;
      const on = Boolean(saved[job.id]);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Bỏ lưu việc" : "Lưu việc");
      btn.title = on ? "Bỏ lưu việc" : "Lưu việc";
      const text = btn.querySelector("[data-save-label]");
      if (text) text.textContent = on ? "Đã lưu" : "Lưu việc";
    });
    document.querySelectorAll("[data-saved-count]").forEach((badge) => {
      const n = VR.saved.count();
      badge.textContent = String(n);
      badge.dataset.savedCount = String(n);
    });
  }
  VR.syncSaveButtons = syncSaveButtons;

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-save]");
    if (!btn) return;
    event.preventDefault();
    const job = jobFromElement(btn);
    if (!job) return;
    if (VR.saved.has(job.id)) {
      VR.saved.remove(job.id);
      VR.toast("Đã bỏ lưu việc này");
    } else {
      VR.saved.add(job);
      VR.toast("Đã lưu — xem trong mục Việc đã lưu");
    }
  });
  document.addEventListener("vr:saved", () => syncSaveButtons());
  // saved or removed in another tab: the header count and every bookmark on this page follow
  window.addEventListener("storage", (event) => {
    if (event.key === SAVED_KEY || event.key === null) syncSaveButtons();
  });

  /* ---------- toast & clipboard ---------- */
  let toastTimer;
  VR.toast = (message) => {
    const el = document.querySelector("[data-toast]");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
  };
  VR.copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); } catch (__) { /* ignore */ }
      area.remove();
    }
    VR.toast(message || "Đã sao chép");
  };

  /* ---------- number formatting ---------- */
  VR.fmt = {
    int(n) { return Math.round(Number(n) || 0).toLocaleString("vi-VN"); },
    usd(n, digits) {
      const value = Number(n) || 0;
      return value.toLocaleString("vi-VN", { maximumFractionDigits: digits ?? (value < 100 ? 1 : 0) }) + " USD";
    },
    vnd(n) {
      const value = Number(n) || 0;
      if (value >= 1e9) return (value / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ";
      if (value >= 1e6) return (value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " triệu";
      return value.toLocaleString("vi-VN") + " đ";
    },
  };

  /* ---------- company logos ----------
     Twin of the icon_logo filter (portal/logos.py). manage.py cache_logos stores each logo that reads
     at 32-56 px as a trimmed, re-padded square under img/logos/ and lists every source URL in
     img/logos/manifest.json; padded wordmarks, photos and broken images map to no file and the tile
     shows the initials. Without a manifest (not loaded yet, or the request failed) every tile shows the initials:
     the page never hotlinks a third-party logo (no visitor IP sent to an image CDN, the export stays first-party). */
  const LOGO_FILES = new Set(["icon", "tile"]);
  let logoMap = null;  // {source url: {file, kind}} once loaded
  let logosPromise;
  VR.loadLogos = () => {
    if (!logosPromise) {
      logosPromise = fetch(STATIC_BASE + "img/logos/manifest.json", { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          logoMap = data && data.logos && typeof data.logos === "object" ? data.logos : null;
          return logoMap;
        })
        .catch(() => null);
    }
    return logosPromise;
  };
  VR.iconLogo = (job) => {
    const url = String((job && job.logo) || "");
    if (!url) return "";
    if (!logoMap) return "";
    const entry = Object.prototype.hasOwnProperty.call(logoMap, url) ? logoMap[url] : null;
    return entry && entry.file && LOGO_FILES.has(entry.kind) ? STATIC_BASE + "img/logos/" + entry.file : "";
  };

  /* ---------- job data ---------- */
  let jobsPromise;
  VR.loadJobs = () => {
    if (!jobsPromise) {
      // the logo manifest rides along, so every VR.jobCard/jobRow drawn from this data can use it
      jobsPromise = Promise.all([
        fetch("/data/jobs.json", { credentials: "same-origin" })
          .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          }),
        VR.loadLogos(),
      ]).then(([data]) => data);
    }
    return jobsPromise;
  };

  const ICON = (name, cls) => `<svg class="icon${cls ? " " + cls : ""}"><use href="#i-${name}"/></svg>`;
  VR.icon = ICON;

  /** Pay text as the templates show it: USD label without "≈ ", converted label for other currencies. */
  VR.payLabel = (job) => {
    const pay = job.pay || {};
    if (!pay.disclosed) return "";
    if (pay.currency === "USD") return VR.sameRange(String(pay.label_usd || job.salary || "").replace(/^≈\s*/, ""));
    return VR.sameRange(String(pay.label_usd || job.salary || ""));
  };
  /** "1.500 – 1.500 EUR/tháng" -> "1.500 EUR/tháng": a range whose two ends are equal, printed once.
      Twin of collapse_range() in portal/templatetags/jobs_tags.py */
  VR.sameRange = (text) => String(text ?? "").replace(/(^|[^\d.,])(\d[\d.,]*)(\s*[–—-]\s*)\2(?![\d.,])/g, "$1$2");
  /** Pay as the listing states it ("14–16 triệu VNĐ/tháng", "1.500 EUR/tháng"); USD as VR.payLabel prints it.
      Twin of pay_native (portal_tags.py) + pay_main (jobs_tags.py): the jobs pages lead with this figure. */
  const PERIOD_UNIT = { hourly: "giờ", monthly: "tháng", annual: "năm", fixed: "dự án", weekly: "tuần", daily: "ngày" };
  const vnFigure = (n) => String(Math.round(Number(n) / 1e5) / 10).replace(".", ",");
  VR.payNative = (job) => {
    const pay = (job && job.pay) || {};
    if (!pay.disclosed) return "";
    const unit = PERIOD_UNIT[pay.period || ""];
    const cur = String(pay.currency || "").toUpperCase();
    const low = Number(pay.low) || 0;
    const high = Number(pay.high) || low;
    const span = (a, b) => (a === b ? a : a + "–" + b);
    if (cur === "VND" && unit && low >= 1e6) return `${span(vnFigure(low), vnFigure(high))} triệu VNĐ/${unit}`;
    if (cur && cur !== "USD" && cur !== "VND" && /^[A-Z]{3}$/.test(cur) && unit && low) {
      return `${span(VR.fmt.int(low), VR.fmt.int(high))} ${cur}/${unit}`;
    }
    return VR.payLabel(job);
  };
  /** the quiet "≈ 538–615 USD/tháng" line under a pay stated in another currency ("" for USD). Twin of pay_usd */
  VR.payUsd = (job) => {
    const pay = (job && job.pay) || {};
    if (!pay.disclosed || String(pay.currency || "").toUpperCase() === "USD") return "";
    const label = String(pay.label_usd || "").trim();
    if (!label || VR.payNative(job) === VR.payLabel(job)) return "";
    return VR.sameRange(label.startsWith("≈") ? label : "≈ " + label);
  };

  const dataAttrs = (job) =>
    `data-job-id="${Number(job.id)}" data-title="${VR.escape(job.title)}" data-company="${VR.escape(job.company)}" data-url="${VR.escape(job.url)}" data-salary="${VR.escape(job.salary)}" data-field="${VR.escape(job.field_label)}"`;
  /* logo only when it reads at 40px (VR.iconLogo); initials share one neutral treatment (ink on
     --surface-2), no per-job tints */
  const logoHtml = (job) => {
    const src = VR.iconLogo(job);
    return `<span class="logo" aria-hidden="true" data-initials="${VR.escape(job.initials)}">${src
      ? `<img src="${VR.escape(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : VR.escape(job.initials)}</span>`;
  };
  const saveBtn = `<button class="save-btn" type="button" data-save aria-pressed="false" aria-label="Lưu việc" title="Lưu việc">${ICON("bookmark")}</button>`;

  /* Badges worth showing on a card/row: only what sets a job apart. Pay is never a badge
     (it is printed in the foot) and neither is "Mới" (the age in the meta line turns blue).
     Twin of CARD_BADGES / card_badges in portal_tags.py. */
  const CARD_BADGES = [
    { key: "vn", label: "Tuyển ở Việt Nam", tone: "ok", icon: "check" },
    { key: "beginner", label: "Hợp người mới", tone: "info", icon: "" },
    { key: "low-competition", label: "Ít cạnh tranh", tone: "neutral", icon: "" },
  ];
  /* Age from the job's own timestamp, computed in the browser: jobs.json and the exported HTML are
     built once a day, so their baked "21 giờ trước" would drift. Same rules as catalog._age_label:
     hours under a day, then calendar days ("Hôm qua" only for yesterday's date). */
  VR.ageOf = (iso) => {
    const posted = Date.parse(iso || "");
    if (!Number.isFinite(posted)) return null;
    const hours = Math.max(0, (Date.now() - posted) / 36e5);
    let label;
    if (hours < 1) label = "Vừa đăng";
    else if (hours < 24) label = Math.floor(hours) + " giờ trước";
    else {
      const day = (t) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
      const days = Math.max(1, Math.round((day(Date.now()) - day(posted)) / 864e5));
      label = days === 1 ? "Hôm qua" : days + " ngày trước";
    }
    return { label, isNew: hours <= 24, hours };
  };
  VR.ageLabel = (iso) => { const a = VR.ageOf(iso); return a ? a.label : ""; };
  const ageHtml = (job) => {
    const a = VR.ageOf(job.posted);
    const label = a ? a.label : job.posted_label;
    const fresh = a ? a.isNew : job.is_new;
    return `<span class="job-age${fresh ? " is-new" : ""}" data-posted="${VR.escape(job.posted || "")}">${VR.escape(label)}</span>`;
  };
  /** refresh server-rendered ages: <span class="job-age" data-posted="2026-11-13T02:41:08+00:00">22 giờ trước</span>,
      the last-sync day <span data-synced-day="2026-11-13T09:47+07:00">hôm qua</span> and the
      "việc mới trong 24 giờ" count <span data-recent="epoch,epoch,…">47</span> (catalog.overview) */
  VR.refreshAges = (root) => {
    const scope = root || document;
    scope.querySelectorAll("[data-posted]").forEach((el) => {
      const a = VR.ageOf(el.dataset.posted);
      if (!a) return;
      const label = el.hasAttribute("data-lower") ? a.label.toLowerCase() : a.label;
      if (el.textContent !== label) el.textContent = label;
      if (el.classList.contains("job-age")) el.classList.toggle("is-new", a.isNew);
    });
    scope.querySelectorAll("[data-synced-day]").forEach((el) => {
      const t = Date.parse(el.dataset.syncedDay || "");
      if (!Number.isFinite(t)) return;
      const day = (x) => { const d = new Date(x); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
      const days = Math.round((day(Date.now()) - day(t)) / 864e5);
      const d = new Date(t);
      el.textContent = days <= 0 ? "hôm nay" : days === 1 ? "hôm qua"
        : `ngày ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    scope.querySelectorAll("[data-recent]").forEach((el) => {
      const since = Date.now() / 1000 - 24 * 3600;
      const n = String(el.dataset.recent || "").split(",").filter((x) => Number(x) >= since).length;
      el.textContent = n.toLocaleString("vi-VN");
    });
  };

  /* Vietnamese compounds a heading must not split ("nguyên / tắc"). Twin of VN_COMPOUNDS / vn_keep. */
  const VN_COMPOUNDS = ["nguyên tắc", "dữ liệu", "nước ngoài", "lừa đảo", "kết quả", "đầu tiên", "hợp đồng",
    "thông tin", "thanh toán", "người Việt", "mỗi tin", "công cụ", "Việt Nam", "tiếng Anh", "khách hàng",
    "cộng đồng", "hướng dẫn", "ứng tuyển", "tuyển dụng", "kiểm tra", "làm remote", "số 0", "người mới", "việc làm"];
  const VN_KEEP = new RegExp(String.raw`(^|[^\p{L}\p{N}])(` + VN_COMPOUNDS.join("|") + String.raw`)(?=$|[^\p{L}\p{N}])`, "giu");
  /* "3–6+ năm": word joiner after a dash between numbers, no-break space before a unit. Twin of keep_ranges(). */
  const RANGE = /(\d[+%]?)([ \u00a0]?)([\u2013\u2014-])([ \u00a0]?)(?=[$\u20ac\u00a3]?\d)/g;
  const UNITS = ["năm", "tháng", "tuần", "ngày", "giờ", "phút", "USD", "VND", "VNĐ", "triệu", "tr", "đ",
    "years", "year", "yrs", "months", "month", "hours", "hrs", "weeks", "days"];
  const UNIT = new RegExp(String.raw`(\d[+%]?) (?=(?:` + UNITS.join("|") + String.raw`)(?![\p{L}\p{N}_]))`, "gu");
  VR.keepRanges = (text) => String(text ?? "")
    .replace(RANGE, (m, num, before, dash, after) => num + (before ? "\u00a0" : "") + dash + "\u2060" + (after ? "\u00a0" : ""))
    .replace(UNIT, (m, num) => num + "\u00a0");
  VR.keepVN = (text) => VR.keepRanges(String(text ?? "").replace(VN_KEEP, (m, lead, pair) => lead + pair.replace(" ", "\u00a0")));
  /** [{key,label,tone,icon}] for a job, at most `limit` (default 2) */
  VR.cardBadges = (job, limit) => {
    const keys = new Set((job.badges || []).map((b) => b.key));
    return CARD_BADGES.filter((b) => keys.has(b.key)).slice(0, limit || 2);
  };
  const badgesHtml = (job, limit) => VR.cardBadges(job, limit)
    .map((b) => `<span class="badge badge--${b.tone}">${b.icon ? ICON(b.icon) : ""}${VR.escape(b.label)}</span>`).join("");

  /** Client-side twin of templates/portal/includes/job_card.html */
  VR.jobCard = (job) => {
    const e = VR.escape;
    const badges = badgesHtml(job, 2);
    const pay = VR.payLabel(job);
    const field = VR.cardField(job);
    return `<article class="job-card" ${dataAttrs(job)}>
  <div class="job-card__head">
    ${logoHtml(job)}
    <div class="job-card__org">
      <span class="job-card__company">${e(VR.shortCompany(job.company) || "Nhà tuyển dụng ẩn danh")}</span>
      ${field ? `<span class="job-card__meta">${e(field)}</span>` : ""}
    </div>
    ${saveBtn}
  </div>
  <h3 class="job-card__title"><a href="${e(job.url)}" title="${e(job.title)}">${e(VR.shortTitle(job.title))}</a></h3>
  ${badges ? `<div class="job-card__badges">${badges}</div>` : ""}
  <div class="job-card__foot">
    <span class="job-card__pay">${pay ? e(pay) : `<span class="muted">Lương thỏa thuận</span>`}</span>
    <span class="job-card__info">${ageHtml(job)}<span class="job-card__source">${e(job.source_label)}</span></span>
  </div>
</article>`;
  };

  /** Client-side twin of templates/portal/includes/job_row.html */
  VR.jobRow = (job, extra) => {
    const e = VR.escape;
    const meta = [VR.shortCompany(job.company) || "Nhà tuyển dụng ẩn danh", job.field_label, job.level_label, job.employment_label]
      .filter(Boolean).map((x) => `<span>${e(x)}</span>`).join("");
    const badges = badgesHtml(job, 3);
    // the listing's own figure leads; a pay in another currency adds the quiet ≈ USD line (jobs_tags pay_main/pay_usd)
    const pay = VR.keepRanges(VR.payNative(job));
    const usd = VR.payUsd(job);
    const original = pay && usd ? `<small>${e(usd)}</small>` : "";
    const note = extra && extra.note ? `<p class="job-row__note">${e(extra.note)}</p>` : "";
    return `<article class="job-row" ${dataAttrs(job)}>
  ${logoHtml(job)}
  <div class="job-row__main">
    <h3 class="job-row__title"><a href="${e(job.url)}" title="${e(job.title)}">${e(VR.shortTitle(job.title))}</a></h3>
    <div class="job-row__meta">${meta}</div>
    ${badges ? `<div class="job-row__badges">${badges}</div>` : ""}
    ${note}
  </div>
  <div class="job-row__side">
    <span class="job-row__pay">${pay ? e(pay) + original : `<span class="muted">Lương thỏa thuận</span>`}</span>
    <span class="job-row__age">${ageHtml(job)}<span class="job-row__source">${e(job.source_label)}</span></span>
  </div>
  ${saveBtn}
</article>`;
  };

  /* ---------- tabs (segmented control) ----------
     <div data-tabs><div role="tablist"><button role="tab" aria-controls="p1" aria-selected="true">…</button>…</div>
     <div role="tabpanel" id="p1">…</div><div role="tabpanel" id="p2" hidden>…</div></div> */
  VR.tabs = (root) => {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      root.dispatchEvent(new CustomEvent("vr:tab", { detail: { tab } }));
    };
    tabs.forEach((tab, i) => {
      tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (event) => {
        const dir = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        event.preventDefault();
        select(tabs[(i + dir + tabs.length) % tabs.length], true);
      });
    });
  };

  /* ---------- number roll-up ---------- */
  const numText = (n, decimals) => {
    const d = decimals === undefined || decimals === "" ? 0 : Number(decimals);
    return n.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: d });
  };
  /** Roll el's number to target (Vietnamese format). opts: {from, decimals, duration}.
      Without opts.from it starts from el.dataset.count (the last value shown).
      If page code writes el.textContent itself mid-roll (e.g. a dash for "no value"), the roll
      stops instead of overwriting it; VR.countStop(el) stops it explicitly. */
  VR.countStop = (el) => { if (el) { cancelAnimationFrame(el._vrCount || 0); el._vrCount = 0; } };
  VR.countTo = (el, target, opts) => {
    const o = opts || {};
    const decimals = o.decimals ?? el.dataset.decimals;
    const from = o.from ?? (Number(el.dataset.count) || 0);
    el.dataset.count = String(target);
    VR.countStop(el);
    if (VR.reducedMotion) { el.textContent = numText(target, decimals); return; }
    const start = performance.now();
    const dur = o.duration || 900;
    let shown = el.textContent;
    const step = (t) => {
      if (el.textContent !== shown) { el._vrCount = 0; return; }  // someone else wrote the text
      const p = Math.max(0, Math.min(1, (t - start) / dur));   // a frame stamped before start: never below the start
      const eased = 1 - Math.pow(1 - p, 3);
      const factor = Math.pow(10, Number(decimals) || 0);
      el.textContent = shown = numText(Math.round((from + (target - from) * eased) * factor) / factor, decimals);
      el._vrCount = p < 1 ? requestAnimationFrame(step) : 0;
    };
    el._vrCount = requestAnimationFrame(step);
  };

  /** Run fn(el) once when el enters the viewport. */
  VR.inView = (el, fn, opts) => {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { fn(el); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        fn(entry.target);
      });
    }, Object.assign({ threshold: 0.35 }, opts || {}));
    io.observe(el);
  };

  /** Toggle cls on each element while it is on screen (idle loops that should not run off-screen). */
  VR.live = (els, cls) => {
    const list = Array.from(els || []);
    const name = cls || "is-live";
    if (!list.length || VR.reducedMotion || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle(name, entry.isIntersecting));
    }, { rootMargin: "40px 0px" });
    list.forEach((el) => io.observe(el));
  };

  /** [data-tilt]: a floating card leans ≤ 3° toward the pointer, and settles back on leave. */
  VR.tilt = (root) => {
    if (VR.reducedMotion || !window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    (root || document).querySelectorAll("[data-tilt]").forEach((el) => {
      const max = Number(el.dataset.tilt) || 3;
      let frame = 0;
      let settle = 0;
      el.addEventListener("pointermove", (event) => {
        const r = el.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - 0.5;
        const y = (event.clientY - r.top) / r.height - 0.5;
        clearTimeout(settle);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          el.style.transition = "transform 160ms linear";
          el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
        });
      });
      el.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        el.style.transition = "transform 420ms cubic-bezier(.2,.7,.2,1)";
        el.style.transform = "";
        settle = setTimeout(() => { el.style.transition = ""; }, 460);  /* hand transitions back to the stylesheet */
      });
    });
  };

  /* ---------- Vietnam time (static-export safe: every relative word is computed here) ----------
     VR.vnNow() -> {date: "2026-11-14", minutes: 754 (since 00:00 in Asia/Ho_Chi_Minh), offsetOk: bool}.
     offsetOk is false when the visitor's clock is not on +07:00, so labels can add "(giờ Việt Nam)".
     A ?now=2026-11-14T12:29+07:00 query is honoured only where the page sets VR.allowFakeNow (DEBUG). */
  VR.now = () => {
    if (VR.allowFakeNow) {
      const fake = (new URLSearchParams(location.search).get("now") || "").replace(" ", "+");  // "+07:00" arrives as " 07:00"
      const t = fake ? Date.parse(fake) : NaN;
      if (Number.isFinite(t)) return t;
    }
    return Date.now();
  };
  VR.vnNow = (at) => {
    const t = at == null ? VR.now() : at;
    const parts = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t))
      .forEach((p) => { parts[p.type] = p.value; });
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute),
      offsetOk: new Date(t).getTimezoneOffset() === -420, t };
  };
  /** days between two "YYYY-MM-DD" dates (b - a) */
  VR.dayDiff = (a, b) => Math.round((Date.UTC(...b.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0)))
    - Date.UTC(...a.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0)))) / 864e5);
  /** "hôm nay" / "hôm qua" / "dd/mm" for a YYYY-MM-DD (or ISO) date, in Vietnam time */
  VR.relTime = (iso) => {
    const day = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
    const diff = VR.dayDiff(day, VR.vnNow().date);
    return diff === 0 ? "hôm nay" : diff === 1 ? "hôm qua" : `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  };
  VR.refreshRel = (root) => {
    (root || document).querySelectorAll("time[data-rel]").forEach((el) => {
      const label = VR.relTime(el.getAttribute("datetime"));
      if (label && el.textContent !== label) el.textContent = label;
    });
  };

  /* ---------- header field: the header takes the colour of the field under its centre line ----------
     Sections carry data-field="porcelain|paper|night|navy|ultra|cobalt|deep|sun|sky"; one IntersectionObserver watches a 1px line
     at y = 36 (rebuilt on resize) and writes html[data-field]. Overlapping sheets: the later one wins. */
  VR.fieldHeader = () => {
    // only field markers (job cards also carry data-field: their field label, never one of these values)
    const FIELDS = new Set(["porcelain", "paper", "night", "navy", "ultra", "cobalt", "deep", "sun", "sky"]);
    const fields = Array.from(document.querySelectorAll("main [data-field], .site-footer[data-field], .site-footer [data-field]"))
      .filter((el) => FIELDS.has(el.dataset.field));
    if (!fields.some((el) => el.closest("main")) || !("IntersectionObserver" in window)) return;  // inner pages keep the V2 header
    const root = document.documentElement;
    const live = new Set();
    let io;
    const apply = () => {
      const top = fields.filter((el) => live.has(el)).pop();
      const value = top ? top.dataset.field : "porcelain";
      if (root.dataset.field !== value) root.dataset.field = value;
    };
    const build = () => {
      if (io) io.disconnect();
      live.clear();
      const below = Math.max(0, window.innerHeight - 37);
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) live.add(e.target); else live.delete(e.target); });
        apply();
      }, { rootMargin: `-36px 0px -${below}px 0px`, threshold: 0 });
      fields.forEach((el) => io.observe(el));
    };
    root.dataset.field = fields[0].dataset.field;
    /* reading innerHeight during the deferred-script task forces a full layout with the fallback font (then the
       web font forces a second one): build after the first frame instead, when layout is already clean. A page
       restored mid-scroll gets its field one frame later. */
    requestAnimationFrame(() => setTimeout(build, 0));
    let resizeTimer = 0;
    window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 150); }, { passive: true });
  };

  /* ---------- cross-document view transitions: a job card title morphs into the job page h1 ---------- */
  if ("onpageswap" in window) {
    const JOB_PAGE = /\/viec-lam\/\d+-[^/]*\/?$/;
    window.addEventListener("pageswap", (event) => {
      const vt = event.viewTransition;
      const url = event.activation && event.activation.entry ? event.activation.entry.url : "";
      if (!vt || !JOB_PAGE.test(new URL(url || location.href).pathname)) return;
      const a = Array.from(document.querySelectorAll("a[href]"))
        .find((el) => el.href === url && el.closest(".job-card, .job-pick, .job-feature, .job-row"));
      const title = a && (a.closest("h3") || a);
      if (!title) return;
      title.style.viewTransitionName = "vt-job-title";
      vt.finished.finally(() => { title.style.viewTransitionName = ""; });
    });
    window.addEventListener("pagereveal", (event) => {
      const vt = event.viewTransition;
      const nav = window.navigation;
      const from = nav && nav.activation && nav.activation.from ? nav.activation.from.url : "";
      const h1 = document.querySelector("h1.jd-title");
      if (!vt || !h1 || !from || JOB_PAGE.test(new URL(from).pathname)) return;
      h1.style.viewTransitionName = "vt-job-title";
      vt.finished.finally(() => { h1.style.viewTransitionName = ""; });
    });
  }

  /* ---------- logo fallback ----------
     Logos are hotlinked from the job sources. When one 404s or is blocked, the <img> inside a
     .logo tile is swapped for the tile's data-initials (the neutral initials treatment), so a
     broken-image glyph never shows. One delegated listener in the capture phase (error events
     do not bubble); images that failed before this script ran are swept on ready. */
  const logoFallback = (img) => {
    const tile = img && img.closest && img.closest(".logo");
    if (!tile) return;
    tile.textContent = tile.dataset.initials || "";
    tile.classList.add("logo--fallback");
  };
  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) logoFallback(event.target);
  }, true);

  /* ---------- header behaviour, reveal-on-scroll, clocks, numbers ---------- */
  VR.onReady(() => {
    VR.applyShortTitles();
    document.querySelectorAll(".logo img").forEach((img) => {
      /* lazy images have not loaded yet, so their errors still reach the listener above */
      if (img.loading !== "lazy" && img.complete && img.naturalWidth === 0 && img.getAttribute("src")) logoFallback(img);
    });

    VR.fieldHeader();
    VR.refreshRel();
    const header = document.querySelector("[data-header]");
    if (header) {
      const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
      requestAnimationFrame(onScroll);  // after the first layout: reading scrollY in the deferred-script task forces one
      window.addEventListener("scroll", onScroll, { passive: true });
      const toggle = header.querySelector("[data-menu-toggle]");
      const menu = document.querySelector("[data-menu]");
      /* While the full-screen menu is open, the page behind it is inert (no focus, no clicks) and Tab
         cycles through the menu toggle and the menu only. */
      const behind = [document.getElementById("main"), document.querySelector(".site-footer")].filter(Boolean);
      const setOpen = (open) => {
        header.classList.toggle("is-open", open);
        document.documentElement.classList.toggle("menu-open", open);
        behind.forEach((el) => { el.inert = open; if (open) el.setAttribute("aria-hidden", "true"); else el.removeAttribute("aria-hidden"); });
        if (toggle) {
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
          const label = toggle.querySelector(".sr-only");
          if (label) label.textContent = open ? "Đóng menu" : "Mở menu";
        }
      };
      const FOCUSABLE = "a[href], button:not([disabled])";
      const trapItems = () => [...header.querySelectorAll(FOCUSABLE), ...(menu ? menu.querySelectorAll(FOCUSABLE) : [])]
        .filter((el) => el.getClientRects().length > 0);
      if (toggle) toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));
      if (menu) menu.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
      document.addEventListener("keydown", (event) => {
        if (!header.classList.contains("is-open")) return;
        if (event.key === "Escape") { setOpen(false); if (toggle) toggle.focus(); return; }
        if (event.key !== "Tab") return;
        const items = trapItems();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const inside = items.includes(document.activeElement);
        if (event.shiftKey && (document.activeElement === first || !inside)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !inside)) { event.preventDefault(); first.focus(); }
      });
      window.addEventListener("resize", () => { if (window.innerWidth > 960) setOpen(false); }, { passive: true });
    }

    document.querySelectorAll("[data-tabs]").forEach((root) => VR.tabs(root));

    /* Once the fade-in has played, drop .reveal (keep .is-in for child animations): its
       transition/transform rules outrank the block's own, so .tile / a.card would never lift on
       hover and hover transitions would inherit the stagger delay. */
    const settle = (el) => {
      let timer;
      const done = () => { clearTimeout(timer); el.removeEventListener("transitionend", onEnd); el.classList.remove("reveal"); };
      const onEnd = (event) => { if (event.target === el && event.propertyName === "opacity") done(); };
      el.addEventListener("transitionend", onEnd);
      timer = setTimeout(done, 1800);
    };
    const reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && reveals.length && !VR.reducedMotion) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            settle(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      reveals.forEach((el) => io.observe(el));
    } else {
      reveals.forEach((el) => { el.classList.add("is-in"); el.classList.remove("reveal"); });
    }

    // <time data-clock="Asia/Ho_Chi_Minh"> live local clocks
    const clocks = document.querySelectorAll("[data-clock]");
    if (clocks.length) {
      const tick = () => clocks.forEach((el) => {
        try {
          el.textContent = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: el.dataset.clock }).format(new Date());
        } catch (_) { /* unknown zone */ }
      });
      tick();
      setInterval(tick, 20000);
    }

    // <span data-num>1417</span> -> 1.417 (Vietnamese grouping). Integers only: the server may already
    // print "1.417" (|vn_int), so dots/commas are group separators here, never decimals. Inputs that use
    // data-num="name" as a hook (tool-rate) are skipped.
    document.querySelectorAll("[data-num]").forEach((el) => {
      if (el.dataset.num !== "" || el.children.length) return;
      const raw = String(el.textContent).trim();
      if (!/^-?[\d.,\s]+$/.test(raw)) return;
      const n = Number(raw.replace(/[.,\s]/g, ""));
      if (Number.isFinite(n)) el.textContent = n.toLocaleString("vi-VN");
    });
    VR.refreshAges();

    // count-up numbers: <span data-count="715">715</span>, decimals: data-count="27.5" data-decimals="1".
    // Only numeric values roll: a bare/empty data-count (a hook some page uses for its own
    // purpose) is left alone instead of being overwritten with "0".
    const counters = Array.from(document.querySelectorAll("[data-count]"))
      .filter((el) => el.dataset.count.trim() !== "" && Number.isFinite(Number(el.dataset.count)));
    counters.forEach((el) => { el.textContent = numText(Number(el.dataset.count) || 0, el.dataset.decimals); });
    if ("IntersectionObserver" in window && counters.length && !VR.reducedMotion) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          VR.countTo(entry.target, Number(entry.target.dataset.count) || 0, { from: 0 });
        });
      }, { threshold: 0.4 });
      counters.forEach((el) => io.observe(el));
    }

    // V3: matte objects bob only while on screen; floating cards tilt toward the pointer
    VR.live(document.querySelectorAll(".obj"));
    VR.tilt();

    syncSaveButtons();
  });
})();

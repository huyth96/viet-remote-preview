/* Việt Remote — the community group (events, stories, a story, post a job, about), direction A (community-a.css).
   common.js (window.VR) does the heavy lifting: inline validation (form[data-validate]), copy buttons
   ([data-copy-from|text]), VR.busy, toasts, the action bar, the lively layer ([data-live], [data-to] count-ups).
   Here only what these pages add: the post-a-job submit (pending, the static export's fetch, the success panel) and
   its live preview, .ics on events and the next session's agenda (its time track), the story frame you can write in
   (/cau-chuyen/: what you type fills the text the copy button copies). A row lighting its twin (the about checks,
   the agenda's parts and segments) is the kit's: ed.js [data-ed-twins]. Static-export safe: ?da-gui=1 is read in the
   browser.
   (The peer-group / mentor sign-up was cut, client 19/11.) */
(function () {
  "use strict";
  const VR = window.VR;
  if (!VR) return;

  const params = new URLSearchParams(window.location.search);
  const smooth = () => (VR.reducedMotion ? "auto" : "smooth");
  /* run after the load event: the browser's own scroll to the URL's #fragment would undo an earlier focus */
  const afterLoad = (fn) => {
    if (document.readyState === "complete") requestAnimationFrame(fn);
    else window.addEventListener("load", () => requestAnimationFrame(fn), { once: true });
  };

  /* ---- the submit (post a job) */
  /** "congty.vn" → "https://congty.vn": employers rarely type the scheme. Runs on blur, before the kit's check
      (focusout), so the field is judged with the scheme already added. */
  function fixUrl(el) {
    const value = el.value.trim();
    if (value && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^mailto:/i.test(value)) el.value = "https://" + value.replace(/^\/+/, "");
  }

  function showSent(form, sent) {
    if (!sent) return;
    form.hidden = true;
    sent.hidden = false;
    sent.classList.add("is-new");
    sent.focus({ preventScroll: true });
    sent.scrollIntoView({ behavior: smooth(), block: "center" });
  }

  function wireForm(form) {
    const sent = document.querySelector("[data-sent]");
    form.querySelectorAll('input[type="url"]').forEach((el) => el.addEventListener("blur", () => fixUrl(el)));
    /* the server's "Còn N ô cần sửa" summary goes once nothing is marked wrong any more */
    const summary = form.querySelector(".cg-form-errors");
    if (summary) {
      const check = () => { if (!form.querySelector('[aria-invalid="true"]')) summary.hidden = true; };
      form.addEventListener("input", () => requestAnimationFrame(check));
      form.addEventListener("change", () => requestAnimationFrame(check));
    }
    const buttons = () => Array.from(document.querySelectorAll(`[data-submit], button[type="submit"][form="${form.id}"]`))
      .filter((b) => b.form === form);
    /* the kit's check runs first (capture) and stops an invalid submit; this only sees a valid one */
    form.addEventListener("submit", (event) => {
      form.querySelectorAll('input[type="url"]').forEach(fixUrl);
      buttons().forEach((b) => VR.busy(b, true));
      if (!form.hasAttribute("data-remote")) return;                    // a normal POST to the Django view
      event.preventDefault();
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          buttons().forEach((b) => VR.busy(b, false));
          form.reset();
          form.dispatchEvent(new Event("input", { bubbles: true }));
          showSent(form, sent);
        })
        .catch(() => {
          /* the endpoint refused fetch (CORS, an old browser): let the browser post the form itself */
          HTMLFormElement.prototype.submit.call(form);
        });
    });
    /* back from the next page (bfcache): the pending state must not stick */
    window.addEventListener("pageshow", (event) => { if (event.persisted) buttons().forEach((b) => VR.busy(b, false)); });

    if (params.get("da-gui") === "1" && sent && sent.hidden) afterLoad(() => showSent(form, sent));
    /* after a real submit the page comes back with the panel showing: focus it, so screen readers announce it */
    else if (sent && !sent.hidden) afterLoad(() => sent.focus({ preventScroll: true }));
    /* back with server errors: the first wrong field takes focus (the summary above says how many) */
    else if (form.querySelector('[aria-invalid="true"]')) afterLoad(() => form.querySelector('[aria-invalid="true"]').focus());

    /* "Gửi thêm một tin" after an inline (fetch) success: same document, so reopen the form */
    const again = sent && sent.querySelector(".cg-sent__again");
    if (again) again.addEventListener("click", (event) => {
      if (!form.hidden || params.get("da-gui") === "1") return;
      event.preventDefault();
      sent.hidden = true;
      form.hidden = false;
      const first = form.querySelector("input:not([type=hidden]):not(.hp):not([type=radio]), textarea");
      if (first) first.focus();
    });
  }

  /* ---- events: save to calendar (.ics) */
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const slug = (s) => VR.fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  /* RFC 5545 §3.1: a content line is at most 75 octets; longer ones continue on lines that start with one space. Cut
     on whole characters (UTF-8: a Vietnamese letter is 2-3 octets), never inside one. */
  const utf8 = new TextEncoder();
  const icsFold = (line) => {
    const out = [];
    let cur = "";
    let size = 0;
    for (const ch of line) {
      const n = utf8.encode(ch).length;
      if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; size = 0; }
      cur += ch;
      size += n;
    }
    out.push(cur);
    return out.join("\r\n ");
  };

  function initCalendar() {
    document.querySelectorAll("[data-event]").forEach((item) => {
      const button = item.querySelector("[data-ics]");
      const start = new Date(item.dataset.start);
      if (!button) return;
      if (Number.isNaN(start.getTime())) { button.hidden = true; return; }
      button.addEventListener("click", () => {
        const end = new Date(start.getTime() + (Number(item.dataset.minutes) || 60) * 60000);
        const lines = [
          "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Viet Remote//Events//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          "UID:" + icsDate(start) + "-" + slug(item.dataset.title).slice(0, 40) + "@vietremote",
          "DTSTAMP:" + icsDate(new Date()),
          "DTSTART:" + icsDate(start),
          "DTEND:" + icsDate(end),
          "SUMMARY:" + icsText(item.dataset.title),
          "DESCRIPTION:" + icsText([item.dataset.summary, item.dataset.url].filter(Boolean).join("\n")),
          "LOCATION:" + icsText(item.dataset.format),
          "URL:" + icsText(item.dataset.url),
          "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(item.dataset.title), "END:VALARM",
          "END:VEVENT", "END:VCALENDAR",
        ];
        const url = URL.createObjectURL(new Blob([lines.map(icsFold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = (slug(item.dataset.title) || "su-kien") + ".ics";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        VR.toast("Đã tạo file lịch, mở để thêm vào lịch của bạn", { tone: "ok" });
      });
    });
  }

  /* ---- post a job: the live preview */
  function initials(company) {
    const words = String(company || "").split(/[\s\-–—|()]+/).filter((w) => w && /[\p{L}\p{N}]/u.test(w[0]));
    if (!words.length) return "VR";
    return (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
  }
  /* the board's tone for a company (the twin of the logo_tone filter): the same company keeps its tint */
  const tone = (company) => VR.logoTone({ company, initials: company ? "x" : "", field: "" });

  function initPostJob() {
    const form = document.querySelector("[data-job-form]");
    if (!form) return;
    const previews = Array.from(document.querySelectorAll("[data-preview]"));
    const val = (name) => { const el = form.elements.namedItem(name); return el ? String(el.value || "").trim() : ""; };
    const vn = form.elements.namedItem("open_to_vietnam");
    const count = document.querySelector("[data-count]");
    const countN = count && count.querySelector("[data-count-n]");
    const scores = Array.from(document.querySelectorAll("[data-tips-score]"));
    const rings = Array.from(document.querySelectorAll("[data-tips-ring]"));
    const bar = document.querySelector("[data-bar-value]");
    const barLabel = document.querySelector("[data-bar-label]");
    const tips = Array.from(document.querySelectorAll("[data-tip]"));
    const RULES = ["salary", "timezone_note", "job_url", "description"];

    let frame = 0;
    const render = () => {
      frame = 0;
      const company = val("company");
      const title = val("job_title");
      previews.forEach((preview) => {
        const set = (key, text, fallback) => {
          const node = preview.querySelector(`[data-p="${key}"]`);
          if (!node) return;
          if (node.textContent !== (text || fallback)) node.textContent = text || fallback;
          node.classList.toggle("is-placeholder", !text);
        };
        set("company", VR.shortCompany(company), "Tên công ty");
        set("title", VR.shortTitle(title), "Vị trí bạn đang tuyển");
        set("salary", VR.keepRanges ? VR.keepRanges(val("salary")) : val("salary"), "Lương thỏa thuận");
        const type = preview.querySelector('[data-p="type"]');
        if (type) { type.textContent = val("employment_type"); type.hidden = !val("employment_type"); type.classList.remove("is-placeholder"); }
        const logo = preview.querySelector('[data-p="logo"]');
        if (logo) { logo.textContent = initials(company); logo.dataset.tone = String(tone(company)); }
        const badge = preview.querySelector('[data-p="vn"]');
        if (badge && vn) badge.hidden = !vn.checked;
      });
      /* the tips are rendered twice (beside the form, and inside it under 1100 px): judge each rule once */
      const done = {};
      RULES.forEach((rule) => { done[rule] = rule === "description" ? val("description").length >= 300 : Boolean(val(rule)); });
      tips.forEach((li) => {
        const on = Boolean(done[li.dataset.tip]);
        li.classList.toggle("is-off", !on);
        const state = li.querySelector("[data-tip-state]");
        if (state) state.textContent = on ? "Đã có: " : "Chưa có: ";
      });
      const met = RULES.filter((rule) => done[rule]).length;
      scores.forEach((score) => {
        VR.liveCount(score, `${met}/${RULES.length}`);
        score.classList.toggle("is-full", met === RULES.length);
      });
      rings.forEach((ring) => {
        ring.style.setProperty("--v", String(Math.round((met / RULES.length) * 100)));
        ring.classList.toggle("is-full", met === RULES.length);
      });
      if (countN) {
        const n = val("description").length;
        VR.liveCount(countN, n);
        count.classList.toggle("is-met", n >= 300);
      }
      if (bar) bar.textContent = title ? VR.shortTitle(title) : "Chưa có tên vị trí";
      if (barLabel) barLabel.textContent = `Tin của bạn · đủ ${met}/${RULES.length} điều nên có`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    render();
  }

  /* ---- events: the next session's agenda. Each line of Event.description is one part ("1. Đọc tin … (15 phút)"):
     the leading number goes (the list numbers itself), the minutes become the part's segment length on the track
     and its clock times (Vietnam time, from the session's start); a line without minutes stays as written. */
  const clock = (d) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
  function initAgenda() {
    document.querySelectorAll("[data-agenda]").forEach((box) => {
      const items = Array.from(box.querySelectorAll(".ca-ag__item"));
      const segs = Array.from(box.querySelectorAll(".ca-ag__track > i"));
      const start = new Date(box.dataset.start);
      const parts = items.map((li) => {
        const t = li.querySelector(".ca-ag__t");
        const raw = t.textContent.replace(/^\s*\d+\s*[.)]\s*/, "");
        const m = /^(.*?)\s*\((\d+)\s*phút\)\s*$/i.exec(raw);
        t.textContent = m ? m[1] : raw;
        return m ? Number(m[2]) : 0;
      });
      const timed = parts.every((n) => n > 0) && !Number.isNaN(start.getTime());
      let at = start.getTime();
      items.forEach((li, i) => {
        li.dataset.edK = String(i);
        if (segs[i]) { segs[i].dataset.edK = String(i); if (parts[i]) segs[i].style.setProperty("--m", String(parts[i])); }
        const min = li.querySelector(".ca-ag__min");
        if (!min || !parts[i]) return;
        if (timed) {
          const from = new Date(at);
          at += parts[i] * 60000;
          min.textContent = `${clock(from)}–${clock(new Date(at))}`;
        } else min.textContent = `${parts[i]} phút`;
      });
      const axis = box.querySelector(".ca-ag__axis");
      if (axis && timed) axis.innerHTML = `<span>${clock(start)}</span><span>${clock(new Date(at))}</span>`;
      /* the longest part is the session's centre: lit until a row is pointed at */
      const longest = parts.indexOf(Math.max(...parts));
      box.setAttribute("data-ed-twins", parts[longest] ? String(longest) : "");
      if (window.edTwins) window.edTwins(box.parentNode);   // the kit's twins (ed.js)
    });
  }

  /* ---- stories: the frame you can write in. Each question is a real field; what is typed fills the plain text the
     copy button copies ([data-tell] names it), so "Sao chép" hands over the story ready to paste on Skool. The draft
     stays on this device only (localStorage, when the browser allows it). */
  function initTell() {
    const post = document.querySelector("[data-tell]");
    const out = post && document.querySelector(post.dataset.tell);
    if (!out) return;
    const base = out.textContent;
    const fields = Array.from(post.querySelectorAll("textarea[data-q]"));
    const count = post.querySelector("[data-tell-count]");
    const KEY = "vr-story-draft";
    const fits = window.CSS && CSS.supports && CSS.supports("field-sizing", "content");
    const grow = (f) => { if (fits) return; f.style.height = "auto"; f.style.height = `${f.scrollHeight}px`; };
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (saved) fields.forEach((f) => { if (typeof saved[f.name] === "string") f.value = saved[f.name]; });
    } catch (error) { /* storage blocked: start empty */ }
    const render = () => {
      let text = base;
      const draft = {};
      let done = 0;
      fields.forEach((f) => {
        const v = f.value.trim();
        draft[f.name] = f.value;
        f.closest(".ca-q").classList.toggle("is-done", Boolean(v));
        if (v) { done += 1; text = text.replace(`${f.dataset.q}:`, () => `${f.dataset.q}: ${v}`); }   // a function: "$&", "$'" stay as typed
      });
      out.textContent = text;
      if (count) {
        count.textContent = `Đã viết ${done}/${fields.length} câu`;
        count.classList.toggle("is-full", done === fields.length);
      }
      try { window.localStorage.setItem(KEY, JSON.stringify(draft)); } catch (error) { /* not kept: fine */ }
    };
    let frame = 0;
    post.addEventListener("input", (event) => {
      if (event.target.matches("textarea[data-q]")) grow(event.target);
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); });
    });
    fields.forEach(grow);
    render();
  }

  VR.onReady(() => {
    document.querySelectorAll("[data-job-form]").forEach(wireForm);
    initCalendar();
    initPostJob();
    initAgenda();
    initTell();
  });
})();

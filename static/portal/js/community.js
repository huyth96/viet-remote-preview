/* Việt Remote — community & company pages (community, events, stories, post a job, about, 404).
   Depends on common.js (window.VR). Everything here also works on the static export:
   ?loai= / ?da-gui=1 are read in the browser, and forms with [data-remote] post to the
   external form endpoint with fetch, falling back to a normal submit. */
(function () {
  "use strict";
  const VR = window.VR;
  if (!VR) return;

  const params = new URLSearchParams(window.location.search);
  const KINDS = ["peer_group", "find_mentor", "be_mentor"];

  /* ---------------------------------------------------------------- validation (both forms) */
  const MESSAGES = {
    radio: "Chọn một trong ba lựa chọn.",
    select: "Chọn một mục trong danh sách.",
    email: "Email chưa đúng, ví dụ: ban@email.com.",
    url: "Link chưa đúng, ví dụ: https://congty.vn",
    text: "Ô này cần được điền.",
    long: "Nội dung dài quá giới hạn.",
  };

  function messageFor(el) {
    const v = el.validity;
    if (el.type === "radio") return MESSAGES.radio;
    if (el.tagName === "SELECT") return MESSAGES.select;
    if (v.valueMissing) return el.dataset.msg || MESSAGES.text;
    if (v.typeMismatch && el.type === "email") return MESSAGES.email;
    if (v.typeMismatch && el.type === "url") return MESSAGES.url;
    if (v.tooLong) return MESSAGES.long;
    return el.validationMessage || MESSAGES.text;
  }

  function errorHost(el) {
    return el.type === "radio" ? el.closest(".kinds") : el.closest(".field");
  }

  function setError(el, message) {
    const host = errorHost(el);
    if (!host) return;
    const id = "err-" + el.name;
    let node = host.querySelector(".field__error");
    if (message) {
      if (!node) {
        node = document.createElement("p");
        node.className = "field__error";
        node.id = id;
        host.appendChild(node);
      }
      node.textContent = message;
      host.classList.add(el.type === "radio" ? "is-invalid" : "field--error");
      const targets = el.type === "radio" ? [host] : [el];
      targets.forEach((t) => {
        if (t !== host) t.setAttribute("aria-invalid", "true");
        const ids = new Set((t.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
        ids.add(node.id);
        t.setAttribute("aria-describedby", Array.from(ids).join(" "));
      });
    } else if (node) {
      node.remove();
      host.classList.remove("is-invalid", "field--error");
      const targets = el.type === "radio" ? [host] : [el];
      targets.forEach((t) => {
        t.removeAttribute("aria-invalid");
        const ids = (t.getAttribute("aria-describedby") || "").split(" ").filter((x) => x && x !== node.id);
        if (ids.length) t.setAttribute("aria-describedby", ids.join(" "));
        else t.removeAttribute("aria-describedby");
      });
    }
  }

  /** "congty.vn" → "https://congty.vn": employers rarely type the scheme. */
  function fixUrl(el) {
    if (!el || el.type !== "url") return;
    const value = el.value.trim();
    if (value && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^mailto:/i.test(value)) el.value = "https://" + value.replace(/^\/+/, "");
  }

  function validate(form) {
    form.querySelectorAll('input[type="url"]').forEach(fixUrl);
    let first = null;
    const seenRadio = new Set();
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type === "hidden" || el.disabled || !el.name) return;
      if (el.type === "radio") {
        if (seenRadio.has(el.name)) return;
        seenRadio.add(el.name);
      }
      const ok = el.checkValidity();
      setError(el, ok ? "" : messageFor(el));
      if (!ok && !first) first = el;
    });
    // the server-side summary notice is stale once the user has edited the form
    const summary = form.querySelector(".form-errors");
    if (summary) summary.hidden = true;
    if (first) {
      const target = first.type === "radio" ? form.querySelector('.kind__input:not(:checked)') || first : first;
      target.focus({ preventScroll: true });
      (errorHost(first) || first).scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "center" });
    }
    return !first;
  }

  function showSent(form, sent) {
    if (!sent) return;
    form.hidden = true;
    sent.hidden = false;
    sent.classList.add("is-new");
    sent.focus({ preventScroll: true });
    sent.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "center" });
  }

  /** Validate in Vietnamese; post [data-remote] forms with fetch (static export). */
  function wireForm(form, sent) {
    form.noValidate = true;
    form.querySelectorAll('input[type="url"]').forEach((el) => el.addEventListener("blur", () => {
      fixUrl(el);
      if (errorHost(el) && errorHost(el).querySelector(".field__error") && el.checkValidity()) setError(el, "");
    }));
    form.addEventListener("input", (event) => {
      const el = event.target;
      if (el.name && errorHost(el) && errorHost(el).querySelector(".field__error") && el.checkValidity()) setError(el, "");
    });
    form.addEventListener("change", (event) => {
      const el = event.target;
      if (el.name && errorHost(el) && errorHost(el).querySelector(".field__error") && el.checkValidity()) setError(el, "");
    });
    form.addEventListener("submit", (event) => {
      if (!validate(form)) { event.preventDefault(); return; }
      const button = form.querySelector('[type="submit"]');
      if (!form.hasAttribute("data-remote")) {
        if (button) { button.classList.add("is-disabled"); button.setAttribute("aria-busy", "true"); }
        return; // normal POST to the Django view
      }
      event.preventDefault();
      if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          form.reset();
          showSent(form, sent);
        })
        .catch(() => {
          // endpoint refused fetch (CORS/old browser): let the browser post the form itself
          if (button) { button.disabled = false; button.removeAttribute("aria-busy"); }
          HTMLFormElement.prototype.submit.call(form);
        });
    });
    // Both run after the load event: the browser's scroll to the URL's #fragment (#dang-ky, #gui-tin) happens then and
    // would blur anything focused earlier.
    const afterLoad = (fn) => {
      if (document.readyState === "complete") requestAnimationFrame(fn);
      else window.addEventListener("load", () => requestAnimationFrame(fn), { once: true });
    };
    // on the static export the endpoint can redirect back with ?da-gui=1
    if (params.get("da-gui") === "1" && sent && sent.hidden) afterLoad(() => showSent(form, sent));
    // after a real (server-side) submit the page comes back with the success card already showing: move focus to
    // it, so screen readers announce it (role=status alone is not read when it is there on load)
    else if (sent && !sent.hidden) afterLoad(() => sent.focus({ preventScroll: true }));
  }

  /* ---------------------------------------------------------------- community signup */
  /** Program rows: pick the kind and glide to #dang-ky instead of reloading the page. */
  function wireKindLinks(radios, pick) {
    document.querySelectorAll("[data-kind-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const kind = link.dataset.kindLink;
        pick(kind);
        const target = document.getElementById("dang-ky");
        if (target) target.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "start" });
        const radio = radios.find((r) => r.value === kind);
        if (radio) setTimeout(() => radio.focus({ preventScroll: true }), VR.reducedMotion ? 0 : 450);
      });
    });
  }

  /** Copy-a-template buttons ([data-copy-template]): copy the visible <pre> next to them. */
  function wireTemplateCopy(root, message) {
    const button = root.querySelector("[data-copy-template]");
    if (!button) return;
    button.hidden = false;
    button.addEventListener("click", () => {
      const pre = Array.from(root.querySelectorAll(".msg-tpl__body")).find((el) => el.offsetParent !== null);
      if (pre) VR.copy(pre.textContent.trim() + "\n", message);
    });
  }

  /* Static export without a form endpoint: the kind picker chooses a Skool message template. */
  function initSkoolSignup() {
    const box = document.querySelector("[data-skool-signup]");
    if (!box) return;
    const radios = Array.from(box.querySelectorAll(".kind__input"));
    const select = (kind, updateUrl) => {
      const radio = radios.find((r) => r.value === kind);
      if (!radio) return;
      radio.checked = true;
      box.dataset.kind = kind;
      if (updateUrl && window.history && history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set("loai", kind);
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    };
    radios.forEach((radio) => radio.addEventListener("change", () => select(radio.value, true)));
    const fromUrl = params.get("loai");
    const checked = radios.find((r) => r.checked);
    select(KINDS.includes(fromUrl) ? fromUrl : checked ? checked.value : "peer_group", false);
    wireKindLinks(radios, (kind) => select(kind, true));
    wireTemplateCopy(box, "Đã sao chép mẫu, dán vào tin nhắn trên Skool");
  }

  function initSignup() {
    const form = document.querySelector("[data-signup-form]");
    if (!form) return;
    const sent = document.querySelector("[data-sent]");
    const radios = Array.from(form.querySelectorAll(".kind__input"));
    const goal = form.querySelector("#id_goal");

    const apply = (kind, updateUrl) => {
      if (!KINDS.includes(kind)) return;
      form.dataset.kind = kind;
      if (goal) {
        const ph = goal.getAttribute("data-ph-" + kind);
        if (ph) goal.placeholder = ph;
      }
      if (updateUrl && window.history && history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set("loai", kind);
        url.searchParams.delete("da-gui");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    };
    const select = (kind, updateUrl) => {
      const radio = radios.find((r) => r.value === kind);
      if (!radio) return;
      radio.checked = true;
      setError(radio, "");
      apply(kind, updateUrl);
    };

    radios.forEach((radio) => radio.addEventListener("change", () => apply(radio.value, true)));
    // static export: ?loai= is not seen by the server, honour it here
    const fromUrl = params.get("loai");
    if (KINDS.includes(fromUrl) && !radios.some((r) => r.checked && r.value === fromUrl)) select(fromUrl, false);
    const checked = radios.find((r) => r.checked);
    apply(checked ? checked.value : "peer_group", false);

    wireKindLinks(radios, (kind) => {
      if (form.hidden && sent) { sent.hidden = true; form.hidden = false; }
      select(kind, true);
    });

    // availability quick picks fill the text field (comma separated), the field stays editable
    const avail = form.querySelector("#id_availability");
    const picks = form.querySelector("[data-avail-picks]");
    if (avail && picks) {
      const chips = Array.from(picks.querySelectorAll(".chip"));
      const parts = () => avail.value.split(",").map((s) => s.trim()).filter(Boolean);
      const sync = () => {
        const now = parts().map((p) => VR.fold(p));
        chips.forEach((chip) => {
          const on = now.includes(VR.fold(chip.textContent));
          chip.setAttribute("aria-pressed", on ? "true" : "false");
        });
      };
      chips.forEach((chip) => chip.addEventListener("click", () => {
        const label = chip.textContent.trim();
        let list = parts();
        const i = list.findIndex((p) => VR.fold(p) === VR.fold(label));
        if (i >= 0) list.splice(i, 1); else list.push(label);
        avail.value = list.join(", ");
        sync();
      }));
      avail.addEventListener("input", sync);
      sync();
    }

    // "Gửi thêm một đăng ký" after an inline (fetch) success: same document, so reopen the form
    const again = document.querySelector("[data-send-again]");
    if (again) again.addEventListener("click", (event) => {
      if (!form.hidden || window.location.pathname !== "/cong-dong/" || params.get("da-gui") === "1") return;
      event.preventDefault();
      sent.hidden = true;
      form.hidden = false;
      form.querySelector("#id_name").focus();
    });

    wireForm(form, sent);
  }

  /* ---------------------------------------------------------------- illustrative group card */
  function initGroupCard() {
    const card = document.querySelector("[data-group-card]");
    if (!card) return;
    const items = card.querySelectorAll("li[data-done]");
    VR.inView(card, () => {
      items.forEach((li, i) => setTimeout(() => li.classList.add("is-done"), VR.reducedMotion ? 0 : 500 + i * 420));
    }, { threshold: 0.5 });
  }

  /* ---------------------------------------------------------------- events: save to calendar (.ics) */
  const icsDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

  function initCalendar() {
    document.querySelectorAll("[data-event]").forEach((item) => {
      const button = item.querySelector("[data-ics]");
      const start = new Date(item.dataset.start);
      if (!button || Number.isNaN(start.getTime())) return;
      button.hidden = false;
      button.addEventListener("click", () => {
        const end = new Date(start.getTime() + (Number(item.dataset.minutes) || 60) * 60000);
        const lines = [
          "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Viet Remote//Events//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          "UID:" + icsDate(start) + "-" + VR.fold(item.dataset.title).replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "@vietremote",
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
        const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (VR.fold(item.dataset.title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "su-kien") + ".ics";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        VR.toast("Đã tạo file lịch, mở để thêm vào lịch của bạn");
      });
    });
  }

  /* ---------------------------------------------------------------- post a job */
  function initials(company) {
    const words = String(company || "").split(/[\s\-–—|()]+/).filter((w) => w && /[\p{L}\p{N}]/u.test(w[0]));
    if (!words.length) return "VR";
    return (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
  }

  function initPostJob() {
    const form = document.querySelector("[data-job-form]");
    const review = document.querySelector("[data-review]");
    const mine = document.querySelector("[data-mine]");
    if (review) VR.inView(review, () => {
      review.classList.add("is-live");
      // the illustrative post goes live once the five checks and the badge have ticked (CSS delays)
      if (mine) setTimeout(() => mine.classList.add("is-live"), VR.reducedMotion ? 0 : 1500);
    }, { threshold: 0.4 });
    const send = document.querySelector(".pj-send");
    if (send) wireTemplateCopy(send, "Đã sao chép mẫu tin tuyển dụng");
    if (!form) return;
    const sent = document.querySelector("[data-sent]");
    const previews = Array.from(document.querySelectorAll("[data-preview]"));
    const get = (name) => form.elements.namedItem(name);
    const val = (name) => { const el = get(name); return el ? String(el.value || "").trim() : ""; };

    const render = () => {
      previews.forEach((preview) => {
        const set = (key, text, fallback) => {
          const node = preview.querySelector(`[data-p="${key}"]`);
          if (!node) return;
          node.textContent = text || fallback;
          node.classList.toggle("is-placeholder", !text);
        };
        const company = val("company");
        set("company", VR.shortCompany(company), "Tên công ty");
        set("title", VR.shortTitle(val("job_title")), "Vị trí bạn đang tuyển");
        set("salary", val("salary"), "Lương thỏa thuận");
        set("type", val("employment_type"), "Hợp đồng");
        const logo = preview.querySelector('[data-p="logo"]');
        if (logo) logo.textContent = initials(company);
        const vn = get("open_to_vietnam");
        const badge = preview.querySelector('[data-p="vn"]');
        if (badge && vn) badge.hidden = !vn.checked;
      });
      document.querySelectorAll("[data-tip]").forEach((li) => {
        const rule = li.dataset.tip;
        const on = rule === "description" ? val("description").length >= 300 : Boolean(val(rule));
        li.classList.toggle("is-off", !on);
        const state = li.querySelector("[data-tip-state]");
        if (state) state.textContent = on ? "Đã có: " : "Chưa có: ";
      });
    };
    form.addEventListener("input", render);
    form.addEventListener("change", render);
    render();
    wireForm(form, sent);
  }

  /* ---------------------------------------------------------------- copy link (story detail) */
  function initCopy() {
    document.querySelectorAll("[data-copy-link]").forEach((button) => {
      button.hidden = false;
      button.addEventListener("click", () => VR.copy(window.location.href.split("#")[0], "Đã sao chép link câu chuyện"));
    });
  }

  /* ---------------------------------------------------------------- story frame (/cau-chuyen/) */
  /** "Sao chép khung": copies the six questions as a plain-text post (from a <template>, so the
      wording lives in the page), and briefly marks the button as done. */
  function initStoryFrame() {
    const button = document.querySelector("[data-copy-frame]");
    const source = document.querySelector("template[data-frame-text]");
    if (!button || !source) return;
    button.hidden = false;
    const label = button.querySelector("[data-copy-label]");
    const idle = label ? label.textContent : "";
    let timer;
    button.addEventListener("click", () => {
      const text = source.content.textContent.replace(/^\s+|\s+$/g, "").replace(/\n[ \t]+/g, "\n");
      VR.copy(text + "\n", "Đã sao chép khung 6 câu hỏi, dán vào bài đăng trên Skool");
      button.classList.add("is-done");
      if (label) label.textContent = "Đã sao chép";
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.classList.remove("is-done");
        if (label) label.textContent = idle;
      }, 2400);
    });
  }

  VR.onReady(() => {
    initSignup();
    initSkoolSignup();
    initGroupCard();
    initCalendar();
    initPostJob();
    initCopy();
    initStoryFrame();
  });
})();

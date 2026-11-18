/* Việt Remote — /da-luu/ application tracker (needs common.js / window.VR).

   Source of truth: VR.saved (localStorage "vr.saved"), statuses VR.STATUSES.
   Desktop: kanban columns, each headed by its status tile; drag a card to another column or use its status menu
   (901–1100px: the same board scrolls sideways). Tablet portrait and phones (≤900px):
   status tabs show one column at a time. Another tab's changes arrive via "storage".
   Cards are enriched from /data/jobs.json when it loads (logo, the pay as the listing states it, closed listings);
   the empty state never fetches it (it loads once the first card is saved).
   Empty: the server-rendered app phone and "Gợi ý để bắt đầu" (three real jobs as the home's job cards, njc.html)
   are shown while nothing is saved; saving one of them fills the board.
   Notes save as you type; removing a card can be undone for a few seconds; export to CSV.
*/
(function () {
  "use strict";

  const VR = window.VR;
  if (!VR || !VR.onReady) return;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const icon = (name) => VR.icon(name);
  const TAB_KEY = "vr.savedTab";

  /* each status's tile on the board (jobs.css .sv-tile: the kit's app-icon recipe, small): a filled glyph
     (#g-*, base.html) or a line icon for "Không phù hợp" */
  const TILES = {
    saved: '<svg class="glyph"><use href="#g-bookmark"/></svg>',
    applied: '<svg class="glyph"><use href="#g-person"/></svg>',
    interview: '<svg class="glyph"><use href="#g-chat"/></svg>',
    offer: '<svg class="glyph"><use href="#g-gift"/></svg>',
    rejected: '<svg class="icon"><use href="#i-x"/></svg>',
  };
  const tileHtml = (key) => `<span class="sv-tile sv-tile--${key}" aria-hidden="true">${TILES[key] || TILES.saved}</span>`;

  const EMPTY_TEXT = {
    saved: "Bấm dấu trang trên một việc để lưu vào đây.",
    applied: "Nộp hồ sơ xong thì chuyển thẻ sang đây.",
    interview: "Được hẹn phỏng vấn? Chuyển thẻ sang đây.",
    offer: "Chỗ dành cho tin vui.",
    rejected: "Việc không hợp hoặc bị từ chối. Không sao, việc tiếp theo.",
  };

  VR.onReady(() => {
    const root = $("[data-saved-page]");
    if (!root) return;

    const board = $("[data-sv-board]", root);
    const tabs = $("[data-sv-tabs]", root);
    const empty = $("[data-sv-empty]", root);
    const suggest = $("[data-sv-suggest]", root);
    const suggestList = $("[data-sv-suggest-list]", root);
    // the summary line and the export / find buttons live in the page hero, above the board
    const actions = $("[data-sv-actions]");
    const summary = $("[data-sv-summary]");
    const local = $("[data-sv-local]", root);
    const exportBtn = $("[data-sv-export]");
    const defaultSummary = summary ? summary.innerHTML : "";

    const keys = VR.STATUSES.map((s) => s.key);
    const labelOf = Object.fromEntries(VR.STATUSES.map((s) => [s.key, s.label]));
    let feed = null;            // Map id -> job (from jobs.json)
    let active = VR.store.get(TAB_KEY, "saved");
    if (!keys.includes(active)) active = "saved";
    let editing = null;         // id whose note is open
    let quiet = false;          // skip the vr:saved re-render while typing a note
    let flashId = null;
    let undo = null;

    const statusOf = (item) => (keys.includes(item.status) ? item.status : "saved");
    const items = () => Object.values(VR.saved.all()).filter((x) => x && x.id);

    function ago(iso) {
      const t = Date.parse(iso || "");
      if (!Number.isFinite(t)) return "";
      const days = Math.floor((Date.now() - t) / 86400000);
      if (days <= 0) return "hôm nay";
      if (days === 1) return "hôm qua";
      if (days < 30) return `${days} ngày trước`;
      return new Date(t).toLocaleDateString("vi-VN");
    }
    function initials(company) {
      // anonymous Upwork client: empty tile, base.css draws the neutral client glyph (.logo:empty)
      if (/^Khách (hàng )?(trên )?Upwork$/.test(String(company || "").trim())) return "";
      const words = String(company || "").split(/[\s\-–—|()]+/).filter((w) => w && /[\p{L}\p{N}]/u.test(w[0]));
      if (!words.length) return "VR";
      return (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
    }
    // the pay as the listing states it (VR.payNative, as on the board's rows); a same-value range printed once
    function payOf(item) {
      const job = feed && feed.get(Number(item.id));
      if (job) return VR.payNative ? VR.payNative(job) : VR.payLabel(job);
      return VR.sameRange ? VR.sameRange(item.salary || "") : item.salary || "";
    }

    function cardHtml(item) {
      const e = VR.escape;
      const id = Number(item.id);
      const job = feed && feed.get(id);
      const closed = feed && !job;
      const pay = payOf(item);
      const status = statusOf(item);
      // same rule as every other logo tile: a mark that reads at this size (VR.iconLogo), else initials
      const src = job && VR.iconLogo ? VR.iconLogo(job) : "";
      const logo = src
        ? `<span class="logo logo--sm" aria-hidden="true" data-initials="${e(job.initials)}"><img src="${e(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`
        : `<span class="logo logo--sm" aria-hidden="true" data-initials="${e(job ? job.initials : initials(item.company))}">${e(job ? job.initials : initials(item.company))}</span>`;
      const options = VR.STATUSES.map((s) => `<option value="${s.key}"${s.key === status ? " selected" : ""}>${e(s.label)}</option>`).join("");
      const note = String(item.note || "");
      let noteHtml = "";
      if (editing === id) {
        noteHtml = `<textarea class="sv-note__edit" data-note-edit maxlength="1000" aria-label="Ghi chú cho ${e(VR.shortTitle(item.title))}" placeholder="Lịch phỏng vấn, người liên hệ, mức lương đã trao đổi…">${e(note)}</textarea>`;
      } else if (note) {
        noteHtml = `<button class="sv-note" type="button" data-note-open aria-label="Sửa ghi chú">${e(note)}</button>`;
      }
      return `<article class="sv-card${flashId === id ? " is-flash" : ""}" draggable="true" data-id="${id}" data-job-id="${id}" data-title="${e(item.title)}" data-company="${e(item.company)}" data-url="${e(item.url)}" data-salary="${e(item.salary)}" data-field="${e(item.field)}">
  <div class="sv-card__top">${logo}<span class="sv-card__company">${e(VR.shortCompany(item.company) || "Nhà tuyển dụng ẩn danh")}</span><button class="sv-icon sv-icon--risk sv-card__remove" type="button" data-remove aria-label="Bỏ lưu việc này" title="Bỏ lưu">${icon("x")}</button></div>
  <h3 class="sv-card__title"><a href="${e(item.url || "/viec-lam/")}" title="${e(item.title)}">${e(VR.shortTitle(item.title) || "Việc đã lưu")}</a></h3>
  <div class="sv-card__meta">
    <span class="sv-card__pay${pay ? "" : " is-none"}">${pay ? e(pay) : "Lương thỏa thuận"}</span>
    ${ago(item.savedAt) ? `<span>Lưu ${e(ago(item.savedAt))}</span>` : ""}
    ${closed ? `<span class="badge">Tin đã đóng</span>` : ""}
  </div>
  ${noteHtml}
  <div class="sv-card__foot">
    <label class="sr-only" for="sv-st-${id}">Trạng thái</label>
    <select class="select sv-select" id="sv-st-${id}" data-status>${options}</select>
    <button class="sv-icon" type="button" data-note-open aria-label="${note ? "Sửa ghi chú" : "Thêm ghi chú"}" title="${note ? "Sửa ghi chú" : "Thêm ghi chú"}">${icon("message")}</button>
  </div>
</article>`;
    }

    function render() {
      const all = items();
      const counts = Object.fromEntries(keys.map((k) => [k, 0]));
      all.forEach((item) => { counts[statusOf(item)] += 1; });
      const total = all.length;

      // (saved.html's inline script already showed the empty state before the first paint when nothing is saved)
      empty.hidden = total > 0;
      board.hidden = total === 0;
      tabs.hidden = total === 0;
      actions.hidden = total === 0;
      local.hidden = total === 0;
      if (total === 0) {
        if (summary) summary.innerHTML = defaultSummary;
        board.innerHTML = "";
        tabs.innerHTML = "";
        renderSuggest();
        return;
      }
      if (suggest) suggest.hidden = true;

      if (summary) {
        const parts = [`<strong>${total}</strong> việc đang theo dõi`];
        if (counts.applied) parts.push(`<strong>${counts.applied}</strong> đã ứng tuyển`);
        if (counts.interview) parts.push(`<strong>${counts.interview}</strong> đang phỏng vấn`);
        if (counts.offer) parts.push(`<strong>${counts.offer}</strong> nhận offer`);
        summary.innerHTML = parts.join(" · ") + ". Lưu trên trình duyệt này, không cần tài khoản.";
      }

      // mobile: if the remembered tab is empty, open the first column that has cards
      if (!counts[active]) active = keys.find((k) => counts[k]) || "saved";

      tabs.innerHTML = VR.STATUSES.map((s) =>
        `<button class="tab" type="button" data-tab="${s.key}" aria-pressed="${s.key === active ? "true" : "false"}" aria-controls="sv-col-${s.key}">${VR.escape(s.label)} <span class="tab__count">${counts[s.key]}</span></button>`
      ).join("");

      board.innerHTML = VR.STATUSES.map((s) => {
        const cards = all.filter((item) => statusOf(item) === s.key)
          .sort((a, b) => String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || "")));
        return `<section class="sv-col${s.key === active ? " is-active" : ""}" id="sv-col-${s.key}" data-col="${s.key}" aria-labelledby="sv-h-${s.key}">
  <header class="sv-col__head"><h2 class="sv-col__title" id="sv-h-${s.key}">${tileHtml(s.key)}${VR.escape(s.label)}</h2><span class="sv-col__n">${cards.length}</span></header>
  <div class="sv-col__list">${cards.length ? cards.map(cardHtml).join("") : `<p class="sv-col__empty">${EMPTY_TEXT[s.key]}</p>`}</div>
</section>`;
      }).join("");

      VR.syncSaveButtons();
      flashId = null;
      const on = $('[aria-pressed="true"]', tabs);
      if (on && tabs.offsetParent) tabs.scrollLeft = Math.max(0, on.offsetLeft - 24);
      if (editing !== null) {
        const area = $(`.sv-card[data-id="${editing}"] [data-note-edit]`, board);
        if (area) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }
      }
    }

    // "Gợi ý để bắt đầu": server-rendered job cards (njc.html), shown while nothing is saved
    function renderSuggest() {
      if (!suggest) return;
      const has = suggestList && suggestList.querySelector("[data-job-id]");
      if (!has || items().length) { suggest.hidden = true; return; }
      VR.syncSaveButtons(suggestList);
      suggest.hidden = false;
    }

    /* ---- events */
    document.addEventListener("vr:saved", () => { if (!quiet) render(); });
    // a job saved or moved in another tab: localStorage fires "storage" here, re-render (and the header count)
    window.addEventListener("storage", (event) => {
      if (event.key !== "vr.saved" && event.key !== null) return;
      if (editing !== null) return; // never yank a note that is being typed; the next render catches up
      render();
    });

    board.addEventListener("change", (event) => {
      const select = event.target.closest("[data-status]");
      if (!select) return;
      const id = Number(select.closest(".sv-card").dataset.id);
      flashId = id;
      active = select.value;
      VR.store.set(TAB_KEY, active);
      VR.saved.update(id, { status: select.value });
      VR.toast(`Đã chuyển sang “${labelOf[select.value]}”`);
      const moved = $(`.sv-card[data-id="${id}"] [data-status]`, board);
      if (moved) moved.focus({ preventScroll: true });
    });

    board.addEventListener("click", (event) => {
      const card = event.target.closest(".sv-card");
      if (!card) return;
      const id = Number(card.dataset.id);
      if (event.target.closest("[data-note-open]")) {
        editing = id;
        render();
        return;
      }
      if (event.target.closest("[data-remove]")) {
        const item = VR.saved.all()[id];
        if (!item) return;
        editing = null;
        VR.saved.remove(id);
        showUndo(item);
      }
    });

    let noteTimer;
    board.addEventListener("input", (event) => {
      const area = event.target.closest("[data-note-edit]");
      if (!area) return;
      const id = Number(area.closest(".sv-card").dataset.id);
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => {
        quiet = true;
        VR.saved.update(id, { note: area.value.slice(0, 1000) });
        quiet = false;
      }, 250);
    });
    board.addEventListener("focusout", (event) => {
      const area = event.target.closest("[data-note-edit]");
      if (!area) return;
      const id = Number(area.closest(".sv-card").dataset.id);
      clearTimeout(noteTimer);
      quiet = true;
      VR.saved.update(id, { note: area.value.trim().slice(0, 1000) });
      quiet = false;
      // let a click on another control land before the card re-renders
      setTimeout(() => {
        if (editing === id && !(document.activeElement && document.activeElement.matches("[data-note-edit]"))) {
          editing = null;
          render();
        }
      }, 120);
    });
    board.addEventListener("keydown", (event) => {
      const area = event.target.closest("[data-note-edit]");
      if (area && (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey)))) {
        event.preventDefault();
        const id = area.closest(".sv-card").dataset.id;
        area.blur();
        setTimeout(() => {
          const btn = $(`.sv-card[data-id="${id}"] .sv-icon[data-note-open]`, board);
          if (btn) btn.focus();
        }, 160);
      }
    });

    tabs.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (!tab) return;
      active = tab.dataset.tab;
      VR.store.set(TAB_KEY, active);
      $$("[data-tab]", tabs).forEach((t) => t.setAttribute("aria-pressed", t === tab ? "true" : "false"));
      $$(".sv-col", board).forEach((col) => col.classList.toggle("is-active", col.dataset.col === active));
      tab.scrollIntoView({ block: "nearest", inline: "center", behavior: VR.reducedMotion ? "auto" : "smooth" });
    });

    /* drag & drop between columns (desktop) */
    let dragId = null;
    board.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".sv-card");
      if (!card || event.target.closest("textarea, select")) return;
      dragId = Number(card.dataset.id);
      card.classList.add("is-dragging");
      try { event.dataTransfer.setData("text/plain", String(dragId)); event.dataTransfer.effectAllowed = "move"; } catch (_) { /* old browsers */ }
    });
    board.addEventListener("dragend", (event) => {
      const card = event.target.closest(".sv-card");
      if (card) card.classList.remove("is-dragging");
      $$(".sv-col.is-over", board).forEach((c) => c.classList.remove("is-over"));
      dragId = null;
    });
    board.addEventListener("dragover", (event) => {
      const col = event.target.closest(".sv-col");
      if (!col || dragId === null) return;
      event.preventDefault();
      try { event.dataTransfer.dropEffect = "move"; } catch (_) { /* ignore */ }
      $$(".sv-col.is-over", board).forEach((c) => { if (c !== col) c.classList.remove("is-over"); });
      col.classList.add("is-over");
    });
    board.addEventListener("dragleave", (event) => {
      const col = event.target.closest(".sv-col");
      if (col && !col.contains(event.relatedTarget)) col.classList.remove("is-over");
    });
    board.addEventListener("drop", (event) => {
      const col = event.target.closest(".sv-col");
      if (!col || dragId === null) return;
      event.preventDefault();
      const id = dragId;
      dragId = null;
      const item = VR.saved.all()[id];
      if (!item || statusOf(item) === col.dataset.col) { col.classList.remove("is-over"); return; }
      flashId = id;
      VR.saved.update(id, { status: col.dataset.col });
      VR.toast(`Đã chuyển sang “${labelOf[col.dataset.col]}”`);
    });

    /* undo after removal. Removals made while the bar is up join it ("Đã bỏ 2 việc"), so
       "Hoàn tác" brings every one of them back, and focus returns to the restored card. */
    function showUndo(item) {
      const pending = undo ? undo.items.concat(item) : [item];
      if (undo) { undo.el.remove(); clearTimeout(undo.timer); }
      const el = document.createElement("div");
      el.className = "sv-undo";
      el.setAttribute("role", "status");
      const label = pending.length > 1 ? `Đã bỏ ${pending.length} việc` : `Đã bỏ “${VR.escape(VR.shortTitle(item.title))}”`;
      el.innerHTML = `<span>${label}</span><button type="button">Hoàn tác</button>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add("is-on"));
      const close = () => { el.classList.remove("is-on"); setTimeout(() => el.remove(), 300); if (undo && undo.el === el) undo = null; };
      el.querySelector("button").addEventListener("click", () => {
        const all = VR.saved.all();
        pending.forEach((x) => { all[x.id] = x; });
        VR.store.set("vr.saved", all);
        const first = pending[0];
        flashId = Number(first.id);
        // show the column the restored card lives in (tabs on tablets and phones)
        active = statusOf(first);
        VR.saved.emit();
        close();
        const link = $(`.sv-card[data-id="${Number(first.id)}"] .sv-card__title a`, board);
        if (link) link.focus({ preventScroll: false });
      });
      undo = { el, items: pending, timer: setTimeout(close, 6000) };
    }

    /* CSV export */
    function csvCell(v) { return `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`; }
    if (exportBtn) exportBtn.addEventListener("click", () => {
      const all = items().sort((a, b) => keys.indexOf(statusOf(a)) - keys.indexOf(statusOf(b)) ||
        String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
      if (!all.length) return;
      const head = ["Việc", "Công ty", "Trạng thái", "Lương", "Ngành", "Ghi chú", "Link", "Ngày lưu", "Cập nhật"];
      const rows = all.map((item) => [
        item.title, VR.shortCompany(item.company), labelOf[statusOf(item)], payOf(item) || item.salary || "",
        item.field, item.note, item.url ? window.location.origin + item.url : "",
        String(item.savedAt || "").slice(0, 10), String(item.updatedAt || "").slice(0, 10),
      ]);
      const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      a.download = `viet-remote-viec-da-luu-${day}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      VR.toast(`Đã xuất ${all.length} việc ra file CSV`);
    });

    // /data/jobs.json (~200 KB gzipped) only enriches cards: fetched once there is a card, never for the empty state
    let enriching = false;
    function enrich() {
      if (enriching || !items().length) return;
      enriching = true;
      VR.loadJobs().then((data) => {
        feed = new Map((data.jobs || []).map((job) => [Number(job.id), job]));
        render();
      }).catch(() => { /* cards keep the saved text */ });
    }
    document.addEventListener("vr:saved", enrich);
    window.addEventListener("storage", enrich);

    render();
    enrich();
  });
})();

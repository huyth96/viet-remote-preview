/* Việt Remote — /da-luu/ application tracker (needs common.js / window.VR).

   Source of truth: VR.saved (localStorage "vr.saved"), statuses VR.STATUSES.
   Direction A (saved.html, jobs.css §6): the statuses as one row of numbers ("Tất cả" + the five; saved.html's
   window.svStats draws it, before the first paint and on every change), the chosen one cobalt. It drives the list
   under it: the saved jobs as the board's own rows (.jl-rows .job-row), grouped by status under "Tất cả", one status
   otherwise; switching cross-fades the list (jobs.css, off under reduced motion). Each row: its status menu, a note
   (saved as you type), "Bỏ lưu" (undo for a few seconds). Drag a row onto a status in the numbers row (or onto a
   group) to move it. Another tab's changes arrive via "storage". Rows are enriched from /data/jobs.json when it loads
   (logo, the pay as the listing states it, closed listings); the empty state never fetches it.
   Empty: the server-rendered line + "Xem việc remote" and "Gợi ý để bắt đầu" (three real jobs as the board's rows,
   job_row.html) are shown while nothing is saved; saving one of them fills the list. Export to CSV.
*/
(function () {
  "use strict";

  const VR = window.VR;
  if (!VR || !VR.onReady) return;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const icon = (name) => VR.icon(name);
  const TAB_KEY = "vr.savedTab";

  const EMPTY_TEXT = {
    saved: "Bấm dấu trang trên một việc để lưu vào đây.",
    applied: "Nộp hồ sơ xong thì chuyển việc sang đây.",
    interview: "Được hẹn phỏng vấn? Chuyển việc sang đây.",
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
    // the summary line and the export / find buttons live in the page hero, above the list
    const actions = $("[data-sv-actions]");
    const summary = $("[data-sv-summary]");
    const exportBtn = $("[data-sv-export]");
    const defaultSummary = summary ? summary.innerHTML : "";

    const keys = VR.STATUSES.map((s) => s.key);
    const labelOf = Object.fromEntries(VR.STATUSES.map((s) => [s.key, s.label]));
    let feed = null;            // Map id -> job (from jobs.json)
    let active = VR.store.get(TAB_KEY, "all");
    if (active !== "all" && !keys.includes(active)) active = "all";
    // a remembered status that has nothing in it any more opens on "Tất cả" (saved.html's inline svStats does the same)
    if (active !== "all" && !Object.values(VR.saved.all()).some((x) => x && x.id && (keys.includes(x.status) ? x.status : "saved") === active)) active = "all";
    let editing = null;         // id whose note is open
    let quiet = false;          // skip the vr:saved re-render while typing a note
    let flashId = null;
    let undo = null;

    const statusOf = (item) => (keys.includes(item.status) ? item.status : "saved");
    const items = () => Object.values(VR.saved.all()).filter((x) => x && x.id);
    const newest = (a, b) => String(b.updatedAt || b.savedAt || "").localeCompare(String(a.updatedAt || a.savedAt || ""));

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
      // anonymous Upwork client: empty tile, jobs.css §0 draws the platform's mark (.logo:empty)
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

    /* one saved job as the board's row (jobs.css §3 .jl-rows .job-row): the tile, the title with the board's tick,
       "company · saved when", the pay right-aligned; then this page's controls: the status menu, the note, "Bỏ lưu" */
    function rowHtml(item) {
      const e = VR.escape;
      const id = Number(item.id);
      const job = feed && feed.get(id);
      const closed = feed && !job;
      const pay = payOf(item);
      const status = statusOf(item);
      // same rule as every other logo tile: a mark that reads at this size (VR.iconLogo), else initials
      const src = job && VR.iconLogo ? VR.iconLogo(job) : "";
      const ini = job ? job.initials : initials(item.company);
      const logo = src
        ? `<span class="logo" aria-hidden="true" data-initials="${e(ini)}"><img src="${e(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`
        : `<span class="logo" aria-hidden="true" data-initials="${e(ini)}" data-tone="${VR.logoTone ? VR.logoTone(job || { company: item.company, initials: ini }) : ""}" data-f="${e(job ? job.field || "" : "")}">${e(ini)}</span>`;
      const options = VR.STATUSES.map((s) => `<option value="${s.key}"${s.key === status ? " selected" : ""}>${e(s.label)}</option>`).join("");
      const note = String(item.note || "");
      const title = VR.shortTitle(item.title) || "Việc đã lưu";
      let noteHtml = "";
      if (editing === id) {
        noteHtml = `<textarea class="sv-note__edit" data-note-edit maxlength="1000" rows="2" aria-label="Ghi chú cho ${e(title)}" placeholder="Lịch phỏng vấn, người liên hệ, mức lương đã trao đổi…">${e(note)}</textarea>`;
      } else if (note) {
        noteHtml = `<button class="sv-note" type="button" data-note-open aria-label="Sửa ghi chú: ${e(note)}">${e(note)}</button>`;
      }
      return `<article class="job-row sv-row${flashId === id ? " is-flash" : ""}${closed ? " is-closed" : ""}" draggable="true" data-id="${id}" data-job-id="${id}" data-title="${e(item.title)}" data-company="${e(item.company)}" data-url="${e(item.url)}" data-salary="${e(item.salary)}" data-field="${e(item.field)}">
  ${logo}
  <div class="job-row__main">
    <h4 class="job-row__title"><a href="${e(item.url || "/viec-lam/")}" title="${e(item.title)}">${e(title)}</a></h4>
    <div class="job-row__meta"><span>${e(VR.shortCompany(item.company) || "Nhà tuyển dụng ẩn danh")}</span>${ago(item.savedAt) ? `<span>Lưu ${e(ago(item.savedAt))}</span>` : ""}${closed ? `<span class="sv-row__closed">Tin đã đóng</span>` : ""}</div>
    ${noteHtml}
  </div>
  <div class="job-row__side"><span class="job-row__pay">${pay ? e(pay) : `<span class="muted">Lương thỏa thuận</span>`}</span></div>
  <div class="sv-row__ctl">
    <label class="sr-only" for="sv-st-${id}">Trạng thái của ${e(title)}</label>
    <select class="select sv-select" id="sv-st-${id}" data-status>${options}</select>
    <button class="sv-icon" type="button" data-note-open aria-label="${note ? "Sửa ghi chú" : "Thêm ghi chú"}" title="${note ? "Sửa ghi chú" : "Thêm ghi chú"}">${icon("message")}</button>
  </div>
  <button class="sv-icon sv-row__remove" type="button" data-remove aria-label="Bỏ lưu ${e(title)}" title="Bỏ lưu">${icon("x")}</button>
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
      if (total === 0) {
        if (summary) summary.innerHTML = defaultSummary;
        board.innerHTML = "";
        tabs.innerHTML = "";
        renderSuggest();
        return;
      }
      // a job saved from "Gợi ý để bắt đầu": its button goes with the suggestions, so the keyboard lands on the new row
      const fromSuggest = suggest && !suggest.hidden && suggest.contains(document.activeElement);
      if (suggest) suggest.hidden = true;

      // the numbers row (saved.html's window.svStats, the same markup the inline script wrote before the first paint)
      if (window.svStats) window.svStats(VR.saved.all(), active);

      // a control in a row keeps the keyboard across a re-render (the feed arriving, another tab's change)
      const focusKey = (() => {
        const a = document.activeElement;
        const row = a && board.contains(a) && a.closest(".sv-row");
        if (!row) return null;
        const part = [".job-row__title a", "[data-status]", ".sv-icon[data-note-open]", "[data-remove]"].find((sel) => a.matches(sel));
        return part ? `.sv-row[data-id="${row.dataset.id}"] ${part}` : null;
      })();

      board.dataset.view = active;
      board.innerHTML = VR.STATUSES.map((s) => {
        const rows = all.filter((item) => statusOf(item) === s.key).sort(newest);
        const shown = active === "all" ? rows.length > 0 : active === s.key;
        return `<section class="sv-group" data-col="${s.key}" aria-labelledby="sv-h-${s.key}"${shown ? "" : " hidden"}>
  <h3 class="sv-group__t" id="sv-h-${s.key}">${VR.escape(s.label)}<span class="sv-group__n">${rows.length}</span></h3>
  ${rows.length ? `<div class="job-rows jl-rows sv-rows">${rows.map(rowHtml).join("")}</div>` : `<p class="sv-group__empty">${EMPTY_TEXT[s.key]}</p>`}
</section>`;
      }).join("");

      VR.syncSaveButtons();
      flashId = null;
      const refocus = fromSuggest ? $(".sv-row .job-row__title a", board) : focusKey && editing === null ? $(focusKey, board) : null;
      if (refocus) refocus.focus({ preventScroll: !fromSuggest });
      if (editing !== null) {
        const area = $(`.sv-row[data-id="${editing}"] [data-note-edit]`, board);
        if (area) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }
      }
    }

    /* choose a view: the numbers row and the groups follow; the list cross-fades (jobs.css .sv-list.is-swap) */
    function choose(key, opts) {
      active = key;
      VR.store.set(TAB_KEY, active);
      $$("[data-tab]", tabs).forEach((t) => t.setAttribute("aria-pressed", t.dataset.tab === key ? "true" : "false"));
      board.dataset.view = key;
      $$(".sv-group", board).forEach((g) => {
        const n = $(".sv-rows", g) ? 1 : 0;
        g.hidden = key === "all" ? !n : g.dataset.col !== key;
      });
      board.classList.remove("is-swap");
      void board.offsetWidth;
      board.classList.add("is-swap");
      if (opts && opts.scroll) {
        const tab = $(`[data-tab="${key}"]`, tabs);
        if (tab) tab.scrollIntoView({ block: "nearest", inline: "center", behavior: VR.reducedMotion ? "auto" : "smooth" });
      }
    }

    // "Gợi ý để bắt đầu": server-rendered board rows (job_row.html), shown while nothing is saved
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

    tabs.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (!tab || tab.dataset.tab === active) return;
      choose(tab.dataset.tab, { scroll: true });
    });

    board.addEventListener("change", (event) => {
      const select = event.target.closest("[data-status]");
      if (!select) return;
      const id = Number(select.closest(".sv-row").dataset.id);
      flashId = id;
      // one status in view: follow the job to its new status; "Tất cả" keeps the whole list in view
      if (active !== "all") { active = select.value; VR.store.set(TAB_KEY, active); }
      VR.saved.update(id, { status: select.value });
      VR.toast(`Đã chuyển sang “${labelOf[select.value]}”`);
      const moved = $(`.sv-row[data-id="${id}"] [data-status]`, board);
      if (moved) moved.focus({ preventScroll: true });
    });

    board.addEventListener("click", (event) => {
      const row = event.target.closest(".sv-row");
      if (!row) return;
      const id = Number(row.dataset.id);
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
      const id = Number(area.closest(".sv-row").dataset.id);
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
      const id = Number(area.closest(".sv-row").dataset.id);
      clearTimeout(noteTimer);
      quiet = true;
      VR.saved.update(id, { note: area.value.trim().slice(0, 1000) });
      quiet = false;
      // let a click on another control land before the row re-renders
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
        const id = area.closest(".sv-row").dataset.id;
        area.blur();
        setTimeout(() => {
          const btn = $(`.sv-row[data-id="${id}"] .sv-icon[data-note-open]`, board);
          if (btn) btn.focus();
        }, 160);
      }
    });

    /* drag & drop: a row onto a status in the numbers row, or onto a group (pointer devices; the menu is the way
       everywhere else) */
    let dragId = null;
    const targetOf = (el) => {
      const tab = el.closest && el.closest("[data-tab]");
      if (tab && tab.dataset.tab !== "all" && tabs.contains(tab)) return { el: tab, key: tab.dataset.tab };
      const group = el.closest && el.closest(".sv-group");
      if (group && board.contains(group)) return { el: group, key: group.dataset.col };
      return null;
    };
    const clearOver = () => $$(".is-over", root).forEach((c) => c.classList.remove("is-over"));
    board.addEventListener("dragstart", (event) => {
      const row = event.target.closest(".sv-row");
      if (!row || event.target.closest("textarea, select")) return;
      dragId = Number(row.dataset.id);
      row.classList.add("is-dragging");
      root.classList.add("is-dragging");
      try { event.dataTransfer.setData("text/plain", String(dragId)); event.dataTransfer.effectAllowed = "move"; } catch (_) { /* old browsers */ }
    });
    board.addEventListener("dragend", (event) => {
      const row = event.target.closest(".sv-row");
      if (row) row.classList.remove("is-dragging");
      root.classList.remove("is-dragging");
      clearOver();
      dragId = null;
    });
    root.addEventListener("dragover", (event) => {
      if (dragId === null) return;
      const t = targetOf(event.target);
      if (!t) { clearOver(); return; }
      event.preventDefault();
      try { event.dataTransfer.dropEffect = "move"; } catch (_) { /* ignore */ }
      $$(".is-over", root).forEach((c) => { if (c !== t.el) c.classList.remove("is-over"); });
      t.el.classList.add("is-over");
    });
    root.addEventListener("dragleave", (event) => {
      const t = targetOf(event.target);
      if (t && !t.el.contains(event.relatedTarget)) t.el.classList.remove("is-over");
    });
    root.addEventListener("drop", (event) => {
      const t = targetOf(event.target);
      if (!t || dragId === null) return;
      event.preventDefault();
      const id = dragId;
      dragId = null;
      clearOver();
      const item = VR.saved.all()[id];
      if (!item || statusOf(item) === t.key) return;
      flashId = id;
      VR.saved.update(id, { status: t.key });
      VR.toast(`Đã chuyển sang “${labelOf[t.key]}”`);
    });

    /* undo after removal. Removals made while the bar is up join it ("Đã bỏ 2 việc"), so
       "Hoàn tác" brings every one of them back, and focus returns to the restored row. */
    function showUndo(item) {
      const pending = undo ? undo.items.concat(item) : [item];
      if (undo) { undo.el.remove(); clearTimeout(undo.timer); }
      const el = document.createElement("div");
      el.className = "sv-undo";
      el.setAttribute("role", "status");
      const label = pending.length > 1 ? `Đã bỏ ${pending.length} việc` : `Đã bỏ “${VR.escape(VR.shortTitle(item.title))}”`;
      el.innerHTML = `<span>${label}</span><button type="button">Hoàn tác</button>`;
      document.body.appendChild(el);
      // one pill at a time: the bar replaces a toast still on screen ("Đã chuyển sang …")
      const toast = document.querySelector("[data-toast]");
      if (toast) toast.classList.remove("is-on");
      requestAnimationFrame(() => el.classList.add("is-on"));
      const close = () => { el.classList.remove("is-on"); setTimeout(() => el.remove(), 300); if (undo && undo.el === el) undo = null; };
      el.querySelector("button").addEventListener("click", () => {
        const all = VR.saved.all();
        pending.forEach((x) => { all[x.id] = x; });
        VR.store.set("vr.saved", all);
        const first = pending[0];
        flashId = Number(first.id);
        // one status in view: show the one the restored job lives in
        if (active !== "all") active = statusOf(first);
        VR.saved.emit();
        close();
        const link = $(`.sv-row[data-id="${Number(first.id)}"] .job-row__title a`, board);
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
      // the list lives in this browser only: the file is how it survives a new machine (the button's title says so too)
      VR.toast(`Đã xuất ${all.length} việc ra file CSV. Giữ file này khi đổi máy.`);
    });

    // /data/jobs.json (~200 KB gzipped) only enriches rows: fetched once there is a row, never for the empty state
    let enriching = false;
    function enrich() {
      if (enriching || !items().length) return;
      enriching = true;
      VR.loadJobs().then((data) => {
        feed = new Map((data.jobs || []).map((job) => [Number(job.id), job]));
        render();
      }).catch(() => { /* rows keep the saved text */ });
    }
    document.addEventListener("vr:saved", enrich);
    window.addEventListener("storage", enrich);

    render();
    enrich();
  });
})();

/* Việt Remote — "Tạo invoice" (tools/tao_invoice.html)
   Client-side only. Form -> live A4 preview in a clean English invoice style.
   "In / Lưu PDF" = window.print(); the print stylesheet (tools-b.css) prints only the
   invoice, which is copied into a body-level .inv-print container right before printing.
   Draft: localStorage "vr.invoice" (this browser only), autosaved while typing.

   Markup contract (template):
     [data-inv]                  root
     [data-inv-field="a.b"]      inputs bound to state paths (from.name, to.email, number…)
     [data-inv-items]            line items list (rendered here), [data-inv-add] adds a row
     input[name="inv-method"]    payment method radios; [data-pay-group="wise"] field groups
     [data-inv-sheet]            the A4 sheet; [data-inv-stage] its scaled container
     [data-inv-print] [data-inv-next] [data-inv-reset] [data-inv-status] [data-inv-total]
     [data-inv-due-chip="14"]    quick due-date chips */
(function () {
  "use strict";

  const VR = window.VR;
  const KEY = "vr.invoice";
  const SHEET_W = 794; /* A4 at 96 dpi = 210 mm */

  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (iso, n) => {
    const [y, m, d] = (iso || isoDate(new Date())).split("-").map(Number);
    return isoDate(new Date(y, m - 1, d + n));
  };
  const today = () => isoDate(new Date());

  const CURRENCIES = {
    USD: { locale: "en-US", digits: 2 },
    EUR: { locale: "en-US", digits: 2 },
    AUD: { locale: "en-US", digits: 2 },
    VND: { locale: "vi-VN", digits: 0 },
  };
  const METHODS = {
    payoneer: { label: "Payoneer", rows: [["email", "Payoneer account"], ["link", "Payment request"]] },
    wise: { label: "Wise", rows: [["holder", "Account holder"], ["email", "Wise account"], ["details", "Bank details"]] },
    paypal: { label: "PayPal", rows: [["email", "PayPal"]] },
    swift: { label: "International bank transfer (SWIFT)", rows: [["beneficiary", "Beneficiary"], ["bank", "Bank"], ["account", "Account number"], ["swift", "SWIFT / BIC"], ["bankAddress", "Bank address"]] },
  };

  function defaults() {
    const issue = today();
    return {
      from: { name: "", email: "", address: "", taxId: "" },
      to: { name: "", company: "", email: "", address: "" },
      number: `INV-${new Date().getFullYear()}-001`,
      issue,
      due: addDays(issue, 14),
      currency: "USD",
      items: [{ desc: "", qty: "1", rate: "" }],
      discountType: "percent",
      discount: "",
      tax: "",
      notes: "",
      method: "wise",
      pay: { payoneer: {}, wise: {}, paypal: {}, swift: {} },
      savedAt: "",
    };
  }

  function load() {
    const base = defaults();
    const s = VR.store.get(KEY, null);
    if (!s || typeof s !== "object") return base;
    const out = Object.assign(base, s);
    out.from = Object.assign(defaults().from, s.from || {});
    out.to = Object.assign(defaults().to, s.to || {});
    out.pay = Object.assign(defaults().pay, s.pay || {});
    Object.keys(METHODS).forEach((k) => { out.pay[k] = Object.assign({}, out.pay[k] || {}); });
    out.items = Array.isArray(s.items) && s.items.length
      ? s.items.map((it) => ({ desc: String(it.desc || ""), qty: String(it.qty ?? ""), rate: String(it.rate ?? "") }))
      : base.items;
    if (!CURRENCIES[out.currency]) out.currency = "USD";
    if (!METHODS[out.method]) out.method = "wise";
    if (out.discountType !== "amount") out.discountType = "percent";
    return out;
  }

  /* ------------------------------------------------------------------ maths & formatting */
  /* Reads the ways people type amounts: 1250 · 1,250.50 · 25,5 · 0.250 · 1.250.000 (Vietnamese
     thousands) · 1.250,50 (dot thousands, comma decimals) · $1,250 · 1.250.000 đ.
     `unit` is the invoice currency, or "%" for percent fields. Groups of three after a separator
     are thousands only when the first group has no leading zero ("0.250" is a quarter). A lone
     "1.500" is 1.500 đ in VND and 1.5 in a percent field, but in a USD/EUR/AUD invoice it could be
     1.5 or 1500, so it is ambiguous and the form asks instead of guessing.
     Returns NaN for text it cannot read (or ambiguous), so the form can flag it instead of
     printing a wrong amount. Same parser as tool-templates.js; keep the two in sync. */
  const strip = (v) => String(v ?? "").replace(/A\$|US\$|USD|EUROS?|EUR|AUD|VND|[\s$€₫đ]/gi, "");
  const LONE = /^-?[1-9]\d{0,2}\.\d{3}$/;
  const isAmbiguous = (v, unit) => unit !== "VND" && unit !== "%" && LONE.test(strip(v));
  const parseAmount = (v, unit) => {
    let s = strip(v);
    if (!s) return 0;
    const neg = s[0] === "-";
    if (neg) s = s.slice(1);
    let n;
    if (unit === "%" && LONE.test(s)) n = Number(s);
    else if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(s)) {
      if (isAmbiguous(s, unit)) return NaN;
      n = Number(s.replace(/\./g, "").replace(",", "."));
    } else if (/^[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/.test(s)) n = Number(s.replace(/,/g, ""));
    else if (/^(\d+[.,]?\d*|[.,]\d+)$/.test(s)) n = Number(s.replace(",", "."));
    else return NaN;
    return neg ? -n : n;
  };
  const num = (v, unit) => { const n = parseAmount(v, unit); return Number.isFinite(n) ? n : 0; };
  const isBad = (v, unit) => String(v ?? "").trim() !== "" && !Number.isFinite(parseAmount(v, unit));
  /** "1.500" in a dollar invoice -> the question to ask, naming both readings */
  function ambiguityText(label, raw) {
    const s = strip(raw).replace(/^-/, "");
    const small = Number(s);
    const big = Number(s.replace(".", ""));
    const vi = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
    return `${label} “${String(raw).trim()}”: ý bạn là ${vi(small)} hay ${vi(big)}? Ghi ${String(small)} hoặc ${String(big)} cho rõ.`;
  }
  const discUnit = (s) => (s.discountType === "percent" ? "%" : s.currency);
  const round = (n, digits) => { const f = Math.pow(10, digits); return Math.round(n * f) / f; };

  function totals(s) {
    const c = CURRENCIES[s.currency];
    const lines = s.items.map((it) => round(num(it.qty, s.currency) * num(it.rate, s.currency), c.digits));
    const subtotal = round(lines.reduce((a, b) => a + b, 0), c.digits);
    const d = Math.max(0, num(s.discount, discUnit(s)));
    const discount = round(s.discountType === "percent" ? subtotal * Math.min(d, 100) / 100 : Math.min(d, subtotal), c.digits);
    const taxable = subtotal - discount;
    const taxRate = Math.max(0, num(s.tax, "%"));
    const tax = round(taxable * taxRate / 100, c.digits);
    return { lines, subtotal, discount, tax, taxRate, total: round(taxable + tax, c.digits) };
  }

  function money(n, cur) {
    const c = CURRENCIES[cur];
    try {
      return new Intl.NumberFormat(c.locale, { style: "currency", currency: cur, minimumFractionDigits: c.digits, maximumFractionDigits: c.digits }).format(n);
    } catch (_) {
      return `${n.toFixed(c.digits)} ${cur}`;
    }
  }
  const plain = (n, digits) => Number(n).toLocaleString("en-US", { maximumFractionDigits: digits ?? 2 });
  const pct = (n) => plain(n, 2) + "%";
  function dateEn(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  const e = (s) => VR.escape(s);
  const lines = (s) => e(s).replace(/\n/g, "<br>");
  /* empty values show a faint placeholder on screen; print hides it */
  const val = (v, ph, multi) => (String(v || "").trim()
    ? (multi ? lines(String(v).trim()) : e(String(v).trim()))
    : `<span class="inv-ph">${e(ph)}</span>`);

  /* ------------------------------------------------------------------ sheet */
  function sheetHtml(s) {
    const t = totals(s);
    const cur = s.currency;
    /* unreadable numbers are shown as typed and marked on screen (printing is blocked until fixed) */
    const bad = (raw) => `<span class="inv-bad" title="Chưa đọc được số này">${e(String(raw).trim())}</span>`;
    const items = s.items.map((it, i) => {
      const q = num(it.qty, cur);
      const badQty = isBad(it.qty, cur);
      const badRate = isBad(it.rate, cur);
      const has = String(it.desc).trim() || num(it.rate, cur) || (q && q !== 1) || badQty || badRate;
      const qty = !String(it.qty).trim() ? '<span class="inv-ph">0</span>' : badQty ? bad(it.qty) : e(plain(q, 3));
      const rate = !String(it.rate).trim() ? `<span class="inv-ph">${e(money(0, cur))}</span>` : badRate ? bad(it.rate) : e(money(num(it.rate, cur), cur));
      const amt = badQty || badRate ? '<span class="inv-ph">—</span>' : e(money(t.lines[i], cur));
      return `<tr class="${has ? "" : "is-blank"}">
        <td class="inv-t__desc">${val(it.desc, "Description of work", true)}</td>
        <td class="inv-t__num">${qty}</td>
        <td class="inv-t__num">${rate}</td>
        <td class="inv-t__num inv-t__amt">${amt}</td>
      </tr>`;
    }).join("");

    const m = METHODS[s.method];
    const pay = s.pay[s.method] || {};
    /* the first row always shows on screen (as a placeholder); an empty row never prints */
    const payRows = m.rows.filter(([k]) => String(pay[k] || "").trim() || k === m.rows[0][0])
      .map(([k, label]) => `<div class="inv-kv${String(pay[k] || "").trim() ? "" : " is-blank"}"><dt>${e(label)}</dt><dd>${val(pay[k], "Fill in your details", k === "details" || k === "bankAddress")}</dd></div>`).join("");

    const fromLines = [
      s.from.email ? e(s.from.email) : "",
      s.from.address ? lines(s.from.address) : "",
      s.from.taxId ? `Tax ID: ${e(s.from.taxId)}` : "",
    ].filter(Boolean);
    const toLines = [
      s.to.company && s.to.name ? e(s.to.company) : "",
      s.to.email ? e(s.to.email) : "",
      s.to.address ? lines(s.to.address) : "",
    ].filter(Boolean);
    const toName = s.to.name || s.to.company;
    const overdue = s.due && s.issue && s.due < s.issue;

    return `
      <header class="inv-head">
        <div>
          <p class="inv-title">Invoice</p>
          <p class="inv-no">${val(s.number, "INV-001")}</p>
        </div>
        <div class="inv-from">
          <p class="inv-from__name">${val(s.from.name, "Your name or business")}</p>
          ${fromLines.length ? `<p>${fromLines.join("<br>")}</p>` : `<p><span class="inv-ph">you@email.com</span></p>`}
        </div>
      </header>

      <section class="inv-meta">
        <div class="inv-meta__to">
          <p class="inv-label">Billed to</p>
          <p class="inv-strong">${val(toName, "Client name")}</p>
          ${toLines.length ? `<p>${toLines.join("<br>")}</p>` : `<p><span class="inv-ph">client@company.com</span></p>`}
        </div>
        <div class="inv-meta__dates">
          <div><p class="inv-label">Issued</p><p class="inv-strong">${val(dateEn(s.issue), "—")}</p></div>
          <div><p class="inv-label">Due</p><p class="inv-strong${overdue ? " is-warn" : ""}">${val(dateEn(s.due), "—")}</p></div>
        </div>
        <div class="inv-meta__due">
          <p class="inv-label">Amount due</p>
          <p class="inv-due">${e(money(t.total, cur))}</p>
          <p class="inv-due__cur">${e(cur)}${s.due ? ` · due ${e(dateEn(s.due))}` : ""}</p>
        </div>
      </section>

      <table class="inv-t">
        <thead><tr><th class="inv-t__desc">Description</th><th class="inv-t__num">Qty</th><th class="inv-t__num">Rate</th><th class="inv-t__num">Amount</th></tr></thead>
        <tbody>${items}</tbody>
      </table>

      <div class="inv-sum">
        <dl>
          <div class="inv-sum__row"><dt>Subtotal</dt><dd>${e(money(t.subtotal, cur))}</dd></div>
          ${t.discount ? `<div class="inv-sum__row"><dt>Discount${s.discountType === "percent" ? ` (${e(pct(num(s.discount, "%")))})` : ""}</dt><dd>−${e(money(t.discount, cur))}</dd></div>` : ""}
          ${t.taxRate ? `<div class="inv-sum__row"><dt>Tax (${e(pct(t.taxRate))})</dt><dd>${e(money(t.tax, cur))}</dd></div>` : ""}
          <div class="inv-sum__row inv-sum__total"><dt>Total due</dt><dd>${e(money(t.total, cur))}</dd></div>
        </dl>
      </div>

      <section class="inv-foot">
        <div class="inv-pay">
          <p class="inv-label">Payment details</p>
          <p class="inv-strong">${e(m.label)}</p>
          <dl>${payRows}</dl>
          <p class="inv-ref">Please use <b>${val(s.number, "the invoice number")}</b> as the payment reference.</p>
        </div>
        <div class="inv-notes">
          <p class="inv-label">Notes</p>
          <p>${val(s.notes, "Thank you for your business.", true)}</p>
        </div>
      </section>`;
  }

  /* ------------------------------------------------------------------ app */
  function init() {
    const root = document.querySelector("[data-inv]");
    if (!root) return;
    const $ = (sel) => root.querySelector(sel);
    const els = {
      fields: Array.from(root.querySelectorAll("[data-inv-field]")),
      items: $("[data-inv-items]"),
      add: $("[data-inv-add]"),
      methods: Array.from(root.querySelectorAll('input[name="inv-method"]')),
      groups: Array.from(root.querySelectorAll("[data-pay-group]")),
      sheet: $("[data-inv-sheet]"),
      stage: $("[data-inv-stage]"),
      desk: $("[data-inv-desk]"),
      zoom: $("[data-inv-zoom]"),
      status: $("[data-inv-status]"),
      totals: Array.from(root.querySelectorAll("[data-inv-total]")),
      curLabels: Array.from(root.querySelectorAll("[data-inv-cur]")),
      discUnit: $("[data-inv-disc-unit]"),
      print: Array.from(root.querySelectorAll("[data-inv-print]")),
      next: $("[data-inv-next]"),
      reset: $("[data-inv-reset]"),
      dueChips: Array.from(root.querySelectorAll("[data-inv-due-chip]")),
      warn: $("[data-inv-warn]"),
      start: $("[data-inv-start]"),
      example: $("[data-inv-example]"),
      adjustErr: $("[data-inv-adjust-err]"),
      discInput: $('[data-inv-field="discount"]'),
      taxInput: $('[data-inv-field="tax"]'),
      dueInput: $('[data-inv-field="due"]'),
    };
    let state = load();
    let syncStart = null;
    let badInputs = []; /* number fields the parser cannot read, in form order */

    /* mark a number field as unreadable: red border (.field--error), aria-invalid, message link */
    function flag(input, bad, errId) {
      if (!input) return;
      const field = input.closest(".field");
      if (field) field.classList.toggle("field--error", bad);
      if (bad) {
        input.setAttribute("aria-invalid", "true");
        if (errId) input.setAttribute("aria-describedby", errId);
        badInputs.push(input);
      } else {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
      }
    }

    const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), state);
    const set = (path, v) => {
      const keys = path.split(".");
      const last = keys.pop();
      const obj = keys.reduce((o, k) => (o[k] = o[k] || {}), state);
      obj[last] = v;
    };

    function fillFields() {
      els.fields.forEach((input) => {
        const v = get(input.dataset.invField);
        input.value = v == null ? "" : v;
      });
      els.methods.forEach((r) => { r.checked = r.value === state.method; });
    }

    function itemRow(it, i) {
      const n = i + 1;
      return `<li class="inv-item" data-index="${i}">
        <span class="inv-item__n" aria-hidden="true">${pad(n)}</span>
        <div class="field inv-item__desc"><label class="sr-only" for="inv-desc-${i}">Mô tả hạng mục ${n}</label>
          <input id="inv-desc-${i}" type="text" data-item="desc" value="${e(it.desc)}" placeholder="VD: Video editing, 4 YouTube episodes" autocomplete="off"></div>
        <div class="field inv-item__qty"><label class="inv-item__lab" for="inv-qty-${i}">Số lượng</label>
          <input id="inv-qty-${i}" type="text" inputmode="decimal" data-item="qty" value="${e(it.qty)}" placeholder="1" autocomplete="off"></div>
        <div class="field inv-item__rate"><label class="inv-item__lab" for="inv-rate-${i}">Đơn giá</label>
          <div class="suffix-input"><input id="inv-rate-${i}" type="text" inputmode="decimal" data-item="rate" value="${e(it.rate)}" placeholder="0" autocomplete="off"><span data-inv-cur>${e(state.currency)}</span></div></div>
        <p class="inv-item__amt"><span class="inv-item__lab">Thành tiền</span><b data-item-amt>${e(money(num(it.qty, state.currency) * num(it.rate, state.currency), state.currency))}</b></p>
        <button class="icon-btn inv-item__del" type="button" data-item-del aria-label="Xóa hạng mục ${n}"${state.items.length === 1 ? " disabled" : ""}>${VR.icon("x")}</button>
        <p class="field__error inv-item__err" id="inv-err-${i}" data-item-err hidden></p>
      </li>`;
    }
    function renderItems(focusIndex) {
      els.items.innerHTML = state.items.map(itemRow).join("");
      if (focusIndex != null) {
        const input = els.items.querySelector(`#inv-desc-${focusIndex}`);
        if (input) input.focus();
      }
    }

    function renderSheet() {
      const tinted = els.sheet.querySelector(".is-zone");
      const tintedSel = tinted ? "." + Array.from(tinted.classList).find((c) => c.startsWith("inv-")) : "";
      els.sheet.innerHTML = sheetHtml(state);
      if (tintedSel) { const again = els.sheet.querySelector(tintedSel); if (again) again.classList.add("is-zone"); }
      const t = totals(state);
      els.totals.forEach((el) => { el.textContent = money(t.total, state.currency); });
      els.curLabels = Array.from(root.querySelectorAll("[data-inv-cur]"));
      els.curLabels.forEach((el) => { el.textContent = state.currency; });
      if (els.discUnit) els.discUnit.textContent = state.discountType === "percent" ? "%" : state.currency;
      badInputs = [];
      const cur = state.currency;
      /* one message per row: "1.500" in a dollar invoice asks which reading you meant,
         text the parser cannot read at all gets the format examples */
      const message = (fields, example) => {
        const unread = fields.filter((f) => f.bad && !isAmbiguous(f.raw, f.unit)).map((f) => f.label);
        const asks = fields.filter((f) => f.bad && isAmbiguous(f.raw, f.unit)).map((f) => ambiguityText(f.label.charAt(0).toUpperCase() + f.label.slice(1), f.raw));
        return (unread.length ? [`Chưa đọc được ${unread.join(" và ")}. ${example}`] : []).concat(asks).join(" ");
      };
      els.items.querySelectorAll(".inv-item").forEach((row, i) => {
        const it = state.items[i] || {};
        const badQty = isBad(it.qty, cur);
        const badRate = isBad(it.rate, cur);
        const amt = row.querySelector("[data-item-amt]");
        if (amt) amt.textContent = badQty || badRate ? "—" : money(t.lines[i] || 0, cur);
        const err = row.querySelector("[data-item-err]");
        const text = message([
          { label: "số lượng", raw: it.qty, unit: cur, bad: badQty },
          { label: "đơn giá", raw: it.rate, unit: cur, bad: badRate },
        ], "Viết số như 1250, 1,250.50 hoặc 1.250,50.");
        if (err) {
          err.hidden = !text;
          err.textContent = text;
        }
        flag(row.querySelector('[data-item="qty"]'), badQty, err && err.id);
        flag(row.querySelector('[data-item="rate"]'), badRate, err && err.id);
      });
      const badDisc = isBad(state.discount, discUnit(state));
      const badTax = isBad(state.tax, "%");
      if (els.adjustErr) {
        const text = message([
          { label: "ô giảm giá", raw: state.discount, unit: discUnit(state), bad: badDisc },
          { label: "ô thuế", raw: state.tax, unit: "%", bad: badTax },
        ], "Chỉ ghi số, ví dụ 10 hoặc 7,5.");
        els.adjustErr.hidden = !text;
        els.adjustErr.textContent = text;
      }
      flag(els.discInput, badDisc, els.adjustErr && els.adjustErr.id);
      flag(els.taxInput, badTax, els.adjustErr && els.adjustErr.id);
      els.groups.forEach((g) => { g.hidden = g.dataset.payGroup !== state.method; });
      const late = Boolean(state.due && state.issue && state.due < state.issue);
      if (els.warn) els.warn.hidden = !late;
      if (els.dueInput) {
        if (late) els.dueInput.setAttribute("aria-describedby", els.warn.id); else els.dueInput.removeAttribute("aria-describedby");
      }
      els.dueChips.forEach((chip) => {
        chip.setAttribute("aria-pressed", addDays(state.issue, Number(chip.dataset.invDueChip)) === state.due ? "true" : "false");
      });
      fit();
      root.dataset.total = String(t.total);
    }

    /* scale the 794px sheet to the stage width ("Xem cỡ thật" shows it at 100% in a scrollable desk) */
    let scale = 1;
    let zoomed = false;
    function fit() {
      if (!els.stage) return;
      const w = els.stage.clientWidth;
      scale = zoomed ? 1 : Math.min(1, w / SHEET_W);
      els.sheet.style.transform = scale < 1 ? `scale(${scale})` : "";
      els.stage.style.height = Math.ceil(els.sheet.offsetHeight * scale) + "px";
      els.stage.style.width = zoomed ? SHEET_W + "px" : "";
    }
    if (els.zoom) els.zoom.addEventListener("click", () => {
      zoomed = !zoomed;
      root.classList.toggle("is-zoom", zoomed);
      els.zoom.setAttribute("aria-pressed", zoomed ? "true" : "false");
      els.zoom.textContent = zoomed ? "Thu nhỏ" : "Xem cỡ thật";
      fit();
    });

    /* the preview follows the section being edited: scroll the desk to it (every time focus
       enters a section) and tint it briefly when you arrive from another section */
    const ZONES = { head: ".inv-head", meta: ".inv-meta", items: ".inv-t", pay: ".inv-pay", notes: ".inv-notes" };
    let zoneTimer;
    root.addEventListener("focusin", (ev) => {
      const sec = ev.target.closest("[data-inv-zone]");
      if (!sec || !els.desk) return;
      const zone = sec.dataset.invZone;
      const target = els.sheet.querySelector(ZONES[zone]);
      if (!target) return;
      const from = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest("[data-inv-zone]") : null;
      if (!from || from.dataset.invZone !== zone) {
        els.sheet.querySelectorAll(".is-zone").forEach((el) => el.classList.remove("is-zone"));
        target.classList.add("is-zone");
        clearTimeout(zoneTimer);
        zoneTimer = setTimeout(() => target.classList.remove("is-zone"), 1400);
      }
      if (els.desk.scrollHeight > els.desk.clientHeight + 4) {
        /* measured against the desk itself, so the sticky toolbar above it does not count */
        const top = target.getBoundingClientRect().top - els.desk.getBoundingClientRect().top - els.desk.clientTop + els.desk.scrollTop - 24;
        els.desk.scrollTo({ top: Math.max(0, Math.round(top)), behavior: VR.reducedMotion ? "auto" : "smooth" });
      }
    });
    if ("ResizeObserver" in window && els.stage) new ResizeObserver(() => fit()).observe(els.stage);
    window.addEventListener("resize", fit, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    /* autosave */
    let saveTimer;
    function setStatus(text) { if (els.status) els.status.textContent = text; }
    function saveNow() {
      state.savedAt = new Date().toISOString();
      const ok = VR.store.set(KEY, state);
      const time = new Date(state.savedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      setStatus(ok ? `Đã lưu nháp lúc ${time}, chỉ trên trình duyệt này` : "Trình duyệt đang chặn lưu nháp, hãy in hoặc lưu PDF trước khi đóng trang");
    }
    function changed() {
      renderSheet();
      if (typeof syncStart === "function") syncStart();
      clearTimeout(saveTimer);
      setStatus("Đang lưu nháp…");
      saveTimer = setTimeout(() => { saveTimer = 0; saveNow(); }, 450);
    }
    /* closing or reloading the tab inside the 450ms debounce must not lose the last edits */
    const flushSave = () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; saveNow(); } };
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

    /* bindings */
    els.fields.forEach((input) => {
      const path = input.dataset.invField;
      const update = () => {
        set(path, input.value);
        if (path === "currency" || path === "discountType") renderItems();
        changed();
      };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });
    els.methods.forEach((r) => r.addEventListener("change", () => {
      if (!r.checked) return;
      state.method = r.value;
      changed();
    }));
    els.items.addEventListener("input", (ev) => {
      const input = ev.target.closest("[data-item]");
      if (!input) return;
      const i = Number(input.closest(".inv-item").dataset.index);
      state.items[i][input.dataset.item] = input.value;
      changed();
    });
    els.items.addEventListener("click", (ev) => {
      const del = ev.target.closest("[data-item-del]");
      if (!del || state.items.length === 1) return;
      const i = Number(del.closest(".inv-item").dataset.index);
      state.items.splice(i, 1);
      renderItems();
      const focusTo = els.items.querySelectorAll("[data-item-del]")[Math.min(i, state.items.length - 1)];
      if (focusTo && !focusTo.disabled) focusTo.focus(); else if (els.add) els.add.focus();
      changed();
      VR.toast("Đã xóa một hạng mục");
    });
    if (els.add) els.add.addEventListener("click", () => {
      if (state.items.length >= 30) { VR.toast("Tối đa 30 hạng mục cho một invoice"); return; }
      state.items.push({ desc: "", qty: "1", rate: "" });
      renderItems(state.items.length - 1);
      changed();
    });
    /* Enter in the last row's rate adds a new row */
    els.items.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const input = ev.target.closest("[data-item]");
      if (!input) return;
      ev.preventDefault();
      const i = Number(input.closest(".inv-item").dataset.index);
      if (input.dataset.item === "rate" && i === state.items.length - 1 && els.add) els.add.click();
      else {
        const all = Array.from(els.items.querySelectorAll("[data-item]"));
        const nextInput = all[all.indexOf(input) + 1];
        /* select the default "1" so typing replaces it instead of making "12" */
        if (nextInput) { nextInput.focus(); nextInput.select(); }
      }
    });
    els.dueChips.forEach((chip) => chip.addEventListener("click", () => {
      state.due = addDays(state.issue || today(), Number(chip.dataset.invDueChip));
      const dueInput = root.querySelector('[data-inv-field="due"]');
      if (dueInput) dueInput.value = state.due;
      changed();
    }));

    /* print: copy the sheet into a body-level container the print stylesheet keeps */
    let printBox = document.querySelector(".inv-print");
    if (!printBox) {
      printBox = document.createElement("div");
      printBox.className = "inv-print";
      printBox.setAttribute("aria-hidden", "true");
      document.body.appendChild(printBox);
    }
    const preparePrint = () => {
      printBox.innerHTML = `<div class="inv-sheet inv-sheet--print">${sheetHtml(state)}</div>`;
    };
    window.addEventListener("beforeprint", preparePrint);
    /* no payment details: warn once, a second click within a few seconds prints anyway */
    let payWarned = 0;
    const payMissing = () => !METHODS[state.method].rows.some(([k]) => String((state.pay[state.method] || {})[k] || "").trim());
    els.print.forEach((btn) => btn.addEventListener("click", () => {
      const goTo = (input) => {
        input.focus({ preventScroll: true });
        input.scrollIntoView({ block: "center", behavior: VR.reducedMotion ? "auto" : "smooth" });
      };
      if (badInputs.length) {
        /* never print a wrong amount on a document that goes to a client */
        goTo(badInputs[0]);
        VR.toast(badInputs.length === 1 ? "Còn một ô số chưa rõ. Sửa ô đó rồi in lại." : `Còn ${badInputs.length} ô số chưa rõ. Sửa các ô đó rồi in lại.`);
        return;
      }
      if (payMissing() && !payWarned) {
        payWarned = setTimeout(() => { payWarned = 0; }, 8000);
        const group = root.querySelector(`[data-pay-group="${state.method}"] input, [data-pay-group="${state.method}"] textarea`);
        if (group) goTo(group);
        VR.toast("Mục 05 chưa có thông tin nhận tiền. Bấm in lần nữa nếu vẫn muốn in.");
        return;
      }
      clearTimeout(payWarned);
      payWarned = 0;
      clearTimeout(saveTimer);
      saveNow();
      preparePrint();
      const prev = document.title;
      /* the PDF file name browsers suggest comes from the title */
      const who = (state.to.company || state.to.name || "").trim();
      document.title = [state.number || "Invoice", who].filter(Boolean).join(" — ");
      const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
      window.addEventListener("afterprint", restore);
      window.print();
      setTimeout(restore, 1500);
    }));

    /* next invoice: keep your details + payment, bump the number, clear client and items */
    if (els.next) els.next.addEventListener("click", () => {
      const m = /^(.*?)(\d+)(\D*)$/.exec(state.number || "");
      state.number = m ? m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0") + m[3] : state.number;
      state.to = defaults().to;
      state.items = defaults().items;
      state.discount = "";
      state.notes = "";
      state.issue = today();
      state.due = addDays(state.issue, 14);
      fillFields();
      renderItems();
      changed();
      VR.toast(`Đã tạo ${state.number}, giữ thông tin của bạn và cách thanh toán`);
    });

    /* reset: two clicks so a stray tap never wipes a draft */
    let armed = null;
    if (els.reset) els.reset.addEventListener("click", () => {
      const label = els.reset.querySelector("[data-reset-label]");
      if (!armed) {
        els.reset.classList.add("is-armed");
        if (label) label.textContent = "Bấm lần nữa để xóa hết";
        armed = setTimeout(() => {
          els.reset.classList.remove("is-armed");
          if (label) label.textContent = "Làm lại từ đầu";
          armed = null;
        }, 4000);
        return;
      }
      clearTimeout(armed);
      armed = null;
      els.reset.classList.remove("is-armed");
      if (label) label.textContent = "Làm lại từ đầu";
      try { window.localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
      state = defaults();
      fillFields();
      renderItems();
      renderSheet();
      setStatus("Đã xóa nháp. Invoice mới, chưa lưu.");
      syncStart();
      VR.toast("Đã xóa nháp trên máy này");
    });

    /* example: fictional sender/client (example.com), real-looking items; payment is never prefilled */
    const isEmpty = () => !state.from.name && !state.to.name && !state.to.company && state.items.every((it) => !String(it.desc).trim() && !String(it.rate).trim());
    syncStart = () => { if (els.start) els.start.hidden = !isEmpty(); };
    if (els.example) els.example.addEventListener("click", () => {
      state.from = Object.assign(state.from, { name: "Linh Nguyen", email: "linh@example.com", address: "District 3, Ho Chi Minh City, Vietnam" });
      state.to = { name: "Sarah Miller", company: "Northwind Media LLC", email: "accounts@example.com", address: "Austin, TX, United States" };
      state.items = [
        { desc: "Video editing: 4 YouTube episodes, 10–12 minutes each", qty: "4", rate: "120" },
        { desc: "Short-form cutdowns for Reels and Shorts", qty: "12", rate: "25" },
        { desc: "Thumbnail design", qty: "4", rate: "15" },
      ];
      state.notes = "Thank you for your business. Payment is due within 14 days of the invoice date.";
      fillFields();
      renderItems();
      changed();
      VR.toast("Đã điền ví dụ. Sửa từng ô thành thông tin của bạn.");
      const first = root.querySelector('[data-inv-field="from.name"]');
      if (first) first.focus();
    });

    fillFields();
    renderItems();
    renderSheet();
    syncStart();
    if (state.savedAt) {
      const d = new Date(state.savedAt);
      setStatus(`Mở lại nháp lưu lúc ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ngày ${d.toLocaleDateString("vi-VN")}`);
    } else {
      setStatus("Nháp sẽ tự lưu trên trình duyệt này khi bạn gõ");
    }
    root.classList.add("is-ready");
  }

  VR.onReady(init);
})();

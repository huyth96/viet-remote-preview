/* Việt Remote — freelance rate calculator (/cong-cu/tinh-gia/).
   All maths runs in the browser. The comparison with real hourly pay by field reads the quartiles the page
   carries (json_script "vr-hourly", computed at render/export from the same jobs as the salary page:
   {all: [p25, p50, p75, n], by: {field: [p25, p50, p75, n]}}, fields with 5+ hourly rates only), so no job
   index is downloaded; without them it falls back to the public job index (/data/jobs.json via VR.loadJobs).
   Inputs are remembered in this browser only (VR.store "vr.rate"), as a convenience.
   Direction A (tinh_gia.html, tools-a.css §R): ONE white window [data-rate] — the inputs left, the answer right (the
   minimum big in cobalt, what to quote on a range bar with ticks, the month in the order the money flows: a bar + the
   cuts in USD + the net). Under it, outside the window: the comparison with the board's real hourly pay (a histogram
   with your marker; #so-voi-bang-viec) and the formula filled with your numbers (#cong-thuc). On phones the kit's action bar ([data-actionbar], VR.actionbar) carries the figure while the
   inputs are on screen.

     hours/month = hours/week × (52 − weeks off) ÷ 12
     client pays = target VND ÷ fx ÷ (1 − platform) ÷ (1 − withdrawal) ÷ (1 − tax)
     minimum     = client pays ÷ hours/month          recommended = minimum × 1.2 … 1.5
*/
(function () {
  "use strict";

  /* fx: about 26.000 đ per USD in late 2026, the same figure as the home page rate tile */
  const DEFAULTS = { v: 2, target: 20000000, hours: 30, off: 4, fee: "10", feeCustom: 20, withdraw: 2, tax: 10, fx: 26000, field: "" };
  const FX = [1000, 1000000];
  const KEY = "vr.rate";
  /* field limits live in ONE place: the min/max attributes in tinh_gia.html */
  const limits = (el) => [Number(el.min), Number(el.max)];
  const UNITS = { hours: " giờ", off: " tuần", feeCustom: "%", withdraw: "%", tax: "%" };

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const digits = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;
  /* The monthly target as people write it: 20.000.000 · 20,000,000 · 20tr · 20 triệu · 1,5 tỷ ·
     500k. With a unit, one separator followed by other than three digits is a decimal ("1,5 tỷ").
     Returns null for text it cannot read. */
  const SCALE = [[/^(k|nghin|ngan)$/, 1e3], [/^(tr|trieu|cu|m)$/, 1e6], [/^(ty|ti)$/, 1e9]];
  function parseMoney(raw) {
    const t = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
      .replace(/\s+/g, " ").trim().replace(/\s*(d|dong|vnd)$/, "");
    if (!t) return 0;
    const m = /^(\d[\d.,\s]*?)\s*([a-z]+)?$/.exec(t);
    if (!m) return null;
    const unit = m[2] || "";
    const scale = unit ? (SCALE.find(([re]) => re.test(unit)) || [])[1] : 1;
    if (!scale) return null;
    let n = m[1].replace(/\s/g, "");
    const seps = n.match(/[.,]/g) || [];
    if (unit && seps.length === 1 && !/[.,]\d{3}$/.test(n)) n = n.replace(",", ".");
    else n = n.replace(/[.,]/g, "");
    const v = Number(n);
    return Number.isFinite(v) ? Math.round(v * scale) : null;
  }
  const hasUnit = (s) => /[^\d.,\s]/.test(String(s || ""));
  const dec = (s) => { const n = parseFloat(String(s ?? "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
  const half = (n) => Math.round(n * 2) / 2;
  const f1 = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  const f0 = (n) => Math.round(n).toLocaleString("vi-VN");
  const usd = (n) => (n >= 100 ? f0(n) : f1(n)) + " USD";
  const vnd = (n) => f0(n) + " đ";
  const minus = (n, fmt) => (n > 0 ? "−" + fmt(n) : "Không có");
  const vndShort = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " triệu đ" : vnd(n));

  function compute(s) {
    const fee = (s.fee === "custom" ? s.feeCustom : Number(s.fee)) / 100;
    const hoursMonth = (s.hours * (52 - s.off)) / 12;
    const factor = (1 - fee) * (1 - s.withdraw / 100) * (1 - s.tax / 100);
    const gross = factor > 0 && s.fx > 0 ? s.target / s.fx / factor : 0;
    const min = hoursMonth > 0 ? gross / hoursMonth : 0;
    const platform = gross * fee;
    const afterPlatform = gross - platform;
    const withdrawal = afterPlatform * (s.withdraw / 100);
    const afterWithdraw = afterPlatform - withdrawal;
    const vndBeforeTax = afterWithdraw * s.fx;
    const taxVnd = vndBeforeTax * (s.tax / 100);
    return {
      fee, hoursMonth, gross, min, platform, withdrawal, afterWithdraw, vndBeforeTax, taxVnd,
      net: vndBeforeTax - taxVnd, lossPct: 1 - factor,
      low: Math.max(half(min * 1.2), half(min) + 0.5), high: Math.max(half(min * 1.5), half(min) + 1),
    };
  }

  /* Python statistics.quantiles(n=4) (exclusive method) — same numbers as the salary page */
  function quartiles(values) {
    const d = values.slice().sort((a, b) => a - b);
    const n = d.length;
    const m = n + 1;
    const q = [1, 2, 3].map((i) => {
      let j = Math.floor((i * m) / 4);
      j = j < 1 ? 1 : j > n - 1 ? n - 1 : j;
      const delta = i * m - j * 4;
      return (d[j - 1] * (4 - delta) + d[j] * delta) / 4;
    });
    const mid = n % 2 ? d[(n - 1) / 2] : (d[n / 2 - 1] + d[n / 2]) / 2;
    return { p25: q[0], p50: mid, p75: q[2], n };
  }

  VR.onReady(() => {
    const root = document.querySelector("[data-rate]");
    if (!root) return;
    const form = root.querySelector("[data-form]");
    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => document.querySelector(sel);       // the comparison, the formula and the action bar sit outside the window
    const targetInput = $("[data-target]");
    const fxInput = $("[data-fx]");
    const fieldSelect = $$("select[data-field]");
    const customWrap = $("[data-custom]");
    const saved = VR.store.get(KEY, {}) || {};
    if (saved.v !== DEFAULTS.v) delete saved.fx;   // v1 saved the old 25.000 default
    let state = Object.assign({}, DEFAULTS, saved, { v: DEFAULTS.v });
    let hourly = null;        // {all: [...], byField: {slug: [...]}} once loaded (fallback path)
    let pre = null;           // the page's precomputed quartiles (vr-hourly), the normal path
    let lastMin = 0;
    let targetOk = true;      // false: the monthly target is missing or clearly mistyped (e.g. "20" đ)

    /* ---------- field messages: out-of-range values are clamped, and the field says so ---------- */
    const errEl = (key) => root.querySelector(`[data-err="${key}"]`);
    const unit = (key, v) => (key === "fx" || key === "target" ? f0(v) + " đ" : f1(v) + UNITS[key]);
    function setError(el, key, text, invalid) {
      const msg = errEl(key);
      if (msg && msg.textContent !== text) msg.textContent = text;
      if (invalid) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    }
    function clearErrors() {
      root.querySelectorAll("[data-err]").forEach((m) => { m.textContent = ""; });
      root.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    }

    /* ---------- state <-> form ---------- */
    function fill() {
      targetInput.value = f0(state.target);
      fxInput.value = f0(state.fx);
      root.querySelectorAll("[data-num]").forEach((el) => { el.value = state[el.dataset.num]; });
      root.querySelectorAll("[data-fee]").forEach((r) => { r.checked = r.value === String(state.fee); });
      customWrap.hidden = state.fee !== "custom";
      fieldSelect.value = state.field || "";
      if (fieldSelect.value !== (state.field || "")) fieldSelect.value = "";
    }
    function read() {
      const typed = parseMoney(targetInput.value);
      state.target = clamp(typed == null ? 0 : typed, 0, 5e9);
      /* a monthly target under 1 triệu is almost always a missing unit ("20" for 20 triệu):
         say so and show no verdict rather than "0 USD/giờ" */
      let msg = "";
      if (typed == null) msg = "Chưa đọc được số tiền. Ghi như 20.000.000, 20tr hoặc 1,5 tỷ.";
      else if (!state.target) msg = "Nhập số tiền bạn muốn nhận về mỗi tháng.";
      else if (state.target < 1e6) msg = state.target < 1000
        ? `Bạn nhập ${f0(state.target)} đ, ý bạn là ${f1(state.target)} triệu? Ghi ${f0(state.target)}tr hoặc ${f0(state.target * 1e6)}.`
        : `Bạn nhập ${f0(state.target)} đ một tháng. Ghi đủ số, ví dụ 20.000.000 hoặc 20tr.`;
      targetOk = !msg;
      setError(targetInput, "target", msg, !targetOk);
      const fx = digits(fxInput.value);
      if (fx >= FX[0] && fx <= FX[1]) { state.fx = fx; setError(fxInput, "fx", "", false); }
      else setError(fxInput, "fx", `Tỷ giá từ ${unit("fx", FX[0])} đến ${unit("fx", FX[1])}. Đang tính với ${unit("fx", state.fx)}.`, true);
      root.querySelectorAll("[data-num]").forEach((el) => {
        const key = el.dataset.num;
        const [lo, hi] = limits(el);
        const n = dec(el.value);
        if (!Number.isFinite(n)) {
          setError(el, key, `Nhập một số từ ${unit(key, lo)} đến ${unit(key, hi)}. Đang tính với ${unit(key, state[key])}.`, true);
          return;
        }
        state[key] = clamp(n, lo, hi);
        const out = state[key] !== n;
        setError(el, key, out ? `${n < lo ? "Tối thiểu" : "Tối đa"} ${unit(key, state[key])}. Đang tính với ${unit(key, state[key])}.` : "", out);
      });
      const fee = root.querySelector("[data-fee]:checked");
      state.fee = fee ? fee.value : "10";
      customWrap.hidden = state.fee !== "custom";
      state.field = fieldSelect.value;
      if (targetOk) VR.store.set(KEY, state);
    }

    /* on change/blur the input takes the value the maths actually uses */
    function commit(el) {
      if (el.matches("[data-num]")) {
        const key = el.dataset.num;
        const [lo, hi] = limits(el);
        const n = dec(el.value);
        if (Number.isFinite(n) && n === state[key]) return;
        el.value = state[key];
        setError(el, key, Number.isFinite(n) ? `${n < lo ? "Tối thiểu" : "Tối đa"} ${unit(key, n < lo ? lo : hi)}, đã đổi về ${unit(key, state[key])}.` : `Đã điền lại ${unit(key, state[key])}.`, false);
      } else if (el === targetInput) {
        /* "20tr" becomes "20.000.000" once you leave the field */
        if (targetOk && hasUnit(targetInput.value)) targetInput.value = f0(state.target);
      } else if (el === fxInput) {
        const fx = digits(fxInput.value);
        if (fx === state.fx) return;
        fxInput.value = f0(state.fx);
        setError(fxInput, "fx", `Tỷ giá phải từ ${unit("fx", FX[0])} đến ${unit("fx", FX[1])}, đã giữ ${unit("fx", state.fx)}.`, false);
      }
    }

    /* ---------- output ---------- */
    const setText = (sel, text) => { const el = $$(sel); if (el && el.textContent !== text) el.textContent = text; };
    const setAll = (sel, text) => document.querySelectorAll(sel).forEach((el) => { if (el.textContent !== text) el.textContent = text; });
    /* a display figure's decimal comma set small (.nsep), like portal_tags |num_seps */
    const seps = (text) => VR.escape(text).replace(",", '<span class="nsep">,</span>');
    /* the big number tweens frame by frame, so screen readers get the settled result from a separate live region */
    let announceTimer = 0;
    let announced = false;
    function announce(text) {
      clearTimeout(announceTimer);
      if (!announced) { announced = true; return; }   // not on page load
      announceTimer = setTimeout(() => { const el = $("[data-announce]"); if (el.textContent !== text) el.textContent = text; }, 700);
    }

    /* the big number rolls to its new value (260 ms). The first time it counts up from zero over 900 ms, the window
       coming alive — only under html.rv-live (never with reduced motion, lite or without the lively layer). Null
       shows a dash. */
    let tween = 0;
    let firstRoll = document.documentElement.classList.contains("rv-live") && !VR.reducedMotion;
    function tweenMin(target) {
      const el = $("[data-min]");
      cancelAnimationFrame(tween);
      (el.closest(".ta-fig") || el.parentElement).classList.toggle("is-empty", target === null);
      if (target === null) { el.textContent = "–"; lastMin = 0; return; }
      let from = lastMin;
      let dur = 260;
      if (firstRoll) { firstRoll = false; from = 0.1; dur = 900; el.innerHTML = seps(f1(from)); }
      lastMin = target;
      if (VR.reducedMotion || !from) { el.innerHTML = seps(f1(target)); return; }
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        el.innerHTML = seps(f1(Math.round((from + (target - from) * (1 - Math.pow(1 - p, 3))) * 10) / 10));
        if (p < 1) tween = requestAnimationFrame(step);
      };
      tween = requestAnimationFrame(step);
    }

    /* the range bar: the minimum (the dot) and what to quote (the band) on a scale from 2 under the minimum to 2 over
       the top of the quote, as portal_tags rate_breakdown draws the first paint; each with its tick label */
    function renderRange(r, valid) {
      const bar = $("[data-range-bar]");
      if (!bar) return;
      bar.hidden = !valid;
      if (!valid) return;
      const lo = Math.floor(r.min) - 2;
      const hi = Math.ceil(r.high) + 2;
      const pos = (v) => (100 * (v - lo) / (hi - lo)).toFixed(2) + "%";
      const at = { m: pos(r.min), a: pos(r.low), b: pos(r.high) };
      bar.style.setProperty("--a", at.a);
      bar.style.setProperty("--b", at.b);
      bar.style.setProperty("--m", at.m);
      const label = { m: f1(r.min), a: f1(r.low), b: f1(r.high) };
      bar.querySelectorAll("[data-tick]").forEach((tick) => {
        const k = tick.dataset.tick;
        tick.style.setProperty("--at", at[k]);
        if (tick.textContent !== label[k]) tick.textContent = label[k];
      });
    }

    function render() {
      const r = compute(state);
      const valid = targetOk && r.min > 0 && Number.isFinite(r.min);
      tweenMin(valid ? Math.round(r.min * 10) / 10 : null);
      setText("[data-bar-value]", valid ? f1(r.min) + " USD/giờ" : "–");
      setText("[data-target-label]", targetOk ? vndShort(state.target) : "số tiền bạn chọn");
      setText("[data-range]", valid ? `${f1(r.low)}–${f1(r.high)} USD/giờ` : "–");
      renderRange(r, valid);
      announce(valid ? `Giá tối thiểu ${f1(r.min)} USD/giờ. Nên báo giá ${f1(r.low)} đến ${f1(r.high)} USD/giờ.` : "Chưa tính được giá. Kiểm tra số tiền muốn nhận và số giờ.");

      const feePct = f1(r.fee * 100) + "%";
      /* the month in the order the money flows, ONE unit in the value column (USD: the tax reserve the tool books on
         what reaches the account is the same amount at your exchange rate), the net's đồng as its second line; the
         stacked bar shows each cut's share of what the client pays */
      const taxUsd = state.fx > 0 ? r.taxVnd / state.fx : 0;
      const netUsd = Math.max(0, r.gross - r.platform - r.withdrawal - taxUsd);
      const rows = [
        ["coral", `Phí nền tảng ${feePct}`, minus(r.platform, usd), r.platform ? "" : "is-zero"],
        ["sky", `Phí rút tiền ${f1(state.withdraw)}%`, minus(r.withdrawal, usd), r.withdrawal ? "" : "is-zero"],
        ["amber", `Dự phòng thuế ${f1(state.tax)}%`, minus(taxUsd, usd), taxUsd ? "" : "is-zero"],
      ];
      const dot = '<i class="rv-dot" aria-hidden="true"></i>';
      $("[data-table]").innerHTML = rows.map(([, label, value, cls]) =>
        `<tr${cls ? ` class="${cls}"` : ""}><th scope="row">${dot}${VR.escape(label)}</th><td>${VR.escape(valid ? value : "–")}</td></tr>`).join("") +
        `<tr class="is-total"><th scope="row">${dot}Bạn nhận về</th><td>${valid ? `${VR.escape(usd(netUsd))}<small>${VR.escape(vnd(r.net))}</small>` : "–"}</td></tr>`;
      const gross = $("[data-gross]");
      if (gross && gross.textContent !== (valid ? usd(r.gross) : "–")) gross.textContent = valid ? usd(r.gross) : "–";
      const split = $("[data-split]");
      if (split) split.classList.toggle("is-off", !(valid && r.gross > 0));
      if (split && valid && r.gross > 0) {
        const share = [r.platform, r.withdrawal, taxUsd, netUsd].map((v) => ((100 * v) / r.gross).toFixed(2));
        split.querySelectorAll("i").forEach((seg, i) => { seg.style.setProperty("--w", share[i]); seg.hidden = i < 3 && Number(share[i]) === 0; });
      }

      /* the formula below the tool, filled with these numbers (#cong-thuc) */
      setAll('[data-f="hours"]', f0(state.hours));
      setAll('[data-f="off"]', f0(state.off));
      setAll('[data-f="hm"], [data-f="hm2"]', f0(r.hoursMonth));
      setAll('[data-f="target"]', targetOk ? vnd(state.target) : "–");
      setAll('[data-f="fx"]', f0(state.fx));
      setAll('[data-f="fee"]', feePct);
      setAll('[data-f="wd"]', f1(state.withdraw) + "%");
      setAll('[data-f="tax"]', f1(state.tax) + "%");
      setAll('[data-f="gross"], [data-f="gross2"]', valid ? (r.gross >= 100 ? f0(r.gross) : f1(r.gross)) : "–");
      setAll('[data-f="min"]', valid ? f1(r.min) : "–");

      root.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.preset) === state.target ? "true" : "false"));
      renderCompare(r, valid);
    }

    function renderCompare(r, valid) {
      if (!hourly && !pre) return;
      const status = $$("[data-compare-status]");
      const box = $$("[data-compare]");
      if (!status || !box) return;
      if (!valid) {
        status.hidden = false;
        status.textContent = "Nhập số tiền muốn nhận về mỗi tháng để so với lương thật.";
        box.hidden = true;
        return;
      }
      const slug = state.field;
      const opt = fieldSelect.selectedOptions[0];
      const label = slug && opt ? opt.dataset.label || opt.textContent : "mọi ngành";
      let q = null;
      let fallback = false;
      if (pre) {
        let row = slug ? pre.by[slug] : pre.all;
        if (!row) { row = pre.all; fallback = Boolean(slug); }
        if (row && row[3] >= 5) q = { p25: row[0], p50: row[1], p75: row[2], n: row[3] };
      } else {
        let values = slug ? hourly.byField[slug] || [] : hourly.all;
        if (values.length < 5) { values = hourly.all; fallback = Boolean(slug); }
        if (values.length >= 5) q = quartiles(values);
      }
      if (!q) {
        status.hidden = false;
        status.textContent = "Chưa đủ tin có ghi lương theo giờ để so sánh.";
        box.hidden = true;
        return;
      }
      const you = r.min;
      /* the chart's scale is the histogram's (portal_tags hourly_overview: 5 USD bins, the last one 100+: 0 … 105) */
      const bins = Array.from(box.querySelectorAll("[data-bins] > i"));
      const top = bins.length ? Number(bins[bins.length - 1].dataset.end) : 105;
      const pct = (v) => clamp((v / top) * 100, 0, 100);
      bins.forEach((bin) => bin.classList.toggle("is-below", Number(bin.dataset.end) <= you && !("last" in bin.dataset)));
      const youEl = box.querySelector("[data-you]");
      youEl.style.setProperty("--at", pct(you).toFixed(2));
      youEl.classList.toggle("is-edge-l", pct(you) < 8);
      youEl.classList.toggle("is-edge-r", pct(you) > 92);
      const youN = youEl.querySelector("[data-you-n]");
      if (youN.textContent !== f1(you)) youN.textContent = f1(you);
      const band = box.querySelector("[data-band]");
      band.style.left = pct(q.p25) + "%";
      band.style.width = Math.max(1, pct(q.p75) - pct(q.p25)) + "%";
      box.querySelector("[data-median]").style.left = pct(q.p50) + "%";

      box.querySelector("[data-p25]").textContent = f1(q.p25);
      box.querySelector("[data-p50]").textContent = f1(q.p50);
      box.querySelector("[data-p75]").textContent = f1(q.p75);
      const fieldName = fallback || !slug ? "mọi ngành" : label;
      box.querySelector("[data-med-label]").textContent = `Trung vị, ${fieldName}`;
      /* the bars are every field's: with a field picked they step back, its band and median lead */
      box.classList.toggle("is-field", Boolean(slug) && !fallback);
      const cap = box.querySelector("[data-chart-cap]");
      if (cap) cap.textContent = `Số tin theo mức lương theo giờ, mọi ngành. Dải xám: 50% số tin ở giữa, ${fieldName}.`;
      const sub = $$("[data-compare-sub]");
      if (sub) sub.textContent = `Lương theo giờ của ${f0(q.n)} tin đang mở${fallback || !slug ? "" : `, ngành ${label}`}, quy về USD.`;

      /* ONE sentence: where your minimum sits, what to do about it */
      const where = VR.escape(fallback ? "mọi ngành" : label);
      const minTxt = `<strong>${f1(you)} USD/giờ</strong>`;
      let text;
      if (you < q.p25) text = `${minTxt} thấp hơn 75% số tin của ${where}: bạn còn dư địa báo cao hơn.`;
      else if (you < q.p50) text = `${minTxt} ở nửa dưới của ${where}: báo trong khoảng nên báo, rồi tăng dần về trung vị.`;
      else if (you <= q.p75) text = `${minTxt} đã cao hơn trung vị của ${where}: cần portfolio và đánh giá tốt ngay từ đầu.`;
      else text = `${minTxt} cao hơn 75% số tin của ${where}: nhắm khách lớn, hoặc tăng số giờ tính tiền.`;
      box.querySelector("[data-compare-text]").innerHTML = text;
      /* only when it matters: a field with too few hourly rates is compared with every field */
      box.querySelector("[data-compare-note]").textContent = fallback ? "Ngành này có dưới 5 tin ghi lương theo giờ nên đang so với mọi ngành." : "";
      status.hidden = true;
      box.hidden = false;
    }

    /* ---------- events ---------- */
    const update = () => { read(); render(); };
    form.addEventListener("input", (event) => {
      if ((event.target === targetInput && !hasUnit(targetInput.value) && !/[.,]\d{0,2}\s*$/.test(targetInput.value)) || event.target === fxInput) {
        /* live thousands separators, keeping the caret near the end; not while a unit
           ("20tr", "1,5 tỷ") or a decimal comma is being typed */
        const el = event.target;
        const fromEnd = el.value.length - (el.selectionStart || 0);
        const n = digits(el.value);
        el.value = n ? f0(n) : "";
        const pos = Math.max(0, el.value.length - fromEnd);
        try { el.setSelectionRange(pos, pos); } catch (_) { /* not focusable */ }
      }
      update();
    });
    form.addEventListener("change", (event) => { update(); commit(event.target); });
    fieldSelect.addEventListener("change", update);
    form.addEventListener("submit", (event) => event.preventDefault());
    root.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      state.target = Number(b.dataset.preset);
      targetInput.value = f0(state.target);
      update();
    }));
    root.querySelector("[data-reset]").addEventListener("click", () => {
      state = Object.assign({}, DEFAULTS, { field: state.field });
      fill();
      clearErrors();
      update();
      VR.toast("Đã đặt lại thông số mặc định", { tone: "info" });
    });
    root.querySelector("[data-copy]").addEventListener("click", (event) => {
      if (!targetOk) { VR.toast("Sửa ô số tiền muốn nhận trước khi sao chép", { tone: "error" }); targetInput.focus(); return; }
      const r = compute(state);
      const lines = [
        `Muốn nhận về: ${vnd(state.target)}/tháng`,
        `Giờ tính tiền: ${f0(state.hours)} giờ/tuần, nghỉ ${f0(state.off)} tuần/năm (${f0(r.hoursMonth)} giờ/tháng)`,
        `Phí nền tảng ${f1(r.fee * 100)}% · phí rút ${f1(state.withdraw)}% · dự phòng thuế ${f1(state.tax)}% · tỷ giá ${f0(state.fx)}`,
        `Giá tối thiểu: ${f1(r.min)} USD/giờ`,
        `Nên báo giá: ${f1(r.low)}–${f1(r.high)} USD/giờ`,
        `Tính bằng công cụ của Việt Remote: ${location.origin}/cong-cu/tinh-gia/`,
      ];
      VR.copy(lines.join("\n"), "Đã sao chép kết quả", event.currentTarget);
    });

    fill();
    update();
    root.classList.add("is-on");   // the figure shows from here (tools-a.css hides it until its first roll starts)

    /* phones: the result's action bar ([data-actionbar], rv.css §23) is the kit's: common.js VR.actionbar shows it
       while the inputs are on screen and the result card is not; this file only writes its figure ([data-live]) */

    /* real hourly pay by field: the page's precomputed quartiles; the job index only as a fallback */
    try {
      const el = document.getElementById("vr-hourly");
      const data = el ? JSON.parse(el.textContent) : null;
      if (data && Array.isArray(data.all) && data.by) pre = data;
    } catch (_) { pre = null; }
    Array.from(fieldSelect.options).forEach((opt) => { opt.dataset.label = opt.value ? opt.textContent : "mọi ngành"; });
    if (pre) { render(); return; }
    VR.loadJobs().then((data) => {
      const all = [];
      const byField = {};
      (data.jobs || []).forEach((job) => {
        const pay = job.pay || {};
        if (!pay.disclosed || pay.period !== "hourly" || !pay.hourly_usd) return;
        all.push(pay.hourly_usd);
        (byField[job.field] = byField[job.field] || []).push(pay.hourly_usd);
      });
      hourly = { all, byField };
      render();
    }).catch(() => {
      const status = $$("[data-compare-status]");
      if (status) { status.hidden = false; status.textContent = "Không tải được dữ liệu lương lúc này. Phần tính giá vẫn dùng bình thường."; }
    });
  });

  VR.rateCompute = compute;   // console / test hook
})();

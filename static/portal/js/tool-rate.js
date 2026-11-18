/* Việt Remote — freelance rate calculator (/cong-cu/tinh-gia/).
   All maths runs in the browser. The comparison with real hourly pay by field reads the quartiles the page
   carries (json_script "vr-hourly", computed at render/export from the same jobs as the salary page:
   {all: [p25, p50, p75, n], by: {field: [p25, p50, p75, n]}}, fields with 5+ hourly rates only), so no job
   index is downloaded; without them it falls back to the public job index (/data/jobs.json via VR.loadJobs).
   Inputs are remembered in this browser only (VR.store "vr.rate"), as a convenience.

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
    const targetInput = $("[data-target]");
    const fxInput = $("[data-fx]");
    const fieldSelect = $("[data-field]");
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
    /* the big number tweens frame by frame, so screen readers get the settled result from a separate live region */
    let announceTimer = 0;
    let announced = false;
    function announce(text) {
      clearTimeout(announceTimer);
      if (!announced) { announced = true; return; }   // not on page load
      announceTimer = setTimeout(() => { const el = $("[data-announce]"); if (el.textContent !== text) el.textContent = text; }, 700);
    }

    /* the big number rolls to its new value (260ms); null shows a dash */
    let tween = 0;
    function tweenMin(target) {
      const el = $("[data-min]");
      cancelAnimationFrame(tween);
      if (target === null) { el.textContent = "–"; lastMin = 0; return; }
      const from = lastMin;
      lastMin = target;
      if (VR.reducedMotion || !from) { el.textContent = f1(target); return; }
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / 260);
        el.textContent = f1(Math.round((from + (target - from) * (1 - Math.pow(1 - p, 3))) * 10) / 10);
        if (p < 1) tween = requestAnimationFrame(step);
      };
      tween = requestAnimationFrame(step);
    }

    function render() {
      const r = compute(state);
      const valid = targetOk && r.min > 0 && Number.isFinite(r.min);
      tweenMin(valid ? Math.round(r.min * 10) / 10 : null);
      $("[data-live]").textContent = valid ? f1(r.min) + " USD/giờ" : "–";
      $("[data-target-label]").textContent = targetOk ? vndShort(state.target) : "số tiền bạn chọn";
      $("[data-gross]").textContent = valid ? usd(r.gross) : "–";
      $("[data-hours-month]").textContent = f0(r.hoursMonth) + " giờ";
      $("[data-range]").textContent = valid ? `${f1(r.low)}–${f1(r.high)} USD/giờ` : "–";
      announce(valid ? `Giá tối thiểu ${f1(r.min)} USD/giờ. Nên báo giá ${f1(r.low)} đến ${f1(r.high)} USD/giờ.` : "Chưa tính được giá. Kiểm tra số tiền muốn nhận và số giờ.");

      const feePct = f1(r.fee * 100) + "%";
      const rows = [
        ["Khách trả", usd(r.gross), `${f1(r.min)} USD × ${f0(r.hoursMonth)} giờ`, ""],
        [`Phí nền tảng (${feePct})`, minus(r.platform, usd), "", r.platform ? "is-minus" : "is-zero"],
        [`Phí rút tiền (${f1(state.withdraw)}%)`, minus(r.withdrawal, usd), "", r.withdrawal ? "is-minus" : "is-zero"],
        [`Về tài khoản, tỷ giá ${f0(state.fx)}`, vnd(r.vndBeforeTax), usd(r.afterWithdraw), ""],
        [`Dự phòng thuế (${f1(state.tax)}%)`, minus(r.taxVnd, vnd), "", r.taxVnd ? "is-minus" : "is-zero"],
        ["Bạn nhận về", vnd(r.net), "", "is-total"],
        ["Phí và thuế chiếm", f1(r.lossPct * 100) + "% tiền khách trả", "", "is-sub"],
      ];
      $("[data-table]").innerHTML = rows.map(([label, value, note, cls]) =>
        `<tr${cls ? ` class="${cls}"` : ""}><th scope="row">${VR.escape(label)}</th><td>${VR.escape(valid ? value : "–")}${note && valid ? `<small>${VR.escape(note)}</small>` : ""}</td></tr>`).join("");

      root.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.preset) === state.target ? "true" : "false"));
      renderCompare(r, valid);
    }

    function renderCompare(r, valid) {
      if (!hourly && !pre) return;
      if (!valid) {
        $("[data-compare-status]").hidden = false;
        $("[data-compare-status]").textContent = "Nhập số tiền muốn nhận về mỗi tháng để so với lương thật.";
        $("[data-compare]").hidden = true;
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
        $("[data-compare-status]").hidden = false;
        $("[data-compare-status]").textContent = "Chưa đủ tin có ghi lương theo giờ để so sánh.";
        $("[data-compare]").hidden = true;
        return;
      }
      const you = r.min;
      const maxRaw = Math.max(q.p75 * 1.35, you * 1.15, r.high * 1.1, 10);
      const step = maxRaw > 80 ? 20 : maxRaw > 40 ? 10 : 5;
      const max = Math.ceil(maxRaw / step) * step;
      const pct = (v) => clamp((v / max) * 100, 0, 100);

      $("[data-band]").style.left = pct(q.p25) + "%";
      $("[data-band]").style.width = (pct(q.p75) - pct(q.p25)) + "%";
      $("[data-median]").style.left = pct(q.p50) + "%";
      const youEl = $("[data-you]");
      youEl.style.left = pct(you) + "%";
      youEl.classList.toggle("is-edge-l", pct(you) < 6);
      youEl.classList.toggle("is-edge-r", pct(you) > 94);
      youEl.querySelector("span").textContent = "Bạn " + f1(you);
      const ticks = [];
      for (let v = 0; v <= max; v += step) ticks.push(`<span style="left:${pct(v)}%">${v}</span>`);
      $("[data-axis]").innerHTML = ticks.join("");

      $("[data-p25]").textContent = f1(q.p25);
      $("[data-p50]").textContent = f1(q.p50);
      $("[data-p75]").textContent = f1(q.p75);

      const where = fallback ? "mọi ngành" : label;
      const minTxt = `<strong>${f1(you)} USD/giờ</strong>`;
      let text;
      if (you < q.p25) text = `Giá tối thiểu của bạn, ${minTxt}, thấp hơn 75% tin có ghi lương theo giờ trong ${VR.escape(where)}. Bạn có dư địa báo cao hơn, nhất là khi đã có portfolio và vài đánh giá tốt.`;
      else if (you < q.p50) text = `Giá tối thiểu của bạn, ${minTxt}, nằm ở nửa dưới của ${VR.escape(where)}; trung vị là <strong>${f1(q.p50)} USD/giờ</strong>. Báo quanh khoảng nên báo, rồi tăng dần về trung vị.`;
      else if (you <= q.p75) text = `Giá tối thiểu của bạn, ${minTxt}, đã cao hơn trung vị của ${VR.escape(where)} (${f1(q.p50)} USD/giờ). Cần portfolio và đánh giá tốt để khách chấp nhận ngay từ đầu.`;
      else text = `Giá tối thiểu của bạn, ${minTxt}, cao hơn 75% tin trong ${VR.escape(where)}. Hãy nhắm khách lớn, việc chuyên sâu, hoặc tăng số giờ tính tiền để hạ mức tối thiểu.`;
      $("[data-compare-text]").innerHTML = text;
      /* no "updated on" date: a static export is rebuilt rarely, and the page carries no dated details */
      $("[data-compare-note]").textContent = (fallback ? `Ngành này có dưới 5 tin ghi lương theo giờ nên đang so với mọi ngành. ` : "") +
        `Tính từ ${f0(q.n)} tin đang mở có ghi lương theo giờ${fallback || !slug ? "" : " trong ngành này"}, quy về USD.`;
      $("[data-compare-status]").hidden = true;
      $("[data-compare]").hidden = false;
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
      VR.toast("Đã đặt lại thông số mặc định");
    });
    root.querySelector("[data-copy]").addEventListener("click", () => {
      if (!targetOk) { VR.toast("Sửa ô số tiền muốn nhận trước khi sao chép"); targetInput.focus(); return; }
      const r = compute(state);
      const lines = [
        `Muốn nhận về: ${vnd(state.target)}/tháng`,
        `Giờ tính tiền: ${f0(state.hours)} giờ/tuần, nghỉ ${f0(state.off)} tuần/năm (${f0(r.hoursMonth)} giờ/tháng)`,
        `Phí nền tảng ${f1(r.fee * 100)}% · phí rút ${f1(state.withdraw)}% · dự phòng thuế ${f1(state.tax)}% · tỷ giá ${f0(state.fx)}`,
        `Giá tối thiểu: ${f1(r.min)} USD/giờ`,
        `Nên báo giá: ${f1(r.low)}–${f1(r.high)} USD/giờ`,
        `Tính bằng công cụ của Việt Remote: ${location.origin}/cong-cu/tinh-gia/`,
      ];
      VR.copy(lines.join("\n"), "Đã sao chép kết quả");
    });

    fill();
    update();

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
      $("[data-compare-status]").textContent = "Không tải được dữ liệu lương lúc này. Phần tính giá vẫn dùng bình thường.";
    });
  });

  VR.rateCompute = compute;   // console / test hook
})();

/* Việt Remote — "Mẫu proposal và email khách" (tools/mau_proposal_email.html)
   Client-side only. Six English templates x two tones, filled live from a few fields.
   Empty fields show an example value (styled as a sample) so the preview always reads well;
   copying warns when samples are still in the text.

   Markup contract (template):
     [data-tpl]                 root
     [data-tpl-type] radios     name="tpl-type", value = template key
     [data-tpl-tone] buttons    data-tone="friendly|formal", aria-pressed
     [data-tpl-field="x"]       inputs (wrapped in [data-field-wrap="x"] to show/hide per template)
     [data-tpl-subject] [data-tpl-body] [data-tpl-tips] [data-tpl-stats] [data-tpl-snippet]
     ([data-tpl-tips] may sit outside the root: its own section after the tool; the template server-renders the
     first render, so the script's first paint changes nothing)
     [data-tpl-copy] [data-tpl-copy-subject] [data-tpl-clear]
   Session-only memory (sessionStorage "vr.templates"): survives a reload, gone when the tab closes. */
(function () {
  "use strict";

  const VR = window.VR;
  const KEY = "vr.templates";

  const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const EXAMPLE = {
    client: "Sarah",
    project: "short-form video editing for your YouTube channel",
    skill: "video editing",
    years: "3",
    result: "grew a fitness channel from 2,000 to 48,000 subscribers in six months",
    rate: "25",
    oldRate: "20",
    unit: "hour",
    effective: plusDays(30),
    availability: "20 hours a week, from Monday",
    name: "Linh",
  };

  /* Paragraphs: {t, tip?}. Tokens: {client} {project} {skill} {Skill} {years} {result} {rate}
     {oldRate} {effective} {availability} {name}. "\n" = line break inside a paragraph. */
  const TEMPLATES = {
    upwork: {
      label: "Proposal Upwork", use: "Cover letter khi ứng tuyển một job trên Upwork",
      fields: ["client", "project", "skill", "years", "result", "rate", "availability", "name"],
      subject: null,
      body: {
        friendly: [
          { t: "Hi {client}," },
          { t: "I read your post about {project}, and this is exactly the kind of work I do every week.", tip: 1 },
          { t: "I've worked in {skill} for {years}. One recent result: I {result}.", tip: 2 },
          { t: "Here's how I'd start: a 15-minute call to confirm what success looks like for you, then a first draft within 48 hours, so you can judge my work before committing to more.", tip: 3 },
          { t: "My rate is {rate}, and I'm available {availability}." },
          { t: "Would it help if I sent two samples similar to your project?", tip: 4 },
          { t: "Thanks,\n{name}" },
        ],
        formal: [
          { t: "Hello {client}," },
          { t: "Thank you for sharing the details of {project}. I have reviewed the requirements and can deliver exactly what you have described.", tip: 1 },
          { t: "I have {years} of experience in {skill}. Most relevant to your project: I {result}.", tip: 2 },
          { t: "My proposed approach: we agree on scope and success criteria in a short call, I deliver a first milestone within 48 hours, and we review it together before moving forward.", tip: 3 },
          { t: "My rate is {rate}. I am available {availability}." },
          { t: "Shall I share two relevant samples so you can review them before we speak?", tip: 4 },
          { t: "Kind regards,\n{name}" },
        ],
      },
      tips: [
        ["Mở bằng dự án của khách", "Khách chỉ thấy khoảng 200 ký tự đầu của thư."],
        ["Một kết quả có số thay cho mười kỹ năng", "Một con số chứng minh nhanh hơn “hard-working”."],
        ["Cho khách thấy bước đầu tiên", "Bản nháp sớm làm giảm rủi ro cho khách."],
        ["Kết bằng một câu hỏi dễ trả lời", "Câu hỏi có hoặc không dễ được nhắn lại."],
      ],
    },
    cold: {
      label: "Cold email", use: "Chủ động chào dịch vụ cho khách chưa từng liên hệ",
      fields: ["client", "project", "skill", "years", "result", "availability", "name"],
      subject: { friendly: "A quick idea for you, {client}", formal: "{Skill} support for your team" },
      body: {
        friendly: [
          { t: "Hi {client}," },
          { t: "I've been following your work and noticed you might need help with {project}. I had one idea I think could make a real difference.", tip: 1 },
          { t: "I've worked in {skill} for {years}. One recent result: I {result}.", tip: 2 },
          { t: "If it's useful, I can send a short sample showing what I'd change, free and with no strings attached. Would a 15-minute chat next week work? I'm available {availability}.", tip: 3 },
          { t: "Cheers,\n{name}" },
        ],
        formal: [
          { t: "Hello {client}," },
          { t: "I came across your work and noticed you may be looking for support with {project}. This is exactly what I specialise in.", tip: 1 },
          { t: "I have {years} of experience in {skill}. A recent example: I {result}.", tip: 2 },
          { t: "I would be happy to prepare a short, complimentary sample for your review. If you are open to it, could we schedule a 15-minute call? I am available {availability}.", tip: 3 },
          { t: "Best regards,\n{name}" },
        ],
      },
      tips: [
        ["Chứng minh bạn đã tìm hiểu khách", "Một câu nhắc đúng việc của họ, không gửi hàng loạt."],
        ["Bằng chứng ngắn, có số", "Trả lời câu “sao tôi phải đọc tiếp?”."],
        ["Lời mời nhỏ, chỉ một lời mời", "Mẫu thử hay cuộc gọi ngắn; cả thư dưới 120 từ."],
      ],
    },
    followup: {
      label: "Follow-up", use: "Nhắc lại khi khách chưa trả lời proposal hoặc báo giá",
      fields: ["client", "project", "skill", "availability", "name"],
      subject: { friendly: "Following up on {project}", formal: "Follow-up: proposal for {project}" },
      body: {
        friendly: [
          { t: "Hi {client}," },
          { t: "Just bringing this back to the top of your inbox: I sent my proposal for {project} last week.", tip: 1 },
          { t: "Since then I've sketched out how I'd handle the first week, including a quick win we could ship in the first few days. Happy to send it over if it's useful.", tip: 2 },
          { t: "I'm still keen to help with {skill}, and I'm available {availability}." },
          { t: "If the timing isn't right, no worries at all. A quick “not now” helps me plan.", tip: 3 },
          { t: "Best,\n{name}" },
        ],
        formal: [
          { t: "Hello {client}," },
          { t: "I am following up on the proposal I sent last week for {project}, in case it was missed.", tip: 1 },
          { t: "I have since prepared a brief outline of how I would approach the first week, which I would be glad to share.", tip: 2 },
          { t: "I remain very interested in supporting you with {skill} and am available {availability}." },
          { t: "If you have decided to go in a different direction, I would appreciate a short note so I can plan accordingly.", tip: 3 },
          { t: "Kind regards,\n{name}" },
        ],
      },
      tips: [
        ["Ngắn, không trách móc", "Khách im lặng thường vì bận, không phải từ chối."],
        ["Mang thêm một giá trị mới", "Một ý tưởng, một bản phác thảo, không chỉ hỏi tin."],
        ["Cho khách một lối ra", "Được nói “chưa” thì dễ trả lời; tối đa hai lần."],
      ],
    },
    quote: {
      label: "Báo giá", use: "Gửi giá và phạm vi công việc sau khi trao đổi",
      fields: ["client", "project", "skill", "years", "result", "rate", "availability", "name"],
      subject: { friendly: "Quote for {project}", formal: "Quote: {project}" },
      body: {
        friendly: [
          { t: "Hi {client}," },
          { t: "Thanks for walking me through {project}. Here's my quote, based on what we discussed.", tip: 1 },
          { t: "What's included:\n• {Skill} for the full scope we agreed on\n• Two rounds of revisions\n• Final files in the formats you need", tip: 2 },
          { t: "Price: {rate}\nAvailability: {availability}" },
          { t: "Why me: {years} of experience in {skill}. Most recently, I {result}." },
          { t: "This quote is valid for 14 days. I usually work with 50% upfront and 50% on delivery, or through milestones if you prefer. If it all looks good, just reply “approved” and I'll set up the first milestone.", tip: 3 },
          { t: "Best,\n{name}" },
        ],
        formal: [
          { t: "Hello {client}," },
          { t: "Thank you for the opportunity to quote for {project}. Please find the details below.", tip: 1 },
          { t: "Scope of work:\n• {Skill} covering the full agreed scope\n• Up to two rounds of revisions\n• Final deliverables in your preferred formats", tip: 2 },
          { t: "Fee: {rate}\nAvailability: {availability}" },
          { t: "Relevant experience: {years} in {skill}. A recent example: I {result}." },
          { t: "This quote is valid for 14 days. Payment terms are 50% upfront and 50% on delivery, or milestone-based if preferred. Once you confirm, I will send the first milestone for approval.", tip: 3 },
          { t: "Kind regards,\n{name}" },
        ],
      },
      tips: [
        ["Mở bằng cuộc trao đổi trước đó", "Khách nhớ ngay đây là báo giá cho việc gì."],
        ["Ghi rõ những gì có trong giá", "Phạm vi và số lần sửa đứng cạnh giá, tránh phát sinh."],
        ["Hạn báo giá và điều khoản thanh toán", "Có hạn thì khách quyết sớm; đặt cọc giữ an toàn cho bạn."],
      ],
    },
    raise: {
      label: "Tăng giá", use: "Báo khách cũ mức giá mới, giữ quan hệ lâu dài",
      fields: ["client", "project", "skill", "years", "result", "oldRate", "rate", "effective", "availability", "name"],
      subject: { friendly: "An update to my rates from {effective}", formal: "Rate update effective {effective}" },
      body: {
        friendly: [
          { t: "Hi {client}," },
          { t: "I've really enjoyed working with you on {project}. Together we {result}, and I'm proud of that.", tip: 1 },
          { t: "I'm writing to let you know that from {effective}, my rate will change from {oldRate} to {rate}. It reflects the experience I've built over {years} in {skill} and the results we've been getting.", tip: 2 },
          { t: "Nothing else changes: same quality, same turnaround, and I'm still available {availability}. Happy to jump on a quick call if you have any questions.", tip: 3 },
          { t: "Thank you for trusting me with your work." },
          { t: "Best,\n{name}" },
        ],
        formal: [
          { t: "Hello {client}," },
          { t: "Thank you for the continued opportunity to work on {project}. I am proud of what we have achieved together; most notably, we {result}.", tip: 1 },
          { t: "I am writing to inform you that, effective {effective}, my rate will be adjusted from {oldRate} to {rate}. This reflects my {years} of experience in {skill} and the value delivered on this project.", tip: 2 },
          { t: "The quality and turnaround you rely on will remain the same, and I am available {availability}. Please let me know if you would like to discuss this.", tip: 3 },
          { t: "Thank you for your continued trust." },
          { t: "Kind regards,\n{name}" },
        ],
      },
      tips: [
        ["Nhắc kết quả trước khi nói về giá", "Khách đồng ý khi thấy rõ giá trị đã nhận."],
        ["Nói thẳng con số và ngày áp dụng", "Không vòng vo; báo trước ít nhất 30 ngày."],
        ["Khẳng định điều không đổi", "Chất lượng và tốc độ giữ nguyên, sẵn lòng trao đổi."],
      ],
    },
    review: {
      label: "Xin review", use: "Xin đánh giá và góp ý sau khi bàn giao dự án",
      fields: ["client", "project", "result", "availability", "name"],
      subject: { friendly: "A quick favour?", formal: "Feedback on {project}" },
      body: {
        friendly: [
          { t: "Hi {client}," },
          { t: "Thanks again for the chance to work on {project}. I'm really happy with how it turned out: we {result}.", tip: 1 },
          { t: "Would you mind leaving a short review? Two or three sentences about working together would help me a lot. If we worked on Upwork, you'll find the feedback form under the closed contract.", tip: 2 },
          { t: "If it helps, clients usually mention communication, quality of work and speed. And if there's anything I could have done better, I'd genuinely love to hear it.", tip: 3 },
          { t: "I'm available {availability} whenever you need help again." },
          { t: "Best,\n{name}" },
        ],
        formal: [
          { t: "Hello {client}," },
          { t: "Thank you for the opportunity to work on {project}. I am pleased with the outcome: we {result}.", tip: 1 },
          { t: "Would you be willing to share a brief review of our work together? A few sentences would be greatly appreciated. On Upwork, the feedback form is available under the closed contract.", tip: 2 },
          { t: "You may wish to comment on communication, quality and timeliness. I would also welcome any suggestions on how I could improve.", tip: 3 },
          { t: "Should you need support in the future, I am available {availability}." },
          { t: "Kind regards,\n{name}" },
        ],
      },
      tips: [
        ["Xin ngay khi khách còn vui", "Gửi vài ngày sau bàn giao, nhắc lại kết quả."],
        ["Nói rõ việc cần làm, và nó ngắn", "“Hai, ba câu” nghe nhẹ hơn “viết đánh giá”."],
        ["Gợi ý chủ đề, xin cả góp ý", "Có gợi ý thì viết nhanh, xin góp ý thì không giống đòi khen."],
      ],
    },
  };
  const ORDER = ["upwork", "cold", "followup", "quote", "raise", "review"];
  const UNITS = { hour: "/hour", month: "/month", project: " for the full project" };

  /* ------------------------------------------------------------------ formatting */
  /* Same amount parser as tool-invoice.js (keep in sync), always in USD here: 25 · 25,5 · 0.5 ·
     1,250.50 · 1.250,50 · 1.250.000 · $1,250. A lone "1.500" could be 1.5 or 1500, so it is
     ambiguous and the field asks. NaN for text it cannot read (or ambiguous). */
  const strip = (v) => String(v ?? "").replace(/A\$|US\$|USD|EUROS?|EUR|AUD|VND|[\s$€₫đ]/gi, "");
  const LONE = /^-?[1-9]\d{0,2}\.\d{3}$/;
  const isAmbiguous = (v) => LONE.test(strip(v));
  const parseAmount = (v) => {
    let s = strip(v);
    if (!s) return 0;
    const neg = s[0] === "-";
    if (neg) s = s.slice(1);
    let n;
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(s)) {
      if (LONE.test(s)) return NaN;
      n = Number(s.replace(/\./g, "").replace(",", "."));
    } else if (/^[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/.test(s)) n = Number(s.replace(/,/g, ""));
    else if (/^(\d+[.,]?\d*|[.,]\d+)$/.test(s)) n = Number(s.replace(",", "."));
    else return NaN;
    return neg ? -n : n;
  };
  const isBadAmount = (v) => String(v ?? "").trim() !== "" && !(parseAmount(v) > 0);
  function ambiguityText(raw) {
    const s = strip(raw).replace(/^-/, "");
    const small = Number(s);
    const big = Number(s.replace(".", ""));
    const vi = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
    return `“${String(raw).trim()}” là ${vi(small)} hay ${vi(big)} USD? Ghi ${String(small)} hoặc ${String(big)} cho rõ.`;
  }
  /* $25 · $25.50 (never "$1,250.5") */
  const money = (raw) => {
    const n = parseAmount(raw);
    if (!Number.isFinite(n) || n <= 0) return "";
    const cents = Math.round(n * 100) % 100 !== 0;
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
  };
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const years = (raw) => {
    const n = Number(String(raw || "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return "";
    return `${n.toLocaleString("en-US")} ${n === 1 ? "year" : "years"}`;
  };
  const dateEn = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  /* strip what people often paste around their phrase: trailing full stop, a leading "I " */
  const clean = (key, v) => {
    let s = String(v || "").replace(/\s+/g, " ").trim();
    if (key === "result") s = s.replace(/^(i|we)\s+/i, "").replace(/[.\s]+$/, "");
    if (key === "project" || key === "skill" || key === "availability") s = s.replace(/[.\s]+$/, "");
    return s;
  };

  /** {token: {text, sample}} for the current values */
  function tokens(values) {
    const pick = (key, fmt) => {
      const own = fmt(clean(key, values[key]));
      return own ? { text: own, sample: false } : { text: fmt(clean(key, EXAMPLE[key])), sample: true };
    };
    const unit = UNITS[values.unit] ? values.unit : "hour";
    const rate = (key) => pick(key, (v) => { const m = money(v); return m ? m + UNITS[unit] : ""; });
    const out = {
      client: pick("client", (v) => v),
      project: pick("project", (v) => v),
      skill: pick("skill", (v) => v),
      years: pick("years", years),
      result: pick("result", (v) => v),
      rate: rate("rate"),
      oldRate: rate("oldRate"),
      effective: pick("effective", dateEn),
      availability: pick("availability", (v) => v),
      name: pick("name", (v) => v),
    };
    out.Skill = { text: cap(out.skill.text), sample: out.skill.sample };
    return out;
  }

  const e = (s) => VR.escape(s);
  const TOKEN = /\{(client|project|skill|Skill|years|result|rate|oldRate|effective|availability|name)\}/g;
  const fillHtml = (text, tk, used) => e(text).replace(TOKEN, (_, k) => {
    used.add(k === "Skill" ? "skill" : k);
    return `<span class="tp-var${tk[k].sample ? " is-sample" : ""}" data-var="${k === "Skill" ? "skill" : k}">${e(tk[k].text)}</span>`;
  }).replace(/\n/g, "<br>");
  const fillText = (text, tk) => text.replace(TOKEN, (_, k) => tk[k].text);

  /* ------------------------------------------------------------------ app */
  function init() {
    const root = document.querySelector("[data-tpl]");
    if (!root) return;
    const $ = (sel) => root.querySelector(sel);
    const els = {
      types: Array.from(root.querySelectorAll("[data-tpl-type]")),
      tones: Array.from(root.querySelectorAll("[data-tpl-tone]")),
      fields: Array.from(root.querySelectorAll("[data-tpl-field]")),
      wraps: Array.from(root.querySelectorAll("[data-field-wrap]")),
      subjectRow: $("[data-tpl-subject-row]"),
      subject: $("[data-tpl-subject]"),
      body: $("[data-tpl-body]"),
      /* the tips live in their own section after the tool (outside the root) */
      tips: $("[data-tpl-tips]") || document.querySelector("[data-tpl-tips]"),
      tipsTitle: $("[data-tpl-tips-title]"),
      stats: $("[data-tpl-stats]"),
      /* what a client sees in the proposal list: the visual of the "why it works" section, after the tool */
      snippet: $("[data-tpl-snippet]") || document.querySelector("[data-tpl-snippet]"),
      snippetText: $("[data-tpl-snippet-text]") || document.querySelector("[data-tpl-snippet-text]"),
      snippetName: $("[data-tpl-snippet-name]") || document.querySelector("[data-tpl-snippet-name]"),
      snippetInitial: document.querySelector("[data-tpl-snippet-initial]"),
      /* the letter in miniature beside the tips (#vi-sao-hieu-qua, after the tool): the kit's twins light a tip and
         its paragraph (ed.js); this file writes both and keeps the picked key */
      why: document.querySelector("[data-tpl-why]"),
      mini: document.querySelector("[data-tpl-mini]"),
      miniLabel: document.querySelector("[data-tpl-mini-label]"),
      label: $("[data-tpl-label]"),
      use: $("[data-tpl-use]"),
      to: $("[data-tpl-to]"),
      rail: $(".tp-types"),
      errs: Array.from(root.querySelectorAll("[data-tpl-err]")),
      barLabel: $("[data-tpl-bar-label]"),
      barValue: $("[data-tpl-bar-value]"),
    };

    let saved = {};
    try { saved = JSON.parse(window.sessionStorage.getItem(KEY) || "{}") || {}; } catch (_) { saved = {}; }
    const state = {
      type: TEMPLATES[saved.type] ? saved.type : "upwork",
      tone: saved.tone === "formal" ? "formal" : "friendly",
      values: Object.assign({ unit: "hour", effective: "" }, saved.values || {}),
    };
    /* a ?mau=raise style deep link picks the template (used by other tools' links) */
    const fromUrl = new URLSearchParams(window.location.search).get("mau");
    if (fromUrl && TEMPLATES[fromUrl]) state.type = fromUrl;

    const persist = () => {
      try { window.sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* private mode */ }
    };

    /* restore inputs */
    els.fields.forEach((input) => {
      const k = input.dataset.tplField;
      if (state.values[k] != null && state.values[k] !== "") input.value = state.values[k];
      if (k === "effective" && !input.value) input.placeholder = EXAMPLE.effective;
    });

    let last = { subject: "", body: "", samples: 0 };

    function render() {
      const tpl = TEMPLATES[state.type];
      const tk = tokens(state.values);
      const used = new Set();

      els.types.forEach((r) => { r.checked = r.value === state.type; });
      els.tones.forEach((b) => b.setAttribute("aria-pressed", b.dataset.tone === state.tone ? "true" : "false"));
      els.wraps.forEach((w) => {
        const keys = w.dataset.fieldWrap.split(" ");
        w.hidden = !keys.some((k) => tpl.fields.includes(k));
      });
      if (els.label) els.label.textContent = tpl.label;
      if (els.use) els.use.textContent = tpl.use;

      /* subject */
      const subjectTpl = tpl.subject ? tpl.subject[state.tone] : "";
      if (els.subjectRow) els.subjectRow.hidden = !subjectTpl;
      if (subjectTpl) els.subject.innerHTML = fillHtml(cap(subjectTpl), tk, used);
      if (els.to) els.to.innerHTML = `<span class="tp-var${tk.client.sample ? " is-sample" : ""}" data-var="client">${e(tk.client.text)}</span>`;

      /* body: tip markers sit in the gutter, numbered like the tips list */
      const paras = tpl.body[state.tone];
      els.body.innerHTML = paras.map((p) => `<p class="tp-p${p.tip ? " has-tip" : ""}"${p.tip ? ` data-tip="${p.tip}"` : ""}>${p.tip ? `<span class="tp-pin" aria-hidden="true">${p.tip}</span>` : ""}${fillHtml(p.t, tk, used)}</p>`).join("");

      /* field messages: a rate the parser cannot read (the letter falls back to the sample), a
         "1.500" that could mean two things, and for "Tăng giá" a new rate that is not higher than
         the current one or a date that has already passed */
      const v = state.values;
      const fieldMessage = (k, fallback) => {
        if (k === "rate" || k === "oldRate") {
          if (isAmbiguous(v[k])) return ambiguityText(v[k]);
          if (isBadAmount(v[k])) return fallback;
          const nv = parseAmount(v.rate);
          const ov = parseAmount(v.oldRate);
          if (k === "rate" && state.type === "raise" && nv > 0 && ov > 0 && nv <= ov) return "Giá mới chưa cao hơn giá hiện tại. Kiểm tra lại hai ô giá.";
        }
        if (k === "effective" && state.type === "raise" && v.effective && v.effective < todayIso()) return "Ngày này đã qua. Chọn một ngày sắp tới, nên cách hôm nay ít nhất 30 ngày.";
        return "";
      };
      els.errs.forEach((err) => {
        const k = err.dataset.tplErr;
        const input = root.querySelector(`[data-tpl-field="${k}"]`);
        if (err.dataset.text == null) err.dataset.text = err.textContent;
        const text = input ? fieldMessage(k, err.dataset.text) : "";
        const bad = Boolean(text);
        err.hidden = !bad;
        if (bad && err.textContent !== text) err.textContent = text;
        const field = err.closest(".field");
        if (field) field.classList.toggle("field--error", bad);
        if (!input) return;
        if (input.dataset.describedby == null) input.dataset.describedby = input.getAttribute("aria-describedby") || "";
        const base = input.dataset.describedby;
        if (bad) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", (base + " " + err.id).trim()); }
        else {
          input.removeAttribute("aria-invalid");
          if (base) input.setAttribute("aria-describedby", base); else input.removeAttribute("aria-describedby");
        }
      });

      /* the tips and the letter in miniature: the picked key lit in both (the twins' key at rest) */
      let key = els.why ? els.why.dataset.edTwins || "1" : "1";
      if (Number(key) > tpl.tips.length) key = "1";
      if (els.why) els.why.dataset.edTwins = key;
      els.tips.innerHTML = tpl.tips.map(([title, text], i) => `<li><button type="button" class="tp-tip${String(i + 1) === key ? " is-lit" : ""}" data-tip="${i + 1}" data-ed-k="${i + 1}" aria-pressed="${String(i + 1) === key}"><span class="tp-tip__num ed-num" aria-hidden="true">0${i + 1}</span><span class="tp-tip__main"><span class="tp-tip__title">${e(title)}</span><span class="tp-tip__text">${e(text)}</span></span></button></li>`).join("");
      if (els.mini) {
        els.mini.innerHTML = paras.map((p) => `<p class="ta-mini__p${p.tip && String(p.tip) === key ? " is-lit" : ""}"${p.tip ? ` data-ed-k="${p.tip}"` : ""}>${p.tip ? `<span class="ta-mini__pin">${p.tip}</span>` : ""}${e(fillText(p.t, tk)).replace(/\n/g, "<br>")}</p>`).join("");
        if (els.miniLabel) els.miniLabel.textContent = tpl.label;
      }

      /* plain text for copy + stats */
      const subjectText = subjectTpl ? fillText(cap(subjectTpl), tk) : "";
      const bodyText = paras.map((p) => fillText(p.t, tk)).join("\n\n");
      const words = bodyText.split(/\s+/).filter(Boolean).length;
      const secs = Math.max(10, Math.round((words / 220) * 60 / 5) * 5);
      const samples = Array.from(used).filter((k) => tk[k] && tk[k].sample).length;
      last = { subject: subjectText, body: bodyText, samples };

      els.stats.innerHTML = `<span><b class="tnum">${words}</b> từ</span><span>đọc khoảng ${secs < 60 ? secs + " giây" : Math.round(secs / 60) + " phút"}</span>${state.type === "upwork" ? `<span><b class="tnum">${bodyText.length.toLocaleString("vi-VN")}</b>/5.000 ký tự</span>` : ""}${samples ? `<span class="tp-stats__samples"><span class="tp-sample-key">${samples} ô</span> còn là mẫu</span>` : ""}`;

      /* Upwork: what the client sees in the proposal list (first ~200 characters) */
      if (els.snippet) {
        els.snippet.hidden = state.type !== "upwork";
        if (state.type === "upwork") {
          const flat = paras.slice(0, -1).map((p) => fillText(p.t, tk)).join(" ").replace(/\s+/g, " ");
          els.snippetText.textContent = flat.length > 200 ? flat.slice(0, 199).replace(/\s+\S*$/, "") + "…" : flat;
          els.snippetName.textContent = tk.name.text;
          if (els.snippetInitial) els.snippetInitial.textContent = (tk.name.text.trim()[0] || "·").toUpperCase();
        }
      }
      /* phones: the action bar repeats the letter's name and how much is still sample text */
      if (els.barLabel) els.barLabel.textContent = tpl.label;
      if (els.barValue) els.barValue.textContent = `${words} từ` + (samples ? ` · ${samples} ô còn là mẫu` : " · sẵn sàng gửi");
      root.dataset.activeType = state.type;
      root.dataset.activeTone = state.tone;
    }

    /* on phones the pills scroll sideways: keep the chosen one in view (a ?mau= link or a
       restored session can pick one that starts off-screen). Only the rail scrolls, never the page. */
    function revealType(smooth) {
      const rail = els.rail;
      const input = els.types.find((r) => r.checked);
      if (!rail || !input || rail.scrollWidth <= rail.clientWidth + 1) return;
      const pill = input.closest("label") || input;
      const r = rail.getBoundingClientRect();
      const p = pill.getBoundingClientRect();
      const edge = 16;
      const fade = 32; /* the rail fades out its last 28px */
      let left = rail.scrollLeft;
      if (p.left < r.left + edge) left += p.left - r.left - edge;
      else if (p.right > r.right - fade) left += p.right - r.right + fade;
      else return;
      rail.scrollTo({ left: Math.max(0, left), behavior: smooth && !VR.reducedMotion ? "smooth" : "auto" });
    }

    /* a tip and its paragraph light each other in #vi-sao-hieu-qua (the kit's twins); a click or focus keeps the pick
       (the twins' key at rest), so a re-render (another template, a field typed) keeps it too */
    if (els.why) ["click", "focusin"].forEach((type) => els.why.addEventListener(type, (ev) => {
      const el = ev.target.closest && ev.target.closest("[data-ed-k]");
      if (el) els.why.dataset.edTwins = el.dataset.edK;
    }));

    /* the field you are typing in lights up its words in the preview */
    function focusVar(key) {
      root.querySelectorAll(".tp-var[data-var]").forEach((el) => el.classList.toggle("is-focus", el.dataset.var === key));
    }

    els.types.forEach((r) => r.addEventListener("change", () => {
      if (!r.checked) return;
      state.type = r.value;
      persist();
      render();
      revealType(true);
    }));
    els.tones.forEach((b) => b.addEventListener("click", () => {
      state.tone = b.dataset.tone;
      persist();
      render();
    }));
    els.fields.forEach((input) => {
      const k = input.dataset.tplField;
      const update = () => { state.values[k] = input.value; persist(); render(); focusVar(k); };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
      input.addEventListener("focus", () => focusVar(k));
      input.addEventListener("blur", () => focusVar(null));
    });

    /* the letter's copy pill (and its twin in the phone action bar): the tick and "Đã sao chép" on the pill, a toast
       that says when sample values are still in the letter */
    root.querySelectorAll("[data-tpl-copy]").forEach((btn) => btn.addEventListener("click", () => {
      const text = last.subject ? `Subject: ${last.subject}\n\n${last.body}` : last.body;
      const msg = last.samples ? `Đã sao chép. Còn ${last.samples} ô đang là giá trị mẫu, nhớ sửa trước khi gửi.` : "Đã sao chép, sẵn sàng dán vào email";
      VR.copy(text, msg, btn);
    }));
    const copySubject = $("[data-tpl-copy-subject]");
    if (copySubject) copySubject.addEventListener("click", () => VR.copy(last.subject, "Đã sao chép tiêu đề", copySubject));
    const clearBtn = $("[data-tpl-clear]");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      els.fields.forEach((input) => { input.value = input.dataset.tplField === "unit" ? "hour" : ""; });
      state.values = { unit: "hour", effective: "" };
      persist();
      render();
      VR.toast("Đã xóa các ô, xem trước quay về giá trị mẫu", { tone: "info" });
    });
    /* the band's white pill leads to the field: common.js [data-focus-target] */

    render();
    revealType(false);
    /* pill widths change once the display font arrives */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => revealType(false));
    root.classList.add("is-ready");
  }

  VR.onReady(init);
})();

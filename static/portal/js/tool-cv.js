/* Việt Remote — CV / Upwork profile / proposal grader (/cong-cu/cham-cv/).
   Transparent heuristics, 100% in the browser: nothing typed here is stored or sent.

   Check: { id, label, weight, test(ctx) -> {pass, detail}, fix, example?: {before, after, why} }
   Score = passed weight / total weight × 10, rounded to 0.5.
*/
(function () {
  "use strict";

  /* ---------------- text helpers ---------------- */
  const VI_CHARS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/gi;
  const count = (re, text) => (text.match(re) || []).length;
  const fold = (s) => VR.fold(s);

  const ACTION_VERBS = ["led", "managed", "built", "created", "designed", "developed", "launched", "increased", "reduced",
    "improved", "grew", "delivered", "automated", "optimized", "optimised", "implemented", "achieved", "drove", "generated",
    "negotiated", "trained", "mentored", "analyzed", "analysed", "produced", "edited", "wrote", "organized", "coordinated",
    "streamlined", "scaled", "saved", "won", "established", "redesigned", "migrated", "shipped", "boosted", "cut", "doubled",
    "tripled", "planned", "researched", "translated", "handled", "resolved", "closed", "sourced", "hired",
    /* Vietnamese verbs keep their diacritics: folded, "dat" would also be đặt/đất, "dung" người dùng, "giam" giám đốc */
    "xây dựng", "triển khai", "quản lý", "quản lí", "thiết kế", "dẫn dắt", "phát triển", "tối ưu", "tự động hóa", "tự động hoá",
    "hoàn thành", "đào tạo", "sản xuất", "cải thiện", "ra mắt", "tổ chức", "điều phối", "biên tập", "tăng", "giảm", "đạt", "dựng"];
  /* runs on the lower-cased original text, with Unicode-aware edges: JS \b treats ư, ộ, ớ… as non-word characters */
  const VERB_RE = new RegExp("(?<![\\p{L}\\p{N}])(" + ACTION_VERBS.map((v) => v.replace(/ /g, "\\s+")).join("|") + ")(?![\\p{L}\\p{N}])(?!\\s+viên)", "giu");   // "biên tập viên" is a job title
  /* "I, my, me" as whole words only: with a plain \b, mới, với, người, lợi and Tôi would each count as "i" */
  const FIRST_PERSON_RE = /(?<![\p{L}\p{N}'’])(i|my|me)(?![\p{L}\p{N}])/giu;
  const WEAK_RE = /\b(responsible for|duties (included|include)|worked on|helped with|hard[- ]?working|team player|detail[- ]oriented|fast learner|quick learner|go[- ]getter|self[- ]motivated|passionate|results[- ]driven|chiu kho|nhiet tinh|ham hoc hoi|nang dong|trung thuc|co trach nhiem|cau tien)\b/g;
  const METRIC_RE = /(\d+(?:[.,]\d+)?\s?(%|x\b|k\b|\+)|[$€£]\s?\d[\d.,]*|\d[\d.,]*\s?(usd|vnd|đ|triệu|million|followers|users|clients|customers|leads|views|subscribers|orders|projects|videos|episodes|articles|khách|người|dự án|đơn|video|bài))/gi;
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const LINK_RE = /(linkedin\.com|github\.com|behance\.net|dribbble\.com|vimeo\.com|youtube\.com|notion\.site|https?:\/\/|www\.|portfolio\s*:)/i;
  const PERSONAL_RE = /\b(date of birth|dob|birthday|ngay sinh|nam sinh|marital|hon nhan|gioi tinh|gender|religion|ton giao|chieu cao|can nang|height|weight|cmnd|cccd|que quan|nationality)\b/;

  /* sign-off lines at the end ("Best,", "Thanks, An", "Kind regards" + a name line) are not the
     closing ask: the CTA checks read the last lines before them */
  const SIGNOFF_RE = /^(best( wishes| regards)?|kind regards|warm regards|regards|many thanks|thanks( again| so much)?|thank you( so much| again)?|cheers|sincerely|yours( sincerely| truly)?|respectfully|talk soon|all the best|trân trọng|thân ái)(?!\p{L})[\s,.!–-]*/iu;
  /* a name is capitalised words ("An", "Nguyen Thu Linh"), so "Thanks, let me know…" stays a sentence */
  const NAME_RE = /^\p{Lu}[\p{L}.'’-]*(\s+\p{Lu}[\p{L}.'’-]*){0,3}$/u;
  const isName = (l) => l.length <= 40 && NAME_RE.test(l);
  const isSignoff = (l) => { const m = SIGNOFF_RE.exec(l); if (!m) return false; const rest = l.slice(m[0].length).trim(); return !rest || isName(rest); };
  function withoutSignoff(lines) {
    const out = lines.slice();
    while (out.length > 1) {
      const last = out[out.length - 1];
      if (isSignoff(last)) { out.pop(); continue; }
      if (out.length > 2 && isName(last) && isSignoff(out[out.length - 2])) { out.splice(-2, 2); continue; }
      break;
    }
    return out.join("\n");
  }

  /** phone-like runs with at least 9 digits (a "2021 - 2022" year range is not a phone) */
  function phoneIn(text) {
    const runs = text.match(/\+?\d[\d .()-]{7,}\d/g) || [];
    return runs.find((r) => r.replace(/\D/g, "").length >= 9 && !/^\d{4}\s*[-–]\s*\d{4}$/.test(r.trim())) || "";
  }

  function typos(raw) {
    /* emails, links and domains are not prose */
    const text = raw.replace(/\S+@\S+|https?:\/\/\S+|www\.\S+|\b[\w-]+\.(com|net|io|vn|org|me|co|site|app|dev|ai)\b\S*/gi, "link");
    const found = [];
    const add = (re, label) => { const m = text.match(re); if (m) found.push(label + ": “" + m[0].trim().slice(0, 24) + "”"); };
    add(/\S+ {2,}\S+/, "Hai dấu cách liền nhau");
    add(/[^\s]\s+[,;!?](?!\d)/, "Dấu cách trước dấu câu");
    add(/(?<![\p{L}\p{N}])([\p{L}\p{N}]{2,})\s+\1(?![\p{L}\p{N}])/iu, "Lặp từ");
    add(/(^|[.!?]\s+|\s)i\s(?=[a-z])/, "Chữ “i” viết thường");
    add(/[a-zà-ỹ]{2,}\.(?=[A-ZÀ-Ỹ][a-zà-ỹ]{2,})|[a-zà-ỹ]{2,},(?=[A-Za-zÀ-ỹ]{2,})/, "Thiếu dấu cách sau dấu câu");
    add(/[!?]{2,}/, "Dấu chấm than/hỏi lặp");
    return found;
  }

  /** per-character fold (no diacritics, lower-case) with an index map, so a match on folded
      text can be shown as the user wrote it ("Ngày sinh", not "ngay sinh") */
  function foldMap(text) {
    let out = "";
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const f = ch === "đ" || ch === "Đ" ? "d" : /\s/.test(ch) ? " " : ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (let k = 0; k < f.length; k++) { out += f[k]; map.push(i); }
    }
    return { folded: out, map };
  }

  function context(text) {
    const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const folded = fold(text);
    const letters = count(/\p{L}/gu, text) || 1;
    const fm = foldMap(text);
    const slice = (m) => text.slice(fm.map[m.index], fm.map[m.index + m[0].length - 1] + 1);
    /** first match of a folded-text pattern, in the user's own spelling ("" if none) */
    const find = (re) => { const m = new RegExp(re.source, re.flags.replace("g", "")).exec(fm.folded); return m ? slice(m) : ""; };
    /** every match, user's spelling, de-duplicated */
    const findAll = (re) => {
      const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      const seen = new Map();
      let m;
      while ((m = r.exec(fm.folded))) { const s = slice(m); if (!seen.has(m[0])) seen.set(m[0], s); if (!m[0]) r.lastIndex++; }
      return { count: (fm.folded.match(r) || []).length, list: Array.from(seen.values()) };
    };
    return {
      text, folded, words, lines, find, findAll,
      wordCount: words.length,
      first: lines[0] || "",
      opening: fold(text.slice(0, 220)),
      ending: fold(withoutSignoff(lines).slice(-260)),
      metrics: count(METRIC_RE, text),
      verbs: count(VERB_RE, text.toLowerCase()),
      weak: findAll(WEAK_RE),
      viRatio: count(VI_CHARS, text) / letters,
      bullets: lines.filter((l) => /^([-•*✓✔▪►–]|\d+[.)])\s*/.test(l)).length,
      questions: count(/\?/g, text),
      typos: typos(text),
    };
  }

  const plural = (n, word) => `${n} ${word}`;
  /* far too long (more than 3× the limit, e.g. a pasted document twice over) caps the verdict in grade() */
  const rangeCheck = (min, max, unit) => (c) => {
    const n = c.wordCount;
    return { pass: n >= min && n <= max, overLimit: n > max * 3, detail: n < min ? `${n} ${unit}, ngắn quá (nên ${min}–${max}).` : n > max ? `${n} ${unit}, dài quá (nên ${min}–${max}).` : `${n} ${unit}, vừa đủ.` };
  };
  const englishCheck = (c) => ({
    pass: c.viRatio < 0.02,
    detail: c.viRatio < 0.02 ? "Viết bằng tiếng Anh." : `Khoảng ${Math.round(c.viRatio * 100)}% chữ cái có dấu tiếng Việt.`,
  });
  const typoCheck = (c) => ({
    pass: c.typos.length <= 1,
    detail: !c.typos.length ? "Không thấy lỗi gõ dễ thấy." : c.typos.length === 1 ? `Chỉ một lỗi nhỏ. ${c.typos[0]}.` : c.typos.slice(0, 3).join(" · ") + ".",
  });
  const weakCheck = (max) => (c) => ({
    pass: c.weak.count <= max,
    detail: c.weak.count ? `${c.weak.count <= max ? "Chỉ có " : "Tìm thấy "}${c.weak.list.slice(0, 4).map((w) => "“" + w + "”").join(", ")}.` : "Không dùng cụm sáo rỗng.",
  });
  /** fail when a pattern is found; detail quotes it as written */
  const absent = (re, bad, good) => (c) => { const m = c.find(re); return { pass: !m, detail: m ? bad(m) : good }; };

  /* ---------------- checklists ---------------- */
  const MODES = {
    cv: {
      label: "Điểm CV", noun: "CV", unit: "từ",
      field: "Dán nội dung CV",
      hint: "Dán chữ từ file CV, bản tiếng Anh.",
      placeholder: "NGUYEN VAN A · Video Editor · email · LinkedIn…",
      checks: [
        { id: "length", label: "Độ dài một đến hai trang", weight: 1, test: rangeCheck(200, 900, "từ"),
          fix: "Một trang cho dưới 5 năm kinh nghiệm. Cắt mô tả công việc chung chung, giữ kết quả." },
        { id: "metrics", label: "Có số liệu đo kết quả", weight: 2,
          test: (c) => ({ pass: c.metrics >= 3, detail: c.metrics ? `Tìm thấy ${plural(c.metrics, "con số")}, nên có từ 3.` : "Chưa có con số nào." }),
          fix: "Mỗi vị trí ít nhất một con số: bao nhiêu khách, tăng bao nhiêu %, tiết kiệm bao nhiêu giờ.",
          example: { before: "Responsible for managing social media accounts.", after: "Grew Instagram from 2,000 to 18,000 followers in 6 months by posting 5 Reels a week.", why: "Một con số cụ thể nói nhiều hơn ba tính từ." } },
        { id: "verbs", label: "Mở đầu bằng động từ hành động", weight: 2,
          test: (c) => ({ pass: c.verbs >= 5, detail: `${plural(c.verbs, "động từ mạnh")} (led, built, increased…), nên có từ 5.` }),
          fix: "Bắt đầu mỗi gạch đầu dòng bằng một động từ quá khứ: Built, Led, Cut, Grew, Launched.",
          example: { before: "Worked on the company website.", after: "Rebuilt the company website in Webflow, cutting load time from 6s to 1.8s.", why: "Động từ cụ thể cho thấy bạn đã làm gì, không chỉ có mặt." } },
        { id: "contact", label: "Có email và số điện thoại", weight: 2,
          test: (c) => { const e = EMAIL_RE.test(c.text); const p = Boolean(phoneIn(c.text)); return { pass: e && p, detail: e && p ? "Có cả email và số điện thoại." : e ? "Có email, thiếu số điện thoại." : p ? "Có số điện thoại, thiếu email." : "Không thấy email hay số điện thoại." }; },
          fix: "Dòng đầu CV: email chuyên nghiệp (tên của bạn), số điện thoại có mã +84, thành phố và múi giờ.",
          example: { before: "Contact: lanxinhdep99@yahoo.com", after: "lan.nguyen@example.com · +84 00 000 0000 · Ho Chi Minh City (GMT+7)", why: "Email theo tên thật trông chuyên nghiệp hơn biệt danh." } },
        { id: "links", label: "Có LinkedIn hoặc portfolio", weight: 1,
          test: (c) => ({ pass: LINK_RE.test(c.text), detail: LINK_RE.test(c.text) ? "Có đường dẫn để xem thêm." : "Chưa có link LinkedIn, GitHub hay portfolio." }),
          fix: "Thêm link LinkedIn và một portfolio (Behance, GitHub, Notion, Google Drive công khai).",
          example: { before: "Portfolio available on request.", after: "Portfolio: behance.net/lannguyen · 12 case studies", why: "Khách quốc tế muốn xem ngay, không muốn phải xin." } },
        { id: "sections", label: "Đủ mục Kinh nghiệm, Kỹ năng, Học vấn", weight: 1,
          test: (c) => {
            const has = { "Kinh nghiệm": /\b(experience|work history|employment|kinh nghiem)\b/, "Kỹ năng": /\b(skills|tools|ky nang|cong cu)\b/, "Học vấn": /\b(education|hoc van|degree|university|dai hoc|certificat)\w*/ };
            const missing = Object.keys(has).filter((k) => !has[k].test(c.folded));
            return { pass: !missing.length, detail: missing.length ? `Thiếu mục: ${missing.join(", ")}.` : "Có đủ ba mục chính." };
          },
          fix: "Đặt tiêu đề rõ: SUMMARY · EXPERIENCE · SKILLS · EDUCATION. Phần mềm ATS đọc theo các tiêu đề này." },
        { id: "weak", label: "Không dùng cụm sáo rỗng", weight: 1, test: weakCheck(1),
          fix: "Thay “responsible for”, “hard-working”, “chịu khó” bằng việc bạn đã làm và kết quả.",
          example: { before: "Hard-working team player with a passion for design.", after: "Product designer, 3 years in e-commerce, 40+ launches for Shopify brands.", why: "Ai cũng tự nhận chăm chỉ; ít ai ghi được con số." } },
        { id: "personal", label: "Không ghi thông tin cá nhân thừa", weight: 1,
          test: absent(PERSONAL_RE, (m) => `Có “${m}”: khách quốc tế không cần, nhiều nơi còn khuyên bỏ để tránh thiên vị.`, "Không có ngày sinh, giới tính hay tình trạng hôn nhân."),
          fix: "Bỏ ngày sinh, giới tính, tình trạng hôn nhân, số CCCD, chiều cao, cân nặng.",
          example: { before: "Date of birth: 12/03/1999 · Marital status: Single", after: "Ho Chi Minh City, Vietnam (GMT+7) · Open to remote", why: "Múi giờ có ích cho khách hơn ngày sinh." } },
        { id: "firstperson", label: "Không xưng “I, my” trong CV", weight: 1,
          test: (c) => { const n = count(FIRST_PERSON_RE, c.text); return { pass: n <= 3, detail: n ? `${plural(n, "lần")} dùng I, my, me.` : "Viết theo kiểu CV, không xưng ngôi thứ nhất." }; },
          fix: "CV bỏ chủ ngữ: “Managed a team of 5” thay cho “I managed a team of 5”.",
          example: { before: "I managed a team of 5 editors and I trained them.", after: "Managed and trained a team of 5 editors; cut turnaround from 5 to 3 days.", why: "Ngắn hơn, đọc nhanh hơn, còn chỗ cho kết quả." } },
        { id: "english", label: "Tiếng Anh cho khách quốc tế", weight: 1, test: englishCheck,
          fix: "Dùng bản tiếng Anh khi ứng tuyển việc nước ngoài; bản tiếng Việt chỉ cho công ty Việt Nam." },
        { id: "typos", label: "Không có lỗi gõ dễ thấy", weight: 1, test: typoCheck,
          fix: "Dán vào Grammarly hoặc LanguageTool, đọc to một lượt trước khi gửi." },
      ],
      sample: "NGUYEN THI LAN\nVideo Editor\nEmail: lan.nguyen@example.com | Phone: +84 00 000 0000\nDate of birth: 12/03/1999\n\nSUMMARY\nHard-working and passionate video editor with 3 years of experience. I am a team player and fast learner.\n\nEXPERIENCE\nVideo Editor, Sunrise Media (2022 – now)\n- Responsible for editing videos for YouTube channels.\n- Edited 120+ long-form videos and 300 Shorts for 6 clients.\n- Increased average view duration by 35% for a cooking channel.\n- Worked on thumbnails and subtitles.\n\nFreelance Editor (2021 – 2022)\n- Responsible for editing wedding videos.\n- Managed  projects for 15 couples.\n\nSKILLS\nPremiere Pro, After Effects, DaVinci Resolve, CapCut\n\nEDUCATION\nBachelor of Multimedia, Ton Duc Thang University (2021)",
    },

    upwork: {
      label: "Điểm Upwork profile", noun: "profile", unit: "từ",
      field: "Dán tiêu đề và phần Overview",
      hint: "Dòng đầu là Title, phần sau là Overview.",
      placeholder: "Podcast Video Editor | YouTube & Shorts\nYour podcast deserves clips people actually finish…",
      checks: [
        { id: "headline", label: "Tiêu đề cụ thể, dưới 70 ký tự", weight: 2,
          test: (c) => {
            const t = c.first; const n = t.split(/\s+/).filter(Boolean).length;
            const generic = /^(freelancer|virtual assistant|video editor|designer|developer|writer|translator)\.?$/i.test(t.trim());
            const ok = t.length >= 20 && t.length <= 70 && n >= 3 && !generic && !/^(hi|hello|my name)/i.test(t);
            return { pass: ok, detail: `Tiêu đề: “${t.slice(0, 70)}${t.length > 70 ? "…" : ""}” (${t.length} ký tự).` };
          },
          fix: "Công thức: Vai trò + ngách + lợi ích. Dùng dấu | để tách, giữ dưới 70 ký tự.",
          example: { before: "Video Editor", after: "Podcast Video Editor | YouTube & Shorts | 4-day turnaround", why: "Khách tìm theo ngách; tiêu đề chung chung chìm giữa hàng nghìn người." } },
        { id: "opening", label: "Hai dòng đầu nói về khách", weight: 2,
          test: (c) => {
            const self = /^(hi|hello|hey)?[\s,!.]*(my name is|i am|i'm|i have)\b/.test(fold(c.lines.slice(1).join(" ")).slice(0, 80));
            const you = /\b(you|your)\b/.test(fold(c.lines.slice(1).join(" ")).slice(0, 220));
            return { pass: you && !self, detail: self ? "Mở đầu bằng giới thiệu bản thân." : you ? "Mở đầu hướng tới khách." : "Hai dòng đầu chưa nhắc tới khách (you, your)." };
          },
          fix: "Upwork chỉ hiện khoảng 200 ký tự đầu. Nói khách nhận được gì trước, tên bạn để sau.",
          example: { before: "Hi, my name is Lan and I am a video editor from Vietnam.", after: "Your podcast deserves clips people actually finish. I turn each episode into 8–10 Shorts a week.", why: "Khách đọc để tìm giải pháp cho họ, không phải để làm quen." } },
        { id: "length", label: "Overview 150–450 từ", weight: 1, test: rangeCheck(150, 450, "từ"),
          fix: "Đủ để nêu dịch vụ, bằng chứng và cách làm việc; dài hơn thì khách không đọc hết." },
        { id: "services", label: "Liệt kê dịch vụ bằng gạch đầu dòng", weight: 1,
          test: (c) => ({ pass: c.bullets >= 3, detail: c.bullets ? `${plural(c.bullets, "gạch đầu dòng")}, nên có từ 3.` : "Chưa có danh sách dịch vụ." }),
          fix: "3–6 gạch đầu dòng, mỗi dòng một dịch vụ cụ thể khách có thể thuê ngay." },
        { id: "proof", label: "Có bằng chứng: số liệu, khách cũ, portfolio", weight: 2,
          test: (c) => {
            const words = /\b(clients?|projects?|reviews?|5-star|five-star|top rated|rising talent|portfolio|case stud(y|ies)|years?)\b/.test(c.folded);
            return { pass: c.metrics >= 2 && words, detail: `${plural(c.metrics, "con số")}${words ? ", có nhắc khách hoặc dự án." : ", chưa nhắc khách cũ hay dự án."}` };
          },
          fix: "Ghi số dự án, loại khách, kết quả tiêu biểu và trỏ tới mục Portfolio." },
        { id: "cta", label: "Kết bằng lời mời hành động", weight: 1,
          test: (c) => { const ok = /\b(invite|message me|send me|contact me|let'?s|let us|book|click|reach out|get in touch|hire me|drop me)\b/.test(c.ending); return { pass: ok, detail: ok ? "Có lời mời ở cuối." : "Đoạn cuối chưa mời khách làm gì tiếp." }; },
          fix: "Câu cuối nói rõ bước tiếp theo: gửi tin nhắn, mời vào job, nhận mẫu thử.",
          example: { before: "Thank you for reading.", after: "Click Invite to Job and send me a raw clip; I'll return a free 30-second sample.", why: "Một bước nhỏ, rõ ràng dễ được làm hơn “liên hệ khi cần”." } },
        { id: "offplatform", label: "Không ghi liên lạc ngoài Upwork", weight: 2,
          test: (c) => {
            const m = (c.text.match(EMAIL_RE) || [])[0] || c.find(/\b(whatsapp|telegram|skype|zalo|viber|wechat)\b/) || phoneIn(c.text);
            return { pass: !m, detail: m ? `Có “${m.trim()}”: Upwork cấm và có thể khóa tài khoản.` : "Không có email, số điện thoại hay app chat." };
          },
          fix: "Xóa email, số điện thoại, Skype, WhatsApp. Mọi trao đổi trước hợp đồng phải ở trên Upwork.",
          example: { before: "Contact me on WhatsApp +84 00 000 0000 for fast reply!", after: "Message me here on Upwork; I reply within 12 hours (GMT+7).", why: "Giữ tài khoản an toàn mà vẫn hứa phản hồi nhanh." } },
        { id: "cheap", label: "Không hạ giá, không hứa quá đà", weight: 1,
          test: absent(/\b(cheap|lowest price|low price|any price|work for free|unlimited revisions|100% satisfaction|satisfaction guaranteed)\b/, (m) => `Có “${m}”.`, "Không cạnh tranh bằng giá rẻ."),
          fix: "Cạnh tranh bằng tốc độ, chất lượng, quy trình rõ ràng; “cheap” thu hút khách khó tính nhất." },
        { id: "weak", label: "Không dùng cụm sáo rỗng", weight: 1, test: weakCheck(1),
          fix: "Thay “hard-working”, “passionate” bằng một kết quả cụ thể." },
        { id: "english", label: "Viết bằng tiếng Anh", weight: 1, test: englishCheck,
          fix: "Khách Upwork đọc tiếng Anh; viết câu ngắn, rõ, không cần từ đao to búa lớn." },
        { id: "typos", label: "Không có lỗi gõ dễ thấy", weight: 1, test: typoCheck,
          fix: "Kiểm tra bằng Grammarly hoặc LanguageTool trước khi lưu profile." },
      ],
      sample: "Video Editor\nHi, my name is Lan. I am a video editor from Vietnam with 3 years of experience. I am hard-working and I always deliver on time. My price is cheap and I offer unlimited revisions.\n\nI can edit YouTube videos, Shorts, Reels and TikTok. I use Premiere Pro and After Effects.\n\nContact me on WhatsApp +84 00 000 0000 for fast reply!!",
    },

    proposal: {
      label: "Điểm proposal", noun: "proposal", unit: "từ",
      field: "Dán proposal hoặc cover letter",
      hint: "Dán đúng bản bạn định gửi.",
      placeholder: "Hi Sarah, you need 4 podcast episodes edited every week…",
      checks: [
        { id: "dear", label: "Không mở bằng “Dear Sir/Madam”", weight: 2,
          test: absent(/^\s*(dear (sir\/madam|sir or madam|sir|madam|hiring manager|client)|to whom it may concern)\b/, (m) => `Mở bằng “${m.trim()}”: đọc như thư gửi hàng loạt.`, "Lời chào không rập khuôn."),
          fix: "Gọi tên khách nếu tin có tên, không thì “Hi there,” rồi vào việc ngay.",
          example: { before: "Dear Sir/Madam, I am very interested in your job.", after: "Hi Sarah, you need 4 podcast episodes edited every week, delivered by Friday.", why: "Câu đầu nhắc lại đúng việc của khách cho thấy bạn đã đọc tin." } },
        { id: "tailored", label: "Câu đầu nói về việc của khách", weight: 2,
          test: (c) => {
            const head = c.opening.replace(/^(hi|hello|hey|dear)[^,\n]*[,\n]\s*/, "").slice(0, 170);
            const self = /^(my name is|i am|i'm|i have \d|i have been)/.test(head);
            const you = /\b(you|your|you'?re)\b/.test(head);
            return { pass: you && !self, detail: self ? "Câu đầu nói về bạn." : you ? "Câu đầu hướng tới khách." : "Câu đầu chưa nhắc tới khách hay dự án." };
          },
          fix: "Câu đầu tóm lại vấn đề của khách bằng lời của bạn; kinh nghiệm của bạn để câu thứ hai." },
        { id: "length", label: "Ngắn: 70–250 từ", weight: 1, test: rangeCheck(70, 250, "từ"),
          fix: "Khách đọc trên điện thoại giữa hàng chục proposal. Ba đoạn ngắn là đủ." },
        { id: "question", label: "Có câu hỏi cho khách", weight: 2,
          test: (c) => ({ pass: c.questions >= 1, detail: c.questions ? `${plural(c.questions, "câu hỏi")}.` : "Chưa có câu hỏi nào." }),
          fix: "Một câu hỏi cụ thể về dự án khiến khách trả lời, và cuộc trò chuyện bắt đầu.",
          example: { before: "I hope to hear from you soon.", after: "Do you already have an intro template, or should I design one for the series?", why: "Câu hỏi đúng chứng minh bạn hiểu việc, hơn mọi lời hứa." } },
        { id: "proof", label: "Có bằng chứng liên quan", weight: 1,
          test: (c) => { const ok = LINK_RE.test(c.text) || /\b(similar|recently|last (month|week|year)|for a client|case study|portfolio|sample)\b/.test(c.folded) || c.metrics >= 1; return { pass: ok, detail: ok ? "Có link, ví dụ hoặc số liệu." : "Chưa có link, dự án tương tự hay con số." }; },
          fix: "Một link tới việc giống nhất, kèm một câu kết quả. Đừng dán cả portfolio.",
          example: { before: "I have a lot of experience in video editing.", after: "Here's a 60-second clip from a similar show I edited last month: [link]. Retention went up 22%.", why: "Một ví dụ đúng loại việc thuyết phục hơn “nhiều kinh nghiệm”." } },
        { id: "rate", label: "Nêu giá hoặc thời gian rõ ràng", weight: 1,
          test: (c) => { const ok = /(\$\s?\d|\d\s?(usd|\$)|\/\s?(hr|hour)|per hour|hourly|fixed price|budget|\d+\s?(hours?|days?|weeks?)|deadline|timeline|deliver (by|within|in)|turnaround)/.test(c.folded); return { pass: ok, detail: ok ? "Có giá hoặc mốc thời gian." : "Chưa nhắc giá, số giờ hay hạn giao." }; },
          fix: "Ước lượng thời gian và giá cho việc đầu tiên giúp khách quyết nhanh.",
          example: { before: "I can do this job perfectly.", after: "I can deliver the first episode in 48 hours at $25/hour, about 3 hours per episode.", why: "Con số giúp khách so sánh và quyết định." } },
        { id: "plan", label: "Có kế hoạch hoặc các bước làm", weight: 1,
          test: (c) => { const ok = c.bullets >= 2 || /\b(first,?|then|step|next,?|plan|approach|my process|here'?s how)\b/.test(c.folded); return { pass: ok, detail: ok ? "Có các bước làm." : "Chưa nói bạn sẽ làm thế nào." }; },
          fix: "2–3 bước ngắn: xem gì trước, giao gì khi nào, sửa thế nào." },
        { id: "cta", label: "Kết bằng bước tiếp theo", weight: 1,
          test: (c) => { const ok = /\b(call|chat|available|let me know|happy to|can start|schedule|reply|send (me|over)|share|would you like|shall i|want me to|start|next step|go ahead)\b|\?/.test(c.ending); return { pass: ok, detail: ok ? "Có lời mời bước tiếp theo." : "Đoạn cuối chưa đề nghị bước tiếp theo." }; },
          fix: "Kết bằng một đề nghị dễ đồng ý: gọi 10 phút, gửi một file mẫu, bắt đầu từ thứ Hai." },
        { id: "beg", label: "Không xin xỏ, không tự hạ mình", weight: 1,
          test: absent(/\b(give me (a|one) chance|i am new|i'?m new|new (to|on) upwork|no reviews yet|low (budget|price)|cheap|for free|please hire|i need this job|kindly)\b/, (m) => `Có “${m}”.`, "Giọng tự tin, ngang hàng."),
          fix: "Không nhắc mình là người mới; thay bằng một việc tương tự bạn đã làm, kể cả dự án tự làm.",
          example: { before: "I am new on Upwork, please give me a chance.", after: "I recently edited 24 episodes for a similar show; here's one: [link].", why: "Khách thuê người giải được việc, không thuê vì thương." } },
        { id: "english", label: "Viết bằng tiếng Anh", weight: 1, test: englishCheck,
          fix: "Viết câu ngắn, chủ động; đọc lại bằng LanguageTool trước khi gửi." },
        { id: "typos", label: "Không có lỗi gõ dễ thấy", weight: 1, test: typoCheck,
          fix: "Một lỗi chính tả trong câu đầu đủ để khách bỏ qua." },
      ],
      sample: "Dear Sir/Madam,\n\nI am very interested in your job. I have read your job post and I am confident I can do this job perfectly. I have 3 years experience in video editing and I am very hard working.\n\nI am new on Upwork so please give me a chance, I will work with low price.\n\nThank you,\nLan",
    },
  };

  /* ---------------- the user's own sentence ----------------
     A failed check with a stock rewrite quotes the sentence of YOURS it is about ("Responsible for editing videos…"),
     when the rule can point at one; otherwise the stock "before" shows the shape. */
  const BULLET_RE = /^([-•*✓✔▪►–]|\d+[.)])\s*/;
  const clip = (s) => (s.length > 150 ? s.slice(0, 149).replace(/\s+\S*$/, "") + "…" : s);
  function sentencesOf(lines) {
    return lines.flatMap((l) => l.replace(BULLET_RE, "").split(/(?<=[.!?])\s+(?=[\p{Lu}"“(])/u))
      .map((x) => x.trim()).filter((x) => /\p{L}/u.test(x));
  }
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function quoteFor(id, mode, c) {
    const all = sentencesOf(c.lines);
    const bullets = c.lines.filter((l) => BULLET_RE.test(l)).map((l) => l.replace(BULLET_RE, "").trim());
    const first = (list, re) => list.find((x) => re.test(x)) || "";
    const WEAK_OPEN = /^(responsible for|worked on|helped with|duties|in charge of|tasks? included|i (was|am) responsible)/i;
    const tail = () => withoutSignoff(c.lines).split("\n").filter(Boolean);
    switch (id) {
      case "metrics": return first(bullets, /^(?!.*\d)\p{L}.{10,}/u) || first(all, WEAK_OPEN);
      case "verbs": return first(bullets, WEAK_OPEN) || first(all, WEAK_OPEN);
      case "weak": return c.weak.list.length ? first(all, new RegExp(reEsc(c.weak.list[0]), "i")) : "";
      case "personal": { const m = c.find(PERSONAL_RE); return m ? first(c.lines, new RegExp(reEsc(m), "i")) : ""; }
      case "contact": return first(c.lines, /@|\b(e-?mail|contact|phone|tel)\b/i);
      case "links": return first(all, /\b(portfolio|on request|linkedin)\b/i);
      case "firstperson": return first(all, new RegExp(FIRST_PERSON_RE.source, "iu"));
      case "headline": return mode === "upwork" ? c.first : "";
      case "opening": return mode === "upwork" ? sentencesOf(c.lines.slice(1, 2))[0] || "" : "";
      case "cta": return sentencesOf(tail().slice(-1)).slice(-1)[0] || "";
      case "offplatform": return first(all, /\b(whatsapp|telegram|skype|zalo|viber|wechat)\b|@|\+?\d[\d .()-]{7,}\d/i);
      case "dear": { const s0 = sentencesOf(c.lines.slice(0, 2)); return s0.slice(0, /,$/.test(s0[0] || "") ? 2 : 1).join(" "); }
      case "question": return sentencesOf(tail()).slice(-1)[0] || "";
      case "proof": return first(all, /\b(experience|years?)\b/i);
      case "beg": return first(all, /\b(give me (a|one) chance|i am new|i'?m new|new (to|on) upwork|low (budget|price)|cheap|please hire|kindly)\b/i);
      default: return "";
    }
  }
  /** the rewrite to show for a failed check: {before, after, why, mine} (mine: the before is the user's sentence) */
  function rewriteFor(r, mode, c, used) {
    const ex = r.check.example;
    if (!ex) return null;
    const q = c ? clip(quoteFor(r.check.id, mode, c)) : "";
    if (!q || q === ex.after || (used && used.has(q))) return Object.assign({ mine: false }, ex);   /* never the same sentence twice */
    if (used) used.add(q);
    return { before: q, after: ex.after, why: ex.why, mine: true };
  }

  function grade(mode, text) {
    const conf = MODES[mode];
    const c = context(text);
    const results = conf.checks.map((check) => Object.assign({ check }, check.test(c)));
    const total = conf.checks.reduce((s, ch) => s + ch.weight, 0);
    const got = results.reduce((s, r) => s + (r.pass ? r.check.weight : 0), 0);
    let score = Math.round((got / total) * 20) / 2;
    /* a text more than 3× over the length limit is never "Sẵn sàng gửi", whatever else passes */
    if (results.some((r) => r.overLimit)) score = Math.min(score, 7.5);
    return { score, results, ctx: c };
  }

  /* ---------------- rendering ----------------
     The ink card (#ket-qua) keeps one shape before and after grading: the mode's criteria as rows (a grey ring
     before the first run, then a green tick or a red cross, in the checklist's own order so nothing jumps while
     you edit), the score /10, the weakest sentence rewritten. The white card under it (data-result) explains
     each failed criterion. Counts are set, never rolled up (DESIGN_SYSTEM_REVOLUT.md §13.3). */
  const e = (s) => VR.escape(s);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const fmtScore = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  const mark = (state) => `<span class="tl-check__mark" aria-hidden="true">${icon(state === "fail" ? "x" : "check")}</span>`;

  /** [title, the line under it, the phone bar's short word] */
  function verdict(score, noun) {
    if (score >= 8.5) return [`Sẵn sàng gửi`, `${noun[0].toUpperCase() + noun.slice(1)} đạt gần hết tiêu chí. Đọc lại một lượt với đúng vị trí bạn ứng tuyển rồi gửi.`, "Sẵn sàng gửi"];
    if (score >= 7) return ["Gần xong, sửa nốt vài chỗ", "Phần lớn đã ổn. Sửa các mục bên dưới, nhất là mục có trọng số cao.", "Gần xong"];
    if (score >= 5) return ["Cần sửa trước khi gửi", "Có nền tảng, nhưng còn những lỗi khiến người đọc lướt qua. Sửa từ trên xuống.", "Cần sửa"];
    return ["Nên viết lại phần chính", "Trượt nhiều tiêu chí quan trọng. Mỗi mục bên dưới kèm cách sửa, có mục kèm câu viết lại để bạn có khung bắt đầu.", "Nên viết lại"];
  }

  function rowsHtml(conf, res) {
    return conf.checks.map((check, i) => {
      const r = res ? res.results[i] : null;
      const state = !r ? "wait" : r.pass ? "pass" : "fail";
      const sr = !r ? "" : `<span class="sr-only">${r.pass ? "Đạt: " : "Chưa đạt: "}</span>`;
      return `<li class="tl-check is-${state}">${mark(state)}<span>${sr}${e(check.label)}</span></li>`;
    }).join("");
  }

  function fixHtml(r, mode, c, used) {
    const heavy = r.check.weight > 1 ? ` <span class="check-item__w">Quan trọng</span>` : "";
    const ex = rewriteFor(r, mode, c, used);
    return `<li class="check-item is-fail">${mark("fail")}
  <span class="check-item__title">${e(r.check.label)}${heavy}</span>
  <span class="check-item__detail">${e(r.detail)}</span>
  <span class="check-item__fix"><strong>Sửa:</strong> ${e(r.check.fix)}</span>
  ${ex ? `<div class="rewrite" lang="en">
    <p class="rewrite__side rewrite__before"><span class="rewrite__tag" lang="vi">${ex.mine ? "Bạn viết" : "Trước"}</span><span>${e(ex.before)}</span></p>
    <p class="rewrite__side rewrite__after"><span class="rewrite__tag" lang="vi">${ex.mine ? "Nên viết" : "Sau"}</span><span>${e(ex.after)}</span></p>
    <p class="rewrite__why" lang="vi">${e(ex.why)}</p>
  </div>` : ""}
</li>`;
  }

  /** the ink card in its waiting state for a mode: the checklist itself, no score */
  function renderEmpty(root, mode) {
    const conf = MODES[mode];
    const card = root.querySelector("[data-score-card]");
    card.querySelector("[data-mode-label]").textContent = conf.label;
    card.querySelector("[data-score-count]").textContent = `${conf.checks.length} tiêu chí`;
    card.querySelector("[data-score]").textContent = "Chưa chấm";
    card.querySelector("[data-big]").classList.add("is-empty");
    const ring = card.querySelector("[data-ring]");
    if (ring) ring.style.setProperty("--v", 0);
    card.querySelector("[data-verdict]").textContent = "";
    card.querySelector("[data-checks]").innerHTML = rowsHtml(conf, null);
    card.querySelector("[data-rewrite]").hidden = true;     // the rewrite joins the readout once there is a grade
    card.querySelector("[data-rewrite-empty]").hidden = false;
    card.querySelector("[data-rewrite-before]").hidden = true;
    card.querySelector("[data-rewrite-after]").hidden = true;
    root.querySelector("[data-result]").hidden = true;
  }

  function render(root, mode, res) {
    const conf = MODES[mode];
    const card = root.querySelector("[data-score-card]");
    const out = root.querySelector("[data-result]");
    const passed = res.results.filter((r) => r.pass);
    const failed = res.results.filter((r) => !r.pass).sort((a, b) => b.check.weight - a.check.weight);
    const [title, text, short] = verdict(res.score, conf.noun);

    card.querySelector("[data-mode-label]").textContent = conf.label;
    card.querySelector("[data-score-count]").textContent = `${passed.length}/${res.results.length} đạt`;
    card.querySelector("[data-big]").classList.remove("is-empty");
    VR.liveCount(card.querySelector("[data-score]"), fmtScore(res.score));
    /* the score ring: the score's share of 10, swept in the mode's hue (tools.css §E) */
    const ring = card.querySelector("[data-ring]");
    if (ring) ring.style.setProperty("--v", Math.round(res.score * 10));
    const v = card.querySelector("[data-verdict]");
    if (v.textContent !== title) v.textContent = title;
    card.querySelector("[data-checks]").innerHTML = rowsHtml(conf, res);

    /* the rewrite: the heaviest failed criterion that has one (your own sentence before it when the rule found one),
       else the mode's first example (to show the shape) */
    const pick = failed.find((r) => r.check.example);
    const ex = pick ? rewriteFor(pick, mode, res.ctx) : (conf.checks.find((ch) => ch.example) || {}).example;
    card.querySelector("[data-rewrite]").hidden = false;
    card.querySelector("[data-rewrite-empty]").hidden = Boolean(ex);
    const before = card.querySelector("[data-rewrite-before]");
    const after = card.querySelector("[data-rewrite-after]");
    before.hidden = after.hidden = !ex;
    if (ex) { before.textContent = ex.before; after.textContent = ex.after; }

    out.querySelector("[data-fix-title]").textContent = failed.length ? `Cách sửa ${failed.length} mục chưa đạt` : "Không còn mục nào cần sửa";
    out.querySelector("[data-summary]").textContent = text;
    out.querySelector("[data-stats]").innerHTML = `<span><b>${passed.length}/${res.results.length}</b> tiêu chí đạt</span><span><b>${VR.fmt.int(res.ctx.wordCount)}</b> từ</span><span><b>${res.ctx.metrics}</b> con số</span>`;
    const used = new Set();
    out.querySelector("[data-fails]").innerHTML = failed.map((r) => fixHtml(r, mode, res.ctx, used)).join("");
    out.querySelector("[data-fails]").hidden = !failed.length;
    out.hidden = false;

    const bar = document.querySelector("[data-cv-bar]");
    if (bar) {
      bar.querySelector("[data-bar-label]").textContent = conf.label;
      bar.querySelector("[data-bar-value]").textContent = `${fmtScore(res.score)}/10 · ${short}`;
      VR.actionbar.ready(bar, true);
    }
  }

  VR.onReady(() => {
    const card = document.querySelector("[data-cv]");
    if (!card) return;
    const root = card.closest(".tool-main") || document;
    const input = card.querySelector("[data-input]");
    const counter = card.querySelector("[data-counter]");
    const scoreCard = root.querySelector("[data-score-card]");
    const tabs = Array.from(card.querySelectorAll('[role="tab"]'));
    const panel = card.querySelector("[data-panel]");
    const runBtn = card.querySelector("[data-run]");
    const bar = document.querySelector("[data-cv-bar]");
    const drafts = { cv: "", upwork: "", proposal: "" };   // per-mode text, memory only
    let mode = "cv";
    let live = false;
    let timer;

    const words = () => input.value.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const updateCount = () => { VR.liveCount(counter, VR.fmt.int(words()) + " từ"); };
    const reset = () => {
      live = false;
      renderEmpty(root, mode);
      if (bar) VR.actionbar.ready(bar, false);
    };

    const run = (scroll) => {
      const text = input.value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
      if (text.split(/\s+/).length < 8) {
        reset();
        if (scroll) { VR.toast("Dán thêm nội dung, ít nhất vài câu để chấm", { tone: "info" }); input.focus(); }
        return;
      }
      render(root, mode, grade(mode, text));
      live = true;
      if (scroll) {
        /* the score card sits beside the field on wide screens; on phones it is below: bring it into view */
        const r = scoreCard.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.6 || r.bottom < 80) scoreCard.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "start" });
      }
    };
    /* the pill shows its pending state for one beat so a click always reads as "graded" */
    const runFromButton = () => {
      VR.busy(runBtn, true);
      setTimeout(() => { VR.busy(runBtn, false); run(true); }, VR.reducedMotion ? 0 : 160);
    };

    const setMode = (next, focus) => {
      if (!MODES[next]) return;
      drafts[mode] = input.value;
      mode = next;
      tabs.forEach((t) => {
        const on = t.dataset.mode === next;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (on) { panel.setAttribute("aria-labelledby", t.id); if (focus) t.focus(); }
      });
      const conf = MODES[next];
      card.querySelector("[data-label]").textContent = conf.field;
      card.querySelector("[data-hint]").textContent = conf.hint;
      input.placeholder = conf.placeholder;
      input.value = drafts[next];
      updateCount();
      if (input.value.trim()) run(false); else reset();
      try { history.replaceState(null, "", next === "cv" ? location.pathname + location.search : "#" + next); } catch (_) { /* file:// */ }
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => setMode(tab.dataset.mode));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        const j = event.key === "ArrowRight" ? (i === last ? 0 : i + 1) : event.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
          : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
        if (j < 0) return;
        event.preventDefault();
        setMode(tabs[j].dataset.mode, true);
      });
    });
    input.addEventListener("input", () => {
      updateCount();
      if (!live) return;
      clearTimeout(timer);
      timer = setTimeout(() => run(false), 350);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(true); }
    });
    runBtn.addEventListener("click", runFromButton);
    card.querySelector("[data-sample]").addEventListener("click", () => {
      input.value = MODES[mode].sample;
      updateCount();
      runFromButton();
    });
    card.querySelector("[data-clear]").addEventListener("click", () => {
      if (!input.value) { input.focus(); return; }
      input.value = "";
      updateCount();
      reset();
      input.focus();
      VR.toast("Đã xóa nội dung", { tone: "info" });
    });
    /* the band's white pill leads to the field: common.js [data-focus-target] */

    const fromHash = (location.hash || "").replace("#", "");
    if (MODES[fromHash]) setMode(fromHash); else { renderEmpty(root, mode); updateCount(); }
    /* a link to #cv, #upwork or #proposal (the mode tiles under the tool, other pages) switches the mode and brings
       the desk into view */
    window.addEventListener("hashchange", () => {
      const h = location.hash.replace("#", "");
      if (!MODES[h]) return;
      if (h !== mode) setMode(h);
      toDesk();
    });
    function toDesk() {
      const desk = card.closest(".ta-frame") || card;   // the tool's window
      const top = desk.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) desk.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "start" });
    }
    /* the same links on this page, even when the hash is already theirs (no hashchange) */
    document.querySelectorAll('a[href="#cv"], a[href="#upwork"], a[href="#proposal"]').forEach((a) => a.addEventListener("click", (event) => {
      const h = a.getAttribute("href").slice(1);
      event.preventDefault();
      if (h !== mode) setMode(h);
      toDesk();
      if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
    }));
  });

  VR.gradeText = grade;   // console / test hook
})();

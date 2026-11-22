/* Việt Remote — "Bạn đã sẵn sàng làm remote?" (tools/san_sang_remote.html)
   Client-side only. 10 questions, one per step; answers 0..3 each.
   Result: level, one bar per dimension, a 30-day roadmap built from the weakest
   dimensions, recommended guides + tools, copy/share, retake.

   State: localStorage "vr.readiness" = {answers:[0..3|null x10], step, done, at, ticks:{}}
   Shareable: #kq=<10 digits>  (opens straight on that result, nothing leaves the browser) */
(function () {
  "use strict";

  const VR = window.VR;
  const KEY = "vr.readiness";

  /* ------------------------------------------------------------------ data */
  /* guides come from the page (json_script "vr-guides", i.e. portal/guides.py): {slug: {title, topic, minutes}} */
  let GUIDES = {};

  /* tools come from the page (json_script "vr-tools"); fallback keeps the page useful */
  let TOOLS = {};
  let COMMUNITY = "";

  const DIMS = [
    {
      key: "english", label: "Tiếng Anh", lower: "tiếng Anh",
      q: "Bạn dùng tiếng Anh trong công việc ở mức nào?",
      hint: "Phần lớn khách quốc tế làm việc qua tin nhắn và email, nên viết rõ ràng quan trọng hơn nói hay.",
      options: ["Đọc còn chậm, cần dịch gần hết", "Đọc tốt, viết được email ngắn, nói còn ngại", "Viết trôi chảy, gọi video được nếu chuẩn bị trước", "Họp và thương lượng bằng tiếng Anh thoải mái"],
      gap: { title: "Tiếng Anh viết đủ dùng", tasks: ["Mỗi ngày viết lại một tin tuyển dụng thật bằng lời của bạn, 15 phút", "Lưu 20 câu mẫu: hỏi rõ yêu cầu, báo tiến độ, xin gia hạn", "Ghi âm 2 phút giới thiệu bản thân, nghe lại và sửa"] },
      polish: { title: "Sẵn sàng cho cuộc gọi đầu tiên", tasks: ["Soạn câu trả lời cho 5 câu khách hay hỏi trong buổi gọi đầu", "Gọi thử 20 phút bằng tiếng Anh với một bạn trong cộng đồng"] },
      guide: "tieng-anh-khi-lam-remote", tool: "mau-proposal-email",
    },
    {
      key: "skill", label: "Kỹ năng bán được", lower: "kỹ năng bán được",
      q: "Bạn đã có một kỹ năng mà khách sẵn sàng trả tiền chưa?",
      hint: "Khách thuê người giải quyết một vấn đề cụ thể, không thuê “người chăm chỉ”.",
      options: ["Chưa, mình còn đang tìm hướng", "Đang học một kỹ năng, chưa làm dự án thật", "Đã làm vài dự án, kể cả cho người quen", "Có kỹ năng rõ ràng và đã được trả tiền nhiều lần"],
      /* still choosing a skill: pricing is not the next step, the starter guide is */
      gap: { title: "Chọn một kỹ năng để bán", tasks: ["Đọc 20 tin tuyển dụng trong một ngành, ghi lại kỹ năng lặp lại nhiều nhất", "Chọn một ngách hẹp: bạn giúp ai, làm việc gì", "Làm một dự án mẫu nhỏ đúng theo một tin tuyển dụng thật"], tool: "" },
      polish: { title: "Gọi tên dịch vụ thật rõ", tasks: ["Viết một câu: bạn giúp ai, làm gì, ra kết quả gì", "Đặt 3 gói dịch vụ có giá cụ thể"] },
      guide: "bat-dau-lam-remote", tool: "tinh-gia",
    },
    {
      key: "portfolio", label: "Portfolio", lower: "portfolio",
      q: "Khách hỏi “cho tôi xem việc bạn đã làm”. Bạn gửi gì?",
      hint: "Một link gọn có kết quả bằng số thuyết phục hơn mười file rời.",
      options: ["Chưa có gì để gửi", "Vài file rời rạc trong máy", "Một link mẫu, nhưng chưa có số liệu kết quả", "Portfolio gọn, có case study và con số kết quả"],
      gap: { title: "Dựng portfolio 3 mẫu", tasks: ["Chọn 3 sản phẩm tốt nhất, làm mới nếu chưa có", "Mỗi mẫu viết 3 dòng: vấn đề, cách làm, kết quả", "Gom tất cả vào một link duy nhất"] },
      polish: { title: "Thêm con số vào portfolio", tasks: ["Bổ sung số liệu cho từng mẫu: lượt xem, giờ tiết kiệm, doanh thu", "Chấm CV và profile, sửa các mục bị trừ điểm"] },
      guide: "cv-chuan-ats", tool: "cham-cv",
    },
    {
      key: "setup", label: "Thiết bị & internet", lower: "thiết bị & internet",
      q: "Chỗ làm việc của bạn hiện ra sao?",
      hint: "Mất mạng giữa buổi gọi với khách mới là cách nhanh nhất để mất dự án.",
      options: ["Dùng chung máy, mạng hay chập chờn", "Có laptop riêng, mạng ổn nhưng không dự phòng", "Laptop đủ mạnh cho công việc, mạng ổn định", "Máy tốt, mạng ổn, có 4G dự phòng và tai nghe mic rõ"],
      gap: { title: "Chuẩn bị chỗ làm việc", tasks: ["Đo tốc độ mạng giờ cao điểm, cần ổn định từ 20 Mbps", "Đăng ký gói 4G dự phòng phát được wifi", "Có tai nghe kèm mic trước cuộc gọi đầu tiên"] },
      polish: { title: "Phòng sự cố trước", tasks: ["Bật sao lưu tự động dữ liệu dự án lên cloud", "Gọi thử Zoom và Google Meet để kiểm tra tiếng, ánh sáng"] },
      guide: "bat-dau-lam-remote", tool: "",
    },
    {
      key: "time", label: "Quản lý thời gian", lower: "quản lý thời gian",
      q: "Không ai giám sát, bạn giữ nhịp làm việc thế nào?",
      hint: "Khách remote đánh giá bạn qua việc báo tiến độ đều đặn, không qua số giờ ngồi máy.",
      options: ["Dễ trôi, thường sát hạn mới làm", "Làm được nhưng còn thất thường", "Có lịch và danh sách việc, giữ được phần lớn", "Tự lên kế hoạch tuần, chủ động báo tiến độ, ít trễ hạn"],
      gap: { title: "Tập làm việc không ai giám sát", tasks: ["Đặt khung giờ làm cố định 4 ngày mỗi tuần, giữ trong 2 tuần", "Cuối ngày viết 3 dòng như gửi khách: đã làm, sẽ làm, đang vướng"] },
      polish: { title: "Chủ động báo tiến độ", tasks: ["Quản lý mọi việc trong một công cụ như Trello hoặc Notion", "Ghi thời gian dự kiến và thực tế cho 5 việc để ước lượng sát hơn"] },
      guide: "bat-dau-lam-remote", tool: "",
    },
    {
      key: "payment", label: "Nhận tiền quốc tế", lower: "nhận tiền quốc tế",
      q: "Bạn đã sẵn sàng nhận tiền từ khách nước ngoài chưa?",
      hint: "Chuẩn bị trước giúp bạn không lúng túng, cũng không bị ép dùng cách nhận tiền lạ.",
      options: ["Chưa biết bắt đầu từ đâu", "Biết vài cách, chưa mở tài khoản nào", "Đã có tài khoản như Payoneer, Wise, PayPal nhưng chưa rút về", "Đã nhận và rút tiền về ngân hàng Việt Nam"],
      gap: { title: "Mở cách nhận tiền quốc tế", tasks: ["So sánh phí và tỷ giá của các cách nhận tiền phổ biến", "Mở một tài khoản nhận tiền và xác minh danh tính", "Soạn sẵn mẫu invoice tiếng Anh với thông tin của bạn"] },
      polish: { title: "Rút thử một lần", tasks: ["Rút một khoản nhỏ về ngân hàng để biết phí thật và thời gian", "Lưu mẫu invoice kèm thông tin thanh toán"] },
      guide: "nhan-tien-ve-viet-nam", tool: "tao-invoice",
    },
    {
      key: "timezone", label: "Làm lệch múi giờ", lower: "làm lệch múi giờ",
      q: "Bạn làm được với khách lệch múi giờ đến đâu?",
      hint: "Khách Mỹ và châu Âu thường muốn trùng ít nhất 2 giờ làm việc mỗi ngày.",
      options: ["Chỉ làm được giờ hành chính Việt Nam", "Thỉnh thoảng họp buổi tối được", "Chia ca linh hoạt, trùng 2–3 giờ với khách", "Đã quen làm với khách Mỹ, Âu, chủ động xếp lịch chồng giờ"],
      gap: { title: "Thử lịch làm lệch múi", tasks: ["Chọn thị trường khách mục tiêu và tính khung giờ trùng", "Làm thử một tuần theo khung giờ đó để biết mình chịu được đến đâu"] },
      polish: { title: "Ghi rõ giờ làm trong hồ sơ", tasks: ["Ghi khung giờ trùng với khách vào profile và proposal", "Cài lịch hiển thị hai múi giờ để không nhầm giờ họp"] },
      guide: "tieng-anh-khi-lam-remote", tool: "",
    },
    {
      key: "freelance", label: "Kinh nghiệm freelance", lower: "kinh nghiệm freelance",
      q: "Bạn đã từng làm freelance hoặc remote chưa?",
      hint: "Một đánh giá thật từ khách trả tiền giúp proposal tiếp theo dễ được trả lời hơn hẳn.",
      options: ["Chưa bao giờ", "Làm cho người quen, không có hợp đồng", "Đã có vài khách, trên nền tảng hoặc có hợp đồng", "Làm lâu dài với khách quốc tế, có đánh giá tốt"],
      gap: { title: "Lấy khách đầu tiên", tasks: ["Hoàn thiện profile Upwork hoặc LinkedIn đủ 100%", "Gửi 5 proposal cho việc nhỏ, ít cạnh tranh", "Nhận một việc nhỏ có hợp đồng và tiêu chí nghiệm thu rõ"] },
      polish: { title: "Có đánh giá đầu tiên", tasks: ["Xin review từ khách cũ bằng mẫu email xin feedback", "Đưa một đánh giá thật vào profile và portfolio"] },
      guide: "upwork-cho-nguoi-moi", tool: "mau-proposal-email",
    },
    {
      key: "network", label: "Mạng lưới", lower: "mạng lưới",
      q: "Ai có thể giới thiệu việc hoặc góp ý hồ sơ cho bạn?",
      hint: "Nhiều việc remote tốt nhất được giới thiệu qua người quen trước khi lên bảng tin.",
      options: ["Chưa có ai trong ngành", "Vài người bạn, ít khi nói chuyện nghề", "Có tham gia nhóm, cộng đồng, thỉnh thoảng hỏi đáp", "Có mentor, đồng nghiệp hay giới thiệu việc cho nhau"],
      gap: { title: "Có người cùng đi", tasks: ["Vào cộng đồng Việt Remote, giới thiệu bản thân và ngách bạn chọn", "Hỏi một câu về ngách của bạn trong nhóm"] },
      polish: { title: "Cho đi trước", tasks: ["Mỗi tuần trả lời 2 câu hỏi của người mới trong cộng đồng", "Hẹn 20 phút trò chuyện với một người đi trước trong ngành"] },
      guide: "", tool: "", community: true,
    },
    {
      key: "savings", label: "Tài chính dự phòng", lower: "tài chính dự phòng",
      q: "Nếu 3 tháng đầu thu nhập bấp bênh, bạn trụ được bao lâu?",
      hint: "Có quỹ dự phòng thì bạn chọn được khách tốt, không phải nhận mọi việc rẻ.",
      options: ["Dưới 1 tháng", "Khoảng 1–2 tháng", "3–5 tháng, hoặc vẫn đang có việc chính", "Từ 6 tháng trở lên"],
      gap: { title: "Lập quỹ dự phòng", tasks: ["Tính chi phí sống tối thiểu mỗi tháng", "Giữ việc hiện tại đến khi có quỹ bằng 3 tháng chi phí", "Tính mức giá cần báo để đủ sống bằng nghề"] },
      polish: { title: "Tách tiền công việc", tasks: ["Mở một tài khoản riêng cho thu nhập freelance", "Trích 10–20% mỗi khoản thu vào quỹ dự phòng và thuế"] },
      guide: "nhan-tien-ve-viet-nam", tool: "tinh-gia",
    },
  ];
  const N = DIMS.length;
  const MAX = N * 3;
  /* ties between equally weak dimensions: fix the foundation first */
  const PRIORITY = ["skill", "english", "portfolio", "payment", "freelance", "time", "setup", "savings", "timezone", "network"];
  const STATUS = ["Cần bắt đầu", "Cần bổ sung", "Khá", "Vững"];

  const LEVELS = [
    {
      key: "start", name: "Mới bắt đầu", head: ["Bạn đang ở mức", "Mới bắt đầu"],
      text: "Vạch xuất phát là chỗ tốt để đi đúng hướng. 30 ngày tới tập trung xây nền: chọn kỹ năng, làm mẫu, chuẩn bị cách nhận tiền. Chưa cần ứng tuyển hàng loạt.",
      final: { title: "Thử sức có kiểm soát", tasks: ["Lưu 10 việc hợp người mới trên Việt Remote", "Gửi 3 proposal đầu tiên, dùng mẫu proposal", "Kiểm tra mọi tin lạ trước khi trả lời hoặc chuyển tiền"] },
      guides: ["bat-dau-lam-remote", "nhan-dien-lua-dao"], tools: ["kiem-tra-lua-dao"],
    },
    {
      key: "almost", name: "Sắp sẵn sàng", head: ["Bạn đang ở mức", "Sắp sẵn sàng"],
      text: "Nền đã có, chỉ còn vài chỗ hổng khiến khách ngần ngại. Lấp ba điểm ưu tiên trong 3 tuần, tuần thứ tư bắt đầu ứng tuyển đều.",
      final: { title: "Ứng tuyển đều đặn", tasks: ["Gửi 2 proposal mỗi ngày làm việc, khoảng 15 cái trong tuần", "Theo dõi hồ sơ ở mục Việc đã lưu, follow-up sau 3 ngày", "Ghi lại proposal nào được trả lời và vì sao"] },
      guides: ["upwork-cho-nguoi-moi"], tools: ["mau-proposal-email"],
    },
    {
      key: "ready", name: "Sẵn sàng", head: ["Bạn đã", "sẵn sàng"],
      text: "Bạn đủ điều kiện để ứng tuyển ngay. Việc còn lại là chọn lọc khách, giữ nhịp và nâng giá dần.",
      final: { title: "Tăng tốc và nâng giá", tasks: ["Mỗi tuần ứng tuyển 3–5 việc trả cao nhất trong ngách", "Thử báo giá cao hơn mức hiện tại 15%", "Xin review sau mỗi dự án hoàn thành"] },
      guides: ["upwork-cho-nguoi-moi"], tools: ["tinh-gia"],
    },
  ];
  /* used when fewer than three dimensions still need work */
  const GROWTH = [
    { title: "Tìm khách dài hạn", tasks: ["Đề xuất gói hằng tháng cho khách đang làm tốt", "Viết một case study từ dự án gần nhất"], guide: "upwork-cho-nguoi-moi", tool: "mau-proposal-email" },
    { title: "Định giá lại", tasks: ["Tính lại giá theo chi phí và mục tiêu thu nhập mới", "Chuẩn bị email báo tăng giá cho khách cũ"], guide: "", tool: "tinh-gia" },
    { title: "Chia sẻ để được biết đến", tasks: ["Viết một bài chia sẻ kinh nghiệm trong cộng đồng", "Nhận góp ý CV cho một bạn mới vào nghề"], guide: "", tool: "", community: true },
  ];

  /* score bands on the scale: 0–13 | 14–22 | 23–30 (14fr 9fr 8fr, 3px gaps) */
  const BANDS = [0, 14, 23];
  function levelFor(answers) {
    const total = answers.reduce((s, v) => s + (v || 0), 0);
    const byScore = total >= BANDS[2] ? 2 : total >= BANDS[1] ? 1 : 0;
    let idx = byScore;
    /* without a sellable skill or with very weak English, "ready" would be misleading */
    const by = Object.fromEntries(DIMS.map((d, i) => [d.key, answers[i] || 0]));
    const missing = [];
    if (idx === 2) {
      if (by.skill <= 1) missing.push("skill");
      if (by.english === 0) missing.push("english");
      if (missing.length) idx = 1;
    }
    return { total, idx, level: LEVELS[idx], capped: idx !== byScore, missing };
  }
  /** pin position on the scale: the score's slot, kept inside the segment of the level shown
      (a capped 28 sits at the top end of "Sắp sẵn sàng", never in the "Sẵn sàng" segment) */
  function pinFor(total, idx, capped) {
    const slot = capped ? BANDS[2] - 1 : total;
    const at = (f, px) => `calc((100% - 6px) * ${f.toFixed(4)} + ${px}px)`;
    const start = BANDS[idx] / (MAX + 1);
    const end = (idx === 2 ? MAX + 1 : BANDS[idx + 1]) / (MAX + 1);
    const gap = idx * 3; /* 3px gaps between segments */
    return `clamp(${at(start, gap + 9)}, ${at((slot + 0.5) / (MAX + 1), gap)}, ${at(end, gap - 9)})`;
  }
  function capNote(missing) {
    const need = missing.map((k) => (k === "skill" ? "có kỹ năng bán được" : "tiếng Anh cơ bản")).join(" và ");
    return `Đủ điểm cho mức Sẵn sàng, nhưng cần ${need} trước.`;
  }

  /** weeks 1–3 from the weakest dimensions, week 4 from the level */
  function buildPlan(answers, level, info) {
    const scored = DIMS.map((d, i) => ({ d, i, v: answers[i] || 0 }))
      .filter((x) => x.v < 3)
      .sort((a, b) => a.v - b.v || PRIORITY.indexOf(a.d.key) - PRIORITY.indexOf(b.d.key));
    const pick = (block, d, key) => (block[key] !== undefined ? block[key] : d[key]);
    const weeks = scored.slice(0, 3).map((x) => {
      const block = x.v <= 1 ? x.d.gap : x.d.polish;
      return { title: block.title, tasks: block.tasks, dim: x.d, guide: pick(block, x.d, "guide"), tool: pick(block, x.d, "tool"), community: x.d.community };
    });
    /* capped results: the dimension that held the level back gets a follow-up week, not "raise your rates" */
    if (info && info.capped) {
      info.missing.forEach((key) => {
        if (weeks.length >= 3) return;
        const n = weeks.findIndex((w) => w.dim && w.dim.key === key);
        const d = DIMS.find((x) => x.key === key);
        if (n === -1 || weeks.some((w) => w.title === d.polish.title)) return;
        weeks.push({ title: d.polish.title, tasks: d.polish.tasks, dim: d, follow: n + 1,
          guide: pick(d.polish, d, "guide"), tool: pick(d.polish, d, "tool"), community: d.community });
      });
    }
    /* growth fillers assume a solid base; a capped result only keeps the community one */
    const fillers = info && info.capped ? GROWTH.filter((x) => x.community) : GROWTH;
    for (let g = 0; weeks.length < 3 && g < fillers.length; g++) {
      const item = fillers[g];
      weeks.push({ title: item.title, tasks: item.tasks, dim: null, filler: true, guide: item.guide, tool: item.tool, community: item.community });
    }
    weeks.push({ title: level.final.title, tasks: level.final.tasks, dim: null, final: true,
      guide: level.guides[0], tool: level.tools[0] });
    return { weeks, priorities: scored.slice(0, 3).map((x) => x.d.key) };
  }

  function recommendations(plan, level) {
    const guides = [];
    const tools = [];
    const push = (list, slug) => { if (slug && !list.includes(slug)) list.push(slug); };
    plan.weeks.slice(0, 3).forEach((w) => push(guides, w.guide));
    level.guides.forEach((s) => push(guides, s));
    Object.keys(GUIDES).forEach((s) => push(guides, s));
    plan.weeks.forEach((w) => push(tools, w.tool));
    level.tools.forEach((s) => push(tools, s));
    ["kiem-tra-lua-dao", "tinh-gia", "mau-proposal-email", "cham-cv", "tao-invoice"].forEach((s) => push(tools, s));
    return {
      guides: guides.filter((s) => GUIDES[s]).slice(0, 3),
      tools: tools.filter((s) => s !== "san-sang-remote" && TOOLS[s]).slice(0, 3),
    };
  }

  /* ------------------------------------------------------------------ state */
  const blank = () => ({ answers: new Array(N).fill(null), step: 0, done: false, at: "", ticks: {} });
  function load() {
    const s = VR.store.get(KEY, null);
    if (!s || !Array.isArray(s.answers) || s.answers.length !== N) return blank();
    s.answers = s.answers.map((v) => (v === 0 || v === 1 || v === 2 || v === 3 ? v : null));
    s.step = Math.min(Math.max(Number(s.step) || 0, 0), N - 1);
    s.ticks = s.ticks && typeof s.ticks === "object" ? s.ticks : {};
    return s;
  }
  const save = (s) => VR.store.set(KEY, s);
  const code = (answers) => answers.map((v) => (v == null ? "0" : String(v))).join("");
  function fromHash() {
    const m = /(?:^|[#&])kq=([0-3]{10})(?:&|$)/.exec(window.location.hash);
    return m ? m[1].split("").map(Number) : null;
  }
  const shareUrl = (answers) => window.location.href.split("#")[0] + "#kq=" + code(answers);

  /* ------------------------------------------------------------------ render helpers */
  const e = (s) => VR.escape(s);
  const icon = (name, cls) => `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  function linkFor(week, seen) {
    if (week.community) {
      const url = COMMUNITY || "/cong-dong/";
      return `<a class="qz-week__link" href="${e(url)}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ""}>${icon("users", "icon--sm")}Vào cộng đồng</a>`;
    }
    if (week.tool && TOOLS[week.tool] && !(seen && seen.has(week.tool))) {
      if (seen) seen.add(week.tool);
      return `<a class="qz-week__link" href="${e(TOOLS[week.tool].url)}">${icon("layers", "icon--sm")}Dùng công cụ: ${e(TOOLS[week.tool].title)}</a>`;
    }
    if (week.guide && GUIDES[week.guide]) {
      return `<a class="qz-week__link" href="/huong-dan/${e(week.guide)}/">${icon("book", "icon--sm")}Đọc: ${e(GUIDES[week.guide].title)}</a>`;
    }
    return "";
  }

  /* ------------------------------------------------------------------ app */
  function init() {
    const root = document.querySelector("[data-quiz]");
    if (!root) return;
    try {
      const raw = document.getElementById("vr-tools");
      const list = raw ? JSON.parse(raw.textContent) : [];
      list.forEach((t) => { TOOLS[t.slug] = t; });
    } catch (_) { TOOLS = {}; }
    try {
      const raw = document.getElementById("vr-guides");
      (raw ? JSON.parse(raw.textContent) : []).forEach((g) => { GUIDES[g.slug] = g; });
    } catch (_) { GUIDES = {}; }
    const photoBase = root.dataset.photos || "/static/portal/img/ph/";
    COMMUNITY = root.dataset.community || "";

    const els = {
      quiz: root.querySelector("[data-quiz-steps]"),
      result: root.querySelector("[data-quiz-result]"),
      form: root.querySelector("[data-quiz-form]"),
      count: root.querySelector("[data-quiz-count]"),
      bar: root.querySelector("[data-quiz-bar]"),
      rail: root.querySelector("[data-quiz-rail]"),
      back: root.querySelector("[data-quiz-back]"),
      next: root.querySelector("[data-quiz-next]"),
      live: root.querySelector("[data-quiz-live]"),
      done: root.querySelector("[data-quiz-done]"),
    };
    let state = load();
    let shared = null;

    /* rail (desktop): one row per dimension, answered rows jump back */
    els.rail.innerHTML = DIMS.map((d, i) => `<li><button class="qz-rail__item" type="button" data-goto="${i}">
      <span class="qz-rail__num">${String(i + 1).padStart(2, "0")}</span><span class="qz-rail__label">${e(d.label)}</span>
      <span class="qz-rail__tick">${icon("check")}</span></button></li>`).join("");
    els.bar.innerHTML = DIMS.map(() => "<i></i>").join("");

    function renderStep(dir) {
      const i = state.step;
      const d = DIMS[i];
      const name = `qz-${d.key}`;
      els.form.innerHTML = `<fieldset class="qz-q${dir ? " is-enter" + (dir < 0 ? " is-back" : "") : ""}">
        <legend class="qz-q__legend"><span class="qz-q__dim">${String(i + 1).padStart(2, "0")} · ${e(d.label)}</span>
          <span class="qz-q__title" tabindex="-1" data-qtitle>${e(d.q)}</span></legend>
        <div class="qz-opts">${d.options.map((text, v) => `<label class="qz-opt">
          <input type="radio" name="${name}" value="${v}"${state.answers[i] === v ? " checked" : ""}>
          <span class="qz-opt__key" aria-hidden="true">${v + 1}</span><span class="qz-opt__text">${e(text)}</span>
          <span class="qz-opt__check" aria-hidden="true">${icon("check")}</span></label>`).join("")}</div>
      </fieldset>`;
      const answered = state.answers.filter((v) => v != null).length;
      els.count.textContent = `Câu ${i + 1}/${N}`;
      Array.from(els.bar.children).forEach((bar, k) => {
        bar.classList.toggle("is-done", state.answers[k] != null);
        bar.classList.toggle("is-on", k === i);
      });
      els.bar.setAttribute("aria-valuenow", String(answered));
      if (els.done) VR.liveCount(els.done, answered);
      els.rail.querySelectorAll("[data-goto]").forEach((btn, k) => {
        btn.classList.toggle("is-done", state.answers[k] != null);
        btn.classList.toggle("is-on", k === i);
        btn.disabled = !(state.answers[k] != null || k === i || k === firstOpen());
        if (k === i) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
      });
      els.back.disabled = i === 0;
      updateNext();
      const q = els.form.querySelector(".qz-q.is-enter");
      if (q) {
        void q.offsetWidth; /* commit the start position so the step slides in */
        q.classList.remove("is-enter", "is-back");
      }
    }
    const firstOpen = () => { const k = state.answers.indexOf(null); return k === -1 ? N : k; };
    function updateNext() {
      const has = state.answers[state.step] != null;
      els.next.disabled = !has;
      const last = state.step === N - 1;
      els.next.querySelector("[data-next-label]").textContent = last ? "Xem kết quả" : "Câu tiếp";
    }

    function focusStep() {
      const checked = els.form.querySelector("input:checked") || els.form.querySelector("input");
      if (checked) checked.focus({ preventScroll: true });
    }
    function go(step, dir) {
      state.step = Math.min(Math.max(step, 0), N - 1);
      save(state);
      renderStep(dir);
      els.live.textContent = `Câu ${state.step + 1} trên ${N}: ${DIMS[state.step].q}`;
      focusStep();
    }
    function next() {
      if (state.answers[state.step] == null) return;
      if (state.step === N - 1) { finish(); return; }
      go(state.step + 1, 1);
    }
    function finish() {
      if (state.answers.some((v) => v == null)) { go(firstOpen(), 1); return; }
      state.done = true;
      state.at = new Date().toISOString();
      save(state);
      shared = null;
      try { history.replaceState(null, "", "#kq=" + code(state.answers)); } catch (_) { /* file:// */ }
      showResult(state.answers, { scroll: true });
    }

    /* A tap or click on an option picks it and moves on, also when it is already your answer.
       Arrow keys and Space change the answer without moving on: those clicks land on the radio
       itself, while a pointer click lands on the label (which then forwards it to the radio). */
    let advanceTimer;
    const advanceSoon = () => {
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(next, VR.reducedMotion ? 60 : 320);
    };
    els.form.addEventListener("click", (ev) => {
      const opt = ev.target.closest(".qz-opt");
      if (!opt || ev.target.matches("input")) return;
      advanceSoon(); /* the forwarded click and its change event run before the timer */
    });
    els.form.addEventListener("change", (ev) => {
      const input = ev.target;
      if (input.type !== "radio") return;
      state.answers[state.step] = Number(input.value);
      save(state);
      renderMarks();
      updateNext();
    });
    function renderMarks() {
      Array.from(els.bar.children).forEach((bar, k) => bar.classList.toggle("is-done", state.answers[k] != null));
      els.rail.querySelectorAll("[data-goto]").forEach((btn, k) => {
        btn.classList.toggle("is-done", state.answers[k] != null);
        btn.disabled = !(state.answers[k] != null || k === state.step || k === firstOpen());
      });
      const answered = state.answers.filter((v) => v != null).length;
      els.bar.setAttribute("aria-valuenow", String(answered));
      if (els.done) VR.liveCount(els.done, answered);
    }
    els.next.addEventListener("click", () => { clearTimeout(advanceTimer); next(); });
    els.back.addEventListener("click", () => { clearTimeout(advanceTimer); if (state.step > 0) go(state.step - 1, -1); });
    els.rail.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-goto]");
      if (!btn || btn.disabled) return;
      clearTimeout(advanceTimer);
      const k = Number(btn.dataset.goto);
      go(k, k < state.step ? -1 : 1);
    });
    /* 1–4 pick an answer and continue, Enter continues, Backspace goes back */
    els.quiz.addEventListener("keydown", (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (/^[1-4]$/.test(ev.key)) {
        const input = els.form.querySelectorAll("input")[Number(ev.key) - 1];
        if (!input) return;
        ev.preventDefault();
        const isNew = !input.checked;
        input.checked = true;
        input.focus({ preventScroll: true });
        if (isNew) input.dispatchEvent(new Event("change", { bubbles: true }));
        advanceSoon();
      } else if (ev.key === "Enter" && ev.target.closest(".qz-q")) {
        ev.preventDefault();
        clearTimeout(advanceTimer);
        next();
      } else if (ev.key === "Backspace" && ev.target.closest(".qz-q") && state.step > 0) {
        ev.preventDefault();
        clearTimeout(advanceTimer);
        go(state.step - 1, -1);
      }
    });

    /* ---------------- result */
    function showResult(answers, opts) {
      const o = opts || {};
      const info = levelFor(answers);
      const { total, idx, level, capped } = info;
      const plan = buildPlan(answers, level, info);
      const recs = recommendations(plan, level);
      const isShared = Boolean(o.shared);
      const ticks = isShared ? {} : state.ticks || {};
      const strong = DIMS.filter((d, i) => answers[i] === 3).map((d) => d.label);

      const dims = DIMS.map((d, i) => {
        const v = answers[i] || 0;
        const p = plan.priorities.indexOf(d.key);
        return `<li class="qz-dim${v === 3 ? " is-strong" : ""}${p > -1 ? " is-priority" : ""}" style="--v:${v / 3}">
          <span class="qz-dim__n ed-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
          <span class="qz-dim__label">${e(d.label)}</span>
          <span class="qz-dim__track" aria-hidden="true"><i></i></span>
          <span class="qz-dim__val"><b class="num">${v}</b>/3</span>
          <span class="qz-dim__status">${p > -1 ? `<span class="qz-dim__week">Tuần ${p + 1}</span>` : v === 3 ? `<span class="qz-dim__ok">${icon("check")}${STATUS[v]}</span>` : STATUS[v]}</span>
        </li>`;
      }).join("");

      const ranges = ["Ngày 1–7", "Ngày 8–14", "Ngày 15–21", "Ngày 22–30"];
      const linked = new Set();
      const now = plan.weeks.findIndex((w, k) => w.tasks.some((t, j) => !ticks[`w${k}t${j}`]));
      const weeks = plan.weeks.map((w, k) => {
        const tasks = w.tasks.map((t, j) => {
          const id = `w${k}t${j}`;
          return `<li><label class="qz-task"><input type="checkbox" data-tick="${id}"${ticks[id] ? " checked" : ""}${isShared ? " disabled" : ""}><span>${e(t)}</span></label></li>`;
        }).join("");
        return `<li class="qz-week${w.final ? " is-final" : ""}${k === now ? " is-now" : ""}">
          <p class="qz-week__when"><span class="qz-week__n ed-num" aria-hidden="true">0${k + 1}</span><span class="qz-week__days">Tuần ${k + 1} · ${ranges[k]}</span></p>
          <div class="qz-week__body">
          <h4 class="qz-week__title">${e(w.title)}</h4>
          <p class="qz-week__why">${w.follow ? `Bước tiếp theo sau tuần ${w.follow}, để lên mức sẵn sàng`
            : w.dim ? `Vì ${e(w.dim.lower || w.dim.label.toLowerCase())} đang ở mức ${e(STATUS[answers[DIMS.indexOf(w.dim)] || 0].toLowerCase())}`
            : w.final ? `Mục tiêu cho mức ${e(level.name.toLowerCase())}`
            : capped ? "Làm song song trong lúc hoàn thiện nền" : "Nâng cấp khi nền đã vững"}</p>
          <ul class="qz-tasks">${tasks}</ul>
          ${linkFor(w, linked)}
          </div>
        </li>`;
      }).join("");

      const guides = recs.guides.map((slug) => {
        const g = GUIDES[slug];
        return `<li><a class="qz-guide" href="/huong-dan/${e(slug)}/">
          <span class="qz-guide__img"><img src="${e(photoBase)}guide-${e(slug)}-640.webp" alt="" width="640" height="${slug === "bat-dau-lam-remote" ? 800 : 425}" loading="lazy" decoding="async"></span>
          <span class="qz-guide__meta">${e(g.topic)} · ${g.minutes} phút đọc</span>
          <span class="qz-guide__title">${e(g.title)}</span></a></li>`;
      }).join("");
      const tools = recs.tools.map((slug) => {
        const t = TOOLS[slug];
        return `<li><a class="qz-tool" href="${e(t.url)}"><span class="qz-tool__title">${e(t.title)}</span><span class="qz-tool__text">${e(t.summary)}</span>${icon("chevron", "qz-tool__arrow")}</a></li>`;
      }).join("");

      const when = !isShared && state.at ? new Date(state.at) : null;
      els.result.innerHTML = `
        <section class="ed-frame ta-qres qz-res" aria-labelledby="qz-res-title">
          <div class="qz-res__summary">
            <p class="qz-res__kicker">${isShared ? "Kết quả được chia sẻ" : when ? `Kết quả của bạn · ${when.toLocaleDateString("vi-VN")}` : "Kết quả của bạn"}</p>
            <h2 class="qz-res__title" id="qz-res-title" tabindex="-1" data-res-title>${e(level.head[0])} <span class="qz-res__level">${e(level.head[1])}</span></h2>
            <p class="qz-res__text">${e(level.text)}</p>
            <div class="qz-res__actions">
              ${isShared ? `<button class="rv-pill rv-pill--primary" type="button" data-act="retake">Làm bài của bạn</button>` : `
              <button class="rv-pill rv-pill--primary rv-copy" type="button" data-act="copy">${icon("copy", "rv-copy__i")}${icon("check", "rv-copy__ok")}<span data-copy-label>Sao chép kết quả</span></button>
              <button class="rv-pill rv-pill--line" type="button" data-act="share">${icon("send")}Chia sẻ</button>
              <button class="ta-textbtn qz-res__again" type="button" data-act="retake">Làm lại từ đầu</button>`}
            </div>
          </div>
          <div class="qz-res__score">
            <p class="qz-score"><span class="qz-score__num num" data-score>${total}</span><span class="qz-score__max">/${MAX} điểm</span></p>
            <div class="qz-scale${capped ? " is-capped" : ""}" style="--p:${pinFor(total, idx, capped)}" role="img" aria-label="${total} trên ${MAX} điểm, mức ${e(level.name)}${capped ? ". " + e(capNote(info.missing)) : ""}">
              <div class="qz-scale__track"><span class="qz-scale__seg${idx === 0 ? " is-on" : ""}"></span><span class="qz-scale__seg${idx === 1 ? " is-on" : ""}"></span><span class="qz-scale__seg${idx === 2 ? " is-on" : ""}"></span><i class="qz-scale__pin"></i></div>
              <div class="qz-scale__labels" aria-hidden="true"><span${idx === 0 ? ' class="is-on"' : ""}>Mới bắt đầu</span><span${idx === 1 ? ' class="is-on"' : ""}>Sắp sẵn sàng</span><span${idx === 2 ? ' class="is-on"' : ""}>Sẵn sàng</span></div>
            </div>
            ${capped ? `<p class="qz-scale__note">${icon("alert")}<span>${e(capNote(info.missing))}</span></p>` : ""}
            ${strong.length ? `<p class="qz-res__strong">${icon("check-circle")}<span><strong>Điểm mạnh:</strong> ${e(strong.join(", "))}</span></p>` : `<p class="qz-res__strong is-none">${icon("compass")}<span>Chưa có mặt nào đạt 3/3. Lộ trình bên dưới bắt đầu từ chỗ cần nhất.</span></p>`}
          </div>
        </section>

        <section class="ta-qblock qz-dims-card" aria-labelledby="qz-dims-title">
          <div class="qz-block-head"><h3 class="qz-block-title" id="qz-dims-title">Điểm theo từng mặt</h3><p class="qz-block-note">Tối đa 3 điểm mỗi mặt${plan.priorities.length ? "; “Tuần 1” là tuần bạn xử lý mặt đó" : ""}.</p></div>
          <ul class="qz-dims">${dims}</ul>
        </section>

        <section class="ta-qblock qz-plan" aria-labelledby="qz-plan-title">
          <div class="qz-block-head">
            <h3 class="qz-block-title" id="qz-plan-title">Lộ trình 30 ngày${isShared ? "" : " của bạn"}</h3>
            <p class="qz-block-note">${plan.priorities.length ? "Ba tuần đầu lấp điểm yếu nhất, tuần cuối bắt tay vào việc." : "Nền đã vững: ba tuần nâng cấp, tuần cuối tăng tốc."}</p>
          </div>
          <ol class="qz-weeks">${weeks}</ol>
        </section>

        <section class="ta-qblock qz-recs" aria-labelledby="qz-recs-title">
          <h3 class="qz-block-title" id="qz-recs-title">Nên đọc tiếp</h3>
          <ul class="qz-guides">${guides}</ul>
          <h3 class="qz-block-title qz-recs__tools-title">Công cụ cho bước tiếp theo</h3>
          <ul class="qz-tools">${tools}</ul>
        </section>`;

      els.quiz.hidden = true;
      els.result.hidden = false;
      root.classList.add("is-result");
      if (o.scroll) {
        const top = root.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: VR.reducedMotion ? "auto" : "smooth" });
        const title = els.result.querySelector("[data-res-title]");
        if (title) title.focus({ preventScroll: true });
      }
      /* the bars grow once (transform only); the score counts up once (not with reduced motion or html.hm-lite) */
      requestAnimationFrame(() => requestAnimationFrame(() => els.result.classList.add("is-in")));
      const scoreEl = els.result.querySelector("[data-score]");
      if (scoreEl && document.documentElement.classList.contains("rv-live") && !VR.reducedMotion) VR.countTo(scoreEl, total, { from: 0, duration: 900 });

      els.result.dataset.code = code(answers);
      els.result.dataset.level = level.name;
      els.result.dataset.total = String(total);
      shared = isShared ? answers : null;
    }

    function summaryText(answers) {
      const info = levelFor(answers);
      const { total, level } = info;
      const plan = buildPlan(answers, level, info);
      const strong = DIMS.filter((d, i) => answers[i] === 3).map((d) => d.label);
      const weak = plan.priorities.map((k) => DIMS.find((d) => d.key === k).label);
      const lines = [`Mức sẵn sàng làm remote của mình: ${level.name} (${total}/${MAX} điểm)`];
      if (info.capped) lines.push(capNote(info.missing));
      if (strong.length) lines.push(`Điểm mạnh: ${strong.join(", ")}`);
      if (weak.length) lines.push(`Ưu tiên 30 ngày tới: ${weak.join(", ")}`);
      plan.weeks.forEach((w, k) => lines.push(`Tuần ${k + 1}: ${w.title}`));
      lines.push(`Xem kết quả: ${shareUrl(answers)}`);
      lines.push(`Tự làm bài 3 phút: ${window.location.href.split("#")[0]}`);
      return lines.join("\n");
    }

    /* leaving someone else's result: back to your own quiz or result, nothing is wiped */
    function leaveShared() {
      shared = null;
      if (state.done && state.answers.every((v) => v != null)) { showResult(state.answers, { scroll: true }); return; }
      els.result.hidden = true;
      els.result.classList.remove("is-in");
      els.result.innerHTML = "";
      els.quiz.hidden = false;
      root.classList.remove("is-result");
      go(firstOpen() < N ? firstOpen() : 0, 0);
    }

    els.result.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "copy") {
        VR.copy(summaryText(state.answers), "Đã sao chép kết quả và lộ trình", btn);
      } else if (act === "share") {
        const url = shareUrl(state.answers);
        const { level, total } = levelFor(state.answers);
        const text = `Mình đạt mức “${level.name}” (${total}/${MAX}) trong bài kiểm tra sẵn sàng làm remote của Việt Remote.`;
        if (navigator.share) {
          navigator.share({ title: "Bạn đã sẵn sàng làm remote?", text, url }).catch(() => { /* cancelled */ });
        } else {
          VR.copy(url, "Đã sao chép link kết quả", btn);
        }
      } else if (act === "retake" && shared) {
        try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (_) { /* ignore */ }
        leaveShared();
      } else if (act === "retake") {
        state = blank(); /* a new attempt gets a new plan, so old ticks go too */
        save(state);
        shared = null;
        try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (_) { /* ignore */ }
        els.result.hidden = true;
        els.result.classList.remove("is-in");
        els.result.innerHTML = "";
        els.quiz.hidden = false;
        root.classList.remove("is-result");
        const top = root.getBoundingClientRect().top + window.scrollY - 96;
        if (top < window.scrollY) window.scrollTo({ top: Math.max(0, top), behavior: VR.reducedMotion ? "auto" : "smooth" });
        go(0, 0);
        VR.toast("Đã xóa câu trả lời cũ. Làm lại từ câu 1.", { tone: "info" });
      }
    });
    els.result.addEventListener("change", (ev) => {
      const box = ev.target.closest("[data-tick]");
      if (!box || shared) return;
      state.ticks = state.ticks || {};
      if (box.checked) state.ticks[box.dataset.tick] = 1; else delete state.ticks[box.dataset.tick];
      save(state);
      const weeks = Array.from(els.result.querySelectorAll(".qz-week"));
      const now = weeks.findIndex((w) => Array.from(w.querySelectorAll("[data-tick]")).some((c) => !c.checked));
      weeks.forEach((w, k) => w.classList.toggle("is-now", k === now));
    });

    document.querySelectorAll("[data-tool-start]").forEach((a) => a.addEventListener("click", (event) => {
      event.preventDefault();
      if (!els.quiz.hidden) {
        els.quiz.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "start" });
        focusStep();
      } else {
        els.result.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "start" });
      }
    }));

    /* ---------------- start */
    const fromLink = fromHash();
    if (fromLink) {
      const mine = state.done && code(state.answers) === code(fromLink);
      renderStep(0);
      showResult(fromLink, { shared: !mine });
    } else if (state.done && state.answers.every((v) => v != null)) {
      renderStep(0);
      showResult(state.answers);
    } else {
      if (state.answers[state.step] == null && firstOpen() < state.step) state.step = firstOpen();
      renderStep(0);
    }
    root.classList.add("is-ready");

    /* a shared link pasted into an already open tab only changes the hash;
       clearing the hash while someone else's result is open goes back to your own */
    window.addEventListener("hashchange", () => {
      const fromLinkNow = fromHash();
      if (!fromLinkNow) { if (shared) leaveShared(); return; }
      const mine = state.done && code(state.answers) === code(fromLinkNow);
      showResult(fromLinkNow, { shared: !mine, scroll: true });
    });

  }

  VR.onReady(init);
})();

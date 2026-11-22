/* Việt Remote — scam checker (/cong-cu/kiem-tra-lua-dao/).
   100% client-side rule engine: nothing typed here leaves the browser.

   Text is folded per character (lower-case, no diacritics, đ -> d, NFKD so styled letters such as
   𝐭𝐫𝐢ệ𝐮 read as "trieu") with an index map back to the original, so one Vietnamese pattern matches
   "đóng phí", "dong phi", "ĐÓNG PHÍ" and "Đ.ó.n.g p.h.í", and every match can be highlighted in the
   original text.

   Rule: { id, cat, weight, title, why, re: [RegExp], critical?, weightOf?(ctx), when?(ctx) }
     cat     money | data | channel | promise | good (positive signal, negative weight)
     re      patterns on the folded text (always use the g flag)
     when    extra condition (e.g. pay is only "too high" for unskilled work)
*/
(function () {
  "use strict";

  const CATS = {
    money: { label: "Đòi tiền", cls: "hl--money" },
    data: { label: "Xin dữ liệu", cls: "hl--data" },
    channel: { label: "Kéo kênh riêng", cls: "hl--channel" },
    promise: { label: "Hứa hẹn, hối thúc", cls: "hl--promise" },
    good: { label: "Điểm cộng", cls: "hl--good" },
  };

  const BRANDS = "shopee|lazada|tiki|sendo|tiktok|amazon|google|meta|facebook|microsoft|apple|netflix|grab|samsung|vingroup|vinfast|viettel|fpt|vinamilk|unilever|nestle|coca[- ]?cola|pepsi|shein|temu|alibaba|agoda|booking\\.com|airbnb|upwork|linkedin|indeed|vietcombank|techcombank|vpbank|mb ?bank|momo|zalopay|deloitte|pwc|kpmg|ey|walmart|ikea|nike|adidas|canva|spotify|youtube";
  const BRAND_RE = new RegExp("\\b(" + BRANDS + ")\\b", "g");
  const FREE_MAIL = /\b[a-z0-9._%+-]+@(?:gmail|googlemail|yahoo|ymail|hotmail|outlook|live|icloud|aol|proton(?:mail)?|gmx|yandex|mail)\.(?:com|vn|net|me)\b/g;
  const ANY_MAIL = /\b[a-z0-9._%+-]+@([a-z0-9-]+\.)+[a-z]{2,}\b/g;
  /* unskilled-work context: only then is a high daily/hourly figure suspicious */
  const SIMPLE_WORK = /\b(nhap lieu|data entry|ctv|cong tac vien|chi can (co )?dien thoai|viec nhe|don gian|khong can kinh nghiem|no (prior )?experience|like\s*(,|\/|va|&)?\s*share|danh gia 5 sao|nhiem vu|typing|copy paste|xem video|watch videos?)\b/;

  /* ---------- money amounts: "500.000đ/ngày", "15–25 triệu/tháng", "$45/hour", "300k mỗi ngày" ---------- */
  const AMOUNT = /(\$\s*)?(\d[\d.,]*)\s*(k|nghin|ngan|tr|trieu|cu|m|million)?\s*(?:(?:-|–|den|toi|to)\s*(\$\s*)?(\d[\d.,]*)\s*(k|nghin|ngan|tr|trieu|cu|m|million)?)?\s*(d|dong|vnd|usd|\$)?\s*(?:\/|mot|moi|1|per|a|an|each)\s*(ngay|gio|thang|tuan|day|hour|hr|week|month)\b/g;

  function num(token) {
    let t = String(token || "").replace(/[.,](?=\d{3}\b)/g, "");
    t = t.replace(",", ".");
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }
  function scale(n, unit) {
    if (/^(k|nghin|ngan)$/.test(unit || "")) return n * 1e3;
    if (/^(tr|trieu|cu|m|million)$/.test(unit || "")) return n * 1e6;
    return n;
  }
  /** returns [{start,end,vndPerDay,usdPerHour,period,currency}] */
  function amounts(folded) {
    const out = [];
    let m;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(folded))) {
      /* groups: 1 "$" · 2 amount · 3 unit · 4 "$" · 5 range amount · 6 range unit · 7 currency · 8 period */
      const cur = m[7] || "";
      const usd = Boolean(m[1] || m[4] || cur === "usd" || cur === "$");
      const low = scale(num(m[2]), m[3] || m[6]);
      const high = m[5] ? scale(num(m[5]), m[6] || m[3]) : low;
      const top = Math.max(low, high);
      const period = m[8];
      if (!top) continue;
      if (!usd && !m[3] && !m[6] && !cur && top < 1000) continue;   // a bare small number is not money
      const perDay = { ngay: 1, day: 1, gio: 8, hour: 8, hr: 8, tuan: 1 / 6, week: 1 / 6, thang: 1 / 26, month: 1 / 26 }[period] || 1;
      const isVnd = !usd && (top >= 1000 || cur === "d" || cur === "dong" || cur === "vnd");
      const vndPerDay = isVnd ? top * perDay : top * perDay * 25000;
      const usdPerHour = isVnd ? 0 : top * perDay / 8;
      out.push({ start: m.index, end: m.index + m[0].length, vndPerDay, usdPerHour, period, usd: !isVnd, top });
    }
    return out;
  }

  const R = (id, cat, weight, title, why, re, extra) => Object.assign({ id, cat, weight, title, why, re }, extra || {});

  const RULES = [
    /* ---------------- money ---------------- */
    R("fee", "money", 5, "Đòi đóng phí trước khi làm",
      "Nhà tuyển dụng thật trả tiền cho bạn, không thu phí hồ sơ, phí giữ chỗ, phí đào tạo hay tiền đồng phục. Đây là dấu hiệu lừa đảo phổ biến nhất.",
      [/\b(dong|nop|dat|mat|thu)\s+(phi|le phi|tien coc|coc|tien giu cho)\b/g,
       /\bphi\s+(giu cho|kich hoat|dang ky|ho so|dao tao|dong phuc|xac nhan|tham gia|nhan viec|mo tai khoan|bao hiem|thu tuc|bao lanh|tai lieu)\b/g,
       /\b(dat coc|tien coc|coc truoc|ky quy)\b/g,
       /\b(chuyen khoan|ck|gui|nop|dong|chuyen)\s+(tien\s+)?coc\b/g,
       /\bhoan\s+coc\b/g,
       /\bcoc\s+\d/g,
       /\b(registration|application|training|processing|onboarding|activation|membership|placement|visa)\s+fees?\b/g,
       /\b(pay|send|transfer)\s+(a|the|an|your)?\s*(small\s+|one-time\s+|refundable\s+)?(fee|deposit)\b/g,
       /\b(refundable\s+deposit|security deposit)\b/g,
       /\b(purchase|buy)\s+(a |the |your )?(starter kit|equipment|software|training materials?|work kit)\b/g,
       /\bstarter kit\b/g],
      { critical: true }),
    R("prepay", "money", 5, "Bắt nạp hoặc chuyển tiền trước",
      "“Nạp tiền kích hoạt”, “chuyển trước rồi hoàn lại” là kịch bản quen thuộc: lần đầu được trả một khoản nhỏ để bạn tin, lần sau mất trắng.",
      [/\bnap\s+(tien|them|vao|truoc|\d[\d.,]*\s*(k|d|dong|vnd|trieu|tr)?)/g,
       /\bchuyen\s+(khoan\s+)?(tien\s+)?truoc\b/g,
       /\b(hoan|tra)\s+(lai|tien)\s+(sau|trong|ngay|khi)\b/g,
       /\b(send|wire|transfer|pay)\s+(money|funds|payment|it)\s+(first|upfront|up front|in advance|before)\b/g,
       /\b(upfront|up-front|advance)\s+(payment|fee|deposit)\b/g,
       /\bgift ?cards?\b/g,
       /\b(deposit|cash)\s+(the|this|a)\s+(check|cheque)\b/g,
       /\b(usdt|bitcoin|crypto wallet|vi tien ao)\b/g],
      { critical: true }),
    R("buyin", "money", 5, "Bắt mua hàng hoặc gói sản phẩm trước",
      "Việc thật không bắt bạn bỏ tiền mua hàng mẫu, gói sản phẩm hay “đơn đầu tiên”. Lời hứa “công ty mua lại với giá gấp đôi” là mồi để bạn chuyển những khoản lớn dần, rồi mất trắng.",
      [/\bmua\s+((cac|1|mot)\s+)?(goi|bo|lo|combo|don)?\s*(san pham|hang)\s*(mau|dau tien|demo|dung thu)\b/g,
       /\bmua lai\s+(voi\s+)?(gia\s+)?(gap (doi|ba|\d+ lan)|cao hon|x ?\d)/g,
       /\b(goi|bo|lo|combo|don hang|san pham)\b[^.!?\n]{0,30}\btri gia\s+\d[\d.,]*(\s*(k|nghin|ngan|tr|trieu|cu|ty|ti|d|dong|vnd|usd)\b)?/g,
       /\b(nhap hang|mua hang)\s+(truoc|mau)\b/g,
       /\b(buy|purchase)\s+(the |our |a |your )?(products?|inventory|stock|samples?|package)\s+(first|upfront|up front|in advance|before)\b/g],
      { critical: true }),
    R("agent", "money", 3, "Tuyển “đại lý online”",
      "“Đại lý online” thường là mô hình bắt bạn nhập hàng hay mua gói sản phẩm trước, lời đến từ việc kéo thêm người. Hỏi thẳng: bạn có phải bỏ ra đồng nào không?",
      [/\bdai ly\s+online\b/g, /\bonline\s+(sales\s+)?agents?\b/g]),
    R("tasks", "money", 4, "Làm nhiệm vụ like, share, đánh giá để nhận hoa hồng",
      "Việc “làm nhiệm vụ” ăn hoa hồng theo đơn thường chuyển dần sang yêu cầu nạp tiền để mở khóa nhiệm vụ lớn hơn, rồi không rút được.",
      [/\b(lam|nhan|hoan thanh)\s+(cac\s+)?nhiem vu\b/g,
       /\b(like|share|follow|tha tim|binh luan)\s*(,|\/|va|&)\s*(like|share|follow|danh gia|binh luan|tha tim)\b/g,
       /\bdanh gia 5 sao\b/g,
       /\bhoa hong\s+(\d[\d.,]*\s*(-|–|den)?\s*(\d[\d.,]*)?\s*%?|tu|len|cao|moi don|theo don)/g,
       /\bdon (hang )?(ao|nhiem vu)\b/g,
       /\b(like|subscribe to)\s+(youtube\s+|tiktok\s+)?(videos?|channels?|posts?)\b/g,
       /\brat(e|ing)\s+(hotels|products|apps)\b/g,
       /\btasks?\s+(to|and)\s+earn\b/g,
       /\bcommission (per|for each|on each) (task|order|review)\b/g]),

    /* ---------------- data ---------------- */
    R("secret", "data", 5, "Hỏi mã OTP, mật khẩu hoặc mã xác minh",
      "Không công việc nào cần mã OTP hay mật khẩu của bạn. Ai có mã OTP là có thể chuyển tiền khỏi tài khoản hoặc chiếm tài khoản của bạn.",
      [/\b(ma\s+)?otp\b/g, /\bmat khau\b/g, /\bma (xac (nhan|minh|thuc))\b/g, /\b(your|account|email|login|bank)\s+passwords?\b/g,
       /\b(verification|security|confirmation|one[- ]time)\s+(code|pin)\b/g, /\b(cvv|pin code|ma pin)\b/g],
      { critical: true }),
    R("id", "data", 4, "Xin CCCD, ảnh chân dung hay giấy tờ tùy thân quá sớm",
      "Giấy tờ tùy thân có thể bị dùng để mở tài khoản hay vay tiền đứng tên bạn. Chỉ gửi sau khi đã ký hợp đồng với công ty xác minh được.",
      [/\b(cccd|cmnd|can cuoc( cong dan)?|chung minh (nhan dan|thu)|ho chieu|bang lai( xe)?)\b/g,
       /\banh (chan dung|selfie|chup mat|2 mat|hai mat|mat truoc|mat sau)\b/g,
       /\b(id card|national id|passport|driver'?s licen[cs]e|social security( number)?|ssn)\b/g,
       /\b(copy|photo|scan|picture) of (your )?(id|passport|licen[cs]e)\b/g]),
    R("bank", "data", 3, "Hỏi số tài khoản ngân hàng ngay từ đầu",
      "Công ty thật chỉ cần thông tin nhận lương sau khi ký hợp đồng. Xin sớm, nhất là kèm CCCD hay OTP, là dấu hiệu chiếm đoạt tài khoản.",
      [/\b(so\s+)?(tai khoan|tk)\s+ngan hang\b/g, /\bstk\b/g, /\bso the\b/g, /\bthe (atm|tin dung|ngan hang)\b/g,
       /\b(bank|banking)\s+(account( number)?|details|login|information|info|card)\b/g, /\b(card number|routing number|iban)\b/g]),
    R("remote", "data", 3, "Yêu cầu cài ứng dụng lạ hoặc điều khiển máy từ xa",
      "Ứng dụng ngoài kho chính thức hoặc phần mềm điều khiển từ xa cho phép người lạ đọc tin nhắn, OTP và thao tác trên máy bạn.",
      [/\b(cai|tai|download)\s+(dat\s+)?(app|ung dung|phan mem)\s+(cua (cong ty|ben minh)|rieng|nay|theo link)/g,
       /\b(teamviewer|ultraviewer|anydesk|quicksupport)\b/g,
       /\b(download|install)\s+(the|our|this)?\s*(app|apk|software|client)\s+(from|via|using)\b/g,
       /\S+\.apk\b/g]),

    /* ---------------- channel ---------------- */
    R("chat", "channel", 3, "Kéo sang Zalo, Telegram hoặc WhatsApp riêng",
      "Đưa cuộc trò chuyện ra khỏi nền tảng tuyển dụng giúp kẻ gian tránh bị báo cáo và xóa dấu vết dễ dàng. Upwork cấm trao đổi ngoài nền tảng trước khi có hợp đồng.",
      [/\b(nhan|nhan tin|ib|inbox|lien he|lien lac|ket ban|kb|add|chat|vao|tham gia|join|ib qua|qua|sdt|so)\s*(qua\s+|voi\s+|ngay\s+|minh\s+(qua\s+)?|em\s+(qua\s+)?)?(zalo|telegram|tele|whatsapp|wa|messenger|signal|wechat|viber)\b/g,
       /\b(zalo|telegram|tele|whatsapp|signal|wechat|viber)\s*[:@]?\s*(@[a-z0-9_]{3,}|\+?\d[\d .-]{7,}\d)/g,
       /\b(t\.me|wa\.me|zalo\.me|telegram\.me)\/\S+/g,
       /\b(contact|text|message|reach|add|dm|chat with)\s+(me|us|our (hr|recruiter|manager|team))\s+(on|via|at|through)\s+(telegram|whatsapp|signal|wechat|viber|line)\b/g,
       /\b(telegram|whatsapp|wechat)\b/g]),
    R("shortlink", "channel", 2, "Link rút gọn che địa chỉ thật",
      "Link rút gọn giấu trang đích, thường dẫn tới trang giả để lấy thông tin đăng nhập. Hãy tự tìm website chính thức của công ty thay vì bấm vào.",
      [/\b(bit\.ly|tinyurl\.com|cutt\.ly|shorturl\.at|rb\.gy|is\.gd|ow\.ly|tiny\.cc|s\.id|rebrand\.ly|t\.ly|shorte\.st|v\.ht|bom\.so|goo\.su)\/\S*/g]),
    R("freemail", "channel", 3, "Email miễn phí nhưng tự nhận là công ty",
      "Công ty tuyển dụng bằng email tên miền riêng (ví dụ @tencongty.com). Gmail, Yahoo hay Outlook cá nhân kèm tên thương hiệu lớn thường là giả danh.",
      [FREE_MAIL],
      {
        weightOf: (ctx) => (ctx.brand || /\b(cong ty|tap doan|hr department|phong nhan su|recruit(ment|ing) team|hiring team|human resources)\b/.test(ctx.folded) ? 3 : 1),
        extra: (ctx) => ctx.brandMatches,
      }),

    /* ---------------- promise / pressure ---------------- */
    R("pay", "promise", 3, "Lương cao bất thường cho việc đơn giản",
      "Việc không cần kỹ năng mà trả từ 300.000đ một ngày hay vài chục USD một giờ là mồi nhử. Đối chiếu với lương thật trên bảng việc của Việt Remote.",
      [/\b(viec nhe luong cao|luong khung|thu nhap khung|thu nhap khong gioi han|luong cao ngat|kiem tien (nhanh|de dang|tai nha)|nhan luong (trong|cuoi) ngay)\b/g,
       /\b(earn|make)\s+(up to\s+)?\$\s?\d[\d,.]*\s*(\+\s*)?(a|per|\/)\s*(day|week)\b/g,
       /\b(easy money|quick money|get paid daily|earn from home)\b/g],
      {
        amounts: true,
        /* common in honest ads too, so these only count next to unskilled work */
        reSimple: [/\b(thu nhap|luong) (cao|hap dan|on dinh|len (toi|den))\b/g, /\b(high|great) (pay|income)\b/g],
      }),
    R("noexp", "promise", 2, "Không cần kinh nghiệm, không cần phỏng vấn",
      "Việc thật vẫn hỏi bạn đã làm gì và gặp bạn qua một cuộc gọi. “Không cần kinh nghiệm, nhận việc ngay” nghĩa là họ cần số đông, không cần bạn.",
      [/\bkhong can (kinh nghiem|bang cap|phong van|ky nang|trinh do|cv|ho so)\b/g,
       /\b(khong|ko|k) (yeu cau|doi hoi) (kinh nghiem|bang cap)\b/g,
       /\b(no|without( any)?)\s+(prior\s+|previous\s+)?(experience|interview|skills?|resume|cv|degree)\s*(is\s+)?(needed|required|necessary)?\b/g,
       /\bno interview\b/g,
       /\b(nhan viec|di lam|lam) ngay( trong ngay)?\b/g,
       /\bchi can (co )?(dien thoai|smartphone|zalo|facebook|biet (dung|doc))\b/g,
       /\b(viec nhe( nhang)?|cong viec (nhe nhang|don gian)|viec don gian)\b/g,
       /\b(easy|simple)\s+(job|work|tasks?|typing)\b/g]),
    R("rush", "promise", 2, "Hối thúc: gấp, chỉ còn vài suất",
      "Tạo cảm giác khan hiếm để bạn quyết định trước khi kịp kiểm tra. Việc thật cho bạn thời gian hỏi lại.",
      [/\b(tuyen gap|can gap|gap gap|khan cap|rat gap)\b/g,
       /\bchi con\s+(\d+|vai|it)\s*(slot|suat|cho|vi tri|ban|nguoi)\b/g,
       /\b(han chot|chot (danh sach|so luong)|trong hom nay|trong 24 ?(h|gio)|het slot)\b/g,
       /\b(urgent(ly)?|asap|immediately|act now)\b/g,
       /\b(only|just)\s+\d+\s+(slots?|spots?|positions?|seats?|openings?)\s*(left|remaining|available)?\b/g,
       /\b(within|in the next)\s+24\s*(hours|hrs|h)\b/g,
       /\b(limited (slots|spots|positions|seats)|positions are limited|today only)\b/g]),
    R("guarantee", "promise", 2, "Cam kết thu nhập, “không rủi ro”",
      "Không ai cam kết được thu nhập cố định cho người mới hay lợi nhuận “100%”. Lời hứa chắc chắn là dấu hiệu của mô hình đa cấp hoặc đầu tư trá hình.",
      [/\b(cam ket|dam bao|bao) (thu nhap|luong|hoan tien|loi nhuan|co viec)\b/g,
       /\b(100%|khong|0%) rui ro\b/g, /\b(lai|loi nhuan) (\d+ ?%|kep|hang ngay)/g,
       /\bguaranteed\s+(income|pay|earnings|profit|returns?)\b/g, /\brisk[- ]free\b/g]),
    R("selected", "promise", 3, "Báo trúng tuyển khi chưa qua vòng nào",
      "Bạn chưa ứng tuyển hay chưa được phỏng vấn mà đã nhận “offer”: đây là cách mở đầu quen thuộc của tin giả.",
      [/\b(you (have|'ve) been (selected|shortlisted|hired|approved))\b/g,
       /\b(pleased|happy|excited) to offer you\b/g,
       /\bban da (trung tuyen|duoc chon|duoc nhan)\b/g,
       /\bchuc mung ban da\b/g,
       /\bchuc mung ban (trung tuyen|duoc chon|duoc nhan)\b/g,
       /\bcongratulations?\b[^.!?\n]{0,40}\b(selected|hired|shortlisted|approved)\b/g]),

    /* ---------------- positive signals (subtract a little; scammers can fake these too) ---------------- */
    R("interview", "good", -1, "Có vòng phỏng vấn qua video",
      "Gặp mặt qua video là dấu hiệu tốt, miễn là không bị thu phí sau đó.",
      [/\b(?<!khong can |khong |no )(phong van|interview)\s+(qua|bang|tren|via|on|over)\s+(video|google meet|meet|zoom|teams|skype|goi video|call|cuoc goi)\b/g]),
    R("contract", "good", -1, "Nhắc tới hợp đồng hoặc thanh toán qua nền tảng",
      "Hợp đồng rõ ràng và thanh toán qua Upwork hay escrow giúp bạn được bảo vệ khi có tranh chấp.",
      [/\b(hop dong (lao dong|dich vu|ro rang)|ky hop dong|written contract|employment contract|escrow|milestones?|thanh toan qua (upwork|nen tang)|paid (through|via|on) upwork)\b/g]),
    R("domain", "good", -1, "Email dùng tên miền riêng",
      "Email tên miền công ty đáng tin hơn email miễn phí, nhưng hãy kiểm tra tên miền có đúng website chính thức không.",
      [], { companyMail: true }),
  ];

  /* A money/data phrase under a negation ("không thu phí", "never ask … to pay a fee",
     "không bao giờ yêu cầu mã OTP") is a disclaimer, not a red flag. It becomes this good signal. */
  const DISCLAIMER = R("disclaimer", "good", -1, "Nói rõ không thu phí, không hỏi mã OTP",
    "Tin thật hay ghi rõ điều này. Nhưng kẻ gian cũng viết “không mất phí” rồi đòi phí sau, nên vẫn đọc kỹ phần còn lại.", []);

  /* ---------- negation: a negator up to 8 words before the match, with only filler words between ----------
     Negators are checked on the ORIGINAL spelling, because folding merges words: "dung" is đừng (don't)
     but also dùng (use: "dùng mã OTP"), "no" is also nợ (debt), "not" also nốt. */
  const NEGATORS = new Set(["không", "khong", "ko", "chưa", "chua", "chẳng", "chang", "đừng", "never", "not", "no", "dont", "don't",
    "doesnt", "doesn't", "wont", "won't", "cannot", "can't", "without", "nor"]);
  /* "miễn phí giữ chỗ" = free: counts only right before the phrase ("miễn là bạn đóng phí" is not a negation) */
  const NEG_ADJACENT = new Set(["miễn", "mien"]);
  const FILLER = new Set(("bao gio he yeu cau doi hoi bat buoc can phai thu dong nop mat tra dat se duoc ai ban ung vien nguoi " +
    "bat ky mot khoan nao gi cung hay chung toi cong ty minh ben de nghi xin cung cap gui chia tu em anh chi " +
    "ask asks asking request requests require requires required expect expects charge charges need needs have has to you your " +
    "candidates candidate applicants applicant anyone any a an the ever for will would we us our share send give provide submit " +
    "pay make transfer wire hay hoac va nhu or and").split(" "));
  const CLAUSE_END = /[.!?;:,\n()[\]"“”]/;
  const WORD = /[a-z0-9']+/g;

  /** start index (folded) of the negation governing a match at `start`, or -1.
      `text`/`map` are the original text and the folded->original index map. */
  function negationAt(folded, start, text, fm, negated) {
    const inNegated = (at) => (negated || []).some((n) => at >= n.start && at < n.end);
    let tail = folded.slice(Math.max(0, start - 90), start).replace(/’/g, "'");
    const offset = start - tail.length;
    let cut = -1;
    for (let i = tail.length - 1; i >= 0; i--) { if (CLAUSE_END.test(tail[i])) { cut = i; break; } }
    const base = offset + cut + 1;
    tail = tail.slice(cut + 1);
    const words = [];
    let m;
    WORD.lastIndex = 0;
    while ((m = WORD.exec(tail))) words.push({ w: m[0], at: base + m.index, len: m[0].length });
    const original = (wd) => text.slice(fm.map[wd.at], fm.ends[wd.at + wd.len - 1]).toLowerCase().replace(/’/g, "'");
    for (let i = words.length - 1, seen = 0; i >= 0 && seen < 8; i--, seen++) {
      const wd = words[i];
      const orig = original(wd);
      if (NEGATORS.has(orig)) return wd.at;
      if (seen === 0 && NEG_ADJACENT.has(orig)) return wd.at;
      if (inNegated(wd.at)) { seen--; continue; }   // an already negated phrase: "không … mã OTP hay mật khẩu"
      if (!FILLER.has(wd.w)) return -1;
    }
    return -1;
  }

  /* ---------- folding with an index map back to the original text ---------- */
  /* letters split one by one to dodge filters: "Đ.ó.n.g p.h.í", "t.e.l.e.g.r.a.m", "z a l o".
     One separator kind per run and at least three letters, so "e.g." or "t.me" stay as they are. */
  const SPACED = /(?<![a-z0-9])[a-z]([.\- ])[a-z](?:\1[a-z])+(?![a-z0-9])/g;

  /** folded text plus, per folded character, its start (map) and end (ends) in the original */
  function foldMap(text) {
    let out = "";
    const map = [];
    const ends = [];
    for (let i = 0; i < text.length;) {
      const ch = String.fromCodePoint(text.codePointAt(i));
      let f;
      if (ch === "đ" || ch === "Đ") f = "d";
      else if (/\s/.test(ch)) f = " ";
      /* NFKD also turns 𝐭𝐫𝐢ệ𝐮, 𝟏𝟎 or fullwidth ｚａｌｏ into plain letters and digits */
      else f = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      for (let k = 0; k < f.length; k++) { out += f[k]; map.push(i); ends.push(i + ch.length); }
      i += ch.length;
    }
    const drop = new Set();
    let m;
    SPACED.lastIndex = 0;
    while ((m = SPACED.exec(out))) {
      for (let k = m.index + 1; k < m.index + m[0].length; k += 2) drop.add(k);
    }
    if (!drop.size) return { folded: out, map, ends };
    let folded = "";
    const map2 = [];
    const ends2 = [];
    for (let k = 0; k < out.length; k++) {
      if (drop.has(k)) continue;
      folded += out[k]; map2.push(map[k]); ends2.push(ends[k]);
    }
    return { folded, map: map2, ends: ends2 };
  }

  /** union of overlapping spans, sorted */
  function merge(spans) {
    const sorted = spans.slice().sort((a, b) => a.start - b.start || b.end - a.end);
    const out = [];
    sorted.forEach((s) => {
      const prev = out[out.length - 1];
      if (prev && s.start <= prev.end) prev.end = Math.max(prev.end, s.end);
      else out.push({ start: s.start, end: s.end });
    });
    return out;
  }

  function allMatches(re, folded) {
    const found = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(folded))) {
      if (!m[0]) { re.lastIndex += 1; continue; }
      found.push({ start: m.index, end: m.index + m[0].length });
    }
    return found;
  }

  /** Analyse a text. Returns {level, score, flags:[{rule, weight, spans}], goods:[...], spans:[{start,end,cat,rule}]} in ORIGINAL indices. */
  function analyse(text) {
    const fm = foldMap(text);
    const { folded, map, ends } = fm;
    const toOrig = (s) => ({ start: map[s.start], end: s.end - 1 < ends.length ? ends[s.end - 1] : text.length });
    const brandMatches = allMatches(BRAND_RE, folded);
    const ctx = { folded, brand: brandMatches.length > 0, brandMatches, simple: SIMPLE_WORK.test(folded) };

    /* pass 1: every pattern match, in text order */
    const found = new Map(RULES.map((rule) => [rule, []]));
    const all = [];
    RULES.forEach((rule) => {
      const res = rule.re.concat(rule.reSimple && ctx.simple ? rule.reSimple : []);
      res.forEach((re) => allMatches(re, folded).forEach((s) => all.push({ rule, s })));
    });
    all.sort((a, b) => a.s.start - b.s.start || b.s.end - a.s.end);
    /* pass 2: drop negated matches. A negated money/data phrase becomes a disclaimer (good signal), and
       it is transparent for the next one, so "không yêu cầu mã OTP hay mật khẩu" negates both. */
    const disclaimers = [];
    const negated = [];
    all.forEach(({ rule, s }) => {
      const neg = negationAt(folded, s.start, text, fm, negated);
      if (neg < 0) { found.get(rule).push(s); return; }
      negated.push({ start: Math.min(neg, s.start), end: s.end });
      if (rule.cat === "money" || rule.cat === "data") disclaimers.push({ start: neg, end: s.end });
    });

    const flags = [];
    const goods = [];
    RULES.forEach((rule) => {
      let spans = found.get(rule);

      if (rule.amounts && ctx.simple) {
        amounts(folded).forEach((a) => {
          const tooHigh = a.usd ? a.usdPerHour >= 20 : a.vndPerDay >= 400000;
          if (tooHigh) spans.push({ start: a.start, end: a.end });
        });
      }
      if (rule.companyMail) {
        spans = allMatches(ANY_MAIL, folded).filter((s) => { FREE_MAIL.lastIndex = 0; return !FREE_MAIL.test(folded.slice(s.start, s.end)); });
      }
      if (!spans.length) return;
      if (rule.extra) spans = spans.concat(rule.extra(ctx));
      const weight = rule.weightOf ? rule.weightOf(ctx) : rule.weight;
      const item = { rule, weight, spans: merge(spans).map(toOrig) };
      (rule.cat === "good" ? goods : flags).push(item);
    });
    if (disclaimers.length) goods.push({ rule: DISCLAIMER, weight: DISCLAIMER.weight, spans: merge(disclaimers).map(toOrig) });

    flags.sort((a, b) => b.weight - a.weight);
    const raw = flags.reduce((sum, f) => sum + f.weight, 0);
    /* one critical sign (fee, prepayment, OTP) is enough for "high", whatever else the text says:
       good signals never pull it down, or a scammer could buy a lower level with "phỏng vấn qua Zoom" */
    const critical = flags.some((f) => f.rule.critical);
    const bonus = critical ? 0 : Math.min(2, goods.length);
    const score = Math.max(0, raw - bonus);
    let level = "low";
    if (critical || score >= 7) level = "high";
    else if (score >= 3) level = "mid";

    /* highlight spans: earliest first, longer wins, no overlaps */
    const spans = [];
    flags.concat(goods).forEach((f) => f.spans.forEach((s) => spans.push({ start: s.start, end: s.end, cat: f.rule.cat, rule: f.rule.id, title: f.rule.title })));
    spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const clean = [];
    let last = -1;
    spans.forEach((s) => { if (s.start >= last && s.end > s.start) { clean.push(s); last = s.end; } });

    return { level, score, raw, critical, flags, goods, spans: clean };
  }

  /* ---------- samples (illustrative, written for this tool) ---------- */
  const SAMPLES = {
    telegram: "Chào bạn, mình là HR bên công ty thương mại điện tử. Bên mình đang tuyển CTV làm online tại nhà, chỉ cần điện thoại, không cần kinh nghiệm. Thu nhập 300.000–800.000đ/ngày, nhận lương trong ngày.\n\nBạn nhắn Telegram @vidu_tuyendung để được hướng dẫn nhé. Trước khi nhận việc bạn đóng phí giữ chỗ 199.000đ, hoàn lại sau khi hoàn thành 3 đơn. Chỉ còn 5 slot hôm nay!",
    "nhiem-vu": "VIỆC NHẸ LƯƠNG CAO, LÀM TẠI NHÀ 1–2 GIỜ MỖI NGÀY\n\nTuyển gấp 20 bạn làm nhiệm vụ online: like, share, đánh giá 5 sao sản phẩm trên sàn. Hoa hồng 10–30% mỗi đơn, thu nhập 15–25 triệu/tháng, cam kết thu nhập.\n\nKhông cần kinh nghiệm. Nạp 500.000đ kích hoạt tài khoản nhiệm vụ, tiền được hoàn lại sau 3 nhiệm vụ đầu. Gửi kèm ảnh CCCD 2 mặt để xác minh.\n\nĐăng ký tại: bit.ly/viecnhe-2026",
    email: "Subject: Job Offer – Remote Data Entry Clerk at Amazon\n\nDear Applicant,\n\nWe reviewed your resume and you have been selected for the position of Remote Data Entry Clerk at $45/hour. No interview is required.\n\nTo complete onboarding, please send a copy of your ID card, your bank account number and the verification code we will text you. You will also need to purchase a starter kit ($150) from our approved vendor; the cost will be refunded with your first paycheck.\n\nPlease reply within 24 hours as positions are limited. You can also text our recruiter on WhatsApp: +1 302 555 0147.\n\nHR Department\namazon.hiring.team@gmail.com",
  };

  const NEXT = {
    high: [
      "<strong>Dừng lại.</strong> Không chuyển thêm khoản nào, không gửi CCCD, mã OTP hay mật khẩu.",
      "Chụp màn hình cuộc trò chuyện, tài khoản người gửi và số tài khoản họ đưa (nếu có).",
      "Báo cáo tài khoản đó trên Zalo, Telegram, Facebook hoặc nền tảng tuyển dụng, rồi chặn.",
      "Nếu đã chuyển tiền: gọi ngay tổng đài ngân hàng để yêu cầu tra soát, và trình báo cơ quan công an gần nhất, hoặc phản ánh trên ứng dụng VNeID. Cần hỗ trợ khẩn cấp, gọi 113.",
    ],
    mid: [
      "Hỏi tên công ty, website và người phụ trách. Tự tìm lại trên Google, LinkedIn thay vì bấm link họ gửi.",
      "Tìm tên công ty hoặc số điện thoại kèm chữ “lừa đảo”.",
      "<strong>Không trả bất kỳ khoản phí nào</strong> và không gửi giấy tờ trước khi có hợp đồng.",
      "Đăng lên cộng đồng (che thông tin cá nhân) để người đi trước xem giúp.",
    ],
    low: [
      "Vẫn kiểm tra tên miền email và website chính thức của công ty.",
      "Trao đổi trên nền tảng tuyển dụng cho tới khi có hợp đồng.",
      "Nhớ quy tắc vàng: <strong>bạn không bao giờ phải trả tiền để được đi làm.</strong>",
    ],
  };
  /* "low" must never read as "safe": the rules only know familiar phrasing, so no check mark here */
  const VERDICT = {
    high: { text: "Rủi ro cao", icon: "alert" },
    mid: { text: "Cần thận trọng", icon: "alert" },
    low: { text: "Chỉ có dấu hiệu nhẹ", icon: "info" },
    none: { text: "Chưa thấy dấu hiệu quen thuộc", icon: "info" },
  };

  /* ---------- rendering ---------- */
  const e = (s) => VR.escape(s);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  function markedHtml(text, spans) {
    let html = "";
    let pos = 0;
    spans.forEach((s) => {
      html += e(text.slice(pos, s.start));
      html += `<mark class="hl ${CATS[s.cat].cls}" data-rule="${s.rule}" title="${e(s.title)}">${e(text.slice(s.start, s.end))}</mark>`;
      pos = s.end;
    });
    return html + e(text.slice(pos));
  }

  function quotes(text, spans) {
    const seen = new Set();
    const out = [];
    spans.forEach((s) => {
      const q = text.slice(s.start, s.end).replace(/\s+/g, " ").trim();
      const key = q.toLowerCase();
      if (q && !seen.has(key)) { seen.add(key); out.push(q.length > 60 ? q.slice(0, 58) + "…" : q); }
    });
    return out.slice(0, 3);
  }

  /* the verdict card (#ket-qua, the page's one ink card): the level, the meter, one line of why and how many signs
     each group has; the white card under it (data-result) shows the text marked up, every sign, what to do next */
  function render(root, text, res) {
    const out = root.querySelector("[data-result]");
    const risk = root.querySelector("[data-risk]");
    risk.classList.remove("is-low", "is-mid", "is-high");
    risk.classList.add("is-" + res.level);

    const n = res.flags.length;
    const groups = new Set(res.flags.map((f) => f.rule.cat)).size;
    const verdict = VERDICT[res.level === "low" && !n ? "none" : res.level];
    const v = risk.querySelector("[data-verdict] span");
    if (v.textContent !== verdict.text) v.textContent = verdict.text;
    /* the readout's lead: how many signs, big, in the level's colour (tools.css §D) */
    const fig = risk.querySelector("[data-count-fig]");
    if (fig) {
      fig.hidden = false;
      VR.liveCount(fig.querySelector("[data-count]"), String(n));
      fig.querySelector("[data-count-unit]").textContent = n ? `dấu hiệu · ${groups} nhóm` : "dấu hiệu";
    }
    let summary;
    if (!n) summary = "Không khớp mẫu câu đáng ngờ nào trong bộ quy tắc. Công cụ chỉ nhận ra cách viết quen thuộc, hãy tự xác minh công ty trước khi chuyển tiền hay gửi giấy tờ.";
    else if (res.level === "high" && res.critical) summary = `Tìm thấy ${n} dấu hiệu thuộc ${groups} nhóm, trong đó có dấu hiệu nghiêm trọng. Đừng chuyển tiền hay gửi thông tin cá nhân.`;
    else if (res.level === "high") summary = `Tìm thấy ${n} dấu hiệu thuộc ${groups} nhóm; cộng dồn lại đã ở mức rủi ro cao. Đừng chuyển tiền hay gửi thông tin cá nhân.`;
    else if (res.level === "mid") summary = `Tìm thấy ${n} dấu hiệu thuộc ${groups} nhóm. Hỏi thêm và tự xác minh trước khi đi tiếp.`;
    else summary = `Có ${n} dấu hiệu nhẹ. Công cụ chỉ nhận ra mẫu câu quen thuộc, hãy tự xác minh công ty trước khi chuyển tiền hay gửi giấy tờ.`;
    risk.querySelector("[data-summary]").textContent = summary;
    risk.querySelectorAll("[data-group]").forEach((row) => {
      const k = res.flags.filter((f) => f.rule.cat === row.dataset.group).length;
      row.classList.toggle("is-hit", k > 0);
      row.querySelector("[data-group-n]").textContent = k ? `${k} dấu hiệu` : "Không thấy";
    });

    const marked = out.querySelector("[data-marked]");
    marked.innerHTML = markedHtml(text, res.spans);
    marked.scrollTop = 0;

    const cats = Array.from(new Set(res.spans.map((s) => s.cat)));
    out.querySelector("[data-legend]").innerHTML = cats.map((c) => `<span><i class="key ${CATS[c].cls}"></i>${CATS[c].label}</span>`).join("");

    const flagsEl = out.querySelector("[data-flags]");
    flagsEl.innerHTML = n
      ? res.flags.map((f) => {
        const pips = Math.min(5, Math.max(1, f.weight));
        const found = quotes(text, f.spans).map((q) => `<q>${e(q)}</q>`).join(", ");
        return `<li class="flag" data-rule="${f.rule.id}">
  <i class="key ${CATS[f.rule.cat].cls}" aria-hidden="true"></i>
  <div class="flag__top"><span class="flag__title">${e(f.rule.title)}</span><span class="flag__weight" title="Mức nặng ${pips}/5" aria-label="Mức nặng ${pips} trên 5">${[1, 2, 3, 4, 5].map((i) => `<i${i <= pips ? ' class="is-on"' : ""}></i>`).join("")}</span></div>
  <p class="flag__why">${e(f.rule.why)}</p>
  ${found ? `<p class="flag__found">${CATS[f.rule.cat].label}: ${found}</p>` : ""}
</li>`;
      }).join("")
      : `<li class="flags-empty">Không có dấu hiệu nào trong bộ quy tắc.</li>`;

    const goodsEl = out.querySelector("[data-goods]");
    goodsEl.hidden = !res.goods.length;
    out.querySelector("[data-goods-list]").innerHTML = res.goods
      .map((g) => `<li>${icon("check-circle")}<span><b class="strong">${e(g.rule.title)}.</b> ${e(g.rule.why)}</span></li>`).join("");

    out.querySelector("[data-next-title]").textContent = res.level === "high" ? "Nên làm ngay" : "Nên làm gì tiếp";
    out.querySelector("[data-next]").innerHTML = NEXT[res.level].map((li) => `<li><span>${li}</span></li>`).join("");

    out.hidden = false;
    clipHint(marked);

    const bar = document.querySelector("[data-scam-bar]");
    if (bar) {
      bar.querySelector("[data-bar-value]").textContent = n ? `${verdict.text} · ${n} dấu hiệu` : verdict.text;
      VR.actionbar.ready(bar, true);
    }
  }

  /** the verdict card before (or after clearing) a check: the four groups explained, no level */
  function renderEmpty(root) {
    const risk = root.querySelector("[data-risk]");
    risk.classList.remove("is-low", "is-mid", "is-high");
    risk.querySelector("[data-verdict] span").textContent = "Chưa kiểm tra";
    const fig = risk.querySelector("[data-count-fig]");
    if (fig) fig.hidden = true;
    risk.querySelector("[data-summary]").textContent = "Công cụ tìm bốn nhóm dấu hiệu:";
    risk.querySelectorAll("[data-group]").forEach((row) => { row.classList.remove("is-hit"); row.querySelector("[data-group-n]").textContent = ""; });
    root.querySelector("[data-result]").hidden = true;
    const bar = document.querySelector("[data-scam-bar]");
    if (bar) VR.actionbar.ready(bar, false);
  }

  /* a long paste scrolls inside its box on desktop: fade the bottom edge while more text is below */
  function clipHint(el) {
    el.closest(".scam-text-box").classList.toggle("is-clipped", el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }

  VR.onReady(() => {
    const card = document.querySelector("[data-scam]");
    if (!card) return;
    const root = card.closest(".tool-main") || document;
    const input = card.querySelector("[data-input]");
    const counter = card.querySelector("[data-counter]");
    const result = root.querySelector("[data-result]");
    const verdictCard = root.querySelector("[data-risk]");
    const runBtn = card.querySelector("[data-run]");
    const samples = Array.from(card.querySelectorAll("[data-sample]"));
    let live = false;
    let timer;

    const count = () => { VR.liveCount(counter, VR.fmt.int(input.value.length) + " ký tự"); };
    const reset = () => { live = false; renderEmpty(root); };
    const run = (scroll) => {
      const text = input.value.normalize("NFC").replace(/\r\n?/g, "\n");
      if (text.trim().length < 12) {
        reset();
        if (scroll) { VR.toast(text.trim() ? "Dán thêm nội dung, ít nhất một câu để kiểm tra" : "Dán một tin trước đã", { tone: "info" }); input.focus(); }
        return;
      }
      render(root, text, analyse(text));
      live = true;
      if (scroll) {
        /* beside the field on wide screens; below it on phones: bring the verdict into view */
        const r = verdictCard.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.6 || r.bottom < 80) verdictCard.scrollIntoView({ behavior: VR.reducedMotion ? "auto" : "smooth", block: "start" });
      }
    };
    /* the pill shows its pending state for one beat so a click always reads as "checked" */
    const runFromButton = () => {
      VR.busy(runBtn, true);
      setTimeout(() => { VR.busy(runBtn, false); run(true); }, VR.reducedMotion ? 0 : 160);
    };

    input.addEventListener("input", () => {
      count();
      samples.forEach((b) => b.setAttribute("aria-pressed", "false"));
      if (!live) return;
      clearTimeout(timer);
      timer = setTimeout(() => run(false), 280);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(true); }
    });
    runBtn.addEventListener("click", runFromButton);
    card.querySelector("[data-clear]").addEventListener("click", () => {
      samples.forEach((b) => b.setAttribute("aria-pressed", "false"));
      if (!input.value) { input.focus(); return; }
      input.value = "";
      count();
      reset();
      input.focus();
      VR.toast("Đã xóa nội dung", { tone: "info" });
    });
    samples.forEach((btn) => {
      btn.addEventListener("click", () => {
        input.value = SAMPLES[btn.dataset.sample] || "";
        samples.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
        count();
        runFromButton();
      });
    });
    /* the band's white pill leads to the field: common.js [data-focus-target] */

    const marked = result.querySelector("[data-marked]");
    marked.addEventListener("scroll", () => clipHint(marked), { passive: true });
    window.addEventListener("resize", () => { if (!result.hidden) clipHint(marked); }, { passive: true });

    /* hovering or focusing a flag thickens the underline of its phrases in the text */
    const focusRule = (event) => {
      const flag = event.target.closest(".flag");
      result.querySelectorAll("mark.is-focus").forEach((m) => m.classList.remove("is-focus"));
      if (flag) result.querySelectorAll(`mark[data-rule="${flag.dataset.rule}"]`).forEach((m) => m.classList.add("is-focus"));
    };
    result.addEventListener("pointerover", focusRule);
    result.addEventListener("focusin", focusRule);

    count();
  });

  /* exposed for tests in the browser console */
  VR.scamCheck = analyse;
})();

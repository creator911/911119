import http from "node:http";
import { readFile, writeFile, mkdir, stat, copyFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.ITEMZONE_SESSION_SECRET || "itemzone-local-dev-secret";
const OWNER_USERNAME = process.env.ITEMZONE_OWNER_USERNAME || "kangdow911";
const OWNER_PASSWORD = process.env.ITEMZONE_OWNER_PASSWORD || "change-me-before-run";
const CHARGE_BANK = process.env.ITEMZONE_CHARGE_BANK || "은행명을 입력하세요";
const CHARGE_HOLDER = process.env.ITEMZONE_CHARGE_HOLDER || "예금주를 입력하세요";
const CHARGE_NUMBER = process.env.ITEMZONE_CHARGE_NUMBER || "계좌번호를 입력하세요";
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const DISPLAY_GRADES = ["브론즈", "실버", "골드", "플레티넘", "다이아", "마스터", "챌린저"];
const MEMBER_GRADES = ["브론즈", "실버", "골드", "플레티넘", "다이아"];
const INTERNAL_GRADES = ["내부등급 1", "내부등급 2", "내부등급 3", "내부등급 4", "내부등급 5"];
const ROLES = ["MEMBER", "STAFF", "ADMIN", "OWNER"];
const DEFAULT_NOTICE_POSTS = [
  { noticeNo: 50, pinned: false, title: "[업데이트 안내] 게임머니·아이템·기타 분할거래 기능 추가", date: "2026-04-30T15:40:00+09:00", body: "안녕하세요.\n\n아이템존입니다.\n\n거래 완료를 기다릴 필요 없이 여러 구매자와 동시에 거래가 가능하도록 분할거래 기능이 개선되었습니다.\n\n[기존]\n분할거래는 최초 신청된 거래가 완료되어야 남은 수량이 재등록됩니다.\n\n[변경]\n1. 거래중 상태에서도 남은 수량 자동 재등록\n- 다수의 거래자와 동시에 거래 가능\n\n2. 프리미엄 글 자동 유지\n- 최초 등록된 분할글이 프리미엄 옵션 글일 경우 남은 수량 재등록 시에도 혜택 유지\n\n앞으로도 편리하고 안전한 거래 환경을 제공하겠습니다.\n\n감사합니다." },
  { noticeNo: 49, pinned: false, title: "[당첨자 안내] 서든어택 이벤트 2", date: "2026-04-02T12:00:00+09:00", body: "서든어택 이벤트 당첨자를 안내드립니다.\n\n마이페이지의 고객센터 문의를 통해 지급 정보를 확인해주세요." },
  { noticeNo: 48, pinned: false, title: "[업데이트 안내] 더 빠르고 스마트하게! 아이템존 기능 업데이트 안내 (25.03.18)", date: "2026-03-18T11:30:00+09:00", body: "아이템존 검색, 게임 리스트, 거래글 등록 화면의 편의 기능이 개선되었습니다.\n\n보다 빠른 거래 등록과 확인이 가능합니다." },
  { noticeNo: 47, pinned: false, title: "[업데이트 안내] 일부 UI 변경 및 카카오 간편 로그인 추가 (25.12.31)", date: "2025-12-31T10:00:00+09:00", body: "일부 화면 UI가 개선되었습니다.\n\n간편 로그인 기능은 단계적으로 적용될 예정입니다." },
  { noticeNo: 46, pinned: false, title: "[업데이트 안내] 네이버 간편 로그인 기능 추가 (25.12.24)", date: "2025-12-24T10:00:00+09:00", body: "네이버 계정 기반 간편 로그인 기능을 준비 중입니다.\n\n적용 완료 시 추가 공지로 안내드리겠습니다." },
  { noticeNo: 45, pinned: false, title: "[업데이트 안내] 검색조건 저장·이미지 확대 등 주요 기능 개선 (25.12.03)", date: "2025-12-03T09:30:00+09:00", body: "검색조건 저장, 이미지 확대, 게임별 거래 목록 편의성이 개선되었습니다." },
  { noticeNo: 44, pinned: false, title: "[업데이트 안내] 050 안심번호 / 터치트 등록 이력 확인", date: "2025-11-27T13:20:00+09:00", body: "거래 안전을 위한 안심번호 및 등록 이력 확인 기능을 준비하고 있습니다." },
  { noticeNo: 43, pinned: false, title: "[업데이트 안내] 채팅 UI 개편 및 신규 게임/서버 게시판 추가", date: "2025-11-25T14:10:00+09:00", body: "고객센터 채팅 UI와 신규 게임/서버 게시판이 개선되었습니다." },
  { noticeNo: 42, pinned: false, title: "[장애 안내] Cloudflare(클라우드플레어) 대규모 장애 안내", date: "2025-11-19T16:00:00+09:00", body: "외부 네트워크 장애로 일부 접속이 원활하지 않을 수 있습니다.\n\n이용에 불편을 드려 죄송합니다." },
  { noticeNo: 41, pinned: false, title: "[업데이트 안내] 현금영수증 자동 발급 방식 도입", date: "2025-11-17T10:10:00+09:00", body: "현금영수증 발급 방식이 순차적으로 개선될 예정입니다." },
  { noticeNo: 40, pinned: false, title: "[안내] 아이템존 안전거래 이용 가이드", date: "2025-11-10T09:00:00+09:00", body: "거래 전 상대방 정보와 거래 내용을 반드시 확인해주세요.\n\n안전한 거래 환경을 위해 운영팀이 지속적으로 모니터링합니다." },
  { noticeNo: 39, pinned: false, title: "[점검 안내] 새벽 시스템 안정화 점검", date: "2025-11-03T02:00:00+09:00", body: "새벽 시간대 서비스 안정화 점검이 진행됩니다.\n\n점검 중 일부 기능 이용이 지연될 수 있습니다." },
  { noticeNo: 0, pinned: true, title: "[공지] 아이템·게임머니 최대 수수료 변경 안내", date: "2026-04-10T09:00:00+09:00", body: "아이템 및 게임머니 거래 수수료 정책이 일부 변경됩니다.\n\n변경 내용은 서비스 안정화와 거래 보호 강화를 위한 조치입니다." },
  { noticeNo: 0, pinned: true, title: "[업데이트 안내] 아이템존 기능 업데이트 안내 (25.03.19)", date: "2026-03-19T09:00:00+09:00", body: "아이템존 주요 기능 업데이트 내용을 안내드립니다.\n\n게임 리스트, 마이페이지, 고객센터 화면이 개선되었습니다." },
  { noticeNo: 0, pinned: true, title: "[공지] 아이템존 사칭 피싱 사이트 주의 안내", date: "2026-02-24T09:00:00+09:00", body: "아이템존을 사칭한 피싱 사이트에 주의해주세요.\n\n주소창의 도메인을 반드시 확인하고 의심스러운 링크는 클릭하지 마세요." },
  { noticeNo: 0, pinned: true, title: "[사기 피해 방지] 거래 전 꼭 확인하세요!", date: "2024-12-28T09:00:00+09:00", body: "거래 전 상대방 정보, 거래 품목, 금액을 반드시 확인해주세요.\n\n아이템존 고객센터를 통하지 않은 외부 거래 유도는 피해 위험이 있습니다." }
];

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const slugifyGame = (name = "", index = 0) => {
  const ascii = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ascii.length >= 3 ? ascii : `game-${String(index + 1).padStart(3, "0")}`;
};
const INITIAL_FILTERS = ["\u3131", "\u3131", "\u3134", "\u3137", "\u3137", "\u3139", "\u3141", "\u3142", "\u3142", "\u3145", "\u3145", "\u3147", "\u3148", "\u3148", "\u314a", "\u314b", "\u314c", "\u314d", "\u314e"];
function initialGroupFor(name = "") {
  const first = String(name).trim().codePointAt(0);
  if (!first) return "1~A";
  if (first >= 0xac00 && first <= 0xd7a3) return INITIAL_FILTERS[Math.floor((first - 0xac00) / 588)] || "1~A";
  return /^[0-9a-z]/i.test(String.fromCodePoint(first)) ? "1~A" : "1~A";
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [, salt] = stored.split(":");
  return crypto.timingSafeEqual(Buffer.from(await hashPassword(password, salt)), Buffer.from(stored));
}

async function readDb() {
  try {
    const db = JSON.parse(await readFile(DB_PATH, "utf8"));
    const normalized = normalizeDb(db);
    if (normalized.changed) await writeDb(normalized.db);
    return normalized.db;
  } catch {
    await seedDb();
    return JSON.parse(await readFile(DB_PATH, "utf8"));
  }
}

function normalizeDb(db) {
  let changed = false;
  db.site ||= {};
  db.site.banners ||= [{ title: "메인 배너", subtitle: "", badge: "" }];
  db.site.posts ||= [];
  db.site.notices ||= [];
  db.games = (db.games || []).map((game, index) => {
    const next = { ...game };
    if (!next.slug) {
      next.slug = slugifyGame(next.name, index);
      changed = true;
    }
    if (!next.imageUrl) {
      next.imageUrl = `/assets/games/game-${(index % 8) + 1}.svg`;
      changed = true;
    }
    const initialGroup = initialGroupFor(next.name);
    if (next.initialGroup !== initialGroup) {
      next.initialGroup = initialGroup;
      changed = true;
    }
    return next;
  });
  if (!db.site?.banners?.[0]?.imageUrl) {
    db.site.banners[0].imageUrl = "";
    changed = true;
  }
  const existingTitles = new Set((db.site.posts || []).map((post) => post.title));
  for (const template of DEFAULT_NOTICE_POSTS) {
    if (existingTitles.has(template.title)) continue;
    db.site.posts.push({
      id: id("post"),
      title: template.title,
      body: template.body,
      displayName: "관리자",
      authorId: db.users?.find((u) => u.role === "OWNER")?.id || db.users?.[0]?.id || null,
      pinned: template.pinned,
      noticeNo: template.noticeNo,
      fontFamily: "default",
      fontSize: "16",
      fontWeight: "400",
      createdAt: new Date(template.date).toISOString()
    });
    existingTitles.add(template.title);
    changed = true;
  }
  db.site.posts = (db.site.posts || []).map((post, index) => {
    const next = { ...post };
    if (typeof next.pinned !== "boolean") {
      next.pinned = false;
      changed = true;
    }
    if (!next.displayName) {
      next.displayName = "관리자";
      changed = true;
    }
    if (!next.fontFamily) {
      next.fontFamily = "default";
      changed = true;
    }
    if (!next.fontSize) {
      next.fontSize = "16";
      changed = true;
    }
    if (!next.fontWeight) {
      next.fontWeight = "400";
      changed = true;
    }
    if (next.noticeNo === undefined) {
      next.noticeNo = next.pinned ? 0 : Math.max(1, 50 - index);
      changed = true;
    }
    return next;
  });
  const regularPosts = db.site.posts.filter((post) => !post.pinned).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const regularStartNo = Math.max(50, regularPosts.length);
  regularPosts.forEach((post, index) => {
    const nextNo = regularStartNo - index;
    if (post.noticeNo !== nextNo) {
      post.noticeNo = nextNo;
      changed = true;
    }
  });
  return { db, changed };
}

async function writeDb(db) {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await copyFile(DB_PATH, path.join(DATA_DIR, "db.backup.json"));
    await copyFile(DB_PATH, path.join(DATA_DIR, `db.backup-${Date.now()}.json`));
  } catch {}
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function seedDb() {
  await mkdir(DATA_DIR, { recursive: true });
  const ownerId = id("user");
  const db = {
    users: [
      {
        id: ownerId,
        username: OWNER_USERNAME,
        passwordHash: await hashPassword(OWNER_PASSWORD),
        nickname: "아이템존 오너",
        phone: "010-0000-0000",
        bank: "관리자은행",
        accountNumber: "000-0000-0000",
        displayGrade: "챌린저",
        internalGrade: "내부등급 1",
        role: "OWNER",
        status: "정상",
        points: 0,
        createdAt: now()
      }
    ],
    site: {
      chargeAccount: { bank: CHARGE_BANK, holder: CHARGE_HOLDER, number: CHARGE_NUMBER },
      banners: [
        { title: "메이플스토리 월드", subtitle: "아이템존에서 안전하게 거래하세요", badge: "오픈 기념 혜택" }
      ],
      notices: ["이용약관 및 마일리지 정책 변경 안내", "신규가입 쿠폰 지급 이벤트", "시스템 점검 안내"],
      events: [
        { title: "신규가입 이벤트", text: "가입하고 첫 거래 쿠폰 받기" },
        { title: "피해보상 제도", text: "거래 사고시 보상 접수 지원" },
        { title: "친구초대", text: "초대링크 공유하고 마일리지 받기" },
        { title: "등급 혜택", text: "등급별 수수료와 쿠폰 혜택" }
      ],
      posts: [
        { id: id("post"), title: "아이템존 오픈 안내", body: "안전거래 중심의 게임 거래소 아이템존입니다.", displayName: "아이템존", authorId: ownerId, createdAt: now() }
      ]
    },
    games: [
      ["메이플스토리월드", "🧙", 2591], ["아이온2", "🛡️", 2204], ["리니지2", "⚔️", 3880], ["로스트아크", "🔥", 1785],
      ["던전앤파이터", "💎", 1511], ["피파온라인4", "⚽", 1408], ["서든어택", "🎯", 1335], ["발로란트", "🎮", 1204],
      ["R2", "🗡️", 1155], ["로한", "🌙", 1002]
    ].map((g, index) => ({ id: id("game"), name: g[0], icon: g[1], rank: index + 1, trades: g[2], visible: true, imageUrl: `/assets/games/game-${(index % 8) + 1}.svg` })),
    sellPosts: [],
    buyPosts: [],
    pointRequests: [],
    pointLedger: [],
    chatRooms: [],
    chatMessages: [],
    auditLogs: []
  };
  await writeDb(db);
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((item) => {
    const [key, ...value] = item.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

async function currentUser(req, db) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const [userId, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  if (sig !== expected) return null;
  return db.users.find((u) => u.id === userId) || null;
}

function sessionCookie(userId) {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  return `session=${encodeURIComponent(`${userId}.${sig}`)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`;
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, payload, headers = {}) {
  const isString = typeof payload === "string";
  res.writeHead(status, { "Content-Type": isString ? "text/html; charset=utf-8" : "application/json; charset=utf-8", ...headers });
  res.end(isString ? payload : JSON.stringify(payload));
}

function canStaff(user) {
  return user && ["STAFF", "ADMIN", "OWNER"].includes(user.role);
}

function canAdmin(user) {
  return user && (["ADMIN", "OWNER"].includes(user.role) || user.displayGrade === "마스터");
}

function gradeAsset(grade = "브론즈") {
  const assets = {
    브론즈: "bronze",
    실버: "silver",
    골드: "gold",
    플레티넘: "platinum",
    다이아: "diamond",
    마스터: "master",
    챌린저: "challenger"
  };
  return `/assets/tiers/${assets[grade] || "bronze"}.png`;
}

function protect(user, role) {
  if (role === "member" && !user) return false;
  if (role === "staff" && !canStaff(user)) return false;
  if (role === "admin" && !canAdmin(user)) return false;
  return true;
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function won(value = 0) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function noticePosts(db) {
  return (db.site?.posts || []).slice().sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function noticeDate(value, detail = false) {
  const date = new Date(value || now());
  if (detail) {
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${mi}`;
  }
  return date.toISOString().slice(0, 10);
}

function noticeCreatedAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return now();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? now() : parsed.toISOString();
}

function noticeContentStyle(post = {}) {
  const family = {
    default: "",
    malgun: "'Malgun Gothic', sans-serif",
    serif: "serif",
    mono: "monospace"
  }[post.fontFamily] || "";
  const size = ["14", "16", "18", "20"].includes(String(post.fontSize)) ? post.fontSize : "16";
  const weight = ["400", "600", "700", "800"].includes(String(post.fontWeight)) ? post.fontWeight : "400";
  return `${family ? `font-family:${family};` : ""}font-size:${size}px;font-weight:${weight};`;
}

function noticeBodyHtml(body = "") {
  const raw = String(body || "");
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeNoticeHtml(raw);
  return esc(raw).split(/\n{2,}/).map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`).join("");
}

function sanitizeNoticeHtml(html = "") {
  const allowedTags = new Set(["p", "div", "br", "b", "strong", "i", "em", "u", "span", "img"]);
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag, attrs = "") => {
      const name = tag.toLowerCase();
      if (!allowedTags.has(name)) return "";
      if (match.startsWith("</")) return name === "img" || name === "br" ? "" : `</${name}>`;
      if (name === "br") return "<br>";
      if (name === "img") {
        const src = attrs.match(/\ssrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const value = src?.[1] || src?.[2] || src?.[3] || "";
        if (!/^(data:image\/(?:png|jpe?g|gif|webp);base64,|\/assets\/|https?:\/\/)/i.test(value)) return "";
        return `<img src="${esc(value)}" alt="">`;
      }
      if (name === "span") {
        const style = attrs.match(/\sstyle=(?:"([^"]*)"|'([^']*)')/i);
        const safe = [];
        const text = style?.[1] || style?.[2] || "";
        const fontSize = text.match(/font-size\s*:\s*(1[2-9]|2[0-8])px/i);
        const fontWeight = text.match(/font-weight\s*:\s*(400|500|600|700|800|900)/i);
        const fontFamily = text.match(/font-family\s*:\s*([^;"']+)/i);
        if (fontSize) safe.push(`font-size:${fontSize[1]}px`);
        if (fontWeight) safe.push(`font-weight:${fontWeight[1]}`);
        if (fontFamily && /^[a-zA-Z0-9가-힣 ,_-]+$/.test(fontFamily[1])) safe.push(`font-family:${fontFamily[1].trim()}`);
        return safe.length ? `<span style="${safe.join(";")}">` : "<span>";
      }
      return `<${name}>`;
    });
}

function tradeCollection(db, type) {
  return type === "sell" ? db.sellPosts || [] : db.buyPosts || [];
}

function allTrades(db) {
  return [...(db.sellPosts || []).map((post) => ({ ...post, type: "sell" })), ...(db.buyPosts || []).map((post) => ({ ...post, type: "buy" }))];
}

function tradeKindLabel(kind = "캐릭터") {
  return ["캐릭터", "게임머니", "아이템", "기타"].includes(kind) ? kind : "캐릭터";
}

function gameTradeCount(db, game) {
  return allTrades(db).filter((post) => post.gameSlug === game.slug || post.gameName === game.name || post.game === game.name).length;
}

function gameImage(game) {
  if (game?.localImageUrl?.startsWith("/")) {
    const rel = game.localImageUrl.replace(/^\/+/, "");
    const direct = path.join(PUBLIC_DIR, rel);
    if (existsSync(direct)) return game.localImageUrl;
    const parsed = path.parse(rel);
    for (const ext of [".jpg", ".png", ".webp", ".svg"]) {
      const candidateRel = path.join(parsed.dir, `${parsed.name}${ext}`).replaceAll("\\", "/");
      if (existsSync(path.join(PUBLIC_DIR, candidateRel))) return `/${candidateRel}`;
    }
  }
  return game?.imageUrl || game?.localImageUrl || "/assets/games/game-1.svg";
}

function gameThemeStyle(game) {
  const palettes = [
    ["#075bd5", "#18a0fb", "#eef6ff"],
    ["#7c3aed", "#f43f5e", "#f7f2ff"],
    ["#0f766e", "#22c55e", "#eefdf7"],
    ["#b45309", "#f97316", "#fff7ed"],
    ["#1f2937", "#64748b", "#f8fafc"]
  ];
  const seed = String(game?.slug || game?.name || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [accent, accent2, tint] = palettes[seed % palettes.length];
  return `style="--game-accent:${accent};--game-accent-2:${accent2};--game-tint:${tint};"`;
}

function gameServerList(game) {
  const fromDb = Array.isArray(game?.servers) ? game.servers.filter((server) => server && !/^\?+$/.test(String(server))) : [];
  const fallback = ["서버전체", "제니스", "크로아", "데스피아", "RED", "버닝", "버닝2", "오로라", "기타", "메모리아", "아리스", "글로벌[GMS]"];
  return [...new Set(fromDb.length ? ["서버전체", ...fromDb] : fallback)];
}

function gameTradeKinds(game) {
  const kinds = Array.isArray(game?.tradeMeta?.tradeKinds) ? game.tradeMeta.tradeKinds : [];
  const safe = kinds.filter((kind) => ["캐릭터", "게임머니", "아이템", "기타"].includes(kind));
  return safe.length ? safe : ["캐릭터", "게임머니", "아이템", "기타"];
}

function gameFilterList(game) {
  return Array.isArray(game?.tradeMeta?.filters) ? game.tradeMeta.filters.filter((filter) => filter?.label && Array.isArray(filter.values) && filter.values.length) : [];
}

function gamePriceRanges(game) {
  const ranges = Array.isArray(game?.tradeMeta?.priceRanges) ? game.tradeMeta.priceRanges : [];
  return ranges.length ? ranges : [
    { from: 0, to: 100, label: "~100만원" },
    { from: 100, to: 200, label: "~200만원" },
    { from: 200, to: 500, label: "~500만원" },
    { from: 500, to: 0, label: "500만원~" }
  ];
}

function marketControlPanel(game, selected = {}) {
  const side = selected.side || "all";
  const kind = selected.kind || "all";
  const server = selected.server || "서버전체";
  const filterValues = selected.filters || {};
  const sideTabs = [["all", "전체"], ["sell", "팝니다"], ["buy", "삽니다"]];
  const kinds = ["전체", ...gameTradeKinds(game)];
  const servers = gameServerList(game);
  const panelHref = (next = {}) => {
    const params = new URLSearchParams();
    params.set("side", next.side || side);
    params.set("kind", next.kind || kind);
    params.set("server", next.server || server);
    const nextFilters = { ...filterValues, ...(next.filters || {}) };
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `?${params.toString()}`;
  };
  const extraFilters = gameFilterList(game).map((filter, filterIndex) => {
    const key = `f${filterIndex}`;
    const selectedValue = filterValues[key] || filter.values[0];
    return `<div class="market-panel__row"><b>${esc(filter.label)}</b><div>${filter.values.slice(0, 48).map((item, index) => `<a class="${item === selectedValue || (!filterValues[key] && index === 0) ? "active-soft" : ""}" href="${panelHref({ filters: { [key]: item } })}">${esc(item)}</a>`).join("")}</div></div>`;
  }).join("");
  const priceButtons = gamePriceRanges(game).map((range) => `<button type="button" data-price-from="${Number(range.from || 0)}" data-price-to="${Number(range.to || 0)}">${esc(range.label)}</button>`).join("");
  return `<section class="market-panel" ${gameThemeStyle(game)}>
    <div class="market-panel__tabs">${kinds.map((item) => {
      const value = item === "전체" ? "all" : item;
      return `<a class="${kind === value ? "active" : ""}" href="${panelHref({ kind: value })}">${esc(item)}</a>`;
    }).join("")}</div>
    <div class="market-panel__row"><b>구분</b><div>${sideTabs.map(([value, label]) => `<a class="${side === value ? "active" : ""}" href="${panelHref({ side: value })}">${label}</a>`).join("")}</div></div>
    <div class="market-panel__row"><b>서버</b><div>${servers.map((item) => `<a class="${item === server ? "active" : ""}" href="${panelHref({ server: item })}">${esc(item)}</a>`).join("")}</div></div>
    <div class="market-panel__row"><b>분류</b><div>${kinds.map((item) => {
      const value = item === "전체" ? "all" : item;
      return `<a class="${kind === value ? "active" : ""}" href="${panelHref({ kind: value })}">${item}</a>`;
    }).join("")}</div></div>
    ${extraFilters}
    <div class="market-panel__row market-panel__price"><b>가격</b><div><span>직접입력</span><input value="0" readonly><small>만원</small><i>-</i><input value="0" readonly><small>만원</small>${priceButtons}</div></div>
    <div class="market-panel__row market-panel__search"><b>제목+내용</b><div><input placeholder="검색어를 입력해주세요."><button type="button" aria-label="검색">⌕</button></div></div>
  </section>`;
}

function tradeComposePage(user, type, db, selectedSlug = "") {
  const sell = type === "sell";
  const games = (db.games || []).filter((game) => game.visible !== false);
  const selectedGame = games.find((game) => game.slug === selectedSlug) || games[0] || {};
  const gameOptions = games.map((game) => `<option value="${esc(game.slug)}" ${game.slug === selectedGame.slug ? "selected" : ""}>${esc(game.name)}</option>`).join("");
  const servers = gameServerList(selectedGame);
  const tradeKinds = gameTradeKinds(selectedGame);
  const sellUnits = gameFilterList(selectedGame).find((filter) => filter.label === "판매 단위")?.values || ["일반", "분할"];
  const title = sell ? "판매등록" : "구매등록";
  return layout(title, user, `<main class="trade-compose-page" ${gameThemeStyle(selectedGame)}>
    <form class="trade-compose" data-form="${sell ? "sell" : "buy"}">
      <section class="trade-compose__hero">
        <img src="${gameImage(selectedGame)}" alt="">
        <div><p>${sell ? "판매할 게임 자산을 등록합니다" : "구매하고 싶은 조건을 등록합니다"}</p><h1>${title}</h1><span>${esc(selectedGame.name || "게임 선택")}</span></div>
        <a href="/games/${encodeURIComponent(selectedGame.slug || "")}">거래목록</a>
      </section>
      <section class="trade-compose__body">
        <div class="compose-field full">
          <b>게임</b>
          <select name="gameSlug" required>${gameOptions}</select>
        </div>
        <div class="compose-field full">
          <b>구분</b>
          <div class="segmented">${tradeKinds.map((item, index) => `<label><input type="radio" name="tradeKind" value="${item}" ${index === 0 ? "checked" : ""}><span>${item}</span></label>`).join("")}</div>
        </div>
        <div class="compose-field full">
          <b>서버</b>
          <div class="chip-grid">${servers.map((item, index) => `<label><input type="radio" name="server" value="${esc(item)}" ${index === 0 ? "checked" : ""}><span>${esc(item)}</span></label>`).join("")}</div>
        </div>
        <div class="compose-field">
          <b>판매 단위</b>
          <div class="segmented compact">${sellUnits.map((item, index) => `<label><input type="radio" name="unit" value="${esc(item)}" ${index === 0 ? "checked" : ""}><span>${esc(item)}</span></label>`).join("")}</div>
        </div>
        <div class="compose-field">
          <b>가격</b>
          <div class="price-entry"><input name="price" type="number" min="0" step="1000" placeholder="${sell ? "판매 가격" : "희망 가격"}" required><span>원</span></div>
          <div class="price-presets"><button type="button" data-price-preset="1000000">100만원</button><button type="button" data-price-preset="2000000">200만원</button><button type="button" data-price-preset="5000000">500만원</button><button type="button" data-price-preset="10000000">1000만원</button></div>
        </div>
        <div class="compose-field">
          <b>캐릭터/수량</b>
          <input name="characterName" placeholder="캐릭터명 또는 품목명">
          <input name="quantity" type="number" min="1" step="1" placeholder="수량">
        </div>
        <div class="compose-field full">
          <b>제목</b>
          <input name="title" placeholder="제목을 입력해주세요." required>
        </div>
        <div class="compose-field full">
          <b>내용</b>
          <textarea name="description" placeholder="거래 조건, 연락 가능 시간, 확인이 필요한 정보를 적어주세요."></textarea>
        </div>
        <div class="compose-field full">
          <b>첨부/메모</b>
          <input name="imageUrl" placeholder="이미지 URL">
          <input name="memo" placeholder="관리용 메모 또는 거래 참고사항">
        </div>
      </section>
      <section class="trade-compose__actions"><a href="/games">취소</a><button>${sell ? "판매글 등록" : "구매글 등록"}</button><p class="form-message"></p></section>
    </form>
  </main>${chatWidget(user)}`, "trade");
}

function layout(title, user, content, page = "home") {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - 아이템존</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body data-page="${page}" data-user="${user ? user.id : ""}" data-role="${user ? user.role : ""}">
  ${header(user)}
  ${content}
  <script src="/app.js" defer></script>
</body>
</html>`;
}

function header(user) {
  const menu = [
    ["/sell", "판매등록", "sell"],
    ["/buy", "구매등록", "buy"],
    ["/games", "게임 리스트", "games"],
    ["/mypage", "마이페이지", "mypage"],
    ["/charge", "마일리지충전", "charge"],
    ["/withdraw", "마일리지출금", "withdraw"],
    ["/support", "고객센터", "support"]
  ].map(([href, label, key]) => `<a class="nav-link" data-nav="${key}" href="${href}" ${key === "support" ? "data-open-chat" : ""}>${label}</a>`).join("");
  return `<header class="topbar">
    <div class="top-inner">
      <a class="brand" href="/" aria-label="아이템존 홈"><img src="/assets/logo/itemzone-logo.png" alt="아이템존"></a>
      <form class="search">
        <div class="deal-toggle" aria-label="거래 유형">
          <label><input type="radio" name="deal" checked><span>팝니다</span></label>
          <label><input type="radio" name="deal"><span>삽니다</span></label>
        </div>
        <div class="search-field">
          <input id="globalSearch" placeholder="게임명 또는 물품명을 검색하세요" autocomplete="off">
          <div class="suggest-panel">
            <b>추천 검색어</b>
            <span>메이플스토리월드</span><span>리니지2</span><span>아이온2</span><span>로스트아크</span>
          </div>
        </div>
        <button class="search-icon" type="button" aria-label="검색"><img src="/assets/header/search-icon.png" alt=""></button>
      </form>
      <nav class="account">
        ${user ? `<b>${user.nickname}</b><span>${user.displayGrade}</span><a href="/mypage">마이페이지</a><button data-action="logout">로그아웃</button>` : `<a class="account-image-link" href="/login" aria-label="로그인"><img src="/assets/header/login-button.png" alt="로그인"></a><a class="account-image-link" href="/signup" aria-label="회원가입"><img src="/assets/header/signup-button.png" alt="회원가입"></a>`}
        ${canAdmin(user) ? `<a href="/admin">관리자</a>` : ""}
        ${canStaff(user) ? `<a href="/staff">상담사</a>` : ""}
      </nav>
    </div>
    <nav class="main-menu">${menu}</nav>
  </header>`;
}

function homePage(user, db) {
  const banner = db.site.banners[0];
  const rankSpecs = [
    ["메이플스토리월드", "-"],
    ["컴투스프로야구V26", "-"],
    ["메이플스토리", "-"],
    ["서든어택", "▲ 1"],
    ["명조 : 워더링웨이브", "▼ 1"],
    ["MLB 9이닝스 라이벌", "▲ 1"],
    ["리니지 클래식", "▲ 3"],
    ["이환", "▲ 1"],
    ["로스트아크", "▼ 1"],
    ["피파온라인4", "▲ 1"],
    ["아이온2", "▲ 1"],
    ["세븐나이츠 리버스", "▼ 6"],
    ["메이플키우기", "▲ 1"],
    ["배틀그라운드(배그)", "▼ 1"],
    ["붕괴: 스타레일", "▲ 1"],
    ["던전앤파이터", "▲ 3"],
    ["발로란트", "▲ 1"],
    ["리그오브레전드", "▼ 3"],
    ["원신", "NEW"],
    ["승리의 여신: 니케", "-"]
  ];
  const rankingGames = rankSpecs.map(([name, trend]) => {
    const game = (db.games || []).find((item) => item.name === name);
    return [name, game?.imageUrl || game?.localImageUrl || "/assets/games/game-1.svg", trend, game?.slug || ""];
  });
  const rankRows = rankingGames.map(([name, imageUrl, trend, slug], index) => `<li><a href="${slug ? `/games/${encodeURIComponent(slug)}` : "/games"}"><span>${index + 1}</span><img src="${imageUrl}" alt=""><b>${esc(name)}</b><em class="${String(trend).startsWith("▲") ? "up" : String(trend).startsWith("▼") ? "down" : String(trend) === "NEW" ? "new" : ""}">${trend}</em></a></li>`).join("");
  const featuredGames = [
    { name: "리니지 클래식", thumbUrl: "/assets/itembay-pairs/game-1-thumb.webp", wideUrl: "/assets/itembay-pairs/game-1-wide.webp", trades: 4320, recent: 9740 },
    { name: "아이온2", thumbUrl: "/assets/itembay-pairs/game-2-thumb.webp", wideUrl: "/assets/itembay-pairs/game-2-wide.webp", trades: 3829, recent: 3043 },
    { name: "R2", thumbUrl: "/assets/itembay-pairs/game-3-thumb.webp", wideUrl: "/assets/itembay-pairs/game-3-wide.webp", trades: 1472, recent: 2103 },
    { name: "라그나로크", thumbUrl: "/assets/itembay-pairs/game-4-thumb.webp", wideUrl: "/assets/itembay-games/itembay-game-1.webp", trades: 482, recent: 927 },
    { name: "뮤", thumbUrl: "/assets/itembay-pairs/game-5-thumb.webp", wideUrl: "/assets/itembay-pairs/game-5-wide.webp", trades: 3482, recent: 1241 },
    { name: "리니지2", thumbUrl: "/assets/itembay-pairs/game-6-thumb.webp", wideUrl: "/assets/itembay-pairs/game-6-wide.webp", trades: 2284, recent: 3302 },
    { name: "로한", thumbUrl: "/assets/itembay-pairs/game-7-thumb.webp", wideUrl: "/assets/itembay-pairs/game-7-wide.webp", trades: 321, recent: 249 },
    { name: "로스트아크", thumbUrl: "/assets/itembay-pairs/game-8-thumb.webp", wideUrl: "/assets/itembay-pairs/game-8-wide.webp", trades: 927, recent: 1138, active: true }
  ];
  const hotGames = featuredGames.map((g) => {
    const cls = g.active ? "game-card active" : "game-card";
    return `<article class="${cls}" tabindex="0"><img class="game-thumb" src="${g.thumbUrl}" alt="${g.name}"><img class="game-wide" src="${g.wideUrl}" alt=""><div><strong>${g.name}</strong><b>${g.trades.toLocaleString()}건</b><small>최근 ${g.recent.toLocaleString()}건의 거래</small></div></article>`;
  }).join("");
  const notices = noticePosts(db).filter((post) => !post.pinned).slice(0, 5).map((post) => `<li><a href="/notices/${encodeURIComponent(post.id)}">${esc(post.title)}</a></li>`).join("");
  const points = Number(user?.points || 0).toLocaleString();
  const displayGrade = user?.displayGrade || "브론즈";
  const quickPanel = user ? `<div class="member-summary">
          <div class="member-tier">
            <img class="tier-badge" src="${gradeAsset(displayGrade)}" alt="${displayGrade}">
            <div class="member-grade-row"><strong>${displayGrade} 등급</strong><b>${user.nickname}</b></div>
          </div>
          <p><span>마일리지</span><b class="blue">${points}원</b></p>
          <p><span>판매중</span><b class="blue">0개</b></p>
          <p><span>구매중</span><b class="green">0개</b></p>
          <p><span>구매대기</span><b class="orange">0개</b></p>
        </div>
        <nav class="quick-actions">
          <a href="/charge"><img src="/assets/quick/point-charge.png" alt=""><span>충전</span></a>
          <a href="/withdraw"><img src="/assets/quick/point-withdraw.png" alt=""><span>출금</span></a>
          <a href="/support" data-open-chat><img src="/assets/quick/support-agent.png" alt=""><span>상담사<br>연결</span></a>
        </nav>` : `<form class="home-login" data-form="login">
          <h2>안전한 게임 거래의 시작</h2>
          <label>아이디<input name="username" placeholder="아이디를 입력하세요" required></label>
          <label>비밀번호<input name="password" type="password" placeholder="비밀번호를 입력하세요" required></label>
          <div class="login-row"><label class="auto-login"><input type="checkbox" name="autoLogin"> 자동로그인</label><a href="/support">아이디/비밀번호 찾기</a></div>
          <button>로그인</button>
          <p>아직 계정이 없으신가요? <a href="/signup">회원가입</a></p>
          <span class="form-message"></span>
        </form>`;
  return layout("홈", user, `<main>
    <section class="hero-wrap">
      <div class="hero-banner">
        <img class="hero-banner-image" src="/assets/banners/top-main-banner.png" alt="리니지 클래식 거래수수료 무료">
        <div class="banner-dots"><i class="active"></i><i></i><i></i><i></i></div>
      </div>
    </section>
    <section class="dashboard">
      <article class="rank-panel"><h2>실시간 검색어 순위</h2><ol>${rankRows}</ol></article>
      <aside class="quick-grid">
        ${quickPanel}
      </aside>
    </section>
    <section class="hot-section"><div class="section-inner"><h2>지금 가장 많이 거래되는 게임</h2><div class="hot-games">${hotGames}</div></div></section>
    <section class="content-grid">
      <article class="notice-card"><h2><a href="/notices">공지사항</a></h2><ul>${notices}</ul></article>
      <article class="ad-placeholder"><img src="/assets/banners/side-ad.png" alt="내 마일리지 안전 보존"></article>
    </section>
    ${chatWidget(user)}
    <footer class="site-footer">
      <nav><a href="https://www.gamemarket.kr/page/terms?t=s">이용약관</a><a href="https://www.gamemarket.kr/page/terms?t=t">아이템거래약관</a><a href="https://www.gamemarket.kr/page/terms?t=p">개인정보취급방침</a><a href="/support" data-open-chat>광고/제휴문의</a></nav>
      <div class="footer-body">
        <img src="/assets/logo/itemzone-logo-footer.png" alt="아이템존">
        <div>
          <p>상호 : 겜마톡 / 대표 : 유지훈 / 사업자등록번호 : 807-16-01721 / 통신판매업 : 2024-전주덕진-0100 / 사업자번호 : 807-16-01721</p>
          <p>전라북도 전주시 덕진구 가재미로 83(인후동1가)</p>
          <p>겜마톡은 통신판매중개자이며 통신판매의 당사자가 아닙니다. 따라서 겜마톡은 상품 거래정보 및 거래에 대하여 책임을 지지 않습니다.</p>
          <p>COPYRIGHT (C) GAME MARKET. ALL RIGHTS RESERVED.</p>
        </div>
      </div>
    </footer>
  </main>`, "home");
}

function authPage(user, mode) {
  const isSignup = mode === "signup";
  const signupFields = `<section class="register-container itemzone-register">
    <div id="register-wrap">
      <form class="register-form" data-form="signup">
        <div class="input-wrap">
          <div class="title">아이디</div>
          <div class="availability-row">
            <input name="username" autocomplete="username" required>
            <span class="availability-status" data-availability="username">입력 대기</span>
          </div>
          <div class="desc">영문 소문자, 숫자 조합으로 최소 4자 이상 입력해주세요.</div>
        </div>
        <div class="input-wrap">
          <div class="title">패스워드</div>
          <input name="password" type="password" autocomplete="new-password" required>
          <div class="desc">8자 이상, 영문 소문자와 숫자를 반드시 조합해주세요.</div>
        </div>
        <div class="input-wrap">
          <div class="title">패스워드 재확인</div>
          <input name="passwordConfirm" type="password" autocomplete="new-password" required>
          <div class="desc" data-password-match>패스워드를 한 번 더 입력해주세요.</div>
        </div>
        <div class="input-wrap">
          <div class="title">닉네임</div>
          <div class="availability-row">
            <input name="nickname" required>
            <span class="availability-status" data-availability="nickname">입력 대기</span>
          </div>
        </div>
        <div class="input-wrap">
          <div class="title">이름</div>
          <input name="realName" required>
          <div class="desc">실명이 아닌 경우 출금 처리 시 확인이 지연될 수 있습니다.</div>
        </div>
        <div class="input-wrap">
          <div class="title">핸드폰 번호</div>
          <div class="phone-wrap">
            <select name="phoneCarrier" required>
              <option value="">통신사</option>
              <option value="SKT">SKT</option>
              <option value="KT">KT</option>
              <option value="LGU+">LGU+</option>
              <option value="SKT 알뜰폰">SKT 알뜰폰</option>
              <option value="KT 알뜰폰">KT 알뜰폰</option>
              <option value="LGU+ 알뜰폰">LGU+ 알뜰폰</option>
            </select>
            <input name="phonePrefix" value="010" readonly aria-label="휴대폰 앞자리">
            <input name="phoneMid" inputmode="numeric" maxlength="4" placeholder="0000" required>
            <input name="phoneLast" inputmode="numeric" maxlength="4" placeholder="0000" required>
          </div>
        </div>
        <div class="input-wrap register-actions">
          <button id="register-btn" type="submit">회원가입</button>
          <a class="button" id="go-back" href="/">회원가입 취소</a>
        </div>
        <p class="form-message"></p>
      </form>
    </div>
  </section>`;
  return layout(isSignup ? "회원가입" : "로그인", user, `<main class="auth-page">
    ${isSignup ? signupFields : `<form class="panel auth-form" data-form="${mode}">
      <h1>${isSignup ? "회원가입" : "로그인"}</h1>
      <input name="username" placeholder="아이디" required>
      <input name="password" type="password" placeholder="비밀번호" required>
      <div class="auth-links"><a href="/support" data-open-chat>아이디/비밀번호 찾기</a></div>
      <button>${isSignup ? "가입하기" : "로그인"}</button>
      <p class="auth-join">아직 계정이 없으신가요? <a href="/signup">회원가입</a></p>
      <p class="form-message"></p>
    </form>`}
  </main>`, "auth");
}

function gamesPage(user, db, group = "전체") {
  const groups = ["전체", "ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ", "1~A"];
  const selected = groups.includes(group) ? group : "전체";
  const games = (db.games || []).filter((game) => game.visible !== false && (selected === "전체" || game.initialGroup === selected));
  const groupTabs = groups.map((item) => `<a class="${item === selected ? "active" : ""}" href="/games?group=${encodeURIComponent(item)}">${item}</a>`).join("");
  const cards = games.map((game) => `<a class="game-list-card" href="/games/${encodeURIComponent(game.slug)}">
    <img src="${game.imageUrl || game.localImageUrl || "/assets/games/game-1.svg"}" alt="">
    <span>${esc(game.name)}</span>
  </a>`).join("");
  return layout("게임 리스트", user, `<main class="games-page">
    <section class="games-shell">
      <nav class="games-filter" aria-label="초성 필터">${groupTabs}</nav>
      <section class="games-grid">${cards || "<p class='empty'>해당 초성의 게임이 없습니다.</p>"}</section>
    </section>
    ${chatWidget(user)}
  </main>`, "games");
}

function gameDetailPage(user, db, slug, filters = {}) {
  const game = (db.games || []).find((item) => item.slug === slug);
  if (!game) return layout("게임 없음", user, "<main class='panel'><h1>게임을 찾을 수 없습니다.</h1></main>", "games");
  const side = ["all", "sell", "buy"].includes(filters.side) ? filters.side : "all";
  const availableKinds = gameTradeKinds(game);
  const kind = ["all", ...availableKinds].includes(filters.kind) ? filters.kind : "all";
  const server = filters.server || "서버전체";
  const extraFilters = filters.filters || {};
  const posts = allTrades(db).filter((post) => (post.gameSlug === game.slug || post.gameName === game.name || post.game === game.name) && (side === "all" || post.type === side) && (kind === "all" || tradeKindLabel(post.tradeKind || post.category) === kind) && (server === "서버전체" || (post.server || "서버전체") === server)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const filterHref = (nextSide, nextKind) => {
    const params = new URLSearchParams();
    params.set("side", nextSide);
    params.set("kind", nextKind);
    params.set("server", server);
    Object.entries(extraFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `/games/${encodeURIComponent(game.slug)}?${params.toString()}`;
  };
  const postCards = posts.map((post) => renderTradeCard(post, db)).join("");
  return layout(game.name, user, `<main class="game-detail-page" ${gameThemeStyle(game)}>
    <section class="game-detail-hero">
      <img src="${gameImage(game)}" alt="">
      <div><p>게임별 통합 거래</p><h1>${esc(game.name)}</h1><span>${posts.length}개의 거래글</span></div>
      <nav><a class="sell" href="/sell?game=${encodeURIComponent(game.slug)}">판매등록</a><a class="buy" href="/buy?game=${encodeURIComponent(game.slug)}">구매등록</a></nav>
    </section>
    <section class="trade-board">
      ${marketControlPanel(game, { side, kind, server, filters: extraFilters })}
      <div class="trade-filter">
        ${["all", "sell", "buy"].map((item) => `<a class="${side === item ? "active" : ""}" href="${filterHref(item, kind)}">${item === "all" ? "전체" : item === "sell" ? "판매글" : "구매글"}</a>`).join("")}
        ${["all", ...availableKinds].map((item) => `<a class="${kind === item ? "active" : ""}" href="${filterHref(side, item)}">${item === "all" ? "전체유형" : item}</a>`).join("")}
      </div>
      <div class="trade-list">${postCards || "<p class='empty'>아직 등록된 거래글이 없습니다.</p>"}</div>
    </section>
    ${chatWidget(user)}
  </main>`, "games");
}

function renderTradeCard(post, db, owner = false) {
  const member = db.users?.find((user) => user.id === post.userId);
  const sideLabel = post.type === "sell" ? "판매" : "구매";
  const statusOptions = post.type === "sell" ? ["판매중", "판매완료", "숨김"] : ["구매중", "구매완료", "숨김"];
  return `<article class="trade-card">
    <div class="trade-card__meta"><span class="${post.type}">${sideLabel}</span><b>${esc(tradeKindLabel(post.tradeKind || post.category))}</b><b>${esc(post.unit || "일반")}</b><em>${esc(post.status || "-")}</em></div>
    <h3>${esc(post.title)}</h3>
    <p>${esc(post.gameName || post.game)} · ${esc(post.server || "서버전체")}</p>
    <strong>${won(post.price)}</strong>
    <small>${esc(member?.nickname || "회원")} · ${new Date(post.createdAt).toLocaleDateString("ko-KR")}</small>
    ${owner ? `<label class="status-update">상태<select data-trade-status="${esc(post.id)}" data-trade-type="${post.type}">${statusOptions.map((status) => `<option ${status === post.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>` : ""}
  </article>`;
}

function registerPage(user, type, db, selectedSlug = "") {
  return tradeComposePage(user, type, db, selectedSlug);
  const sell = type === "sell";
  const gameOptions = (db.games || []).filter((game) => game.visible !== false).map((game) => `<option value="${esc(game.slug)}" ${game.slug === selectedSlug ? "selected" : ""}>${esc(game.name)}</option>`).join("");
  return layout(sell ? "판매등록" : "구매등록", user, `<main class="form-page">
    <form class="panel trade-form" data-form="${sell ? "sell" : "buy"}">
      <h1>${sell ? "판매등록" : "구매등록"}</h1>
      <label>게임 선택<select name="gameSlug" required>${gameOptions}</select></label>
      <input name="server" placeholder="서버">
      <select name="tradeKind"><option>캐릭터</option><option>게임머니</option></select>
      <input name="title" placeholder="제목" required>
      <textarea name="description" placeholder="상세 설명"></textarea>
      <input name="price" type="number" placeholder="${sell ? "판매 가격" : "희망 가격"}" required>
      <input name="memo" placeholder="연락/거래 메모">
      <input name="imageUrl" placeholder="이미지 URL">
      <button>${sell ? "판매글 등록" : "구매글 등록"}</button>
      <p class="form-message"></p>
    </form>
  </main>${chatWidget(user)}`, "trade");
}

function pointPage(user, db, type) {
  const charge = type === "charge";
  const balance = Number(user?.points || 0);
  const presets = charge ? [["10000", "+1만"], ["50000", "+5만"], ["100000", "+10만"], ["1000000", "+100만"]] : [["50000", "5만"], ["100000", "10만"], ["1000000", "100만"], [String(balance), "전액"]];
  return layout(charge ? "마일리지충전" : "마일리지출금", user, `<main class="mileage-page ${charge ? "charge-page" : "withdraw-page"}">
    <section class="mileage-info-panel">
      <h1>${charge ? "충전전용계좌" : "본인 계좌 출금"}</h1>
      <div class="mileage-feature-grid">
        <article><i>₩</i><span>마일리지 종류</span><b>${charge ? "출금가능 마일리지" : "일반 마일리지"}</b></article>
        <article><i>%</i><span>${charge ? "충전 수수료" : "출금 수수료"}</span><b>${charge ? "1,000원<br><small>(50,000원 이상 충전시 무료)</small>" : "0원"}</b></article>
        <article><i>↯</i><span>소요 시간</span><b>${charge ? "5분이내" : "30분 이내"}</b></article>
      </div>
      ${charge ? `<ul class="mileage-guide">
        <li>충전 신청 후, 기재된 입금 계좌로 3시간내 입금해주세요.</li>
        <li>충전 신청 금액과 입금 금액은 동일해야 합니다.</li>
        <li>회원명과 입금자명이 동일해야 빠르게 확인됩니다.</li>
        <li>운영진 확인 후 회원님의 아이템존 계정으로 마일리지가 충전됩니다.</li>
      </ul>` : `<ul class="mileage-guide withdraw-guide">
        <li><b>안내사항</b></li>
        <li>23:40 ~ 02:00까지 은행 점검 시간으로 출금이 지연될 수 있습니다.</li>
        <li>출금 신청 후 30분 이내 처리됩니다.</li>
        <li>아이템존 회원명, 은행 예금주명이 다른 경우 출금이 불가합니다.</li>
        <li>반드시 회원정보에 가입한 은행, 계좌번호, 예금주명을 확인해 주세요.</li>
        <li>[출금 가능 마일리지]는 거래에 사용중인 마일리지, 출금 요청중인 마일리지를 제외한 마일리지입니다.</li>
        <li>최소 출금금액은 2,000원 이상입니다. (100원 단위로 입력해주세요.)</li>
      </ul>`}
    </section>
    <aside class="mileage-request-panel">
      <form class="mileage-form" data-form="${type}" data-balance="${balance}">
        <h2>${charge ? "결제 상품" : "보유 마일리지"}</h2>
        ${charge ? `<h3>충전전용계좌 충전</h3>` : `<div class="mileage-balance-box"><p><span>출금 불가 마일리지</span><b>0원</b></p><p><span>팜크레딧</span><b>0원</b></p><p><span>출금 가능 마일리지</span><b>${won(balance)}</b></p></div>`}
        <label>${charge ? "충전 신청 금액" : "출금 신청 금액"} ${!charge ? "<small>회원명/예금주명 동일</small>" : ""}<input name="amount" type="number" min="${charge ? "1000" : "2000"}" step="1000" placeholder="${charge ? "" : "최소 2,000원 이상 입력"}" required></label>
        <div class="amount-presets">${presets.map(([value, label]) => `<button type="button" data-point-amount="${esc(value)}">${esc(label)}</button>`).join("")}</div>
        <dl class="mileage-summary">
          ${charge ? `<dt>보유 마일리지</dt><dd>${won(balance)}</dd>` : ""}
          <dt>${charge ? "충전 신청 금액" : "출금 신청 금액"}</dt><dd data-point-summary="amount">0원</dd>
          <dt>${charge ? "충전 수수료" : "출금 수수료"}</dt><dd data-point-summary="fee">0원</dd>
          <dt>${charge ? "총 충전 금액" : "총 출금 금액"}</dt><dd data-point-summary="total">0원</dd>
        </dl>
        <button class="mileage-submit" ${!charge && balance <= 0 ? "disabled" : ""}>${charge ? "충전 신청" : "출금 신청"}</button>
        <p class="form-message"></p>
      </form>
    </aside>
    ${chatWidget(user)}
  </main>`, "point");
}

function myPage(user, db) {
  const sellPosts = (db.sellPosts || []).filter((post) => post.userId === user.id).map((post) => ({ ...post, type: "sell" }));
  const buyPosts = (db.buyPosts || []).filter((post) => post.userId === user.id).map((post) => ({ ...post, type: "buy" }));
  const requests = db.pointRequests.filter((r) => r.userId === user.id).slice().reverse();
  const ledger = db.pointLedger.filter((r) => r.userId === user.id).slice().reverse();
  const displayGrade = user.displayGrade || "브론즈";
  const formatDateTime = (value) => new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
  const requestStatus = (status = "") => {
    if (["approved", "승인", "완료", "처리완료"].includes(status)) return "완료";
    if (["rejected", "거절", "취소", "취소완료"].includes(status)) return "취소";
    return "진행중";
  };
  const tradeStatus = (post) => {
    if (post.status?.includes("완료")) return post.type === "sell" ? "판매완료" : "구매완료";
    if (post.status?.includes("숨김") || post.status?.includes("취소")) return "취소";
    return "진행중";
  };
  const tradeRows = (posts, emptyText) => {
    const rows = posts.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((post) => {
      const status = tradeStatus(post);
      return `<a class="mypage-trade-row" href="/games/${encodeURIComponent(post.gameSlug || "")}">
        <span class="mypage-trade-title">${esc(post.title || "제목 없음")}</span>
        <small>${esc(post.gameName || post.game || "게임")} · ${esc(post.server || "서버전체")}</small>
        <b>${won(post.price)}</b>
        <em class="${status === "진행중" ? "active" : status === "취소" ? "cancel" : "done"}">[${status}]</em>
      </a>`;
    }).join("");
    return rows || `<p class="mypage-empty">${emptyText}</p>`;
  };
  const mileageRows = [
    ...requests.map((r) => ({ label: r.type === "charge" ? "충전요청" : "출금요청", amount: r.amount, status: requestStatus(r.status), createdAt: r.createdAt })),
    ...ledger.map((r) => ({ label: r.amount >= 0 ? "마일리지 충전" : "마일리지 차감", amount: Math.abs(r.amount), status: "완료", createdAt: r.createdAt }))
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 12);
  const mileageList = mileageRows.map((row) => `<li>
    <time>${formatDateTime(row.createdAt)}</time>
    <b>${won(row.amount)}</b>
    <span>${row.label}</span>
    <em class="${row.status === "진행중" ? "active" : row.status === "취소" ? "cancel" : "done"}">[${row.status}]</em>
  </li>`).join("");
  return layout("마이페이지", user, `<main class="mypage-page">
    <section class="mypage-summary-card">
      <div class="mypage-summary-user">
        <img src="${gradeAsset(displayGrade)}" alt="${esc(displayGrade)}">
        <div><strong>${esc(user.nickname)}님</strong><span>${esc(displayGrade)} 등급입니다.</span></div>
      </div>
      <div class="mypage-summary-mileage">
        <h2>보유 마일리지</h2>
        <p><span>마일리지</span><b>${won(user.points)}</b></p>
        <p><span>출금가능 마일리지</span><b>${won(user.points)}</b></p>
        <p><span>구매가능 마일리지</span><b>${won(user.points)}</b></p>
        <nav><a class="primary" href="/charge">충전</a><a href="/withdraw">출금</a></nav>
      </div>
    </section>
    <section class="mypage-trade-panels">
      <article class="mypage-simple-panel"><h2>팝니다</h2><div>${tradeRows(sellPosts, "등록한 판매글이 없습니다.")}</div></article>
      <article class="mypage-simple-panel"><h2>삽니다</h2><div>${tradeRows(buyPosts, "등록한 구매글이 없습니다.")}</div></article>
    </section>
    <section class="mileage-history mypage-simple-history"><h2>마일리지 거래 내역</h2><nav><button class="active">년별 보기</button><button>월별 보기</button></nav><ul>${mileageList || "<li class='empty-row'>내역이 없습니다.</li>"}</ul></section>
    ${chatWidget(user)}
  </main>`, "mypage");
}

function adminPage(user, db) {
  const users = db.users.map((u) => `<tr><td>${u.username}</td><td>${u.nickname}</td><td>${u.phone}</td><td>${u.bank} ${u.accountNumber}</td><td>${u.role}</td><td>${u.displayGrade}</td><td>${u.internalGrade}</td><td>${u.points}</td><td><button data-admin-user="${u.id}">수정</button></td></tr>`).join("");
  const reqs = db.pointRequests.slice().reverse().map((r) => {
    const member = db.users.find((u) => u.id === r.userId);
    return `<tr><td>${r.type === "charge" ? "충전" : "출금"}</td><td>${member?.nickname || "-"}</td><td>${Number(r.amount).toLocaleString()}</td><td>${r.status}</td><td><button data-point="${r.id}" data-decision="approved">완료처리</button><button data-point="${r.id}" data-decision="rejected">취소</button></td></tr>`;
  }).join("");
  const latestNotices = noticePosts(db).slice(0, 6).map((post) => `<li><a href="/notices/${encodeURIComponent(post.id)}">${post.pinned ? "[상단고정] " : ""}${esc(post.title)}</a><span>${noticeDate(post.createdAt)}</span></li>`).join("");
  const noticeInputDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return layout("관리자", user, `<main class="admin-page">
    <h1>운영 관리자</h1>
    <section class="admin-grid">
      <form class="panel" data-form="site"><h2>광고/계좌</h2>
        <input name="bannerTitle" value="${db.site.banners[0].title}" placeholder="배너 제목">
        <input name="bannerSubtitle" value="${db.site.banners[0].subtitle}" placeholder="배너 문구">
        <input name="bank" value="${db.site.chargeAccount.bank}" placeholder="은행">
        <input name="holder" value="${db.site.chargeAccount.holder}" placeholder="예금주">
        <input name="number" value="${db.site.chargeAccount.number}" placeholder="계좌번호">
        <button>저장</button><p class="form-message"></p>
      </form>
      <form class="panel" data-form="staff"><h2>운영진 계정 생성</h2>
        <input name="username" placeholder="아이디"><input name="password" type="password" placeholder="비밀번호"><input name="nickname" placeholder="닉네임">
        <select name="role"><option>STAFF</option><option>ADMIN</option></select><button>생성</button><p class="form-message"></p>
      </form>
    </section>
    <section class="panel admin-notice-panel">
      <div class="admin-notice-head"><h2>공지사항 관리</h2><button type="button" data-toggle-notice-form>공지사항 추가</button></div>
      <form class="admin-notice-form" data-form="notice" hidden>
        <label class="admin-check"><input type="checkbox" name="pinned"> 상단고정</label>
        <label class="admin-notice-date">공지 날짜<input type="datetime-local" name="createdAt" value="${noticeInputDate}"></label>
        <input name="title" placeholder="제목" required>
        <input type="hidden" name="body" required>
        <div class="notice-editor-toolbar">
          <select data-notice-font><option value="Malgun Gothic">맑은 고딕</option><option value="serif">명조 계열</option><option value="monospace">고정폭</option></select>
          <select data-notice-size><option value="14">14px</option><option value="16" selected>16px</option><option value="18">18px</option><option value="20">20px</option><option value="24">24px</option></select>
          <select data-notice-weight><option value="400" selected>보통</option><option value="600">조금 굵게</option><option value="700">굵게</option><option value="800">아주 굵게</option></select>
          <button type="button" data-notice-apply>선택 텍스트 적용</button>
          <button type="button" data-notice-image>사진첨부</button>
          <input type="file" accept="image/*" data-notice-file hidden>
        </div>
        <div class="notice-rich-editor" contenteditable="true" data-notice-editor aria-label="공지 내용 편집기"><p>내용을 입력하세요.</p></div>
        <button>공지 저장</button><p class="form-message"></p>
      </form>
      <ul class="admin-notice-list">${latestNotices}</ul>
    </section>
    <section class="panel table-panel"><h2>회원 개인정보/등급 관리</h2><table><thead><tr><th>ID</th><th>닉네임</th><th>전화</th><th>계좌</th><th>권한</th><th>표시등급</th><th>내부등급</th><th>마일리지</th><th></th></tr></thead><tbody>${users}</tbody></table></section>
    <section class="panel table-panel"><h2>충전/출금 신청</h2><table><tbody>${reqs || "<tr><td>신청 내역이 없습니다.</td></tr>"}</tbody></table></section>
  </main>`, "admin");
}

function staffPage(user) {
  return layout("상담사", user, `<main class="staff-page">
    <aside class="chat-list"><h1>상담함 <span id="roomCount">0</span></h1><div id="staffRooms"></div></aside>
    <section class="staff-chat"><div class="room-meta"><span id="staffRoomMeta">상담방을 선택하세요.</span><button type="button" id="staffClearRoom" disabled>채팅방 비우기</button></div><div id="staffMessages" class="chat-log"></div><form id="staffSend"><input name="message" placeholder="답변 입력"><button>전송</button></form></section>
  </main>`, "staff");
}

function supportPage(user) {
  return layout("고객센터", user, `<main class="support-page"><section class="panel"><h1>고객센터</h1><p>우하단 상담 버튼으로 로그인 회원만 실시간 상담을 시작할 수 있습니다.</p></section></main>${chatWidget(user)}`, "support");
}

function noticesPage(user, db, page = 1) {
  const all = noticePosts(db);
  const pinned = all.filter((post) => post.pinned);
  const regular = all.filter((post) => !post.pinned);
  const current = Math.max(1, Number(page) || 1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(regular.length / pageSize));
  const safePage = Math.min(current, totalPages);
  const pagePosts = regular.slice((safePage - 1) * pageSize, safePage * pageSize);
  const row = (post, index) => `<tr class="${post.pinned ? "is-pinned" : ""}">
    <td>${post.pinned ? "<span class='notice-badge'>공지</span>" : esc(post.noticeNo || regular.length - ((safePage - 1) * pageSize + index))}</td>
    <td><a href="/notices/${encodeURIComponent(post.id)}">${post.pinned ? "<i>📣</i> " : ""}${esc(post.title)}</a></td>
    <td>관리자</td>
    <td>${noticeDate(post.createdAt)}</td>
  </tr>`;
  const rows = [...pinned.map(row), ...pagePosts.map(row)].join("");
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((num) => `<a class="${num === safePage ? "active" : ""}" href="/notices?page=${num}">${num}</a>`).join("");
  return layout("공지사항", user, `<main class="notice-page">
    <h1>공지사항</h1>
    <section class="notice-list-card">
      <table><thead><tr><th>NO</th><th>제목</th><th>글쓴이</th><th>날짜</th></tr></thead><tbody>${rows || "<tr><td colspan='4'>등록된 공지사항이 없습니다.</td></tr>"}</tbody></table>
    </section>
    <nav class="notice-pagination"><a href="/notices?page=${Math.max(1, safePage - 1)}">«</a>${pages}<a href="/notices?page=${Math.min(totalPages, safePage + 1)}">»</a></nav>
    ${chatWidget(user)}
  </main>`, "notice");
}

function noticeDetailPage(user, db, postId) {
  const post = (db.site?.posts || []).find((item) => item.id === postId);
  if (!post) return layout("공지사항", user, `<main class="notice-page"><h1>공지사항</h1><section class="notice-detail-card"><p>공지사항을 찾을 수 없습니다.</p></section><a class="notice-list-button" href="/notices">목록</a>${chatWidget(user)}</main>`, "notice");
  return layout(post.title, user, `<main class="notice-page">
    <h1><a href="/notices">공지사항</a></h1>
    <article class="notice-detail-card">
      <h2>${esc(post.title)}</h2>
      <div class="notice-author"><span class="notice-author-icon">i</span><b>관리자</b><time>${noticeDate(post.createdAt, true)}</time></div>
      <div class="notice-body" style="${noticeContentStyle(post)}">${noticeBodyHtml(post.body)}</div>
    </article>
    <a class="notice-list-button" href="/notices">☰ 목록</a>
    ${chatWidget(user)}
  </main>`, "notice");
}

function chatWidget(user) {
  if (!user) return `<a class="chat-fab locked" href="/login" aria-label="상담사연결"><img src="/assets/icons/chat-support.png" alt=""></a>`;
  return `<button class="chat-fab" id="chatOpen" aria-label="상담사연결" aria-expanded="false"><img src="/assets/icons/chat-support.png" alt=""><span>×</span></button>
  <section class="chat-widget" id="chatWidget" aria-label="아이템존 고객센터">
    <header class="member-chat-head">
      <button type="button" class="chat-back" aria-label="뒤로">‹</button>
      <img class="chat-agent-mark" src="/assets/chat/customer-center-agent.png" alt="">
      <div><b>아이템존 고객센터</b><small>상담시간은 오전9시 ~ 새벽4시까지입니다.</small></div>
      <button type="button" id="chatClose" class="chat-close" aria-label="닫기">×</button>
    </header>
    <div id="memberChatLog" class="chat-log member-chat-log"></div>
    <form id="memberChatSend" class="member-chat-send">
      <input id="chatFileInput" type="file" accept="image/*" hidden>
      <div class="chat-composer">
        <input name="message" placeholder="메시지를 입력해주세요." autocomplete="off">
        <div class="chat-tools">
          <button type="button" id="chatAttach" aria-label="파일첨부">📎</button>
        </div>
        <div id="chatAttachmentPreview" class="chat-attachment-preview"></div>
        <button class="chat-send-button" type="submit" aria-label="전송"><img src="/assets/chat/send-idle.png" alt=""></button>
      </div>
    </form>
  </section>`;
}

async function api(req, res, db, user, pathname) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    if (pathname === "/api/check-availability" && req.method === "GET") {
      const field = requestUrl.searchParams.get("field");
      const value = String(requestUrl.searchParams.get("value") || "").trim();
      if (!["username", "nickname"].includes(field)) return send(res, 400, { error: "확인 항목이 올바르지 않습니다." });
      if (!value) return send(res, 200, { available: false, message: "입력 대기" });
      const exists = db.users.some((u) => String(u[field] || "").toLowerCase() === value.toLowerCase());
      return send(res, 200, { available: !exists, message: exists ? "이미 사용 중" : "사용 가능" });
    }
    if (pathname === "/api/signup" && req.method === "POST") {
      const data = await body(req);
      const username = String(data.username || "").trim();
      const nickname = String(data.nickname || "").trim();
      const password = String(data.password || "");
      const passwordConfirm = String(data.passwordConfirm || "");
      const phoneMid = String(data.phoneMid || "").replace(/\D/g, "");
      const phoneLast = String(data.phoneLast || "").replace(/\D/g, "");
      const phone = `010-${phoneMid}-${phoneLast}`;
      if (!username || !nickname || !password || !data.phoneCarrier || phoneMid.length !== 4 || phoneLast.length !== 4) return send(res, 400, { error: "입력값을 확인하세요." });
      if (!/^(?=.*[a-z])(?=.*\d)[a-z\d]{8,}$/.test(password)) return send(res, 400, { error: "비밀번호는 8자 이상 영문 소문자와 숫자를 조합해주세요." });
      if (password !== passwordConfirm) return send(res, 400, { error: "패스워드 재확인이 일치하지 않습니다." });
      if (db.users.some((u) => String(u.username || "").toLowerCase() === username.toLowerCase())) return send(res, 409, { error: "이미 사용 중인 아이디입니다." });
      if (db.users.some((u) => String(u.nickname || "").toLowerCase() === nickname.toLowerCase())) return send(res, 409, { error: "이미 사용 중인 닉네임입니다." });
      const newUser = { id: id("user"), username, passwordHash: await hashPassword(password), nickname, phone, phoneCarrier: data.phoneCarrier, bank: "-", accountNumber: "-", displayGrade: "브론즈", internalGrade: "내부등급 1", role: "MEMBER", status: "정상", points: 0, createdAt: now() };
      db.users.push(newUser); await writeDb(db);
      return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(newUser.id) });
    }
    if (pathname === "/api/login" && req.method === "POST") {
      const data = await body(req);
      const found = db.users.find((u) => u.username === data.username);
      if (!found || !(await verifyPassword(data.password, found.passwordHash))) return send(res, 401, { error: "아이디 또는 비밀번호가 올바르지 않습니다." });
      return send(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(found.id) });
    }
    if (pathname === "/api/logout" && req.method === "POST") return send(res, 200, { ok: true }, { "Set-Cookie": "session=; Path=/; Max-Age=0" });
    if (pathname === "/api/me") return send(res, 200, { user: user && publicUser(user) });
    if (pathname === "/api/trade" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const game = (db.games || []).find((item) => item.slug === data.gameSlug);
      if (!game) return send(res, 400, { error: "게임을 선택하세요." });
      const row = { id: id(data.type), userId: user.id, gameSlug: game.slug, gameName: game.name, game: game.name, server: data.server || "서버전체", tradeKind: tradeKindLabel(data.tradeKind), category: tradeKindLabel(data.tradeKind), unit: data.unit || "일반", characterName: data.characterName || "", quantity: data.quantity ? Number(data.quantity) : null, title: data.title, description: data.description, price: Number(data.price), memo: data.memo, imageUrl: data.imageUrl, status: data.type === "sell" ? "판매중" : "구매중", createdAt: now() };
      db[data.type === "sell" ? "sellPosts" : "buyPosts"].push(row); await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/trade/status" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const collection = tradeCollection(db, data.type);
      const post = collection.find((item) => item.id === data.id);
      if (!post) return send(res, 404, { error: "거래글을 찾을 수 없습니다." });
      if (post.userId !== user.id && !canAdmin(user)) return send(res, 403, { error: "권한이 없습니다." });
      const allowed = data.type === "sell" ? ["판매중", "판매완료", "숨김"] : ["구매중", "구매완료", "숨김"];
      if (!allowed.includes(data.status)) return send(res, 400, { error: "상태값을 확인하세요." });
      post.status = data.status;
      post.updatedAt = now();
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/point-request" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: "신청 금액을 확인하세요." });
      if (data.type === "withdraw" && amount > Number(user.points || 0)) return send(res, 400, { error: "출금 가능 마일리지를 초과했습니다." });
      db.pointRequests.push({ id: id("point"), userId: user.id, type: data.type, amount, status: "대기", createdAt: now(), handledBy: null, handledAt: null });
      await writeDb(db); return send(res, 200, { ok: true, account: db.site.chargeAccount });
    }
    if (pathname === "/api/admin/site" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      db.site.banners[0].title = data.bannerTitle || db.site.banners[0].title;
      db.site.banners[0].subtitle = data.bannerSubtitle || db.site.banners[0].subtitle;
      db.site.chargeAccount = { bank: data.bank, holder: data.holder, number: data.number };
      if (data.postTitle) db.site.posts.push({ id: id("post"), title: data.postTitle, body: data.postBody || "", displayName: data.displayName || user.nickname, authorId: user.id, createdAt: now() });
      audit(db, user, "SITE_UPDATE"); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/notice" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      const title = String(data.title || "").trim();
      const noticeBody = sanitizeNoticeHtml(String(data.body || "").trim());
      if (!title || !noticeBody) return send(res, 400, { error: "제목과 내용을 입력하세요." });
      const maxNoticeNo = Math.max(0, ...(db.site.posts || []).map((post) => Number(post.noticeNo || 0)));
      db.site.posts.push({
        id: id("post"),
        title,
        body: noticeBody,
        displayName: "관리자",
        authorId: user.id,
        pinned: data.pinned === "on" || data.pinned === true,
        noticeNo: maxNoticeNo + 1,
        fontFamily: ["default", "malgun", "serif", "mono"].includes(data.fontFamily) ? data.fontFamily : "default",
        fontSize: ["14", "16", "18", "20"].includes(String(data.fontSize)) ? String(data.fontSize) : "16",
        fontWeight: ["400", "600", "700", "800"].includes(String(data.fontWeight)) ? String(data.fontWeight) : "400",
        createdAt: noticeCreatedAt(data.createdAt)
      });
      audit(db, user, "NOTICE_CREATE");
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/staff" && req.method === "POST") {
      if (user?.role !== "OWNER") return send(res, 403, { error: "챌린저 계정만 운영진을 생성할 수 있습니다." });
      const data = await body(req);
      db.users.push({ id: id("user"), username: data.username, passwordHash: await hashPassword(data.password), nickname: data.nickname, phone: "-", bank: "-", accountNumber: "-", displayGrade: "마스터", internalGrade: "내부등급 1", role: ROLES.includes(data.role) ? data.role : "STAFF", status: "정상", points: 0, createdAt: now() });
      audit(db, user, "STAFF_CREATE"); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/user" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      const target = db.users.find((u) => u.id === data.id);
      if (!target) return send(res, 404, { error: "회원을 찾을 수 없습니다." });
      if (MEMBER_GRADES.includes(data.displayGrade) || (target.role !== "MEMBER" && data.displayGrade === "마스터") || (user.role === "OWNER" && data.displayGrade === "챌린저")) target.displayGrade = data.displayGrade;
      if (INTERNAL_GRADES.includes(data.internalGrade)) target.internalGrade = data.internalGrade;
      if (["정상", "정지"].includes(data.status)) target.status = data.status;
      audit(db, user, "USER_UPDATE", target.id); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/point" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      const request = db.pointRequests.find((r) => r.id === data.id);
      if (!request || request.status !== "대기") return send(res, 404, { error: "처리할 신청이 없습니다." });
      request.status = data.decision === "approved" ? "승인" : "거절";
      request.handledBy = user.id; request.handledAt = now();
      const member = db.users.find((u) => u.id === request.userId);
      if (member && request.status === "승인") {
        member.points += request.type === "charge" ? request.amount : -request.amount;
        db.pointLedger.push({ id: id("ledger"), userId: member.id, amount: request.type === "charge" ? request.amount : -request.amount, reason: request.type, staffId: user.id, createdAt: now() });
      }
      audit(db, user, "POINT_HANDLE", request.id); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/chat/member" && req.method === "GET") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const room = ensureRoom(db, user);
      const unreadStaffMessages = db.chatMessages.filter((m) => m.roomId === room.id && m.senderType === "staff" && !m.read);
      if (unreadStaffMessages.length || room.memberUnread) {
        unreadStaffMessages.forEach((m) => { m.read = true; m.readAt = now(); });
        room.memberUnread = 0;
        await writeDb(db);
      }
      return send(res, 200, { messages: memberMessages(db, room.id) });
    }
    if (pathname === "/api/chat/member" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req); const room = ensureRoom(db, user);
      addMessage(db, room, user, "member", data.message, data.attachment); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/chat/member/delete" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const room = ensureRoom(db, user);
      const message = db.chatMessages.find((m) => m.id === data.id && m.roomId === room.id && m.senderType === "member" && m.userId === user.id);
      if (!message) return send(res, 404, { error: "삭제할 메시지가 없습니다." });
      message.deletedByMember = true;
      message.deletedAt = now();
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/chat/staff" && req.method === "GET") {
      if (!protect(user, "staff")) return send(res, 403, { error: "권한이 없습니다." });
      const rooms = db.chatRooms.map((r) => {
        const member = db.users.find((u) => u.id === r.userId);
        return { ...r, memberName: member?.nickname, username: member?.username, displayGrade: member?.displayGrade, internalGrade: member?.internalGrade };
      }).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
      return send(res, 200, { rooms });
    }
    if (pathname.startsWith("/api/chat/staff/") && pathname.endsWith("/delete-message") && req.method === "POST") {
      if (!protect(user, "staff")) return send(res, 403, { error: "권한이 없습니다." });
      const roomId = pathname.split("/").at(-2);
      const room = db.chatRooms.find((r) => r.id === roomId);
      if (!room) return send(res, 404, { error: "상담방 없음" });
      const data = await body(req);
      const index = db.chatMessages.findIndex((m) => m.id === data.id && m.roomId === room.id);
      if (index < 0) return send(res, 404, { error: "삭제할 메시지가 없습니다." });
      const [removed] = db.chatMessages.splice(index, 1);
      const latest = db.chatMessages.filter((m) => m.roomId === room.id).at(-1);
      room.lastMessage = latest ? latest.message || (latest.attachment ? `첨부파일: ${latest.attachment.name}` : "") : "";
      room.lastAt = latest?.createdAt || now();
      audit(db, user, "CHAT_MESSAGE_DELETE", removed.id);
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname.startsWith("/api/chat/staff/") && pathname.endsWith("/clear") && req.method === "POST") {
      if (!protect(user, "staff")) return send(res, 403, { error: "권한이 없습니다." });
      const roomId = pathname.split("/").at(-2);
      const room = db.chatRooms.find((r) => r.id === roomId);
      if (!room) return send(res, 404, { error: "상담방 없음" });
      const before = db.chatMessages.length;
      db.chatMessages = db.chatMessages.filter((m) => m.roomId !== room.id);
      room.staffUnread = 0;
      room.memberUnread = 0;
      room.lastMessage = "";
      room.lastAt = now();
      audit(db, user, "CHAT_ROOM_CLEAR", `${room.id}:${before - db.chatMessages.length}`);
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname.startsWith("/api/chat/staff/") && req.method === "GET") {
      if (!protect(user, "staff")) return send(res, 403, { error: "권한이 없습니다." });
      const roomId = pathname.split("/").pop();
      const room = db.chatRooms.find((r) => r.id === roomId);
      if (!room) return send(res, 404, { error: "상담방 없음" });
      if (room.staffUnread) {
        room.staffUnread = 0;
        await writeDb(db);
      }
      return send(res, 200, { messages: db.chatMessages.filter((m) => m.roomId === roomId) });
    }
    if (pathname.startsWith("/api/chat/staff/") && req.method === "POST") {
      if (!protect(user, "staff")) return send(res, 403, { error: "권한이 없습니다." });
      const roomId = pathname.split("/").pop();
      const room = db.chatRooms.find((r) => r.id === roomId);
      if (!room) return send(res, 404, { error: "상담방 없음" });
      const data = await body(req); addMessage(db, room, user, "staff", data.message, data.attachment); await writeDb(db);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "Not found" });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
}

function publicUser(user) {
  const { passwordHash, internalGrade, accountNumber, ...safe } = user;
  return safe;
}

function ensureRoom(db, user) {
  let room = db.chatRooms.find((r) => r.userId === user.id && r.status !== "종료");
  if (!room) {
    room = { id: id("room"), userId: user.id, status: "진행중", staffUnread: 0, memberUnread: 0, lastMessage: "", lastAt: now(), createdAt: now() };
    db.chatRooms.push(room);
  }
  return room;
}

function addMessage(db, room, user, senderType, message, attachment = null) {
  const text = String(message || "").trim();
  const isImage = attachment?.type?.startsWith?.("image/") && String(attachment.dataUrl || "").startsWith("data:image/");
  const file = attachment?.name && isImage ? { name: String(attachment.name), type: String(attachment.type || ""), size: Number(attachment.size || 0), dataUrl: String(attachment.dataUrl) } : null;
  if (!text && !file) return;
  db.chatMessages.push({ id: id("msg"), roomId: room.id, senderType, userId: senderType === "member" ? user.id : room.userId, staffId: senderType === "staff" ? user.id : null, internalStaffName: senderType === "staff" ? user.nickname : null, displayName: senderType === "staff" ? "아이템존 상담사" : user.nickname, message: text, attachment: file, createdAt: now(), read: false });
  room.lastMessage = text || `첨부파일: ${file.name}`; room.lastAt = now();
  if (senderType === "member") room.staffUnread += 1;
  if (senderType === "staff") room.memberUnread += 1;
}

function memberMessages(db, roomId) {
  return db.chatMessages.filter((m) => m.roomId === roomId).map((m) => ({ id: m.id, senderType: m.senderType, displayName: m.displayName, message: m.message, attachment: m.attachment || null, deletedByMember: Boolean(m.deletedByMember), createdAt: m.createdAt }));
}

function audit(db, user, action, targetId = null) {
  db.auditLogs.push({ id: id("audit"), staffId: user.id, action, targetId, createdAt: now() });
}

async function serveStatic(req, res, pathname) {
  const target = path.join(PUBLIC_DIR, pathname.replace(/^\/+/, ""));
  if (!target.startsWith(PUBLIC_DIR)) return false;
  try {
    const info = await stat(target);
    if (!info.isFile()) return false;
    const ext = path.extname(target);
    const types = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    createReadStream(target).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (await serveStatic(req, res, url.pathname)) return;
  const db = await readDb();
  const user = await currentUser(req, db);
  if (url.pathname.startsWith("/api/")) return api(req, res, db, user, url.pathname);
  if (url.pathname === "/") return send(res, 200, homePage(user, db));
  if (url.pathname === "/login") return send(res, 200, authPage(user, "login"));
  if (url.pathname === "/signup") return send(res, 200, authPage(user, "signup"));
  if (url.pathname === "/notices") return send(res, 200, noticesPage(user, db, url.searchParams.get("page") || 1));
  if (url.pathname.startsWith("/notices/")) return send(res, 200, noticeDetailPage(user, db, decodeURIComponent(url.pathname.split("/").pop())));
  if (url.pathname === "/games") return send(res, 200, gamesPage(user, db, url.searchParams.get("group") || "전체"));
  if (url.pathname.startsWith("/games/")) {
    const panelFilters = {};
    url.searchParams.forEach((value, key) => {
      if (/^f\d+$/.test(key)) panelFilters[key] = value;
    });
    return send(res, 200, gameDetailPage(user, db, decodeURIComponent(url.pathname.split("/").pop()), { side: url.searchParams.get("side") || "all", kind: url.searchParams.get("kind") || "all", server: url.searchParams.get("server") || "서버전체", filters: panelFilters }));
  }
  if (url.pathname === "/sell") return protect(user, "member") ? send(res, 200, registerPage(user, "sell", db, url.searchParams.get("game") || "")) : redirect(res, "/login");
  if (url.pathname === "/buy") return protect(user, "member") ? send(res, 200, registerPage(user, "buy", db, url.searchParams.get("game") || "")) : redirect(res, "/login");
  if (url.pathname === "/charge") return protect(user, "member") ? send(res, 200, pointPage(user, db, "charge")) : redirect(res, "/login");
  if (url.pathname === "/withdraw") return protect(user, "member") ? send(res, 200, pointPage(user, db, "withdraw")) : redirect(res, "/login");
  if (url.pathname === "/mypage") return protect(user, "member") ? send(res, 200, myPage(user, db)) : redirect(res, "/login");
  if (url.pathname === "/admin") return protect(user, "admin") ? send(res, 200, adminPage(user, db)) : redirect(res, "/login");
  if (url.pathname === "/staff") return protect(user, "staff") ? send(res, 200, staffPage(user)) : redirect(res, "/login");
  if (url.pathname === "/support" || url.pathname === "/giftcards") return send(res, 200, supportPage(user));
  send(res, 404, layout("404", user, "<main class='panel'><h1>페이지를 찾을 수 없습니다.</h1></main>"));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

if (process.argv.includes("--check")) {
  await readDb();
  console.log("Build check complete: database available and server sources parsed.");
} else {
  await readDb();
  http.createServer(router).listen(PORT, () => console.log(`아이템존 MVP: http://localhost:${PORT}`));
}

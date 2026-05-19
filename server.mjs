import http from "node:http";
import { readFile, writeFile, mkdir, stat, copyFile, rename, rm, readdir } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
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
const DB_BACKUP_KEEP = 30;
const PUBLIC_SEED_PATH = path.join(DATA_DIR, "public-seed.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const LEGAL_DIR = path.join(DATA_DIR, "legal");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let dbWriteQueue = Promise.resolve();

const DISPLAY_GRADES = ["브론즈", "실버", "골드", "플레티넘", "다이아", "마스터", "챌린저"];
const MEMBER_GRADES = ["브론즈", "실버", "골드", "플레티넘", "다이아"];
const INTERNAL_GRADES = Array.from({ length: 10 }, (_, index) => `${index + 1}급`);
const ROLES = ["MEMBER", "STAFF", "OWNER"];
const WITHDRAW_BANKS = [
  "KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "IBK기업은행", "SC제일은행", "한국씨티은행",
  "KDB산업은행", "Sh수협은행", "DGB대구은행", "BNK부산은행", "광주은행", "제주은행", "전북은행", "BNK경남은행",
  "새마을금고", "신협", "우체국", "저축은행", "산림조합", "케이뱅크", "토스뱅크",
  "KB증권", "NH투자증권", "미래에셋증권", "삼성증권", "한국투자증권", "키움증권", "신한투자증권", "대신증권",
  "하나증권", "메리츠증권", "유안타증권", "교보증권", "하이투자증권", "현대차증권", "DB금융투자",
  "한화투자증권", "유진투자증권", "LS증권", "SK증권", "부국증권", "신영증권", "케이프투자증권", "다올투자증권"
];
const LEGAL_DOCS = {
  service: { title: "이용약관", file: "service.html" },
  trade: { title: "아이템거래약관", file: "trade.html" },
  privacy: { title: "개인정보취급방침", file: "privacy.html" }
};
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

const SEARCH_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
function searchInitials(value = "") {
  return [...String(value)].map((char) => {
    const code = char.codePointAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return SEARCH_INITIALS[Math.floor((code - 0xac00) / 588)] || "";
    return /[0-9a-z]/i.test(char) ? char.toLowerCase() : "";
  }).join("");
}

function normalizeSearch(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, "");
}

function searchGameResults(db, query = "") {
  const q = normalizeSearch(query);
  const games = (db.games || []).filter((game) => game.visible !== false);
  const ranked = games.slice().sort((a, b) => Number(a.rank || 9999) - Number(b.rank || 9999));
  const filtered = q ? ranked.filter((game) => {
    const name = normalizeSearch(game.name);
    const initials = searchInitials(game.name);
    const group = normalizeSearch(game.initialGroup);
    return name.includes(q) || initials.includes(q) || group === q;
  }).sort((a, b) => {
    const aName = normalizeSearch(a.name);
    const bName = normalizeSearch(b.name);
    const aInitials = searchInitials(a.name);
    const bInitials = searchInitials(b.name);
    const score = (game, name, initials) => (
      name === q ? 0 :
      name.startsWith(q) ? 1 :
      initials === q ? 2 :
      initials.startsWith(q) ? 3 :
      name.includes(q) ? 4 : 5
    ) + Number(game.rank || 9999) / 10000;
    return score(a, aName, aInitials) - score(b, bName, bInitials);
  }) : ranked;
  return filtered.slice(0, 10).map((game) => ({
    name: game.name,
    slug: game.slug,
    imageUrl: game.imageUrl || game.localImageUrl || "/assets/games/game-1.svg",
    initialGroup: game.initialGroup || initialGroupFor(game.name)
  }));
}

function readPublicSeed() {
  try {
    return JSON.parse(readFileSync(PUBLIC_SEED_PATH, "utf8"));
  } catch {
    return { site: {}, games: [] };
  }
}

function publicSeedGames(seed) {
  return (seed.games || []).map((game, index) => ({
    ...game,
    id: game.id || id("game"),
    rank: Number(game.rank || index + 1),
    trades: Number(game.trades || 0),
    visible: game.visible !== false,
    slug: game.slug || slugifyGame(game.name, index),
    initialGroup: game.initialGroup || initialGroupFor(game.name)
  }));
}

function publicSeedPosts(seed, ownerId) {
  return (seed.site?.posts || []).map((post) => ({
    ...post,
    id: post.id || id("post"),
    displayName: post.displayName || "관리자",
    authorId: ownerId,
    pinned: Boolean(post.pinned),
    fontFamily: post.fontFamily || "default",
    fontSize: String(post.fontSize || "16"),
    fontWeight: String(post.fontWeight || "400"),
    createdAt: post.createdAt || now()
  }));
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
    const db = JSON.parse(await retryBusy(() => readFile(DB_PATH, "utf8")));
    const normalized = normalizeDb(db);
    if (normalized.changed) await writeDb(normalized.db);
    return normalized.db;
  } catch (error) {
    if (error?.code === "ENOENT") {
      await seedDb();
      return JSON.parse(await readFile(DB_PATH, "utf8"));
    }
    console.error("DB read failed; keeping existing db.json untouched.", error);
    throw error;
  }
}

function normalizeDb(db) {
  let changed = false;
  const seed = readPublicSeed();
  const seededGames = publicSeedGames(seed);
  db.site ||= {};
  db.site.banners ||= [{ title: "메인 배너", subtitle: "", badge: "" }];
  db.site.posts ||= [];
  db.site.notices ||= [];
  db.directChatRooms ||= [];
  db.directChatMessages ||= [];
  db.userNotifications ||= [];
  db.pointRequests ||= [];
  (db.pointRequests || []).forEach((request) => {
    if (isExpiredPendingCharge(request)) {
      request.status = "회원취소";
      request.memberCanceledAt ||= now();
      request.autoCanceledByChargeDeadline = true;
      changed = true;
    }
  });
  (db.sellPosts || []).forEach((post) => {
    const nextStatus = normalizePostStatusForType(post.status, "sell");
    if (post.status !== nextStatus) {
      post.status = nextStatus;
      changed = true;
    }
  });
  (db.buyPosts || []).forEach((post) => {
    const nextStatus = normalizePostStatusForType(post.status, "buy");
    if (post.status !== nextStatus) {
      post.status = nextStatus;
      changed = true;
    }
  });
  (db.users || []).forEach((user) => {
    if (user.role === "ADMIN") {
      user.role = "STAFF";
      changed = true;
    }
    const normalizedGrade = normalizeInternalGrade(user.internalGrade);
    if (user.internalGrade !== normalizedGrade) {
      user.internalGrade = normalizedGrade;
      changed = true;
    }
  });
  (db.pointLedger || []).forEach((row) => {
    if (["admin_adjust", "rollback"].includes(row.reason) && !row.hiddenFromMember) {
      row.hiddenFromMember = true;
      changed = true;
    }
  });
  if (seededGames.length && (!db.games?.length || db.games.length < seededGames.length)) {
    db.games = seededGames;
    changed = true;
  }
  if (seed.site?.banners?.length && !db.site.banners?.[0]?.imageUrl) {
    db.site.banners = seed.site.banners;
    changed = true;
  }
  if (seed.site?.events?.length && (!db.site.events?.length || db.site.events.length < seed.site.events.length)) {
    db.site.events = seed.site.events;
    changed = true;
  }
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

async function retryBusy(task, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!["EBUSY", "EPERM"].includes(error?.code) || attempt === attempts - 1) throw error;
      await wait(80 * (attempt + 1));
    }
  }
}

async function writeDbPayload(payload) {
  await mkdir(DATA_DIR, { recursive: true });
  await pruneDbBackups();
  try {
    JSON.parse(await retryBusy(() => readFile(DB_PATH, "utf8")));
    await retryBusy(() => copyFile(DB_PATH, path.join(DATA_DIR, "db.backup.json")));
    await retryBusy(() => copyFile(DB_PATH, path.join(DATA_DIR, `db.backup-${Date.now()}.json`)));
  } catch {}
  const tempPath = path.join(DATA_DIR, `db.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tempPath, payload, "utf8");
    JSON.parse(await readFile(tempPath, "utf8"));
    await retryBusy(() => rename(tempPath, DB_PATH));
    await pruneDbBackups();
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function pruneDbBackups() {
  try {
    const entries = await readdir(DATA_DIR, { withFileTypes: true });
    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /^db\.backup-\d+\.json$/.test(entry.name))
        .map(async (entry) => {
          const filePath = path.join(DATA_DIR, entry.name);
          const info = await stat(filePath);
          return { filePath, mtimeMs: info.mtimeMs };
        })
    );
    await Promise.all(
      backups
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(DB_BACKUP_KEEP)
        .map((backup) => rm(backup.filePath, { force: true }).catch(() => {}))
    );
  } catch {}
}

async function writeDb(db) {
  const payload = JSON.stringify(db, null, 2);
  dbWriteQueue = dbWriteQueue.catch(() => {}).then(() => writeDbPayload(payload));
  return dbWriteQueue;
}

async function seedDb() {
  await mkdir(DATA_DIR, { recursive: true });
  if (existsSync(DB_PATH)) return;
  const ownerId = id("user");
  const seed = readPublicSeed();
  const seededPosts = publicSeedPosts(seed, ownerId);
  const seededGames = publicSeedGames(seed);
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
        internalGrade: "1급",
        role: "OWNER",
        status: "정상",
        points: 0,
        createdAt: now()
      }
    ],
    site: {
      chargeAccount: { bank: CHARGE_BANK, holder: CHARGE_HOLDER, number: CHARGE_NUMBER },
      banners: seed.site?.banners?.length ? seed.site.banners : [
        { title: "메이플스토리 월드", subtitle: "아이템존에서 안전하게 거래하세요", badge: "오픈 기념 혜택" }
      ],
      notices: ["이용약관 및 마일리지 정책 변경 안내", "신규가입 쿠폰 지급 이벤트", "시스템 점검 안내"],
      events: seed.site?.events?.length ? seed.site.events : [
        { title: "신규가입 이벤트", text: "가입하고 첫 거래 쿠폰 받기" },
        { title: "피해보상 제도", text: "거래 사고시 보상 접수 지원" },
        { title: "친구초대", text: "초대링크 공유하고 마일리지 받기" },
        { title: "등급 혜택", text: "등급별 수수료와 쿠폰 혜택" }
      ],
      posts: seededPosts.length ? seededPosts : [
        { id: id("post"), title: "아이템존 오픈 안내", body: "안전거래 중심의 게임 거래소 아이템존입니다.", displayName: "아이템존", authorId: ownerId, createdAt: now() }
      ]
    },
    games: seededGames.length ? seededGames : [
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
    directChatRooms: [],
    directChatMessages: [],
    userNotifications: [],
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
  return user && ["STAFF", "OWNER"].includes(user.role);
}

function canAdmin(user) {
  return user && ["STAFF", "OWNER"].includes(user.role);
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
  const file = `/assets/tiers/${assets[grade] || "bronze"}.png`;
  return existsSync(path.join(PUBLIC_DIR, file.replace(/^\/+/, ""))) ? file : "/assets/tiers/bronze.png";
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
        const fontSize = text.match(/font-size\s*:\s*(1[0-9]|2[0-9]|3[0-6])px/i);
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

function normalizePostStatusForType(status = "", type = "sell") {
  const compact = String(status || "").replace(/\s/g, "");
  if (type === "sell") {
    if (!compact || compact === "판매중" || compact === "구매중") return "판매중";
    if (compact === "판매진행중" || compact === "구매진행중") return "판매 진행중";
    if (compact === "판매완료" || compact === "구매완료" || compact === "거래완료") return "판매완료";
  }
  if (!compact || compact === "구매중" || compact === "판매중") return "구매중";
  if (compact === "구매진행중" || compact === "판매진행중") return "구매 진행중";
  if (compact === "구매완료" || compact === "판매완료" || compact === "거래완료") return "구매완료";
  return status || (type === "sell" ? "판매중" : "구매중");
}

function tradeMileageTransfer(db, post, type) {
  if (post.pointTransferred) return { ok: true };
  const amount = Math.max(0, Math.floor(Number(post.price || 0)));
  if (!amount) return { ok: false, error: "거래 금액을 확인하세요." };
  const owner = db.users.find((item) => item.id === post.userId);
  const counterparty = db.users.find((item) => item.id === post.counterpartyId);
  if (!owner || !counterparty) return { ok: false, error: "거래 회원 정보를 찾을 수 없습니다." };
  const payer = type === "sell" ? counterparty : owner;
  const receiver = type === "sell" ? owner : counterparty;
  if (payer.id === receiver.id) return { ok: false, error: "거래 당사자 정보를 확인하세요." };
  if (Number(payer.points || 0) < amount) return { ok: false, error: "구매자의 마일리지가 부족합니다." };
  payer.points = Number(payer.points || 0) - amount;
  receiver.points = Number(receiver.points || 0) + amount;
  post.pointTransferred = true;
  post.pointTransferredAt = now();
  post.payerId = payer.id;
  post.receiverId = receiver.id;
  db.pointLedger.push(
    { id: id("ledger"), tradeId: post.id, tradeType: type, userId: payer.id, amount: -amount, reason: "trade_payment", counterpartyId: receiver.id, createdAt: now() },
    { id: id("ledger"), tradeId: post.id, tradeType: type, userId: receiver.id, amount, reason: "trade_receive", counterpartyId: payer.id, createdAt: now() }
  );
  return { ok: true };
}

function notifyTradeCompleted(db, post, type) {
  const actionLabel = type === "sell" ? "판매" : "구매";
  const title = post.title || "거래 상품";
  const toast = `${title} 상품이 ${actionLabel} 완료되었습니다. 마일리지를 확인해 주세요.`;
  const chatMessage = `${title}\n거래가 완료되었습니다.\n마일리지를 확인해 주세요.`;
  const tone = type === "sell" ? "sell" : "buy";
  [...new Set([post.userId, post.counterpartyId].filter(Boolean))].forEach((userId) => {
    addSystemDirectNotice(db, userId, post, type, chatMessage);
    addUserNotification(db, userId, toast, tone);
  });
  return { message: toast, tone };
}

function notifyTradeRequested(db, post, type, requester) {
  const actionLabel = type === "sell" ? "구매" : "판매";
  const title = post.title || "거래 상품";
  const nickname = requester?.nickname || "회원";
  const message = `${nickname}님께서 ${title} ${actionLabel} 요청하셨습니다.`;
  const tone = type === "sell" ? "sell" : "buy";
  addSystemDirectNotice(db, post.userId, post, type, message);
  addUserNotification(db, post.userId, message, tone);
  return { message, tone };
}

function addTradeRequestGreeting(db, post, type, requester) {
  const result = ensureDirectRoom(db, requester, type, post.id);
  if (!result?.room) return null;
  const actionLabel = type === "sell" ? "구매" : "판매";
  const title = post.title || "거래 상품";
  addDirectMessage(db, result.room, requester, `안녕하세요.\n${title}\n${actionLabel} 요청 드렸습니다.\n거래 희망합니다.`);
  return result.room;
}

function addUserNotification(db, userId, message, tone = "buy") {
  if (!userId || !message) return null;
  db.userNotifications ||= [];
  const notification = {
    id: id("notice"),
    userId,
    message,
    tone: tone === "sell" ? "sell" : "buy",
    createdAt: now()
  };
  db.userNotifications.push(notification);
  return notification;
}

function tradeTypeLabel(type = "sell") {
  return type === "sell" ? "판매" : "구매";
}

function tradeHref(post, type = post.type || "sell") {
  return `/trades/${type}/${encodeURIComponent(post.id)}`;
}

function tradeStatusClass(status = "") {
  if (status === "거래완료" || status.includes("완료")) return "done";
  if (status.includes("진행")) return "active";
  return "";
}

function normalizeInternalGrade(value = "") {
  const text = String(value || "").trim();
  const matched = text.match(/(\d+)/);
  if (!matched) return "1급";
  const grade = Math.min(10, Math.max(1, Number(matched[1])));
  return `${grade}급`;
}

function tradeStatusLabel(status = "", type = "sell") {
  const compact = String(status || "").replace(/\s/g, "");
  if (compact === "판매중" || compact === "구매중") return "";
  if (compact === "구매진행중") return "구매 진행중";
  if (compact === "판매진행중") return "판매 진행중";
  if (compact === "거래완료") return type === "buy" ? "구매완료" : "판매완료";
  if (compact === "구매완료") return "구매완료";
  if (compact === "판매완료") return "판매완료";
  return status;
}

function findTradePost(db, type, idValue) {
  const safeType = type === "buy" ? "buy" : "sell";
  const post = tradeCollection(db, safeType).find((item) => item.id === idValue);
  return post ? { post, type: safeType } : null;
}

function directChatPost(db, room) {
  const found = findTradePost(db, room.tradeType, room.postId);
  return found?.post || null;
}

function directChatMeta(db, room, user) {
  if (room.systemOnly) {
    return {
      id: room.id,
      tradeType: room.tradeType,
      postId: room.postId,
      tradeTitle: room.tradeTitle || "거래 알림",
      peerId: "system",
      peerNickname: room.systemName || "관리자",
      peerGrade: "마스터",
      peerGradeAsset: gradeAsset("마스터"),
      lastMessage: room.lastMessage || "",
      lastAt: room.lastAt || room.createdAt,
      unread: Number(room.unreadBy?.[user.id] || 0),
      systemOnly: true,
      readOnlyMessage: "답장이 불가한 채팅입니다."
    };
  }
  const peerId = (room.participantIds || []).find((idValue) => idValue !== user.id);
  const peer = db.users?.find((item) => item.id === peerId);
  const post = directChatPost(db, room);
  return {
    id: room.id,
    tradeType: room.tradeType,
    postId: room.postId,
    tradeTitle: post?.title || room.tradeTitle || "거래글",
    peerId,
    peerNickname: peer?.nickname || "회원",
    peerGrade: peer?.displayGrade || "브론즈",
    peerGradeAsset: gradeAsset(peer?.displayGrade || "브론즈"),
    lastMessage: room.lastMessage || "",
    lastAt: room.lastAt || room.createdAt,
    unread: Number(room.unreadBy?.[user.id] || 0)
  };
}

function findDirectRoom(db, roomId, user) {
  const room = (db.directChatRooms || []).find((item) => item.id === roomId && (item.participantIds || []).includes(user.id));
  return room || null;
}

function addSystemDirectNotice(db, userId, post, type, message) {
  if (!userId) return null;
  db.directChatRooms ||= [];
  db.directChatMessages ||= [];
  const roomKey = `trade-complete:${type}:${post.id}:${userId}`;
  let room = db.directChatRooms.find((item) => item.systemOnly && item.roomKey === roomKey);
  if (!room) {
    room = {
      id: id("direct"),
      roomKey,
      systemOnly: true,
      systemName: "관리자",
      tradeType: type,
      postId: post.id,
      tradeTitle: post.title || "거래 상품",
      ownerId: "system",
      starterId: "system",
      participantIds: [userId],
      unreadBy: { [userId]: 0 },
      lastMessage: "",
      lastAt: now(),
      createdAt: now()
    };
    db.directChatRooms.push(room);
  }
  db.directChatMessages.push({
    id: id("dmsg"),
    roomId: room.id,
    senderId: "system",
    displayName: "관리자",
    message,
    attachment: null,
    deleted: false,
    system: true,
    createdAt: now(),
    readBy: ["system"]
  });
  room.lastMessage = message;
  room.lastAt = now();
  room.unreadBy ||= {};
  room.unreadBy[userId] = Number(room.unreadBy[userId] || 0) + 1;
  return room;
}

function ensureDirectRoom(db, user, type, postId) {
  const found = findTradePost(db, type, postId);
  if (!found) return null;
  const { post } = found;
  const isOwner = post.userId === user.id;
  const peerId = isOwner ? post.counterpartyId : user.id;
  if (isOwner && !peerId) return { error: "거래 요청자가 정해진 뒤 채팅을 시작할 수 있습니다." };
  const participantIds = [post.userId, peerId].filter(Boolean).sort();
  let room = (db.directChatRooms || []).find((item) => item.tradeType === found.type && item.postId === post.id && participantIds.every((idValue) => (item.participantIds || []).includes(idValue)));
  if (!room) {
    room = {
      id: id("direct"),
      tradeType: found.type,
      postId: post.id,
      tradeTitle: post.title || "거래글",
      ownerId: post.userId,
      starterId: isOwner ? peerId : user.id,
      participantIds,
      unreadBy: Object.fromEntries(participantIds.map((idValue) => [idValue, 0])),
      lastMessage: "",
      lastAt: now(),
      createdAt: now()
    };
    db.directChatRooms.push(room);
  }
  return { room };
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

function legacyTradeComposePage(user, type, db, selectedSlug = "") {
  const sell = type === "sell";
  const games = (db.games || []).filter((game) => game.visible !== false);
  const selectedGame = games.find((game) => game.slug === selectedSlug) || games[0] || {};
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
          <div class="trade-game-picker" data-trade-game-picker data-compose-type="${sell ? "sell" : "buy"}">
            <input type="hidden" name="gameSlug" value="${esc(selectedGame.slug || "")}" required>
            <div class="trade-game-current">
              <img src="${gameImage(selectedGame)}" alt="">
              <div><span>현재 선택</span><strong>${esc(selectedGame.name || "게임 선택")}</strong></div>
            </div>
            <div class="trade-game-search">
              <input type="search" data-trade-game-search placeholder="게임명 또는 초성을 검색하세요" autocomplete="off">
              <button type="button" data-trade-game-search-button>검색</button>
            </div>
            <div class="trade-game-suggest" data-trade-game-suggest aria-label="게임 추천 검색어"></div>
          </div>
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
          <div class="price-presets"><button type="button" data-price-preset="10000">+1만원</button><button type="button" data-price-preset="50000">+5만원</button><button type="button" data-price-preset="100000">+10만원</button><button type="button" data-price-preset="500000">+50만원</button></div>
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

function renderTradeCard(post, db, owner = false) {
  const member = db.users?.find((item) => item.id === post.userId);
  const sideLabel = tradeTypeLabel(post.type);
  const statusOptions = post.type === "sell" ? ["판매중", "판매 진행중", "판매완료", "숨김"] : ["구매중", "구매 진행중", "구매완료", "숨김"];
  const status = post.status || (post.type === "sell" ? "판매중" : "구매중");
  const displayStatus = tradeStatusLabel(status, post.type);
  return `<article class="trade-card" data-trade-card>
    <a class="trade-card__link" href="${tradeHref(post)}" aria-label="${esc(post.title || "거래글")} 상세보기"></a>
    <div class="trade-card__meta"><span class="${post.type}">${sideLabel}</span><b>${esc(tradeKindLabel(post.tradeKind || post.category))}</b><b>${esc(post.unit || "일반")}</b>${displayStatus ? `<em class="${tradeStatusClass(displayStatus)}">[${esc(displayStatus)}]</em>` : ""}</div>
    <h3>${esc(post.title || "제목 없음")}</h3>
    <p>${esc(post.gameName || post.game)} · ${esc(post.server || "서버전체")}</p>
    <strong>${won(post.price)}</strong>
    <small>${esc(member?.nickname || "회원")} · ${new Date(post.createdAt).toLocaleDateString("ko-KR")}</small>
    ${owner ? `<label class="status-update">상태<select data-trade-status="${esc(post.id)}" data-trade-type="${post.type}">${statusOptions.map((item) => `<option ${item === status ? "selected" : ""}>${item}</option>`).join("")}</select></label>` : ""}
  </article>`;
}

function pointRequestStatusLabel(status = "") {
  if (["approved", "승인", "완료", "처리완료"].includes(status)) return "완료";
  if (["rejected", "거절", "취소", "취소완료", "회원취소"].includes(status)) return "취소";
  return "진행중";
}

function pointLedgerLabel(row) {
  if (row.reason === "trade_payment") return "거래 결제";
  if (row.reason === "trade_receive") return "거래 대금";
  if (row.reason === "charge") return "마일리지 충전";
  if (row.reason === "withdraw") return "마일리지 출금";
  return row.amount >= 0 ? "마일리지 충전" : "마일리지 차감";
}

function mileageHistoryItems(db, user, limit = 12, filterType = "") {
  const requests = (db.pointRequests || []).filter((row) => row.userId === user.id && !row.hiddenFromMember && !["삭제", "롤백"].includes(String(row.status || "")) && (!filterType || row.type === filterType));
  const ledger = (db.pointLedger || []).filter((row) => row.userId === user.id && !row.hiddenFromMember && !["admin_adjust", "rollback", "charge"].includes(row.reason) && (!filterType || row.reason === filterType));
  return [
    ...requests.map((row) => ({ id: row.id, source: "request", label: row.type === "charge" ? "충전요청" : "출금요청", amount: row.amount, status: pointRequestStatusLabel(row.status), rawStatus: String(row.status || ""), createdAt: row.createdAt })),
    ...ledger.map((row) => ({ label: pointLedgerLabel(row), amount: Math.abs(row.amount), status: "완료", createdAt: row.createdAt }))
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}

function mileageHistoryList(db, user, limit = 12, options = {}) {
  const formatDateTime = (value) => new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
  return mileageHistoryItems(db, user, limit, options.type || "").map((row) => `<li>
    <time>${formatDateTime(row.createdAt)}</time>
    <b>${won(row.amount)}</b>
    <span>${row.label}</span>
    <em class="${row.status === "진행중" ? "active" : row.status === "취소" ? "cancel" : "done"}">[${row.status}]</em>
    ${options.allowCancel && row.source === "request" && row.rawStatus === "대기" ? `<button type="button" class="mileage-cancel-request" data-point-cancel="${esc(row.id)}">취소하기</button>` : ""}
  </li>`).join("");
}

function pointDeadlineText(value, minutes = 60) {
  const base = new Date(value || Date.now());
  const deadline = new Date(base.getTime() + minutes * 60 * 1000);
  return `${deadline.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16)}까지`;
}

function isExpiredPendingCharge(request) {
  if (!request || request.type !== "charge") return false;
  if (String(request.status || "대기") !== "대기") return false;
  const createdAt = new Date(request.createdAt || 0).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
  return Date.now() - createdAt >= 60 * 60 * 1000;
}

function tradeComposePage(user, type, db, selectedSlug = "") {
  const sell = type === "sell";
  const games = (db.games || []).filter((game) => game.visible !== false);
  const selectedGame = games.find((game) => game.slug === selectedSlug) || games[0] || {};
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
          <div class="trade-game-picker" data-trade-game-picker data-compose-type="${sell ? "sell" : "buy"}">
            <input type="hidden" name="gameSlug" value="${esc(selectedGame.slug || "")}" required>
            <div class="trade-game-current">
              <img src="${gameImage(selectedGame)}" alt="">
              <div><span>현재 선택</span><strong>${esc(selectedGame.name || "게임 선택")}</strong></div>
            </div>
            <div class="trade-game-search">
              <input type="search" data-trade-game-search placeholder="게임명 또는 초성을 검색하세요" autocomplete="off">
              <button type="button" data-trade-game-search-button>검색</button>
            </div>
            <div class="trade-game-suggest" data-trade-game-suggest aria-label="게임 추천 검색어"></div>
          </div>
        </div>
        <div class="compose-field full">
          <b>구분</b>
          <div class="segmented">${tradeKinds.map((item, index) => `<label><input type="radio" name="tradeKind" value="${esc(item)}" ${index === 0 ? "checked" : ""}><span>${esc(item)}</span></label>`).join("")}</div>
        </div>
        <div class="compose-field full">
          <b>서버</b>
          <div class="chip-grid">${servers.map((item, index) => `<label><input type="radio" name="server" value="${esc(item)}" ${index === 0 ? "checked" : ""}><span>${esc(item)}</span></label>`).join("")}</div>
        </div>
        <div class="compose-field compose-field--unit">
          <b>${sell ? "판매 단위" : "구매 단위"}</b>
          <div class="segmented compact">${sellUnits.map((item, index) => `<label><input type="radio" name="unit" value="${esc(item)}" ${index === 0 ? "checked" : ""}><span>${esc(item)}</span></label>`).join("")}</div>
        </div>
        <div class="compose-field compose-field--price">
          <b>가격</b>
          <div class="price-entry"><input name="price" type="number" min="0" step="1000" placeholder="${sell ? "판매 가격" : "희망 가격"}" required><span>원</span></div>
          <div class="price-presets"><button type="button" data-price-preset="10000">+1만원</button><button type="button" data-price-preset="50000">+5만원</button><button type="button" data-price-preset="100000">+10만원</button><button type="button" data-price-preset="500000">+50만원</button></div>
        </div>
        <div class="compose-field compose-field--quantity">
          <b>캐릭터/수량</b>
          <div class="quantity-stack"><input name="characterName" placeholder="캐릭터명 또는 품목명"><input name="quantity" type="number" min="1" step="1" placeholder="수량"></div>
        </div>
        <div class="compose-field full">
          <b>제목</b>
          <input name="title" placeholder="제목을 입력해주세요." required>
        </div>
        <div class="compose-field full compose-field--editor">
          <b>내용</b>
          <div class="trade-editor-wrap">
            <div class="notice-editor-toolbar trade-editor-toolbar">
              <div class="trade-editor-tool-group">
                <button type="button" class="trade-tool-icon" data-trade-command="undo" title="실행 취소">↶</button>
                <button type="button" class="trade-tool-icon" data-trade-command="redo" title="다시 실행">↷</button>
              </div>
              <select data-trade-font><option value="Malgun Gothic">맑은 고딕</option><option value="Noto Sans KR">본고딕</option><option value="Apple SD Gothic Neo">애플고딕</option><option value="Arial">Arial</option><option value="Tahoma">Tahoma</option><option value="Georgia">Georgia</option><option value="serif">명조</option><option value="sans-serif">고딕 계열</option><option value="monospace">고정폭</option></select>
              <select data-trade-size><option>10</option><option>12</option><option>14</option><option selected>16</option><option>18</option><option>20</option><option>22</option><option>24</option><option>28</option><option>32</option><option>36</option></select>
              <select data-trade-weight><option value="400">보통</option><option value="700">굵게</option><option value="900">아주 굵게</option></select>
              <div class="trade-editor-tool-group">
                <button type="button" class="trade-tool-icon trade-tool-bold" data-trade-command="bold" title="굵게">B</button>
                <button type="button" class="trade-tool-icon trade-tool-italic" data-trade-command="italic" title="기울임">I</button>
                <button type="button" class="trade-tool-icon trade-tool-underline" data-trade-command="underline" title="밑줄">U</button>
                <button type="button" class="trade-tool-icon trade-tool-strike" data-trade-command="strikeThrough" title="취소선">S</button>
              </div>
              <div class="trade-editor-tool-group">
                <button type="button" class="trade-tool-icon" data-trade-command="justifyLeft" title="왼쪽 정렬">좌</button>
                <button type="button" class="trade-tool-icon" data-trade-command="justifyCenter" title="가운데 정렬">중</button>
                <button type="button" class="trade-tool-icon" data-trade-command="justifyRight" title="오른쪽 정렬">우</button>
                <button type="button" class="trade-tool-icon" data-trade-command="insertOrderedList" title="번호 목록">1.</button>
                <button type="button" class="trade-tool-icon" data-trade-command="insertUnorderedList" title="글머리 목록">•</button>
              </div>
              <button type="button" class="trade-editor-apply" data-trade-apply>선택 텍스트 적용</button>
              <button type="button" class="trade-editor-photo" data-trade-image>사진첨부</button>
              <input type="file" accept="image/*" data-trade-file hidden>
            </div>
            <div class="notice-rich-editor trade-rich-editor" contenteditable="true" data-trade-editor aria-label="거래글 내용 편집기"></div>
            <input type="hidden" name="description">
            <input type="hidden" name="descriptionText">
          </div>
        </div>
      </section>
      <section class="trade-compose__actions"><a href="/games">취소</a><button>${sell ? "판매글 등록" : "구매글 등록"}</button><p class="form-message"></p></section>
    </form>
  </main>${chatWidget(user)}`, "trade");
}

function tradeDetailPage(user, db, type, postId) {
  const found = findTradePost(db, type, postId);
  if (!found) return layout("거래글 없음", user, `<main class="trade-detail-page"><section class="trade-detail-card"><h1>거래글을 찾을 수 없습니다.</h1><a class="notice-list-button" href="/games">목록</a></section>${chatWidget(user)}</main>`, "trade");
  const { post } = found;
  const member = db.users?.find((item) => item.id === post.userId);
  const game = db.games?.find((item) => item.slug === post.gameSlug);
  const status = post.status || (type === "sell" ? "판매중" : "구매중");
  const displayStatus = tradeStatusLabel(status, type);
  const statusKey = String(status || "").replace(/\s/g, "");
  const isOwner = user?.id === post.userId;
  const isCompleted = ["판매완료", "구매완료", "거래완료"].includes(statusKey);
  const canDeleteTrade = canAdmin(user) || (isOwner && !isCompleted);
  const canStart = user && !isOwner && ((type === "sell" && status === "판매중") || (type === "buy" && status === "구매중"));
  const isProgressing = type === "sell" ? statusKey === "판매진행중" : statusKey === "구매진행중";
  const canComplete = user && post.counterpartyId === user.id && isProgressing;
  const canOwnerChat = user && isOwner && isProgressing && post.counterpartyId;
  const actionLabel = type === "sell" ? "구매요청하기" : "판매요청하기";
  const completeLabel = type === "sell" ? "판매완료" : "구매완료";
  const sideLabel = type === "sell" ? "팝니다" : "삽니다";
  const amountLabel = type === "sell" ? "판매금액" : "구매금액";
  const quantityLabel = type === "sell" ? "판매수량" : "구매수량";
  const memberTitle = type === "sell" ? "판매자 정보" : "구매자 정보";
  const itemName = post.characterName || post.unit || tradeKindLabel(post.tradeKind || post.category);
  const quantity = post.quantity ? `${post.quantity}개` : "1개";
  const detailId = String(post.id || "").split("_").pop()?.slice(0, 8) || post.id;
  const bodyHtml = noticeBodyHtml(post.descriptionHtml || post.description || post.descriptionText || "");
  return layout(post.title || "거래글", user, `<main class="trade-detail-page" ${gameThemeStyle(game)}>
    <div class="trade-detail-shell">
      <section class="trade-detail-card">
        <header class="trade-detail-head">
          <div>
            <a href="/games/${encodeURIComponent(post.gameSlug || "")}">← 목록</a>
            <p><strong class="${type}">${sideLabel}</strong><span>${esc(post.gameName || post.game || "-")} &gt; ${esc(post.server || "서버전체")}</span></p>
          </div>
          ${displayStatus ? `<em class="${tradeStatusClass(displayStatus)}">[${esc(displayStatus)}]</em>` : ""}
        </header>
        <h1>${esc(post.title || "제목 없음")}</h1>
        <div class="trade-detail-code"><span>#${esc(detailId)}</span><time>${new Date(post.createdAt).toLocaleString("ko-KR")}</time></div>
        <dl class="trade-detail-summary" aria-label="거래 요약">
          <div><dt>${quantityLabel}</dt><dd>${esc(quantity)}</dd></div>
          <div><dt>${amountLabel}</dt><dd>${won(post.price)}</dd></div>
          <div><dt>품목명</dt><dd>${esc(itemName || "-")}</dd></div>
        </dl>
        <section class="trade-detail-section">
          <h2>거래 정보</h2>
          <dl class="trade-detail-info-grid">
            <div><dt>게임</dt><dd>${esc(post.gameName || post.game || "-")}</dd></div>
            <div><dt>서버</dt><dd>${esc(post.server || "서버전체")}</dd></div>
            <div><dt>분류</dt><dd>${esc(tradeKindLabel(post.tradeKind || post.category))}</dd></div>
            <div><dt>단위</dt><dd>${esc(post.unit || "일반")}</dd></div>
            <div><dt>캐릭터명 또는 품목명</dt><dd>${esc(post.characterName || "-")}</dd></div>
            ${displayStatus ? `<div><dt>거래 상태</dt><dd>${esc(displayStatus)}</dd></div>` : ""}
          </dl>
        </section>
        <section class="trade-detail-section">
          <div class="trade-detail-section-head"><h2>${memberTitle}</h2></div>
          <div class="trade-member-card">
            <img src="${gradeAsset(member?.displayGrade || "브론즈")}" alt="${esc(member?.displayGrade || "브론즈")}">
            <strong>${esc(member?.displayGrade || "브론즈")}</strong>
            <span>${esc(member?.nickname || "회원")}</span>
          </div>
        </section>
        <section class="trade-detail-section trade-detail-section--body">
          <h2>물품 상세 정보</h2>
          <article class="trade-detail-body">${bodyHtml || "<p>등록된 상세 내용이 없습니다.</p>"}</article>
        </section>
      </section>
      <aside class="trade-detail-action">
        <dl>
          <div><dt>${amountLabel}</dt><dd>${won(post.price)}</dd></div>
          <div><dt>내 마일리지</dt><dd>${user ? won(user.points) : "로그인 필요"}</dd></div>
        </dl>
        <div class="trade-detail-buttons">
          ${!user ? `<a class="trade-detail-chat" href="/login">채팅</a>` : (!isOwner || canOwnerChat) ? `<button type="button" class="trade-detail-chat" data-direct-chat-start="${type}" data-trade-id="${esc(post.id)}">채팅</button>` : `<button type="button" class="trade-detail-chat" disabled>채팅</button>`}
          ${canStart ? `<button type="button" class="trade-detail-request" data-trade-action="${type}" data-trade-id="${esc(post.id)}">${actionLabel}</button>` : ""}
          ${canComplete ? `<button type="button" class="trade-detail-request" data-trade-complete="${type}" data-trade-id="${esc(post.id)}">${completeLabel}</button>` : ""}
          ${canDeleteTrade ? `<button type="button" class="trade-detail-delete" data-trade-delete="${type}" data-trade-id="${esc(post.id)}">삭제</button>` : ""}
          ${!user && !displayStatus ? `<a class="trade-detail-request" href="/login">${actionLabel}</a>` : ""}
          ${user && isOwner && isProgressing ? `<em>상대방 완료 확정 대기중</em>` : ""}
          ${user && isOwner && !isProgressing ? `<em>내가 등록한 글입니다.</em>` : ""}
          ${user && !isOwner && !canStart && !canComplete ? `<em>${esc(displayStatus || status)}</em>` : ""}
          ${!user && displayStatus ? `<em>${esc(displayStatus)}</em>` : ""}
        </div>
      </aside>
    </div>
    ${chatWidget(user)}
  </main>`, "trade");
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
        <div class="search-field">
          <input id="globalSearch" placeholder="게임명 또는 물품명을 검색하세요" autocomplete="off">
          <div class="suggest-panel" id="globalSuggest" aria-label="추천 검색어"></div>
        </div>
        <button class="search-icon" type="submit" aria-label="검색"><img src="/assets/header/search-icon.png" alt=""></button>
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
  const userSellOpenCount = user ? (db.sellPosts || []).filter((post) => post.userId === user.id && String(post.status || "판매중").replace(/\s/g, "") === "판매중").length : 0;
  const userBuyOpenCount = user ? (db.buyPosts || []).filter((post) => post.userId === user.id && String(post.status || "구매중").replace(/\s/g, "") === "구매중").length : 0;
  const userWaitingCount = user ? [
    ...(db.sellPosts || []),
    ...(db.buyPosts || [])
  ].filter((post) => post.userId === user.id && String(post.status || "").includes("진행중")).length : 0;
  const quickPanel = user ? `<div class="member-summary">
          <div class="member-tier">
            <img class="tier-badge" src="${gradeAsset(displayGrade)}" alt="${displayGrade}">
            <div class="member-grade-row"><strong>${displayGrade} 등급</strong><b>${user.nickname}</b></div>
          </div>
          <p><span>마일리지</span><b class="blue">${points}원</b></p>
          <a class="summary-count-row" href="/mypage"><span>판매중</span><b class="blue">${userSellOpenCount.toLocaleString()}개</b></a>
          <a class="summary-count-row" href="/mypage"><span>구매중</span><b class="green">${userBuyOpenCount.toLocaleString()}개</b></a>
          <a class="summary-count-row" href="/mypage"><span>판매/구매대기</span><b class="orange">${userWaitingCount.toLocaleString()}개</b></a>
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
      <nav><a href="/terms">이용약관</a><a href="/trade-terms">아이템거래약관</a><a href="/privacy">개인정보취급방침</a><a href="/support" data-open-chat>광고/제휴문의</a></nav>
      <div class="footer-body">
        <img src="/assets/logo/itemzone-logo-footer.png" alt="아이템존">
        <div>
          <p>상호 : 겜마톡 / 대표 : 유지훈 / 사업자등록번호 : 807-16-01721 / 통신판매업 : 2024-전주덕진-0100 / 사업자번호 : 807-16-01721</p>
          <p>전라북도 전주시 덕진구 가재미로 83(인후동1가)</p>
          <p>아이템존은 통신판매중개자이며 통신판매의 당사자가 아닙니다. 따라서 아이템존은 상품 거래정보 및 거래에 대하여 책임을 지지 않습니다.</p>
          <p>COPYRIGHT (C) ITEMZONE. ALL RIGHTS RESERVED.</p>
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

function legacySimpleRenderTradeCard(post, db, owner = false) {
  const member = db.users?.find((user) => user.id === post.userId);
  const sideLabel = post.type === "sell" ? "판매" : "구매";
  const statusOptions = post.type === "sell" ? ["판매중", "판매 진행중", "판매완료", "숨김"] : ["구매중", "구매 진행중", "구매완료", "숨김"];
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
  const presets = [["50000", "+5만"], ["100000", "+10만"], ["500000", "+50만"]];
  const bankOptions = WITHDRAW_BANKS.map((bank) => `<option value="${esc(bank)}">${esc(bank)}</option>`).join("");
  const mileageList = mileageHistoryList(db, user, 12, { type, allowCancel: true });
  const chargeAccount = db.site?.chargeAccount || {};
  const pendingChargeRequest = charge ? (db.pointRequests || []).slice().reverse().find((row) => row.userId === user.id && row.type === "charge" && String(row.status || "대기") === "대기" && !row.hiddenFromMember) : null;
  const chargeDeadline = pendingChargeRequest ? pointDeadlineText(pendingChargeRequest.createdAt, 60) : "";
  return layout(charge ? "마일리지충전" : "마일리지출금", user, `<main class="mileage-page ${charge ? "charge-page" : "withdraw-page"}">
    <section class="mileage-info-panel">
      <h1>${charge ? "충전전용계좌" : "본인 계좌 출금"}</h1>
      <div class="mileage-feature-grid">
        <article><i>₩</i><span>마일리지 종류</span><b>${charge ? "출금가능 마일리지" : "일반 마일리지"}</b></article>
        <article><i>%</i><span>${charge ? "충전 수수료" : "출금 수수료"}</span><b>0원</b></article>
        <article><i>↯</i><span>소요 시간</span><b>${charge ? "5분이내" : "30분 이내"}</b></article>
      </div>
      ${charge ? `<ul class="mileage-guide">
        <li>충전 신청 후, 기재된 입금 계좌로 <strong class="mileage-guide-alert">1시간내로</strong> 입금해주세요.</li>
        <li>충전 신청 금액과 입금 금액은 <strong class="mileage-guide-alert">동일</strong>해야 합니다.</li>
        <li>회원명과 입금자명이 <strong class="mileage-guide-alert">동일</strong>해야 합니다.</li>
        <li>가상계좌로 입금하시면 고객님의 아이템존 아이디로 마일리지가 바로 충전됩니다.</li>
      </ul>` : `<ul class="mileage-guide withdraw-guide">
        <li><b>안내사항</b></li>
        <li>23:40 ~ 02:00까지 은행 점검 시간으로 출금이 지연될 수 있습니다.</li>
        <li>출금 신청 후 30분 이내 처리됩니다.</li>
        <li>아이템존 회원명, 은행 예금주명이 다른 경우 출금이 불가합니다.</li>
        <li>[출금 가능 마일리지]는 거래에 사용중인 마일리지, 출금 요청중인 마일리지를 제외한 마일리지입니다.</li>
        <li>최소 출금금액은 2,000원 이상입니다. (1,000원 단위로 입력해주세요.)</li>
      </ul>`}
    </section>
    <aside class="mileage-request-panel">
      <form class="mileage-form" data-form="${type}" data-balance="${balance}">
        <h2>${charge ? "결제 상품" : "보유 마일리지"}</h2>
        ${charge ? `<h3>충전전용계좌 충전</h3>` : `<div class="mileage-balance-box"><p><span>출금 불가 마일리지</span><b>0원</b></p><p><span>출금 가능 마일리지</span><b>${won(balance)}</b></p></div>`}
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
    ${charge && pendingChargeRequest ? `<section class="charge-account-check">
      <h2>충전전용계좌 확인</h2>
      <table>
        <thead><tr><th>은행명</th><th>계좌번호</th><th>이름</th><th>입금마감</th></tr></thead>
        <tbody><tr><td>${esc(chargeAccount.bank || "-")}</td><td>${esc(chargeAccount.number || "-")}</td><td>${esc(chargeAccount.holder || "-")}</td><td>${esc(chargeDeadline)}</td></tr></tbody>
      </table>
      <p class="charge-account-caution"><strong>주의!</strong> <b>카카오뱅크</b> · <b>카카오페이</b> · <b>토스뱅크</b>등의 간편결제 서비스에서는 가상계좌로의 <em>입금 확인이 되지 않습니다.</em></p>
    </section>` : ""}
    <section class="mileage-history mypage-simple-history mileage-page-history">
      <h2>${charge ? "마일리지 충전 내역" : "마일리지 출금 내역"}</h2>
      <nav><button class="active">년별 보기</button><button>월별 보기</button></nav>
      <ul>${mileageList || "<li class='empty-row'>내역이 없습니다.</li>"}</ul>
    </section>
    ${charge ? `<div class="withdraw-confirm-layer" data-charge-modal hidden>
      <section class="withdraw-confirm-card charge-confirm-card" role="dialog" aria-modal="true" aria-labelledby="chargeConfirmTitle">
        <h2 id="chargeConfirmTitle">ItemZone 알림</h2>
        <p class="charge-confirm-copy">충전전용계좌란<br>가입하신 회원님에게 각각 부여되는 가상의 계좌번호로<br>해당 계좌로 입금하시면<br>고객님의 아이템존 아이디로 마일리지가 5분내로 충전됩니다.<br><br>진행하시겠습니까?</p>
        <div class="withdraw-confirm-actions">
          <button type="button" data-charge-confirm>확인</button>
          <button type="button" class="ghost" data-charge-cancel>취소</button>
        </div>
      </section>
    </div>` : ""}
    ${!charge ? `<div class="withdraw-confirm-layer" data-withdraw-modal hidden>
      <section class="withdraw-confirm-card" role="dialog" aria-modal="true" aria-labelledby="withdrawConfirmTitle">
        <h2 id="withdrawConfirmTitle">출금 계좌 확인</h2>
        <p>입력하신 계좌로 출금 신청이 접수됩니다.</p>
        <label>은행/증권사
          <select name="withdrawBank" required>
            <option value="">은행 또는 증권사를 선택하세요</option>
            ${bankOptions}
          </select>
        </label>
        <label>계좌번호
          <input name="withdrawAccountNumber" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="계좌번호를 입력하세요" required>
        </label>
        <label>예금주명
          <input name="withdrawHolder" autocomplete="name" placeholder="예금주명을 입력하세요" value="${esc(user?.name || user?.nickname || "")}" required>
        </label>
        <div class="withdraw-confirm-summary">
          <span>출금 신청 금액</span>
          <b data-withdraw-confirm-amount>0원</b>
        </div>
        <div class="withdraw-confirm-actions">
          <button type="button" class="ghost" data-withdraw-cancel>취소</button>
          <button type="button" data-withdraw-confirm>출금신청</button>
        </div>
      </section>
    </div>` : ""}
    ${chatWidget(user)}
  </main>`, "point");
}

function myPage(user, db) {
  const sellPosts = (db.sellPosts || []).filter((post) => post.userId === user.id).map((post) => ({ ...post, type: "sell" }));
  const buyPosts = (db.buyPosts || []).filter((post) => post.userId === user.id).map((post) => ({ ...post, type: "buy" }));
  const displayGrade = user.displayGrade || "브론즈";
  const tradeStatus = (post) => {
    if (post.status?.includes("숨김") || post.status?.includes("취소")) return "취소";
    return tradeStatusLabel(post.status, post.type);
  };
  const tradeRows = (posts, emptyText) => {
    const rows = posts.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((post) => {
      const status = tradeStatus(post);
      return `<a class="mypage-trade-row" href="${tradeHref(post)}">
        <span class="mypage-trade-title">${esc(post.title || "제목 없음")}</span>
        <small>${esc(post.gameName || post.game || "게임")} · ${esc(post.server || "서버전체")}</small>
        <b>${won(post.price)}</b>
        ${status ? `<em class="${status.includes("진행") ? "active" : status === "취소" ? "cancel" : "done"}">[${status}]</em>` : ""}
      </a>`;
    }).join("");
    return rows || `<p class="mypage-empty">${emptyText}</p>`;
  };
  const mileageList = mileageHistoryList(db, user, 12);
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
  const editCell = (name, value, type = "text") => `<div class="admin-edit-field" data-admin-field="${name}"><span>${esc(value || "-")}</span><input name="${name}" type="${type}" value="${esc(value || "")}" hidden><button type="button" data-admin-edit="${name}">수정</button></div>`;
  const passwordCell = () => `<div class="admin-edit-field password" data-admin-field="password"><span>변경 전용</span><input name="password" type="password" value="" placeholder="새 비밀번호" hidden><button type="button" data-admin-edit="password">수정</button></div>`;
  const selectCell = (name, value, options) => `<div class="admin-edit-field" data-admin-field="${name}"><span>${esc(value || "-")}</span><select name="${name}" hidden>${options.map((option) => `<option value="${esc(option)}" ${option === value ? "selected" : ""}>${esc(option)}</option>`).join("")}</select><button type="button" data-admin-edit="${name}">수정</button></div>`;
  const roleOptions = user.role === "OWNER" ? ROLES : ROLES.filter((role) => role !== "OWNER");
  const users = db.users.map((u) => `<tr data-admin-user-row="${esc(u.id)}">
    <td>${editCell("username", u.username)}</td>
    <td>${passwordCell()}</td>
    <td>${editCell("nickname", u.nickname)}</td>
    <td>${editCell("phone", u.phone)}</td>
    <td>${editCell("name", u.name)}</td>
    <td>${selectCell("role", u.role, roleOptions.includes(u.role) ? roleOptions : [u.role, ...roleOptions])}</td>
    <td>${selectCell("displayGrade", u.displayGrade, DISPLAY_GRADES)}</td>
    <td>${selectCell("internalGrade", normalizeInternalGrade(u.internalGrade), INTERNAL_GRADES)}</td>
    <td>${editCell("points", Number(u.points || 0), "number")}</td>
    <td><button type="button" class="admin-row-save" data-admin-user-save="${esc(u.id)}">저장</button></td>
  </tr>`).join("");
  const reqs = db.pointRequests.slice().reverse().map((r) => {
    const member = db.users.find((u) => u.id === r.userId);
    const status = String(r.status || "대기");
    const isWithdraw = r.type === "withdraw";
    const withdrawAccount = isWithdraw && r.withdrawAccount
      ? `<div class="point-account"><b>${esc(r.withdrawAccount.bank || "-")}</b><span>${esc(r.withdrawAccount.number || "-")}</span><small>${esc(r.withdrawAccount.holder || "-")}</small></div>`
      : `<span class="point-account empty">-</span>`;
    const isPending = status === "대기";
    const isApproved = ["approved", "승인", "완료", "처리완료"].includes(status);
    const actions = isPending
      ? `<button data-point="${r.id}" data-decision="approved">완료처리</button><button data-point="${r.id}" data-decision="rejected">취소</button><button data-point="${r.id}" data-decision="deleted">삭제</button>`
      : isApproved
        ? `<button data-point="${r.id}" data-decision="rollback">롤백</button><button data-point="${r.id}" data-decision="deleted">삭제</button>`
        : `<button data-point="${r.id}" data-decision="deleted">삭제</button>`;
    return `<tr class="point-row ${isWithdraw ? "withdraw" : "charge"}"><td><span class="point-type ${isWithdraw ? "withdraw" : "charge"}">${isWithdraw ? "출금" : "충전"}</span></td><td>${esc(member?.nickname || r.nickname || "-")}</td><td>${esc(r.name || member?.name || "-")}</td><td>${Number(r.amount).toLocaleString()}원</td><td>${withdrawAccount}</td><td>${esc(status)}</td><td>${actions}</td></tr>`;
  }).join("");
  const latestNotices = noticePosts(db).slice(0, 6).map((post) => `<li><a href="/notices/${encodeURIComponent(post.id)}">${post.pinned ? "[상단고정] " : ""}${esc(post.title)}</a><span>${noticeDate(post.createdAt)}</span></li>`).join("");
  const noticeInputDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return layout("관리자", user, `<main class="admin-page">
    <h1>운영 관리자</h1>
    <section class="admin-grid">
      <form class="panel account-admin-form" data-form="site"><h2>계좌번호 등록</h2>
        <input name="bank" value="${db.site.chargeAccount.bank}" placeholder="은행">
        <input name="holder" value="${db.site.chargeAccount.holder}" placeholder="예금주">
        <input name="number" value="${db.site.chargeAccount.number}" placeholder="계좌번호">
        <button>저장</button><p class="form-message"></p>
      </form>
      <form class="panel" data-form="staff"><h2>운영진 계정 생성</h2>
        <input name="username" placeholder="아이디"><input name="password" type="password" placeholder="비밀번호"><input name="nickname" placeholder="닉네임">
        <select name="role"><option>STAFF</option></select><button>생성</button><p class="form-message"></p>
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
    <section class="panel table-panel"><h2>회원 개인정보/등급 관리</h2><table><thead><tr><th>ID</th><th>비밀번호</th><th>닉네임</th><th>전화</th><th>이름</th><th>권한</th><th>표시등급</th><th>내부등급</th><th>마일리지</th><th></th></tr></thead><tbody>${users}</tbody></table></section>
    <span id="pointRequests" class="admin-scroll-anchor"></span><section class="panel table-panel point-request-panel"><div class="panel-head"><h2>충전/출금 신청</h2><a href="/admin?refresh=${Date.now()}#pointRequests" class="admin-refresh-button">새로고침</a></div><table><thead><tr><th>구분</th><th>닉네임</th><th>이름</th><th>금액</th><th>출금계좌</th><th>상태</th><th></th></tr></thead><tbody>${reqs || "<tr><td colspan='7'>신청 내역이 없습니다.</td></tr>"}</tbody></table></section>
  </main>`, "admin");
}

function staffPage(user) {
  return layout("상담사", user, `<main class="staff-page">
    <aside class="chat-list"><h1>상담함 <span id="roomCount">0</span></h1><div id="staffRooms"></div></aside>
    <section class="staff-chat"><div class="room-meta"><span id="staffRoomMeta">상담방을 선택하세요.</span><button type="button" id="staffClearRoom" disabled>채팅방 비우기</button></div><div id="staffMessages" class="chat-log"></div><form id="staffSend" class="staff-send-form"><input id="staffChatFileInput" type="file" accept="image/*" hidden><textarea name="message" rows="1" placeholder="답변 입력" autocomplete="off"></textarea><button type="button" id="staffChatAttach">사진</button><div id="staffChatAttachmentPreview" class="staff-attachment-preview"></div><button>전송</button></form></section>
  </main>`, "staff");
}

function supportPage(user) {
  return layout("고객센터", user, `<main class="support-page"><section class="panel"><h1>고객센터</h1><p>우하단 상담 버튼으로 로그인 회원만 실시간 상담을 시작할 수 있습니다.</p></section></main>${chatWidget(user)}`, "support");
}

function legalPage(user, kind = "service") {
  const doc = LEGAL_DOCS[kind] || LEGAL_DOCS.service;
  let body = "";
  try {
    body = readFileSync(path.join(LEGAL_DIR, doc.file), "utf8");
  } catch {
    body = `<p>약관 문서를 불러오지 못했습니다.</p>`;
  }
  body = body.replace(/<h3>[\s\S]*?<\/h3>/i, `<h3>${doc.title} - 아이템존</h3>`);
  return layout(doc.title, user, `<main class="legal-page">
    <section class="legal-card">
      ${body}
    </section>
    ${chatWidget(user)}
  </main>`, "notice");
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
  const canDelete = canAdmin(user);
  return layout(post.title, user, `<main class="notice-page">
    <h1><a href="/notices">공지사항</a></h1>
    <article class="notice-detail-card">
      <h2>${esc(post.title)}</h2>
      <div class="notice-author"><span class="notice-author-icon">i</span><b>관리자</b><time>${noticeDate(post.createdAt, true)}</time></div>
      <div class="notice-body" style="${noticeContentStyle(post)}">${noticeBodyHtml(post.body)}</div>
    </article>
    <div class="notice-detail-actions">
      <a class="notice-list-button" href="/notices">☰ 목록</a>
      ${canDelete ? `<button type="button" class="notice-delete-button" data-notice-delete="${esc(post.id)}">삭제</button>` : ""}
    </div>
    ${chatWidget(user)}
  </main>`, "notice");
}

function chatWidget(user) {
  if (!user) return `<a class="direct-chat-fab locked" href="/login" aria-label="개인채팅"><img class="direct-chat-icon direct-chat-icon-green" src="/assets/chat/direct-chat-green.png" alt=""></a><a class="chat-fab locked" href="/login" aria-label="상담사연결"><img class="support-icon-blue" src="/assets/icons/chat-support.png" alt=""></a>`;
  return `<button class="direct-chat-fab" id="directChatOpen" aria-label="개인채팅" aria-expanded="false"><img class="direct-chat-icon direct-chat-icon-green" src="/assets/chat/direct-chat-green.png" alt=""><img class="direct-chat-icon direct-chat-icon-red" src="/assets/chat/direct-chat-red.png" alt=""><em>×</em><span class="fab-unread-count" data-direct-unread-count hidden>0</span></button>
  <section class="direct-chat-widget" id="directChatWidget" aria-label="개인 채팅">
    <header class="direct-chat-head">
      <button type="button" id="directChatBack" class="direct-chat-back" aria-label="채팅방 목록">‹</button>
      <div id="directChatTitle"><b>채팅</b></div>
      <button type="button" id="directChatClose" class="direct-chat-close" aria-label="닫기">×</button>
    </header>
    <div id="directChatRooms" class="direct-chat-rooms"></div>
    <div id="directChatLog" class="chat-log member-chat-log direct-chat-log" hidden></div>
    <form id="directChatSend" class="member-chat-send direct-chat-send" hidden>
      <input id="directChatFileInput" type="file" accept="image/*" hidden>
      <div class="chat-composer">
        <textarea name="message" rows="1" placeholder="메시지를 입력해주세요." autocomplete="off"></textarea>
        <div class="chat-tools"><button type="button" id="directChatAttach" aria-label="파일첨부">📎</button></div>
        <div id="directChatAttachmentPreview" class="chat-attachment-preview"></div>
        <button class="chat-send-button" type="submit" aria-label="전송"><img src="/assets/chat/send-idle.png" alt=""></button>
      </div>
    </form>
  </section>
  <button class="chat-fab" id="chatOpen" aria-label="상담사연결" aria-expanded="false"><img class="support-icon-blue" src="/assets/icons/chat-support.png" alt=""><img class="support-icon-red" src="/assets/icons/chat-support-red.png" alt=""><span>×</span><i class="fab-unread-count" data-support-unread-count hidden>0</i></button>
  <section class="chat-widget" id="chatWidget" aria-label="아이템존 고객센터">
    <header class="member-chat-head">
      <img class="chat-agent-mark" src="/assets/chat/customer-center-agent.png" alt="">
      <div><b>아이템존 고객센터</b><small>상담시간은 오전9시 ~ 새벽4시까지입니다.</small></div>
      <button type="button" id="chatClose" class="chat-close" aria-label="닫기">×</button>
    </header>
    <div id="memberChatLog" class="chat-log member-chat-log"></div>
    <form id="memberChatSend" class="member-chat-send">
      <input id="chatFileInput" type="file" accept="image/*" hidden>
      <div class="chat-composer">
        <textarea name="message" rows="1" placeholder="메시지를 입력해주세요." autocomplete="off"></textarea>
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
    if (pathname === "/api/search-games" && req.method === "GET") {
      const q = requestUrl.searchParams.get("q") || "";
      return send(res, 200, { games: searchGameResults(db, q) });
    }
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
      const realName = String(data.realName || "").trim();
      const password = String(data.password || "");
      const passwordConfirm = String(data.passwordConfirm || "");
      const phoneMid = String(data.phoneMid || "").replace(/\D/g, "");
      const phoneLast = String(data.phoneLast || "").replace(/\D/g, "");
      const phone = `010-${phoneMid}-${phoneLast}`;
      if (!username || !nickname || !realName || !password || !data.phoneCarrier || phoneMid.length !== 4 || phoneLast.length !== 4) return send(res, 400, { error: "입력값을 확인하세요." });
      if (!/^(?=.*[a-z])(?=.*\d)[a-z\d]{8,}$/.test(password)) return send(res, 400, { error: "비밀번호는 8자 이상 영문 소문자와 숫자를 조합해주세요." });
      if (password !== passwordConfirm) return send(res, 400, { error: "패스워드 재확인이 일치하지 않습니다." });
      if (db.users.some((u) => String(u.username || "").toLowerCase() === username.toLowerCase())) return send(res, 409, { error: "이미 사용 중인 아이디입니다." });
      if (db.users.some((u) => String(u.nickname || "").toLowerCase() === nickname.toLowerCase())) return send(res, 409, { error: "이미 사용 중인 닉네임입니다." });
      const newUser = { id: id("user"), username, passwordHash: await hashPassword(password), nickname, name: realName, phone, phoneCarrier: data.phoneCarrier, bank: "-", accountNumber: "-", displayGrade: "브론즈", internalGrade: "1급", role: "MEMBER", status: "정상", points: 0, createdAt: now() };
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
      const descriptionHtml = sanitizeNoticeHtml(String(data.description || "").trim());
      const descriptionText = String(data.descriptionText || "").trim();
      const row = { id: id(data.type), userId: user.id, gameSlug: game.slug, gameName: game.name, game: game.name, server: data.server || "서버전체", tradeKind: tradeKindLabel(data.tradeKind), category: tradeKindLabel(data.tradeKind), unit: data.unit || "일반", characterName: data.characterName || "", quantity: data.quantity ? Number(data.quantity) : null, title: data.title, description: descriptionHtml, descriptionHtml, descriptionText, price: Number(data.price), status: data.type === "sell" ? "판매중" : "구매중", createdAt: now() };
      db[data.type === "sell" ? "sellPosts" : "buyPosts"].push(row); await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/trade/action" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const type = data.type === "buy" ? "buy" : "sell";
      const collection = tradeCollection(db, type);
      const post = collection.find((item) => item.id === data.id);
      if (!post) return send(res, 404, { error: "거래글을 찾을 수 없습니다." });
      if (post.userId === user.id) return send(res, 403, { error: "본인이 등록한 글입니다." });
      const openStatus = type === "sell" ? "판매중" : "구매중";
      const nextStatus = type === "sell" ? "판매 진행중" : "구매 진행중";
      const status = post.status || openStatus;
      if (status !== openStatus) return send(res, 400, { error: "이미 진행 중이거나 완료된 거래입니다." });
      post.status = nextStatus;
      post.counterpartyId = user.id;
      post.updatedAt = now();
      notifyTradeRequested(db, post, type, user);
      addTradeRequestGreeting(db, post, type, user);
      await writeDb(db);
      return send(res, 200, { ok: true, status: nextStatus });
    }
    if (pathname === "/api/trade/complete" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const type = data.type === "buy" ? "buy" : "sell";
      const collection = tradeCollection(db, type);
      const post = collection.find((item) => item.id === data.id);
      if (!post) return send(res, 404, { error: "거래글을 찾을 수 없습니다." });
      if (post.counterpartyId !== user.id) return send(res, 403, { error: "거래 요청자만 완료할 수 있습니다." });
      const statusKey = String(post.status || "").replace(/\s/g, "");
      const expectedStatus = type === "sell" ? "판매진행중" : "구매진행중";
      if (statusKey !== expectedStatus) return send(res, 400, { error: "진행 중인 거래만 완료할 수 있습니다." });
      const transfer = tradeMileageTransfer(db, post, type);
      if (!transfer.ok) return send(res, 400, { error: transfer.error });
      post.status = type === "sell" ? "판매완료" : "구매완료";
      post.completedBy = user.id;
      post.completedAt = now();
      post.updatedAt = now();
      const notification = notifyTradeCompleted(db, post, type);
      await writeDb(db);
      return send(res, 200, { ok: true, status: post.status, message: notification.message, tone: notification.tone });
    }
    if (pathname === "/api/trade/delete" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const type = data.type === "buy" ? "buy" : "sell";
      const collection = tradeCollection(db, type);
      const index = collection.findIndex((item) => item.id === data.id);
      if (index < 0) return send(res, 404, { error: "거래글을 찾을 수 없습니다." });
      const target = collection[index];
      const targetStatus = String(target.status || "").replace(/\s/g, "");
      if (!canAdmin(user)) {
        if (target.userId !== user.id) return send(res, 403, { error: "본인이 등록한 글만 삭제할 수 있습니다." });
        if (["판매완료", "구매완료", "거래완료"].includes(targetStatus)) return send(res, 400, { error: "거래완료된 글은 관리자만 삭제할 수 있습니다." });
      }
      const [removed] = collection.splice(index, 1);
      audit(db, user, "TRADE_DELETE", removed.id);
      await writeDb(db);
      return send(res, 200, { ok: true, redirect: removed.gameSlug ? `/games/${encodeURIComponent(removed.gameSlug)}` : "/games" });
    }
    if (pathname === "/api/trade/status" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const collection = tradeCollection(db, data.type);
      const post = collection.find((item) => item.id === data.id);
      if (!post) return send(res, 404, { error: "거래글을 찾을 수 없습니다." });
      if (post.userId !== user.id && !canAdmin(user)) return send(res, 403, { error: "권한이 없습니다." });
      const allowed = data.type === "sell" ? ["판매중", "판매 진행중", "판매진행중", "판매완료", "숨김"] : ["구매중", "구매 진행중", "구매진행중", "구매완료", "숨김"];
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
      if (!["charge", "withdraw"].includes(data.type)) return send(res, 400, { error: "신청 종류를 확인하세요." });
      if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: "신청 금액을 확인하세요." });
      if (data.type === "withdraw" && amount > Number(user.points || 0)) return send(res, 400, { error: "출금 가능 마일리지를 초과했습니다." });
      let withdrawAccount = null;
      if (data.type === "withdraw") {
        if (amount < 2000) return send(res, 400, { error: "최소 출금 금액은 2,000원입니다." });
        const bank = String(data.withdrawBank || "").trim();
        const number = String(data.withdrawAccountNumber || "").trim();
        const holder = String(data.withdrawHolder || "").trim();
        if (!WITHDRAW_BANKS.includes(bank)) return send(res, 400, { error: "출금 은행을 선택하세요." });
        if (!/^\d+$/.test(number)) return send(res, 400, { error: "계좌번호는 숫자만 입력하세요." });
        if (!number || !holder) return send(res, 400, { error: "출금 계좌번호와 예금주명을 입력하세요." });
        withdrawAccount = { bank, number, holder };
        user.points = Number(user.points || 0) - amount;
      }
      if (data.type === "charge") {
        (db.pointRequests || []).filter((row) => row.userId === user.id && row.type === "charge" && String(row.status || "대기") === "대기").forEach((row) => {
          row.status = "회원취소";
          row.memberCanceledAt = now();
          row.autoCanceledByNextCharge = true;
        });
      }
      const pointRequest = { id: id("point"), userId: user.id, type: data.type, amount, nickname: user.nickname || "", name: user.name || "", withdrawAccount, status: "대기", pointsReserved: data.type === "withdraw", pointsReleased: false, createdAt: now(), handledBy: null, handledAt: null };
      db.pointRequests.push(pointRequest);
      await writeDb(db); return send(res, 200, { ok: true, account: db.site.chargeAccount, amount, deadline: data.type === "charge" ? pointDeadlineText(pointRequest.createdAt, 60) : "" });
    }
    if (pathname === "/api/point-request/cancel" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const request = db.pointRequests.find((row) => row.id === data.id && row.userId === user.id);
      if (!request) return send(res, 404, { error: "취소할 신청 내역이 없습니다." });
      if (String(request.status || "대기") !== "대기") return send(res, 400, { error: "진행중 신청만 취소할 수 있습니다." });
      const amount = Number(request.amount || 0);
      if (request.type === "withdraw" && request.pointsReserved && !request.pointsReleased) {
        user.points = Math.max(0, Number(user.points || 0) + amount);
        request.pointsReleased = true;
        db.pointLedger.push({ id: id("ledger"), requestId: request.id, userId: user.id, amount, reason: "withdraw_release", hiddenFromMember: true, createdAt: now() });
      }
      request.status = "회원취소";
      request.memberCanceledAt = now();
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/site" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      if (data.bannerTitle) db.site.banners[0].title = data.bannerTitle;
      if (data.bannerSubtitle) db.site.banners[0].subtitle = data.bannerSubtitle;
      db.site.chargeAccount = { bank: String(data.bank || "").trim(), holder: String(data.holder || "").trim(), number: String(data.number || "").trim() };
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
    if (pathname === "/api/admin/notice/delete" && req.method === "POST") {
      if (!canAdmin(user)) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      const before = db.site.posts.length;
      db.site.posts = db.site.posts.filter((post) => post.id !== data.id);
      if (db.site.posts.length === before) return send(res, 404, { error: "공지사항을 찾을 수 없습니다." });
      audit(db, user, "NOTICE_DELETE", data.id);
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/staff" && req.method === "POST") {
      if (user?.role !== "OWNER") return send(res, 403, { error: "챌린저 계정만 운영진을 생성할 수 있습니다." });
      const data = await body(req);
      db.users.push({ id: id("user"), username: data.username, passwordHash: await hashPassword(data.password), nickname: data.nickname, name: "", phone: "-", bank: "-", accountNumber: "-", displayGrade: "마스터", internalGrade: "1급", role: ROLES.includes(data.role) ? data.role : "STAFF", status: "정상", points: 0, createdAt: now() });
      audit(db, user, "STAFF_CREATE"); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/user" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      const target = db.users.find((u) => u.id === data.id);
      if (!target) return send(res, 404, { error: "회원을 찾을 수 없습니다." });
      const username = String(data.username || "").trim();
      const nickname = String(data.nickname || "").trim();
      if (!username || !nickname) return send(res, 400, { error: "아이디와 닉네임을 확인하세요." });
      if (db.users.some((item) => item.id !== target.id && String(item.username || "").toLowerCase() === username.toLowerCase())) return send(res, 409, { error: "이미 사용 중인 아이디입니다." });
      if (db.users.some((item) => item.id !== target.id && String(item.nickname || "").toLowerCase() === nickname.toLowerCase())) return send(res, 409, { error: "이미 사용 중인 닉네임입니다." });
      target.username = username;
      target.nickname = nickname;
      target.name = String(data.name || "").trim();
      const nextPassword = String(data.password || "").trim();
      if (nextPassword) {
        if (!/^(?=.*[a-z])(?=.*\d)[a-z\d]{8,}$/.test(nextPassword)) return send(res, 400, { error: "비밀번호는 8자 이상, 영문 소문자와 숫자를 조합해주세요." });
        target.passwordHash = await hashPassword(nextPassword);
      }
      target.phone = String(data.phone || "").trim();
      if (ROLES.includes(data.role)) {
        if (data.role === "OWNER" && user.role !== "OWNER") return send(res, 403, { error: "오너 권한은 오너만 지정할 수 있습니다." });
        target.role = data.role;
      }
      if (DISPLAY_GRADES.includes(data.displayGrade)) target.displayGrade = data.displayGrade;
      const nextInternalGrade = normalizeInternalGrade(data.internalGrade);
      if (INTERNAL_GRADES.includes(nextInternalGrade)) target.internalGrade = nextInternalGrade;
      const nextPoints = Math.max(0, Math.floor(Number(data.points || 0)));
      if (Number.isFinite(nextPoints) && nextPoints !== Number(target.points || 0)) {
        const before = Number(target.points || 0);
        target.points = nextPoints;
        db.pointLedger.push({ id: id("ledger"), userId: target.id, amount: nextPoints - before, reason: "admin_adjust", staffId: user.id, hiddenFromMember: true, createdAt: now() });
      }
      if (["정상", "정지"].includes(data.status)) target.status = data.status;
      audit(db, user, "USER_UPDATE", target.id); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/point" && req.method === "POST") {
      if (!protect(user, "admin")) return send(res, 403, { error: "권한이 없습니다." });
      const data = await body(req);
      const request = db.pointRequests.find((r) => r.id === data.id);
      if (!request) return send(res, 404, { error: "처리할 신청이 없습니다." });
      const member = db.users.find((u) => u.id === request.userId);
      const status = String(request.status || "대기");
      const amount = Number(request.amount || 0);
      const signedAmount = request.type === "charge" ? amount : -amount;
      const linkedPointLedger = (row) => row.requestId === request.id || (!row.requestId && row.userId === request.userId && row.reason === request.type && Number(row.amount || 0) === signedAmount && (!request.handledAt || Math.abs(new Date(row.createdAt).getTime() - new Date(request.handledAt).getTime()) < 30000));
      const isWithdraw = request.type === "withdraw";
      const isApprovedStatus = ["approved", "승인", "완료", "처리완료"].includes(status);
      const releaseWithdrawReservation = () => {
        if (!member || !isWithdraw || !request.pointsReserved || request.pointsReleased) return false;
        member.points = Math.max(0, Number(member.points || 0) + amount);
        request.pointsReleased = true;
        db.pointLedger.push({ id: id("ledger"), requestId: request.id, userId: member.id, amount, reason: "withdraw_release", staffId: user.id, hiddenFromMember: true, createdAt: now() });
        return true;
      };
      if (data.decision === "approved") {
        if (status !== "대기") return send(res, 400, { error: "대기 상태만 완료처리할 수 있습니다." });
        request.status = "승인";
        request.handledBy = user.id; request.handledAt = now();
        if (member && request.type === "charge") {
          member.points = Number(member.points || 0) + amount;
          db.pointLedger.push({ id: id("ledger"), requestId: request.id, userId: member.id, amount: signedAmount, reason: request.type, staffId: user.id, createdAt: now() });
        } else if (isWithdraw) {
          request.pointsCommitted = true;
        }
      } else if (data.decision === "rejected") {
        if (status !== "대기") return send(res, 400, { error: "대기 상태만 취소할 수 있습니다." });
        request.status = "거절";
        request.handledBy = user.id; request.handledAt = now();
        releaseWithdrawReservation();
      } else if (data.decision === "rollback") {
        if (!isApprovedStatus) return send(res, 400, { error: "완료된 요청만 롤백할 수 있습니다." });
        request.status = "롤백";
        request.hiddenFromMember = true;
        request.rolledBackBy = user.id; request.rolledBackAt = now();
        if (member && request.type === "charge") {
          member.points = Math.max(0, Number(member.points || 0) - signedAmount);
          db.pointLedger.forEach((row) => {
            if (linkedPointLedger(row)) row.hiddenFromMember = true;
          });
          db.pointLedger.push({ id: id("ledger"), requestId: request.id, userId: member.id, amount: -signedAmount, reason: "rollback", staffId: user.id, hiddenFromMember: true, createdAt: now() });
        } else if (isWithdraw) {
          releaseWithdrawReservation();
        }
      } else if (data.decision === "deleted") {
        if (status === "대기") releaseWithdrawReservation();
        request.status = "삭제";
        request.hiddenFromMember = true;
        request.deletedBy = user.id; request.deletedAt = now();
        db.pointLedger.forEach((row) => {
          if (linkedPointLedger(row)) row.hiddenFromMember = true;
        });
      } else {
        return send(res, 400, { error: "처리 값을 확인하세요." });
      }
      audit(db, user, "POINT_HANDLE", request.id); await writeDb(db); return send(res, 200, { ok: true });
    }
    if (pathname === "/api/notifications" && req.method === "GET") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      db.userNotifications ||= [];
      const notifications = db.userNotifications.filter((item) => item.userId === user.id);
      if (notifications.length) {
        const ids = new Set(notifications.map((item) => item.id));
        db.userNotifications = db.userNotifications.filter((item) => !ids.has(item.id));
        await writeDb(db);
      }
      return send(res, 200, { notifications });
    }
    if (pathname === "/api/direct-chat/start" && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const data = await body(req);
      const result = ensureDirectRoom(db, user, data.type, data.id);
      if (!result) return send(res, 404, { error: "거래글을 찾을 수 없습니다." });
      if (result.error) return send(res, 403, { error: result.error });
      await writeDb(db);
      return send(res, 200, { ok: true, room: directChatMeta(db, result.room, user) });
    }
    if (pathname === "/api/direct-chat/rooms" && req.method === "GET") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const rooms = (db.directChatRooms || [])
        .filter((room) => (room.participantIds || []).includes(user.id))
        .map((room) => directChatMeta(db, room, user))
        .sort((a, b) => String(b.lastAt || "").localeCompare(String(a.lastAt || "")));
      return send(res, 200, { rooms });
    }
    if (pathname.startsWith("/api/direct-chat/") && pathname.endsWith("/delete-message") && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const roomId = pathname.split("/").at(-2);
      const room = findDirectRoom(db, roomId, user);
      if (!room) return send(res, 404, { error: "채팅방을 찾을 수 없습니다." });
      const data = await body(req);
      const message = (db.directChatMessages || []).find((item) => item.id === data.id && item.roomId === room.id && item.senderId === user.id);
      if (!message) return send(res, 404, { error: "삭제할 메시지가 없습니다." });
      message.deleted = true;
      message.deletedAt = now();
      const visibleMessages = (db.directChatMessages || []).filter((item) => item.roomId === room.id && !item.deleted);
      const latest = visibleMessages.at(-1);
      room.lastMessage = latest ? latest.message || (latest.attachment ? `첨부파일: ${latest.attachment.name}` : "") : "";
      room.lastAt = latest?.createdAt || now();
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname.startsWith("/api/direct-chat/") && req.method === "GET") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const roomId = pathname.split("/").pop();
      const room = findDirectRoom(db, roomId, user);
      if (!room) return send(res, 404, { error: "채팅방을 찾을 수 없습니다." });
      room.unreadBy ||= {};
      let changed = Number(room.unreadBy[user.id] || 0) !== 0;
      room.unreadBy[user.id] = 0;
      (db.directChatMessages || []).forEach((message) => {
        if (message.roomId === room.id && message.senderId !== user.id) {
          message.readBy ||= [];
          if (!message.readBy.includes(user.id)) {
            message.readBy.push(user.id);
            changed = true;
          }
        }
      });
      if (changed) await writeDb(db);
      return send(res, 200, { room: directChatMeta(db, room, user), messages: directMessages(db, room, user) });
    }
    if (pathname.startsWith("/api/direct-chat/") && req.method === "POST") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const roomId = pathname.split("/").pop();
      const room = findDirectRoom(db, roomId, user);
      if (!room) return send(res, 404, { error: "채팅방을 찾을 수 없습니다." });
      if (room.systemOnly) return send(res, 403, { error: "답장이 불가한 채팅입니다." });
      const data = await body(req);
      addDirectMessage(db, room, user, data.message, data.attachment);
      await writeDb(db);
      return send(res, 200, { ok: true });
    }
    if (pathname === "/api/chat/member/unread" && req.method === "GET") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const room = (db.chatRooms || []).find((item) => item.userId === user.id);
      return send(res, 200, { unread: Number(room?.memberUnread || 0) });
    }
    if (pathname === "/api/chat/member" && req.method === "GET") {
      if (!protect(user, "member")) return send(res, 401, { error: "로그인이 필요합니다." });
      const room = (db.chatRooms || []).find((item) => item.userId === user.id && item.status !== "종료");
      if (!room) return send(res, 200, { messages: [supportGreetingMessage()] });
      const unreadStaffMessages = db.chatMessages.filter((m) => m.roomId === room.id && m.senderType === "staff" && !m.read);
      if (unreadStaffMessages.length || room.memberUnread) {
        unreadStaffMessages.forEach((m) => { m.read = true; m.readAt = now(); });
        room.memberUnread = 0;
        await writeDb(db);
      }
      const messages = memberMessages(db, room.id);
      return send(res, 200, { messages: [supportGreetingMessage(), ...messages] });
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
      const rooms = db.chatRooms.filter((r) => db.chatMessages.some((m) => m.roomId === r.id)).map((r) => {
        const member = db.users.find((u) => u.id === r.userId);
        return { ...r, memberName: member?.nickname, username: member?.username, realName: member?.name || "", name: member?.name || "", displayGrade: member?.displayGrade, internalGrade: normalizeInternalGrade(member?.internalGrade) };
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

function supportGreetingMessage() {
  return { id: "support_greeting", senderType: "staff", displayName: "아이템존 상담사", message: "안녕하세요.\n아이템존 고객센터 입니다.", attachment: null, deletedByMember: false, createdAt: now() };
}

function addDirectMessage(db, room, user, message, attachment = null) {
  const text = String(message || "").trim();
  const isImage = attachment?.type?.startsWith?.("image/") && String(attachment.dataUrl || "").startsWith("data:image/");
  const file = attachment?.name && isImage ? { name: String(attachment.name), type: String(attachment.type || ""), size: Number(attachment.size || 0), dataUrl: String(attachment.dataUrl) } : null;
  if (!text && !file) return;
  const peerId = (room.participantIds || []).find((idValue) => idValue !== user.id);
  db.directChatMessages.push({ id: id("dmsg"), roomId: room.id, senderId: user.id, displayName: user.nickname, message: text, attachment: file, deleted: false, createdAt: now(), readBy: [user.id] });
  room.lastMessage = text || `첨부파일: ${file.name}`;
  room.lastAt = now();
  room.unreadBy ||= {};
  if (peerId) room.unreadBy[peerId] = Number(room.unreadBy[peerId] || 0) + 1;
}

function directMessages(db, room, user) {
  return (db.directChatMessages || []).filter((m) => m.roomId === room.id).map((m) => {
    const deleted = Boolean(m.deleted);
    return {
      id: m.id,
      senderId: m.senderId,
      side: m.system || m.senderId === "system" ? "staff" : m.senderId === user.id ? "member" : "staff",
      displayName: m.displayName || (m.system ? "관리자" : "회원"),
      message: deleted ? "" : m.message,
      attachment: deleted ? null : m.attachment || null,
      deleted,
      system: Boolean(m.system),
      createdAt: m.createdAt
    };
  });
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
  if (url.pathname.startsWith("/trades/")) {
    const [, , type, postId] = url.pathname.split("/");
    if ((type === "sell" || type === "buy") && postId) return send(res, 200, tradeDetailPage(user, db, type, decodeURIComponent(postId)));
  }
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
  if (url.pathname === "/terms") return send(res, 200, legalPage(user, "service"));
  if (url.pathname === "/trade-terms") return send(res, 200, legalPage(user, "trade"));
  if (url.pathname === "/privacy") return send(res, 200, legalPage(user, "privacy"));
  if (url.pathname === "/page/terms") {
    const kind = { s: "service", t: "trade", p: "privacy" }[url.searchParams.get("t") || "s"] || "service";
    return send(res, 200, legalPage(user, kind));
  }
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

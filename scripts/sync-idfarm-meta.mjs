import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DB_PATH = path.join(ROOT, "data", "db.json");
const CACHE_PATH = path.join(ROOT, "data", "scrape-cache", "idfarm-game-meta.json");
const ASSET_DIR = path.join(ROOT, "public", "assets", "idfarm-games-matched");
const DEFAULT_SOURCE = "C:\\Users\\PC\\Desktop\\개 폴더\\86\\BTS부산\\방하\\새 폴더\\아이디팜 캐릭터 거래게임리스트.txt";
const SOURCE_PATH = process.argv[2] || DEFAULT_SOURCE;

const INITIAL_FILTERS = ["ㄱ", "ㄱ", "ㄴ", "ㄷ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅂ", "ㅅ", "ㅅ", "ㅇ", "ㅈ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const FIELD_LABELS = {
  "job[]": "직업 분류",
  "accountType[]": "계정 종류",
  "buyType[]": "구매 경로",
  payment_history: "결제내역",
  account_multi_link: "선물하기 가능여부",
  sellMethod: "판매 단위"
};

function initialGroupFor(name = "") {
  const first = String(name).trim().codePointAt(0);
  if (!first) return "1~A";
  if (first >= 0xac00 && first <= 0xd7a3) return INITIAL_FILTERS[Math.floor((first - 0xac00) / 588)] || "1~A";
  return /^[0-9a-z]/i.test(String.fromCodePoint(first)) ? "1~A" : "1~A";
}

function clean(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.map((item) => clean(item)).filter(Boolean))];
}

function parseGameList(html) {
  const re = /<li class="idfarm-rainbow" onclick="location\.href='\/ItemMarket\/character\/(\d+)\?trx_type=BUY'"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<label[^>]*>([^<]+)<\/label>/g;
  const games = [];
  let match;
  while ((match = re.exec(html))) {
    games.push({ idfarmId: Number(match[1]), externalImageUrl: match[2], name: clean(match[3]) });
  }
  return games;
}

function parseGroup(html, name) {
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<input[^>]+name="${safeName}"[^>]*value="([^"]*)"[^>]*>\\s*<label[^>]*>([\\s\\S]*?)<\\/label>`, "g");
  const values = [];
  let match;
  while ((match = re.exec(html))) values.push(clean(match[2] || match[1]));
  return unique(values);
}

function parsePriceRanges(html) {
  const re = /<input[^>]+name="price"[^>]*data-range-from="([^"]*)"[^>]*data-range-to="([^"]*)"[\s\S]*?<label[^>]*>([\s\S]*?)<\/label>/g;
  const ranges = [];
  let match;
  while ((match = re.exec(html))) {
    ranges.push({ from: Number(match[1] || 0), to: Number(match[2] || 0), label: clean(match[3]) });
  }
  return ranges.length ? ranges : [
    { from: 0, to: 100, label: "~100만원" },
    { from: 100, to: 200, label: "~200만원" },
    { from: 200, to: 500, label: "~500만원" },
    { from: 500, to: 0, label: "500만원~" }
  ];
}

function parseMeta(html, game) {
  const filters = Object.entries(FIELD_LABELS).map(([name, label]) => ({
    key: name.replace(/\[\]$/, ""),
    label,
    values: parseGroup(html, name).filter((item) => item !== "전체")
  })).filter((item) => item.values.length);
  return {
    sourceUrl: `https://idfarm.co.kr/ItemMarket/character/${game.idfarmId}?trx_type=buy`,
    scrapedAt: new Date().toISOString(),
    tradeKinds: ["캐릭터", "게임머니", "아이템", "기타"],
    servers: parseGroup(html, "server[]").filter((item) => item !== "전체"),
    filters,
    priceRanges: parsePriceRanges(html)
  };
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function localImageUrl(index) {
  const base = `game-${String(index + 1).padStart(3, "0")}`;
  try {
    const files = await readdir(ASSET_DIR);
    const found = files.find((file) => path.parse(file).name === base);
    if (found) return `/assets/idfarm-games-matched/${found}`;
  } catch {}
  return `/assets/games/game-${(index % 8) + 1}.svg`;
}

async function main() {
  if (!existsSync(SOURCE_PATH)) throw new Error(`source not found: ${SOURCE_PATH}`);
  const sourceHtml = await readFile(SOURCE_PATH, "utf8");
  const list = parseGameList(sourceHtml);
  if (!list.length) throw new Error("No games found in source HTML.");
  const cache = await loadCache();
  const db = JSON.parse(await readFile(DB_PATH, "utf8"));
  let fetched = 0;

  for (let index = 0; index < list.length; index += 1) {
    const game = list[index];
    const key = String(game.idfarmId);
    if (!cache[key]?.servers) {
      const url = `https://idfarm.co.kr/ItemMarket/character/${game.idfarmId}?trx_type=buy`;
      try {
        const html = await fetchText(url);
        cache[key] = parseMeta(html, game);
        fetched += 1;
        if (fetched % 20 === 0) await saveCache(cache);
      } catch (error) {
        cache[key] = { sourceUrl: url, scrapedAt: new Date().toISOString(), error: error.message, tradeKinds: ["캐릭터", "게임머니", "아이템", "기타"], servers: [], filters: [], priceRanges: parsePriceRanges("") };
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    if ((index + 1) % 25 === 0 || index + 1 === list.length) {
      console.log(`${index + 1}/${list.length} ${game.name}`);
    }
  }
  await saveCache(cache);

  db.games = await Promise.all(list.map(async (game, index) => {
    const slug = `game-${String(index + 1).padStart(3, "0")}`;
    const meta = cache[String(game.idfarmId)] || {};
    return {
      id: slug,
      slug,
      idfarmId: game.idfarmId,
      name: game.name,
      initialGroup: initialGroupFor(game.name),
      visible: true,
      rank: index + 1,
      trades: Math.max(0, 980 - index),
      imageUrl: await localImageUrl(index),
      externalImageUrl: game.externalImageUrl,
      servers: Array.isArray(meta.servers) ? meta.servers : [],
      tradeMeta: {
        sourceUrl: meta.sourceUrl || `https://idfarm.co.kr/ItemMarket/character/${game.idfarmId}?trx_type=buy`,
        scrapedAt: meta.scrapedAt || new Date().toISOString(),
        tradeKinds: Array.isArray(meta.tradeKinds) ? meta.tradeKinds : ["캐릭터", "게임머니", "아이템", "기타"],
        filters: Array.isArray(meta.filters) ? meta.filters : [],
        priceRanges: Array.isArray(meta.priceRanges) ? meta.priceRanges : parsePriceRanges("")
      }
    };
  }));

  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  console.log(`\nUpdated ${db.games.length} games. Newly fetched ${fetched} pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

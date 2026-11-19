// Fetches every channel in channels.json and writes public/feeds.json.
// Runs in the GitHub Action every 30 minutes (and before `npm run dev`).
// One failing channel never breaks the others: it's recorded with an error.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import Parser from "rss-parser";

const MAX_ITEMS = 40;
const TIMEOUT_MS = 15_000;
const CHANNELS_FILE = new URL("../channels.json", import.meta.url);
const OUTPUT_DIR = new URL("../public/", import.meta.url);
const OUTPUT_FILE = new URL("feeds.json", OUTPUT_DIR);

const parser = new Parser();

function stripHtml(html, max = 220) {
  if (!html) return "";
  const text = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (personal news reader)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
  return res.text();
}

async function fetchRss(url) {
  const xml = await fetchText(url);
  // Some feeds (e.g. Mothership) contain bare "&" in titles, which is invalid XML.
  const cleaned = xml.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  let feed;
  try {
    feed = await parser.parseString(cleaned);
  } catch {
    throw new Error("That URL isn't a readable RSS or Atom feed.");
  }
  const items = (feed.items ?? [])
    .filter((it) => it.title && it.link)
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      title: stripHtml(it.title, 300),
      link: it.link,
      published: toIso(it.isoDate ?? it.pubDate),
      summary: stripHtml(it.contentSnippet ?? it.content ?? it.summary),
    }));
  if (items.length === 0) throw new Error("No articles found. Is this an RSS or Atom feed URL?");
  return items;
}

async function fetchHackerNews() {
  const body = await fetchText(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${MAX_ITEMS}`,
  );
  return JSON.parse(body)
    .hits.filter((h) => h.title)
    .map((h) => ({
      title: h.title,
      link: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      published: toIso(h.created_at),
      summary: "",
      meta: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`,
    }));
}

function validate(channels) {
  if (!Array.isArray(channels)) throw new Error("channels.json must be a JSON array.");
  const ids = new Set();
  channels.forEach((c, i) => {
    const where = `channels.json entry ${i + 1}`;
    if (!c.id || !c.name || !c.category) throw new Error(`${where} needs "id", "name" and "category".`);
    if (ids.has(c.id)) throw new Error(`${where}: id "${c.id}" is used twice.`);
    ids.add(c.id);
    if (c.type !== "rss" && c.type !== "hn") throw new Error(`${where}: "type" must be "rss" or "hn".`);
    if (c.type === "rss" && !/^https?:\/\//.test(c.url ?? ""))
      throw new Error(`${where}: "url" must start with http:// or https://.`);
  });
}

async function main() {
  const channels = JSON.parse(await readFile(CHANNELS_FILE, "utf8"));
  validate(channels);

  const results = await Promise.all(
    channels.map(async (c) => {
      try {
        const items = c.type === "hn" ? await fetchHackerNews() : await fetchRss(c.url);
        console.log(`✓ ${c.name}: ${items.length} articles`);
        return { ...c, status: "ok", items };
      } catch (err) {
        const error =
          err?.name === "TimeoutError" ? "The feed took too long to respond." : String(err?.message ?? err);
        console.warn(`✗ ${c.name}: ${error}`);
        return { ...c, status: "error", error, items: [] };
      }
    }),
  );

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), channels: results }),
  );
  console.log(`Wrote public/feeds.json (${results.length} channels)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

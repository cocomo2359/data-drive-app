"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { REPO_URL, type FeedsFile, type NewsItem } from "@/lib/news";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const HIDDEN_KEY = "five-minute-news.hidden.v1";

type Window = "6h" | "24h" | "3d" | "all";
const WINDOWS: { value: Window; label: string; hours: number | null }[] = [
  { value: "6h", label: "6 hours", hours: 6 },
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "3d", label: "3 days", hours: 72 },
  { value: "all", label: "All", hours: null },
];

interface DisplayItem extends NewsItem {
  channelName: string;
  category: string;
}

// ---------- helpers ----------

function loadHidden(): Set<string> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed as string[]);
    }
  } catch {
    // Storage blocked or corrupt: show every channel.
  }
  return new Set();
}

function saveHidden(hidden: Set<string>) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hidden)));
  } catch {
    // Ignore: the choice still applies for this visit.
  }
}

function linkKey(link: string): string {
  try {
    const u = new URL(link);
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return link.toLowerCase();
  }
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function categoryClass(category: string): string {
  const c = category.toLowerCase();
  if (c === "local") return styles.catLocal;
  if (c === "global") return styles.catGlobal;
  if (c === "tech") return styles.catTech;
  return styles.catOther;
}

// ---------- page ----------

export default function Home() {
  const [data, setData] = useState<FeedsFile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("All");
  const [timeWindow, setTimeWindow] = useState<Window>("24h");
  const [showManager, setShowManager] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${BASE_PATH}/feeds.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as FeedsFile);
    } catch {
      setLoadError("Couldn't load the news. Check your connection and press Refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setHidden(loadHidden());
    void load();
  }, [load]);

  const channels = useMemo(() => data?.channels ?? [], [data]);
  const visible = channels.filter((c) => !hidden.has(c.id));

  const categories = useMemo(() => {
    const set = new Set(channels.filter((c) => !hidden.has(c.id)).map((c) => c.category));
    return ["All", ...Array.from(set)];
  }, [channels, hidden]);

  const items = useMemo<DisplayItem[]>(() => {
    const hours = WINDOWS.find((w) => w.value === timeWindow)?.hours ?? null;
    const cutoff = hours ? Date.now() - hours * 3600_000 : null;
    const seenLinks = new Set<string>();
    const seenTitles = new Set<string>();
    const merged: DisplayItem[] = [];

    for (const ch of channels) {
      if (hidden.has(ch.id)) continue;
      if (category !== "All" && ch.category !== category) continue;
      for (const it of ch.items) {
        if (cutoff && it.published && new Date(it.published).getTime() < cutoff) continue;
        const lk = linkKey(it.link);
        const tk = titleKey(it.title);
        if (seenLinks.has(lk) || seenTitles.has(tk)) continue; // same story from two channels
        seenLinks.add(lk);
        seenTitles.add(tk);
        merged.push({ ...it, channelName: ch.name, category: ch.category });
      }
    }
    return merged.sort((a, b) => {
      const ta = a.published ? new Date(a.published).getTime() : 0;
      const tb = b.published ? new Date(b.published).getTime() : 0;
      return tb - ta;
    });
  }, [channels, hidden, category, timeWindow]);

  const failed = visible.filter((c) => c.status === "error");

  const toggleChannel = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
    saveHidden(next);
    if (category !== "All" && !channels.some((c) => !next.has(c.id) && c.category === category)) {
      setCategory("All");
    }
  };

  // ---------- render ----------

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Five-Minute News</h1>
          <p className={styles.subtitle}>
            {loading && !data
              ? "Loading…"
              : `${items.length} stories from ${visible.length} channels`}
            {data && ` · updated ${timeAgo(data.generatedAt)}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.button} onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <button
            className={`${styles.button} ${showManager ? styles.buttonActive : ""}`}
            onClick={() => setShowManager((s) => !s)}
            aria-expanded={showManager}
          >
            Channels
          </button>
        </div>
      </header>

      {showManager && data && (
        <section className={styles.manager} aria-label="Manage channels">
          <h2 className={styles.sectionTitle}>Your channels</h2>
          <p className={styles.hint}>Untick a channel to hide it on this device.</p>
          <ul className={styles.channelList}>
            {channels.map((c) => (
              <li key={c.id} className={styles.channelRow}>
                <label className={styles.channelLabel}>
                  <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => toggleChannel(c.id)} />
                  <span className={styles.channelName}>{c.name}</span>
                  <span className={`${styles.badge} ${categoryClass(c.category)}`}>{c.category}</span>
                </label>
                <span className={styles.channelStatus}>
                  {hidden.has(c.id) ? (
                    "hidden"
                  ) : c.status === "error" ? (
                    <span className={styles.error}>{c.error}</span>
                  ) : (
                    `${c.items.length} articles`
                  )}
                </span>
              </li>
            ))}
          </ul>

          <h2 className={styles.sectionTitle}>Add or remove a channel</h2>
          <ol className={styles.steps}>
            <li>
              Find the site&apos;s RSS feed. Look for an RSS link in its footer, or try adding{" "}
              <code>/feed</code> or <code>/rss</code> to its address.
            </li>
            <li>
              Open{" "}
              <a href={`${REPO_URL}/edit/main/channels.json`} target="_blank" rel="noopener noreferrer">
                channels.json on GitHub
              </a>{" "}
              and copy an existing entry. Give it a new <code>id</code>, <code>name</code>, <code>url</code>{" "}
              and <code>category</code>.
            </li>
            <li>
              Commit the change. The site updates within a few minutes. If a feed can&apos;t be read, it
              shows here with the reason.
            </li>
          </ol>
          <pre className={styles.example}>{`{
  "id": "today",
  "name": "TODAY",
  "type": "rss",
  "url": "https://www.todayonline.com/feed",
  "category": "Local"
}`}</pre>
        </section>
      )}

      <nav className={styles.toolbar} aria-label="Filters">
        <div className={styles.tabs} role="tablist">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={`${styles.tab} ${category === c ? styles.tabActive : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className={styles.windowSelect}>
          <span>Last</span>
          <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value as Window)}>
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </nav>

      {loadError && <p className={styles.notice}>{loadError}</p>}
      {failed.length > 0 && (
        <p className={styles.notice}>
          Couldn&apos;t load: {failed.map((c) => c.name).join(", ")}. Open Channels to see why.
        </p>
      )}

      <main>
        {data && items.length === 0 && (
          <p className={styles.empty}>No stories in this window. Try a longer time range or another category.</p>
        )}
        <ol className={styles.list}>
          {items.map((it) => (
            <li key={it.link} className={styles.item}>
              <a className={styles.itemTitle} href={it.link} target="_blank" rel="noopener noreferrer">
                {it.title}
              </a>
              {it.summary && <p className={styles.summary}>{it.summary}</p>}
              <p className={styles.meta}>
                <span className={`${styles.badge} ${categoryClass(it.category)}`}>{it.category}</span>
                <span>{it.channelName}</span>
                {it.published && <span>{timeAgo(it.published)}</span>}
                {it.meta && <span>{it.meta}</span>}
              </p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

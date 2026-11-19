// Types for public/feeds.json, written by scripts/fetch-feeds.mjs from channels.json.

export const REPO_URL = "https://github.com/cocomo2359/data-drive-app";

export type ChannelType = "rss" | "hn";

export interface NewsItem {
  title: string;
  link: string;
  /** ISO date string, or null when the feed gives none. */
  published: string | null;
  summary: string;
  /** Optional extra line, e.g. "312 points · 120 comments" for Hacker News. */
  meta?: string;
}

export interface ChannelFeed {
  id: string;
  name: string;
  type: ChannelType;
  url?: string;
  category: string;
  status: "ok" | "error";
  error?: string;
  items: NewsItem[];
}

export interface FeedsFile {
  generatedAt: string;
  channels: ChannelFeed[];
}

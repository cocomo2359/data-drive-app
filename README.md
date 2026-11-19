# Five-Minute News

Local, global and tech news from your own channels, on one page.

**Live:** https://cocomo2359.github.io/data-drive-app/

## How it works

- `channels.json` lists the channels (RSS/Atom feeds, plus Hacker News).
- A GitHub Action runs every 30 minutes: `scripts/fetch-feeds.mjs` fetches every channel into `feeds.json`, then the Next.js app is built as a static site and deployed to GitHub Pages.
- The page reads `feeds.json`. Hiding a channel is remembered in your browser.

## Add a channel

Edit `channels.json`, copy an entry and give it a new `id`, `name`, `url` and `category`, then commit. To update right away, run the workflow from the **Actions** tab ("Run workflow").

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` fetches the feeds first, then starts the app at http://localhost:3000.

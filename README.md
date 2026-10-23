<h1>The Daily Bugle</h1>

A news and YouTube aggregator built to run entirely on free tiers. News comes from Tavily, videos from the YouTube Data API v3, both pulled twice a day by GitHub Actions into a Neon Postgres database. The website only ever reads from that database, so opening the app or changing filters never spends API quota.

**Stack:** Next.js 15 (App Router), React 19, Tailwind CSS 4, Prisma 6, Neon Postgres, GitHub Actions, Vercel.


**How the quota stays free**

| Action | API cost | How often |
|---|---|---|
| Open the app, change filters, scroll | 0 | Any time, it reads the database |
| Sync news | 1 Tavily credit per location searched | 16 searches per run, 2 runs a day, about 960 a month (free tier is 1,000) |
| Sync videos | 1 YouTube unit per channel (playlistItems on the Uploads playlist) | 2 runs a day |
| Add a channel by URL or @handle | 2 units (lookup plus first pull) | When you add one |
| Add a channel by name search | 100 units (search.list) plus 2 | When you press Find, capped at 20 a day |

YouTube gives 10,000 units a day, so even 200 channels cost only 400 units a day.

The app keeps its own ledger of credits used (the `ApiUsage` table) and stops before the free limits: 950 Tavily credits a month and 9,000 YouTube units a day. A rate limit or "out of credits" response stops the run immediately instead of retrying.

**Categories**

Every article and video is tagged with up to two topics: Politics, Business and Finance, Technology, Sports, Entertainment, Health, Science and Space, Environment and Weather, Crime and Law, Education and Jobs, or General when nothing matches. Tagging uses keyword matching on the title and text, so it costs no API calls. The keyword lists live in `src/lib/categories.ts`; items with no tags are re-tagged on the next sync. The Category filter applies to articles and videos alike.

**How locations are covered within 16 searches a run**

There are 13 regions, 36 states and UTs, and 725 districts, far more than 16 searches. So each run searches:

1. Global and India, every run.
2. The priority districts, every run. By default these are Gurugram, Chandauli and Varanasi; set `PRIORITY_LOCATIONS` to change them.
3. The rest of the budget rotates through regions and states, least recently searched first. Every region and state gets refreshed roughly every two days.

Districts are mostly covered by tagging. When an India level or state level article names a district (Gurugram, Gurgaon, Bengaluru, Bangalore and so on), it is tagged with that district. Picking a district in the filter shows those stories. Within India the tags roll up: picking India shows all Indian stories, picking a state shows that state and its districts. Global and each region are separate scopes.

Each search asks Tavily only for news since that location was last searched, so credits go to new stories rather than repeats.


**Setup guide**

You need four free accounts: Tavily, Google Cloud, Neon and Vercel. Allow about 20 minutes.

**Step 1. Tavily API key (news)**

1. Go to [app.tavily.com](https://app.tavily.com) and sign up.
2. Your API key is on the dashboard. It starts with `tvly-`. Copy it.
3. The free plan gives 1,000 credits a month with no card required.

**Step 2. YouTube Data API key (videos)**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with a Google account.
2. Click the project picker at the top, then **New Project**. Name it `dailybugle` and create it.
3. Open **APIs and Services**, then **Library**. Search for **YouTube Data API v3** and click **Enable**.
4. Open **APIs and Services**, then **Credentials**. Click **Create credentials**, then **API key**. Copy it (it starts with `AIza`).
5. Click the new key, and under **API restrictions** choose **Restrict key** and tick only **YouTube Data API v3**. Save. This limits damage if the key ever leaks.

No billing account is needed. The free quota is 10,000 units a day and resets at midnight Pacific time.

**Step 3. Neon Postgres database**

1. Go to [neon.tech](https://neon.tech) and sign up.
2. Create a project. Pick the region **AWS Asia Pacific (Singapore)**, which is closest to India and matches the Vercel region in `vercel.json`.
3. On the project dashboard click **Connect**. Copy two connection strings:
   * With **Connection pooling** on: this is `DATABASE_URL` (the host contains `-pooler`).
   * With **Connection pooling** off: this is `DIRECT_URL`.

The free plan includes 0.5 GB storage. Items older than 30 days are deleted automatically, which keeps the database well under that.

**Step 4. Run it locally (optional but recommended)**

```bash
cp .env.example .env        # then paste your keys and connection strings
npm install
npx prisma db push          # creates the tables
npm run sync                # first fetch, uses about 16 Tavily credits
npm run dev                 # open http://localhost:3000
```

Set `ADMIN_KEY` in `.env` to any long random string (`openssl rand -hex 24` makes one).

**Step 5. Deploy the website on Vercel**

GitHub Pages can only host static files, so the site itself runs on Vercel's free Hobby plan, connected to this GitHub repo.

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. Click **Add New**, then **Project**, and import the `DailyBugle` repo. Vercel detects Next.js automatically.
3. Before deploying, open **Environment Variables** and add:
   * `DATABASE_URL`
   * `DIRECT_URL`
   * `TAVILY_API_KEY`
   * `YOUTUBE_API_KEY`
   * `ADMIN_KEY`
4. Click **Deploy**. Every push to `main` redeploys automatically.

**Step 6. Turn on the twice daily sync in GitHub Actions**

1. In the GitHub repo open **Settings**, then **Secrets and variables**, then **Actions**.
2. On the **Secrets** tab add these as repository secrets: `DATABASE_URL`, `DIRECT_URL`, `TAVILY_API_KEY`, `YOUTUBE_API_KEY`.
3. Optional, on the **Variables** tab: add `PRIORITY_LOCATIONS` to replace the default priority districts (Gurugram, Chandauli, Varanasi), and `TAVILY_QUERIES_PER_SYNC`.
4. Open the **Actions** tab, choose **Sync news and videos**, and click **Run workflow** to do the first sync now. The first run also creates the database tables if Step 4 was skipped.

After that it runs on its own at about 06:15 and 18:15 IST. Note that GitHub pauses scheduled workflows in a repo with no commits for 60 days; it emails you first, and one click re-enables it.

**Step 7. Use the app**

1. Open your Vercel URL, click **Admin** in the top corner and paste your `ADMIN_KEY`. It is stored only in that browser.
2. Pick locations, content types and a date range. Everything is saved in the browser's localStorage and applied automatically next time you open the app.
3. Under **YouTube channels**, paste a channel URL or `@handle` (cheap) or type a name and press **Find** (costlier). Add it as a chip. Its latest uploads appear straight away, and the sync keeps it fresh. Tap chips to show only some channels; with none selected, all are shown.
4. To fetch new stories between the scheduled runs, click **Refresh now** next to Admin. Each press uses about 16 Tavily credits, and it is blocked for 15 minutes after any sync so a double click can't waste credits.
4. To fetch new stories between the scheduled runs, click **Refresh now** next to Admin. Each press uses about 16 Tavily credits, and it is blocked for 15 minutes after any sync so a double click can't waste credits.


**Project layout**

```
prisma/schema.prisma            NewsItem, VideoItem, TrackedChannel, plus quota and sync bookkeeping
scripts/sync.ts                 entry point run by GitHub Actions
.github/workflows/sync.yml      the twice daily schedule
src/lib/sync.ts                 the sync: plans Tavily searches, pulls uploads, stores, cleans up
src/lib/tavily.ts               Tavily client (basic depth, 1 credit per call)
src/lib/youtube.ts              YouTube client (search, channels, playlistItems)
src/lib/locations.ts            Global, 13 regions, India, 36 states and UTs, 725 districts
src/lib/mentions.ts             tags articles with the states and districts they mention
src/lib/categories.ts           topic categories by keyword (edit the lists to tune)
src/lib/quota.ts                usage ledger and hard caps
src/data/india.json             state and district list (edit freely)
src/hooks/useFilterState.ts     filter state persisted to localStorage
src/components/                 dashboard, filters, location picker, channel chips, feed, cards
src/app/api/feed                serves the filtered feed from the database
src/app/api/channels            list, add and remove tracked channels
src/app/api/channels/search     channel lookup (the only place search.list is used)
src/app/api/sync                the Refresh now button (admin key, 15 min cooldown)
src/app/api/status              last sync and quota usage, shown in the footer
```

**API reference**

`GET /api/feed` accepts `types=text,video`, `categories=sports,business`, `locations=country:india,district:haryana:gurugram`, `from` and `to` as `YYYY-MM-DD` (IST days), `channels=UC...,UC...`, `cursor` (from the previous page's `nextCursor`) and `limit` (up to 60). Responses are cached at the edge for five minutes, since the data only changes twice a day.

Location ids follow this pattern: `global`, `region:<slug>`, `country:india`, `state:<state-slug>`, `district:<state-slug>:<district-slug>`. Slugs are lowercase with hyphens, so Gurugram is `district:haryana:gurugram` and Tamil Nadu is `state:tamil-nadu`. The full list is generated from `src/data/india.json` and the `REGIONS` list in `src/lib/locations.ts`.

**Tuning**

All optional, set in `.env`, Vercel, or GitHub Actions variables:

| Variable | Default | Effect |
|---|---|---|
| `TAVILY_QUERIES_PER_SYNC` | 16 | Searches per run. Keep runs a day x 30 x this under 1,000 |
| `TAVILY_MAX_RESULTS` | 20 | Articles per search (same 1 credit for 5 or 20) |
| `TAVILY_MONTHLY_BUDGET` | 950 | Hard stop for the month |
| `PRIORITY_LOCATIONS` | Gurugram, Chandauli, Varanasi | Comma separated location ids searched every run |
| `VIDEOS_PER_CHANNEL` | 15 | Uploads pulled per channel per run (still 1 unit) |
| `MAX_CHANNEL_SEARCHES_PER_DAY` | 20 | Cap on 100 unit name searches |
| `RETENTION_DAYS` | 30 | Older items are deleted |

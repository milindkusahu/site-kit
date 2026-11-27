# site-kit

The code every Next.js and Astro site of mine shares, kept in one place. Fix a bug or tighten a check here, tag a release, and every project picks it up on its next sweep.

## What's in it

| Part | Import or command | What it does |
| --- | --- | --- |
| SEO core | `@milindkusahu/site-kit/seo/create-seo` | `createSeo(SITE, SITE_PAGES)` gives titles, metadata, canonicals, breadcrumbs, the JSON-LD graph, sitemap, robots, llms.txt, manifest and registry checks |
| SEO pieces | `@milindkusahu/site-kit/seo/{url,ads,share,types,…}` | Smaller helpers when you only need one |
| Security headers | `@milindkusahu/site-kit/headers` | CSP, HSTS, nosniff, referrer and permissions policy (no COOP: WebKit warns on every navigation without COEP, 1.9.1). Ads and analytics open only what they need |
| ESLint | `@milindkusahu/site-kit/eslint/shared` | The no-comments, no-barrel and boundaries rules, timer bans, banned UI libraries, complexity limits |
| Image input | `@milindkusahu/site-kit/image/{open,heic,header,formats,problems,zip,download,batch}` | Open a picked file upright, HEIC fallback, refuse huge files from the header, reader-friendly errors, ZIP writer, download, one-at-a-time batch runner (see below) |
| Playwright | `@milindkusahu/site-kit/playwright/{steps,homepage}` | Feature steps, plus the above-the-fold and no-ad-near-the-tool tests |
| Audit | `@milindkusahu/site-kit/audit` | The crawler behind `site-kit audit` |
| Markdown Worker | `dist/agent/worker.js`, `site-kit markdown` | Serves a Markdown copy of each page to agents that ask for it (see below) |
| CLI | `site-kit <command>` | `rules`, `plan`, `deps`, `secrets`, `audit`, `cwv`, `ui`, `assets`, `markdown`, `redirects`, `headers` |

Run `bunx site-kit` in a project for the full command list.

## Using it in a project

```json
"dependencies": { "@milindkusahu/site-kit": "github:milindkusahu/site-kit#v1.0.0" }
```

Each project has a `site-kit.config.json` at its root:

```json
{
  "siteFile": "src/lib/site.ts",
  "tokensFile": "src/styles/tokens.css",
  "sourceDirs": ["src", "content"],
  "contentDirs": ["content", "src/content"],
  "chromeDirs": ["src/components/layout"],
  "headersFile": "public/_headers",
  "analytics": false,
  "spacingScale": true
}
```

Paragraph limits (1.12.0+): `maxParagraphWords` (default 30) and `maxLedeWords` (55) apply to Markdown in `contentDirs` (`site-kit rules`) and to every indexable page `site-kit audit` crawls; `maxAnswerWords` (60) is read by the audit only. In the audit, the first paragraph of the main content and any `p.lede` are ledes, and paragraphs inside `<details>` or an element with `data-answer` (FAQ and featured-snippet answers) are answers. The first paragraph on a `home` or `tool` page is the hero tagline, which stays at 25 words. Before 1.12.0 the audit ignored the config and used 30 for everything after the first paragraph.

Title and description lengths (1.13.0+): `minTitleChars` (15), `maxTitleChars` (55), `minDescriptionChars` (70) and `maxDescriptionChars` (150) set the range `site-kit audit` enforces in `onpage/title` and `onpage/description`. The messages show the configured range.

Sitemap indexes (1.13.0+): when `/sitemap.xml` is a `<sitemapindex>`, `site-kit audit` fetches each child sitemap from the audit base URL (the same path as the `<loc>`, since the locs carry the production origin), collects the page URLs from all of them and removes duplicates. One level of nesting is read. A child that doesn't return 200 is reported as `tech/sitemap`, naming that child.

`headersFile` is for Astro on Cloudflare. Next.js projects leave it out and call `securityHeaders()` from `next.config.ts`.

`spacingScale` (1.6.0+, off by default) makes `site-kit rules` fail any literal `margin`, `padding` or `gap` length in CSS and Astro files, the tokens file included (1.11.0+: before that a site whose styles all lived in the tokens file passed unchecked; defining `--space-*` and other custom properties there is fine). Spacing uses `var(--space-N)` from the tokens file; `0`, `auto`, percentages and 1 or 2 px hairlines are allowed. Each `--space-` token used must be defined in the tokens file.

A `docs/design/references.json` with `"version": 2` adds the craft rules to `site-kit plan`: 6+ references not marked `competitor: true`, 2+ from a curated gallery (`source: "gallery"`), a `craft` note on each for `type`, `spacing` and `icons`, and a `measured` file for live ones. Once design directions are ticked, `docs/design/critique.json` must score each direction 4+ on type, spacing, clutter, icons, hierarchy and originality, with a passing design audit.

The headers include `Link: </llms.txt>; rel="describedby", </sitemap.xml>; rel="sitemap"` on every path, so the site must serve both files (a Next.js site needs its own `/llms.txt` route, e.g. from `seo.llmsTxt()`). A site that doesn't sets `"agentLinks": false` in `site-kit.config.json`, or passes `{ agentLinks: false }` to `securityHeaders()`.

### Image input (1.8.0+)

Browser-only, one subpath per piece, so a page ships only what it imports.

```ts
import { openImage } from "@milindkusahu/site-kit/image/open";
import { problemCopy } from "@milindkusahu/site-kit/image/problems";
import { createHeicDecoder } from "@milindkusahu/site-kit/image/heic"; // only if the site opens HEIC

const heic = createHeicDecoder();
const result = await openImage(file, { maxPixels: 100_000_000, heic });
if (result.kind === "opened") use(result.bitmap); // upright, EXIF orientation applied
else show(problemCopy(result, { accepted: "JPG, PNG, WebP or HEIC" })); // { title, line, short }
```

- `open`: `openImage` reads the first megabyte, refuses non-images and anything over `maxPixels` from the header (JPEG, PNG, WebP, GIF, BMP, HEIC and AVIF `ispe`) before decoding, decodes with `imageOrientation: "from-image"`, falls back to the HEIC decoder, and returns `{ kind: "opened", bitmap, size, format, orientation, reducedFrom }` or an `OpenProblem` (`unreadable`, `not-image`, `unsupported`, `too-large`, `damaged`, `decoder-not-loaded`, `out-of-memory`). `reducedFrom` is set when Android Chrome decoded a big JPEG smaller than it is. `decodeAgain` re-decodes for the full-size render; `holdFiles` copies picked files on Android, where their handles go stale.
- `heic`: libheif, loaded only when a HEIC file needs it. Add `"libheif-js": "1.23.5"` to the site's dependencies (an optional peer, LGPL-3.0, about 1.9 MB) and `"wasm": true` to `site-kit.config.json`, which adds `'wasm-unsafe-eval'` to the CSP. It retries once on a fresh instance and drops a heap over 256 MB.
- `zip`: store-only writer (`zipBlob`, `zipStore`, `zipFrame`), streamed CRC-32, `uniqueNames` (`a-2.jpg`, or `"paren"` for `a (2).jpg`), `archiveGroups` and `archiveFileName` for runs over 2 GB. It throws rather than write past ZIP's 32-bit limits.
- `download`: `downloadBlob(blob, name)` keeps the object URL until the next download or `pagehide`; `cleanStem` makes typed names safe.
- `batch`: `createBatch({ process })` runs files one at a time with `add`, `start`, `stop`, `retry`, `remove`, `clear`, `subscribe`, `snapshot` and `idle`. Stop aborts the running file's signal and moves on without waiting for it. `batchProgress` gives the counts, percent and a time-left estimate from the run's own timings.

### Changelog grouping (1.7.0+)

`groupByMonth(CHANGELOG)` from `@milindkusahu/site-kit/seo/changelog` gives months newest first (`id` like `2026-11`, `month`, `year`, `entries`), and `groupByYear(months)` nests them under years. Entries only need a `date` in `YYYY-MM-DD`; any other date throws at build time. The month name locale defaults to `en-GB`.

### Trailing-slash redirects (1.7.0+)

End an Astro build with `astro build && site-kit redirects && site-kit markdown`. `site-kit redirects [dir]` (default `dist`) finds every built page (`<path>/index.html`) and writes `/<path> /<path>/ 301` plus `/index.html / 301` into `<dir>/_redirects`, so Cloudflare's `auto-trailing-slash` never answers with a 307. Rules from `public/_redirects` stay first and win; a source they already redirect isn't doubled. Running it twice gives the same file. It fails past Cloudflare's 2,000 static rules.

### Analytics and verification tags (1.7.0+)

```astro
---
import { parseTrackingConfig } from "@milindkusahu/site-kit/seo/ads";
import { analyticsSnippet, verificationMeta } from "@milindkusahu/site-kit/seo/analytics";
const tracking = parseTrackingConfig(import.meta.env);
const analytics = analyticsSnippet(tracking, { redactParams: ["t"] }); // optional, 1.10.0+
const verification = verificationMeta({ google: tracking.googleVerification, bing: tracking.bingVerification, yandex: tracking.yandexVerification });
---
{verification.map((m) => <meta name={m.name} content={m.content} />)}
{analytics && <script is:inline set:html={analytics} />}
```

`PUBLIC_GTM_ID` wins over `PUBLIC_GA_ID`; with neither the snippet is empty. The snippet sets Consent Mode v2 to denied in the EEA, the UK and Switzerland before anything else runs, and loads the Google script only after the page `load` event. A malformed ID throws at build time rather than shipping. Set `"analytics": true` in `site-kit.config.json` (or either env variable) so the CSP allows Google's hosts.

`redactParams` (1.10.0+, GA4 only) removes the named query parameters, and the hash, from the `page_location` and same-site `page_referrer` that GA4 records for every hit of the page. Use it for parameters that carry what a visitor typed, such as a share link's `?t=`: without it, GA4 sends the full URL, so the text reaches Google on every page_view and event, and on the next page as the referrer. Other parameters (`utm_*` included) are kept. With a Tag Manager ID it throws, because the container reads the URL itself; redact there instead.

## Markdown for agents

Agents that send `Accept: text/markdown` get each page as Markdown, and browsers still get HTML. Every response from the Worker carries `Vary: Accept`. The Markdown answer carries `Link: <page>; rel="canonical"` (1.9.0+), and a copy fetched by its own `.md` URL gets `X-Robots-Tag: noindex` plus the same canonical link, so search engines index the page, never its copy. This replaces Cloudflare's own Markdown for Agents, which needs the Pro plan. It works on any Workers plan.

1. After the build, write a `.md` copy next to every page: `"build": "astro build && site-kit markdown"`. Each copy has front matter (title, description, url) and only the page's `<main>`, with absolute links. The `[data-tool]` element becomes one sentence pointing at the page, and `dist/404.md` gets links to the sitemap and llms.txt. Pages without a `<main>` and the service worker's `/offline/` page are skipped.
2. Serve the site through the kit's Worker in `wrangler.jsonc`. No Worker file in the project:

   ```jsonc
   "main": "node_modules/@milindkusahu/site-kit/dist/agent/worker.js",
   "assets": {
     "directory": "./dist",
     "binding": "ASSETS",
     "run_worker_first": ["/*", "!/_astro/*", "!/images/*", "!/og/*", "!/icons/*", "!/fonts/*"],
     "html_handling": "auto-trailing-slash",
     "not_found_handling": "404-page"
   }
   ```

   List every folder that holds only static files as a `!/folder/*` pattern. Those requests skip the Worker and stay free.
3. Test it under `wrangler dev`: add a spec to `verify/` with
   `import { markdownTests } from "@milindkusahu/site-kit/playwright/markdown";` and
   `markdownTests({ path: "/a-tool-page/", heading: /^# .+$/m });`

Optional settings go in `site-kit.config.json`: `"markdown": { "dir": "dist", "skip": ["offline"], "toolNote": "This page has a free photo tool that runs in the browser. Open {url} in a browser to use it.", "origin": "https://example.com" }`. The origin comes from the homepage's canonical link when it isn't set.

**Cost.** Static files never count as Worker requests. Page requests that match `run_worker_first` do. Workers Free allows 100,000 Worker requests a day (it resets at midnight UTC). Past that limit, page requests fail with an error instead of falling back to the static file. Workers Paid ($5 a month, 10 million requests included) covers it. Use Workers Paid on any site that could pass about 100,000 page views a day.

`site-kit audit <live-url> --launch` checks that the homepage answers `Accept: text/markdown` with Markdown. Local and preview hosts skip that check, because `astro preview` doesn't run the Worker. The Playwright helper covers it there.

## Releasing

1. Change the code and add or update a test.
2. `bun run check` (typecheck, tests, build, secret scan, and a check that `dist/` is committed and current).
3. Bump `version` in package.json, commit, then `git tag vX.Y.Z && git push --tags`.

The weekly security sweep moves every project to the newest tag and runs that project's full check before merging. A breaking change gets a major version, and the sweep reports majors to me instead of merging them.

## Rules for this repo

- No project-specific code. Anything that names a site, a brand or a page belongs in that project.
- No barrels. Every export path points at the module that defines it.
- `dist/` is committed so a GitHub install works without a build step. CI fails if it's stale.

# site-kit

The code every Next.js and Astro site of mine shares, kept in one place. Fix a bug or tighten a check here, tag a release, and every project picks it up on its next sweep.

## What's in it

| Part | Import or command | What it does |
| --- | --- | --- |
| SEO core | `@milindkusahu/site-kit/seo/create-seo` | `createSeo(SITE, SITE_PAGES)` gives titles, metadata, canonicals, breadcrumbs, the JSON-LD graph, sitemap, robots, llms.txt, manifest and registry checks |
| SEO pieces | `@milindkusahu/site-kit/seo/{url,ads,share,types,…}` | Smaller helpers when you only need one |
| Security headers | `@milindkusahu/site-kit/headers` | CSP, HSTS, nosniff, referrer, permissions and opener policy. Ads and analytics open only what they need |
| ESLint | `@milindkusahu/site-kit/eslint/shared` | The no-comments, no-barrel and boundaries rules, timer bans, banned UI libraries, complexity limits |
| Playwright | `@milindkusahu/site-kit/playwright/{steps,homepage}` | Feature steps, plus the above-the-fold and no-ad-near-the-tool tests |
| Audit | `@milindkusahu/site-kit/audit` | The crawler behind `site-kit audit` |
| Markdown Worker | `dist/agent/worker.js`, `site-kit markdown` | Serves a Markdown copy of each page to agents that ask for it (see below) |
| CLI | `site-kit <command>` | `rules`, `plan`, `deps`, `secrets`, `audit`, `cwv`, `ui`, `assets`, `markdown`, `headers` |

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
  "analytics": false
}
```

`headersFile` is for Astro on Cloudflare. Next.js projects leave it out and call `securityHeaders()` from `next.config.ts`.

The headers include `Link: </llms.txt>; rel="describedby", </sitemap.xml>; rel="sitemap"` on every path, so the site must serve both files (a Next.js site needs its own `/llms.txt` route, e.g. from `seo.llmsTxt()`). A site that doesn't sets `"agentLinks": false` in `site-kit.config.json`, or passes `{ agentLinks: false }` to `securityHeaders()`.

## Markdown for agents

Agents that send `Accept: text/markdown` get each page as Markdown, and browsers still get HTML. Every response from the Worker carries `Vary: Accept`. This replaces Cloudflare's own Markdown for Agents, which needs the Pro plan. It works on any Workers plan.

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

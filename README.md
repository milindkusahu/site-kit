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
| CLI | `site-kit <command>` | `rules`, `plan`, `deps`, `secrets`, `audit`, `cwv`, `ui`, `assets`, `headers` |

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

## Releasing

1. Change the code and add or update a test.
2. `bun run check` (typecheck, tests, build, secret scan, and a check that `dist/` is committed and current).
3. Bump `version` in package.json, commit, then `git tag vX.Y.Z && git push --tags`.

The weekly security sweep moves every project to the newest tag and runs that project's full check before merging. A breaking change gets a major version, and the sweep reports majors to me instead of merging them.

## Rules for this repo

- No project-specific code. Anything that names a site, a brand or a page belongs in that project.
- No barrels. Every export path points at the module that defines it.
- `dist/` is committed so a GitHub install works without a build step. CI fails if it's stale.

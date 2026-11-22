import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const [base, ...pathsArg] = process.argv.slice(2);
if (!base) {
  process.stderr.write("Usage: bun run cwv -- <base-url> [/path ...]\nExample: bun run cwv -- http://localhost:3100 / /tools/example\n");
  process.exit(1);
}

const paths = pathsArg.length > 0 ? pathsArg : ["/"];
const runs = Number(process.env.RUNS ?? 3);
const budget = {
  mobile: {
    cls: Number(process.env.CWV_CLS ?? 0.05),
    lcp: Number(process.env.CWV_LCP_MOBILE ?? 4000),
    tbt: Number(process.env.CWV_TBT_MOBILE ?? 800),
  },
  desktop: {
    cls: Number(process.env.CWV_CLS ?? 0.05),
    lcp: Number(process.env.CWV_LCP_DESKTOP ?? 2500),
    tbt: Number(process.env.CWV_TBT_DESKTOP ?? 300),
  },
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

function snippetOf(item) {
  const node = item?.node ?? item?.items?.[0]?.node;
  return node?.snippet ?? node?.selector ?? "unknown element";
}

function lcpElementOf(audits) {
  const fromInsight = (audits["lcp-breakdown-insight"]?.details?.items ?? []).find((i) => i.type === "node");
  if (fromInsight) return fromInsight.snippet ?? fromInsight.selector ?? fromInsight.path ?? "unknown element";
  return snippetOf(audits["largest-contentful-paint-element"]?.details?.items?.[0]);
}

const chromePath = process.env.CHROME_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_PATH;
const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  ...(chromePath ? { chromePath } : {}),
});

let failed = false;
try {
  for (const formFactor of ["mobile", "desktop"]) {
    for (const p of paths) {
      const url = new URL(p, base).href;
      const samples = [];
      for (let run = 0; run < runs; run += 1) {
        const result = await lighthouse(
          url,
          { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance"] },
          formFactor === "desktop" ? desktopConfig : undefined,
        );
        const audits = result?.lhr.audits ?? {};
        samples.push({
          lcp: audits["largest-contentful-paint"]?.numericValue ?? 0,
          cls: audits["cumulative-layout-shift"]?.numericValue ?? 0,
          tbt: audits["total-blocking-time"]?.numericValue ?? 0,
          fcp: audits["first-contentful-paint"]?.numericValue ?? 0,
          observedLcp: audits.metrics?.details?.items?.[0]?.observedLargestContentfulPaint ?? 0,
          lcpElement: lcpElementOf(audits),
          shifts: (audits["layout-shifts"]?.details?.items ?? []).map((i) => `${(i.score ?? 0).toFixed(3)} ${snippetOf(i)}`),
        });
      }
      const m = {
        lcp: median(samples.map((s) => s.lcp)),
        cls: median(samples.map((s) => s.cls)),
        tbt: median(samples.map((s) => s.tbt)),
        fcp: median(samples.map((s) => s.fcp)),
        observedLcp: median(samples.map((s) => s.observedLcp)),
      };
      const b = budget[formFactor];
      const over = [m.cls > b.cls && "CLS", m.lcp > b.lcp && "LCP", m.tbt > b.tbt && "TBT"].filter(Boolean);
      if (over.length > 0) failed = true;
      process.stdout.write(
        [
          `${over.length > 0 ? "FAIL" : "pass"}  ${formFactor.padEnd(7)} ${p}`,
          `      LCP ${Math.round(m.lcp)} ms (observed ${Math.round(m.observedLcp)}, FCP ${Math.round(m.fcp)}) budget ${b.lcp}`,
          `      CLS ${m.cls.toFixed(3)} budget ${b.cls}`,
          `      TBT ${Math.round(m.tbt)} ms budget ${b.tbt}`,
          `      LCP element: ${samples[0]?.lcpElement ?? "unknown"}`,
          ...[...new Set(samples.flatMap((s) => s.shifts))].map((s) => `      shift: ${s}`),
          over.length > 0 ? `      over budget: ${over.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n") + "\n",
      );
    }
  }
} finally {
  await chrome.kill();
}

process.exit(failed ? 1 : 0);

import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [url, ...actions] = process.argv.slice(2);

if (!url) {
  process.stderr.write(
    [
      "Usage: bun run ui -- <url> [action...]",
      "  click:<accessible name>     click a button, link, tab or text",
      "  fill:<label>=<value>        type into the field with that label",
      "  expect:<text>               fail unless the text is visible",
      "  shot:<name>                 save verify/evidence/<name>.png",
      "Always prints the accessibility tree at the end so you can see control names.",
      "",
      "Example: bun run ui -- http://localhost:3000 click:'Say hello' expect:'Hello, world!' shot:hello",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const byName = (name) =>
  page
    .getByRole("button", { name, exact: true })
    .or(page.getByRole("link", { name, exact: true }))
    .or(page.getByRole("tab", { name, exact: true }))
    .or(page.getByText(name, { exact: true }))
    .first();

let failed = false;
try {
  await page.goto(url);
  for (const action of actions) {
    const at = action.indexOf(":");
    const kind = action.slice(0, at);
    const arg = action.slice(at + 1);
    process.stdout.write(`> ${kind} ${arg}\n`);
    if (kind === "click") {
      await byName(arg).click({ timeout: 5000 });
    } else if (kind === "fill") {
      const eq = arg.indexOf("=");
      await page.getByLabel(arg.slice(0, eq), { exact: true }).fill(arg.slice(eq + 1), { timeout: 5000 });
    } else if (kind === "expect") {
      await page.getByText(arg).first().waitFor({ state: "visible", timeout: 5000 });
    } else if (kind === "shot") {
      mkdirSync("verify/evidence", { recursive: true });
      await page.screenshot({ path: `verify/evidence/${arg}.png`, fullPage: true });
      process.stdout.write(`  saved verify/evidence/${arg}.png\n`);
    } else {
      throw new Error(`Unknown action '${kind}'`);
    }
  }
} catch (error) {
  failed = true;
  process.stdout.write(`FAILED: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}\n`);
}

process.stdout.write(`\nAccessibility tree:\n${await page.locator("body").ariaSnapshot()}\n`);
if (pageErrors.length > 0) {
  failed = true;
  process.stdout.write(`\nPage errors:\n${pageErrors.join("\n")}\n`);
}
await browser.close();
process.exit(failed ? 1 : 0);

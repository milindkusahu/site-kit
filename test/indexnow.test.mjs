import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENDPOINT, MAX_URLS, checkKey, describeStatus, liveKeyProblem, submissionBodies, submit, writeKeyFile } from "../assets/indexnow.mjs";

const KEY = "0123456789abcdef0123456789abcdef";
const ORIGIN = "https://example.com";
let dir = "";

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "kit-indexnow-"));
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const reply = (status, text = "") => async () => new Response(text, { status });

describe("site-kit indexnow", () => {
  it("accepts 8 to 128 letters, digits and dashes, and refuses anything else", () => {
    expect(checkKey(KEY)).toBe(KEY);
    expect(checkKey("abc-1234")).toBe("abc-1234");
    for (const bad of [undefined, "", "short12", "a".repeat(129), "has space1", "under_score", "../etc/passwd"]) expect(() => checkKey(bad)).toThrow(/indexnow/);
  });

  it("writes <dir>/<key>.txt holding exactly the key", () => {
    const file = writeKeyFile(dir, KEY);
    expect(file).toBe(path.join(dir, `${KEY}.txt`));
    expect(readFileSync(file, "utf8")).toBe(KEY);
  });

  it("refuses to write before the build exists", () => {
    expect(() => writeKeyFile(path.join(dir, "missing"), KEY)).toThrow(/Run the build first/);
  });

  it("builds one body with host, key, keyLocation and the URLs, deduped and on the host only", () => {
    const urls = [`${ORIGIN}/`, `${ORIGIN}/a/`, `${ORIGIN}/a/`, "https://other.com/x/", "https://www.example.com/b/"];
    expect(submissionBodies({ origin: ORIGIN, key: KEY, urls })).toEqual([
      { host: "example.com", key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: [`${ORIGIN}/`, `${ORIGIN}/a/`] },
    ]);
  });

  it("splits at 10,000 URLs per request, and sends nothing for no URLs", () => {
    const urls = Array.from({ length: MAX_URLS + 1 }, (_, i) => `${ORIGIN}/p${i}/`);
    const bodies = submissionBodies({ origin: ORIGIN, key: KEY, urls });
    expect(bodies.map((b) => b.urlList.length)).toEqual([MAX_URLS, 1]);
    expect(submissionBodies({ origin: ORIGIN, key: KEY, urls: [] })).toEqual([]);
  });

  it("treats only 200 and 202 as success", () => {
    expect([200, 202, 400, 403, 422, 429, 500].map((s) => describeStatus(s).ok)).toEqual([true, true, false, false, false, false, false]);
    expect(describeStatus(403).message).toMatch(/key/);
    expect(describeStatus(500).message).toBe("unexpected status 500");
  });

  it("reports a missing or wrong live key file before any ping", async () => {
    expect(await liveKeyProblem({ origin: ORIGIN, key: KEY, fetchFn: reply(200, `${KEY}\n`) })).toBeNull();
    expect(await liveKeyProblem({ origin: ORIGIN, key: KEY, fetchFn: reply(404) })).toMatch(/returned 404/);
    expect(await liveKeyProblem({ origin: ORIGIN, key: KEY, fetchFn: reply(200, "other-key-123") })).toMatch(/doesn't hold the key/);
  });

  it("POSTs JSON to the IndexNow endpoint and reports the status", async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return new Response("", { status: 202 });
    };
    const [body] = submissionBodies({ origin: ORIGIN, key: KEY, urls: [`${ORIGIN}/`] });
    expect(await submit(body, fetchFn)).toEqual({ count: 1, status: 202, ok: true, message: "received, key validation pending" });
    expect(calls[0].url).toBe(ENDPOINT);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(calls[0].init.body)).toEqual(body);
  });
});

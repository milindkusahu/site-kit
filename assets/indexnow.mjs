import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

// IndexNow (https://www.indexnow.org/documentation): a key file at /{key}.txt proves ownership, then one POST
// tells Bing, Yandex and the other members which URLs changed. The key is public by design.
export const ENDPOINT = "https://api.indexnow.org/indexnow";
export const MAX_URLS = 10000;
const KEY = /^[A-Za-z0-9-]{8,128}$/;

export function checkKey(key) {
  if (typeof key !== "string" || !KEY.test(key)) {
    throw new Error('site-kit.config.json needs "indexnow": { "key": "..." }: 8 to 128 letters, digits or dashes.');
  }
  return key;
}

/** After the build, writes <dir>/<key>.txt holding the key, so the key file ships with every deploy. */
export function writeKeyFile(dir, key) {
  if (!existsSync(dir)) throw new Error(`${dir} not found. Run the build first, then site-kit indexnow key.`);
  const file = path.join(dir, `${checkKey(key)}.txt`);
  writeFileSync(file, key);
  return file;
}

/** One POST body per 10,000 URLs, keeping only URLs on the origin's host (others get a 422). */
export function submissionBodies({ origin, key, urls }) {
  const { host } = new URL(origin);
  const own = [...new Set(urls)].filter((u) => new URL(u).host === host);
  const bodies = [];
  for (let i = 0; i < own.length; i += MAX_URLS) {
    bodies.push({ host, key, keyLocation: new URL(`/${key}.txt`, origin).href, urlList: own.slice(i, i + MAX_URLS) });
  }
  return bodies;
}

const STATUS = {
  200: "accepted",
  202: "received, key validation pending",
  400: "bad request: the body format is wrong",
  403: "key not valid: the key file is missing or doesn't hold the key",
  422: "URLs don't belong to the host, or the key doesn't match the protocol",
  429: "too many requests: wait before pinging again",
};

export function describeStatus(status) {
  return { ok: status === 200 || status === 202, message: STATUS[status] ?? `unexpected status ${status}` };
}

/** Fails before any POST when the live key file doesn't serve the key, which would only earn a 403. */
export async function liveKeyProblem({ origin, key, fetchFn = fetch }) {
  const url = new URL(`/${key}.txt`, origin).href;
  const res = await fetchFn(url, { redirect: "manual" });
  if (res.status !== 200) return `${url} returned ${res.status}. Deploy the build with the key file first.`;
  const body = (await res.text()).trim();
  return body === key ? null : `${url} doesn't hold the key from site-kit.config.json.`;
}

export async function submit(body, fetchFn = fetch) {
  const res = await fetchFn(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return { count: body.urlList.length, status: res.status, ...describeStatus(res.status) };
}

export function withTrailingSlash(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? "/";
  if (clean === "" || clean === "/") return "/";
  if (/\.[a-z0-9]+$/i.test(clean)) return clean;
  return clean.endsWith("/") ? clean : `${clean}/`;
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(withTrailingSlash(path), origin).href;
}

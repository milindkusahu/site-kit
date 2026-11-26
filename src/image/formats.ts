// What kind of image a file is, from its bytes first, then its mime type, then its name.
// Android often reports HEIC as application/octet-stream, so the name is a real fallback.

export type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif" | "heic" | "bmp" | "tiff";

/** Formats every current browser decodes with createImageBitmap. AVIF needs Safari 16+, which is current. */
export const BROWSER_FORMATS: readonly ImageFormat[] = ["jpeg", "png", "webp", "gif", "avif", "bmp"];

const MIME_FORMATS: Readonly<Record<string, ImageFormat>> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/heic-sequence": "heic",
  "image/heif-sequence": "heic",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/tiff": "tiff",
};

const EXTENSION_FORMATS: Readonly<Record<string, ImageFormat>> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  jpe: "jpeg",
  jfif: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  avif: "avif",
  heic: "heic",
  heif: "heic",
  hif: "heic",
  bmp: "bmp",
  tif: "tiff",
  tiff: "tiff",
};

const LABELS: Readonly<Record<ImageFormat, string>> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  avif: "AVIF",
  heic: "HEIC",
  bmp: "BMP",
  tiff: "TIFF",
};

const MIME_TYPES: Readonly<Record<ImageFormat, string>> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  bmp: "image/bmp",
  tiff: "image/tiff",
};

export function formatLabel(format: ImageFormat): string {
  return LABELS[format];
}

export function mimeTypeOf(format: ImageFormat): string {
  return MIME_TYPES[format];
}

export function formatFromMime(type: string): ImageFormat | null {
  return MIME_FORMATS[type.trim().toLowerCase()] ?? null;
}

/** The lower-case extension without its dot, or "" when the name has none. */
export function extensionOf(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase() ?? "";
}

export function formatFromName(name: string): ImageFormat | null {
  return EXTENSION_FORMATS[extensionOf(name)] ?? null;
}

export type FileFacts = { readonly name: string; readonly type: string; readonly header?: ImageFormat | null };

/** The bytes win over the mime type, and the mime type over the name: a renamed PNG is still a PNG. */
export function detectFormat(file: FileFacts): ImageFormat | null {
  return file.header ?? formatFromMime(file.type) ?? formatFromName(file.name);
}

/** True for a known format and for any image/* type the browser may still open. */
export function looksLikeImage(file: FileFacts): boolean {
  return detectFormat(file) !== null || file.type.trim().toLowerCase().startsWith("image/");
}

/**
 * An `accept` attribute for these formats: mime types plus extensions, so a HEIC
 * picked on Android, where the type is often empty, is still offered.
 */
export function acceptFor(formats: readonly ImageFormat[]): string {
  const types = [...new Set(formats.flatMap((format) => Object.entries(MIME_FORMATS).filter(([, value]) => value === format).map(([type]) => type)))];
  const extensions = [...new Set(formats.flatMap((format) => Object.entries(EXTENSION_FORMATS).filter(([, value]) => value === format).map(([extension]) => `.${extension}`)))];
  return [...types, ...extensions].join(",");
}

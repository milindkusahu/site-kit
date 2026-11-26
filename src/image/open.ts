// A picked or dropped file, opened as an upright ImageBitmap or turned down with a reason.
//
// In order: read the first megabyte (a file that can't be read at all is "unreadable", not
// "damaged"), refuse non-images, refuse a file whose header is over the pixel limit before
// decoding it, decode with createImageBitmap honouring EXIF orientation, fall back to the HEIC
// decoder when one is given, then check the decoded size against the limit too.

import { detectFormat, looksLikeImage, type ImageFormat } from "./formats.ts";
import { HEADER_BYTES, exifOrientation, fullSizeIfReduced, headerFormat, headerSize, type Size } from "./header.ts";
import { HeicError, type HeicDecode } from "./heic.ts";
import { isTooLarge, type OpenProblem } from "./problems.ts";

export type OpenedImage = {
  readonly kind: "opened";
  /** Upright: EXIF orientation is already applied. The caller closes it. */
  readonly bitmap: ImageBitmap;
  /** The bitmap's size. */
  readonly size: Size;
  /** Null when the browser read the file but nothing names its format. */
  readonly format: ImageFormat | null;
  readonly name: string;
  readonly bytes: number;
  /** The EXIF orientation the file stated (JPEG only), 1 to 8, or null. */
  readonly orientation: number | null;
  /** The file's real size when the browser decoded it smaller (large JPEGs on Android), else null. */
  readonly reducedFrom: Size | null;
};

export type OpenResult = OpenedImage | OpenProblem;

export type OpenOptions = {
  /** Files with more pixels than this are refused, from the header when it can be read. Default 100 MP. */
  readonly maxPixels?: number;
  /** From `createHeicDecoder()` in `site-kit/image/heic`. Without it, a HEIC the browser can't open is "unsupported". */
  readonly heic?: HeicDecode | null;
};

export const MAX_PIXELS = 100_000_000;

type Head = { readonly bytes: Uint8Array; readonly format: ImageFormat | null };

async function readHead(file: Blob): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  } catch {
    return null;
  }
}

/** True when even the first byte can't be read: the handle went stale, not the file. */
export async function isUnreadable(file: Blob): Promise<boolean> {
  try {
    await file.slice(0, 1).arrayBuffer();
    return false;
  } catch {
    return true;
  }
}

function precheck(file: File, head: Head, maxPixels: number): OpenProblem | null {
  if (!looksLikeImage({ name: file.name, type: file.type, header: head.format })) return { kind: "not-image", name: file.name };
  if (head.format === "tiff") return { kind: "unsupported", name: file.name, format: "tiff" };
  const stored = headerSize(head.bytes);
  if (stored !== null && isTooLarge(stored, maxPixels)) return { kind: "too-large", name: file.name, size: stored, maxPixels };
  return null;
}

async function browserBitmap(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

function heicProblem(name: string, error: unknown): OpenProblem {
  if (!(error instanceof HeicError)) return { kind: "damaged", name, format: "heic" };
  if (error.reason === "not-loaded") return { kind: "decoder-not-loaded", name };
  if (error.reason === "out-of-memory") return { kind: "out-of-memory", name, reference: error.reference };
  return { kind: "damaged", name, format: "heic" };
}

async function decode(file: File, format: ImageFormat | null, heic: HeicDecode | null): Promise<ImageBitmap | OpenProblem> {
  const bitmap = await browserBitmap(file);
  if (bitmap !== null) return bitmap;
  if (await isUnreadable(file)) return { kind: "unreadable", name: file.name };
  if (format !== "heic") return { kind: "damaged", name: file.name, format };
  if (heic === null) return { kind: "unsupported", name: file.name, format };
  try {
    return await heic(file);
  } catch (error) {
    return heicProblem(file.name, error);
  }
}

function opened(file: File, bitmap: ImageBitmap, head: Head): OpenedImage {
  const size = { width: bitmap.width, height: bitmap.height };
  const stored = head.format === "jpeg" ? headerSize(head.bytes) : null;
  return {
    kind: "opened",
    bitmap,
    size,
    format: detectFormat({ name: file.name, type: file.type, header: head.format }),
    name: file.name,
    bytes: file.size,
    orientation: head.format === "jpeg" ? exifOrientation(head.bytes) : null,
    reducedFrom: stored === null ? null : fullSizeIfReduced(stored, size),
  };
}

export async function openImage(file: File, options: OpenOptions = {}): Promise<OpenResult> {
  const maxPixels = options.maxPixels ?? MAX_PIXELS;
  const bytes = await readHead(file);
  if (bytes === null) return { kind: "unreadable", name: file.name };
  const head = { bytes, format: headerFormat(bytes) };
  const problem = precheck(file, head, maxPixels);
  if (problem !== null) return problem;
  const result = await decode(file, detectFormat({ name: file.name, type: file.type, header: head.format }), options.heic ?? null);
  if ("kind" in result) return result;
  const size = { width: result.width, height: result.height };
  if (isTooLarge(size, maxPixels)) {
    result.close();
    return { kind: "too-large", name: file.name, size, maxPixels };
  }
  return opened(file, result, head);
}

/** The bitmap again, for the full-size render after a preview: same orientation, same HEIC fallback. */
export async function decodeAgain(file: File, options: Pick<OpenOptions, "heic"> = {}): Promise<ImageBitmap> {
  const head = (await readHead(file)) ?? new Uint8Array();
  const format = detectFormat({ name: file.name, type: file.type, header: headerFormat(head) });
  const result = await decode(file, format, options.heic ?? null);
  if ("kind" in result) throw new Error(`${file.name} could not be read again. Add it again.`);
  return result;
}

/**
 * On Android a picked file's handle can stop working while the page is open, so each file is
 * copied into memory as soon as it is picked. Elsewhere the files are returned as they are.
 * A file that can't be copied is kept as it is, and opening it later reports "unreadable".
 */
export async function holdFiles(files: readonly File[], userAgent: string = globalThis.navigator?.userAgent ?? ""): Promise<File[]> {
  if (!/Android/i.test(userAgent)) return [...files];
  const held: File[] = [];
  for (const file of files) {
    try {
      held.push(new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified }));
    } catch {
      held.push(file);
    }
  }
  return held;
}

// An image's format, stored pixel size and EXIF orientation, read from the first bytes of the file.
// Structure only, never a pixel, so a 100 megapixel photo can be refused before the browser
// spends a gigabyte decoding it. Sizes are as stored, before any EXIF rotation.

import type { ImageFormat } from "./formats.ts";

export type Size = { readonly width: number; readonly height: number };

/** How much of a file to read for its header. A camera JPEG's EXIF, thumbnail and maker notes fit well inside this. */
export const HEADER_BYTES = 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const AVIF_BRANDS = new Set(["avif", "avis"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, Math.min(at + length, bytes.length)));
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function byteAt(bytes: Uint8Array, at: number): number {
  return bytes[at] ?? 0;
}

function uint16(bytes: Uint8Array, at: number): number {
  return (byteAt(bytes, at) << 8) | byteAt(bytes, at + 1);
}

function uint24le(bytes: Uint8Array, at: number): number {
  return byteAt(bytes, at) | (byteAt(bytes, at + 1) << 8) | (byteAt(bytes, at + 2) << 16);
}

function uint32(bytes: Uint8Array, at: number): number {
  return at + 4 <= bytes.length ? view(bytes).getUint32(at) : 0;
}

/** HEIC and AVIF share one container; the brands in `ftyp` say which. A plain `mif1` file is HEIF. */
function isobmffFormat(bytes: Uint8Array): ImageFormat | null {
  if (ascii(bytes, 4, 4) !== "ftyp") return null;
  const end = Math.min(uint32(bytes, 0), bytes.length);
  const brands = [ascii(bytes, 8, 4)];
  for (let at = 16; at + 4 <= end; at += 4) brands.push(ascii(bytes, at, 4));
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return "avif";
  return brands.some((brand) => HEIC_BRANDS.has(brand)) ? "heic" : null;
}

/** The format the first bytes announce, or null for one this reader does not know. */
export function headerFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 0, 2) === "BM" && bytes.length >= 26) return "bmp";
  const tiff = ascii(bytes, 0, 4);
  if (tiff === "II*\0" || tiff === "MM\0*") return "tiff";
  return isobmffFormat(bytes);
}

// JPEG: walk the segments to the start-of-frame marker.

const SOS = 0xda;
const EOI = 0xd9;

/** C0 to CF are frame markers, except C4 (Huffman tables), C8 (reserved) and CC (arithmetic conditioning). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/** The offset of the marker byte after any 0xFF fill, or null. */
function markerAt(bytes: Uint8Array, offset: number): number | null {
  if (bytes[offset] !== 0xff) return null;
  let at = offset + 1;
  while (at < bytes.length && bytes[at] === 0xff) at += 1;
  return at < bytes.length ? at : null;
}

type Segment = { readonly marker: number; readonly at: number };

/** Calls `found` for each segment until it returns a value. Stops at the image data. */
function eachJpegSegment<T>(bytes: Uint8Array, found: (segment: Segment) => T | null): T | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    const at = markerAt(bytes, offset);
    if (at === null) return null;
    const marker = byteAt(bytes, at);
    if (marker === SOS || marker === EOI) return null;
    const result = found({ marker, at });
    if (result !== null) return result;
    offset = isStandalone(marker) ? at + 1 : at + 1 + uint16(bytes, at + 1);
  }
  return null;
}

/** The frame header's size, or null when the bytes end before it. */
export function jpegSize(bytes: Uint8Array): Size | null {
  const size = eachJpegSegment(bytes, ({ marker, at }) => {
    if (!isStartOfFrame(marker)) return null;
    if (at + 9 >= bytes.length) return { width: 0, height: 0 };
    return { width: uint16(bytes, at + 6), height: uint16(bytes, at + 4) };
  });
  return size === null || size.width === 0 || size.height === 0 ? null : size;
}

// PNG, WebP, GIF, BMP: fixed fields near the start.

function pngSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null;
  return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
}

/** The first chunk decides: VP8X (extended), VP8L (lossless) or "VP8 " (lossy). */
function webpSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
  if (chunk === "VP8L") {
    const bits = view(bytes).getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk !== "VP8 ") return null;
  return { width: view(bytes).getUint16(26, true) & 0x3fff, height: view(bytes).getUint16(28, true) & 0x3fff };
}

function gifSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 10) return null;
  return { width: view(bytes).getUint16(6, true), height: view(bytes).getUint16(8, true) };
}

/** A BMP's height is negative when its rows run top down. */
function bmpSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 26) return null;
  return { width: Math.abs(view(bytes).getInt32(18, true)), height: Math.abs(view(bytes).getInt32(22, true)) };
}

// HEIC and AVIF: the image spatial extent (`ispe`) boxes under meta > iprp > ipco.

type Box = { readonly type: string; readonly start: number; readonly end: number };

/** The boxes between `start` and `end`. A size of 1 means a 64-bit size follows; 0 means "to the end". */
function boxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const found: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    const small = uint32(bytes, at);
    const large = small === 1 ? uint32(bytes, at + 8) * 2 ** 32 + uint32(bytes, at + 12) : small;
    const size = small === 0 ? end - at : large;
    const header = small === 1 ? 16 : 8;
    if (size < header) break;
    found.push({ type: ascii(bytes, at + 4, 4), start: at + header, end: Math.min(at + size, end) });
    at += size;
  }
  return found;
}

function child(bytes: Uint8Array, parent: Box | undefined, type: string, skip = 0): Box | undefined {
  if (parent === undefined) return undefined;
  return boxes(bytes, parent.start + skip, parent.end).find((box) => box.type === type);
}

/**
 * The largest `ispe` in the file. The primary image (or the grid that tiles it) is the
 * largest; the rest are its tiles and thumbnail. Area is what a memory limit cares about,
 * and a rotation (`irot`) does not change it.
 */
function isobmffSize(bytes: Uint8Array): Size | null {
  const meta = boxes(bytes, 0, bytes.length).find((box) => box.type === "meta");
  const properties = child(bytes, child(bytes, meta, "iprp", 4), "ipco");
  if (properties === undefined) return null;
  const extents = boxes(bytes, properties.start, properties.end).filter((box) => box.type === "ispe" && box.start + 12 <= box.end);
  const sizes = extents.map((box) => ({ width: uint32(bytes, box.start + 4), height: uint32(bytes, box.start + 8) }));
  return sizes.reduce<Size | null>((largest, size) => (largest === null || size.width * size.height > largest.width * largest.height ? size : largest), null);
}

const READERS: Readonly<Partial<Record<ImageFormat, (bytes: Uint8Array) => Size | null>>> = {
  jpeg: jpegSize,
  png: pngSize,
  webp: webpSize,
  gif: gifSize,
  bmp: bmpSize,
  heic: isobmffSize,
  avif: isobmffSize,
};

/** The stored pixel size, or null when the header is cut short, not understood, or TIFF. */
export function headerSize(bytes: Uint8Array): Size | null {
  const format = headerFormat(bytes);
  const reader = format === null ? undefined : READERS[format];
  const size = reader?.(bytes) ?? null;
  return size === null || size.width <= 0 || size.height <= 0 ? null : size;
}

// EXIF orientation, from a JPEG's APP1 segment.

const APP1 = 0xe1;
const ORIENTATION_TAG = 0x0112;
const SHORT = 3;

type Tiff = { readonly data: DataView; readonly start: number; readonly end: number; readonly little: boolean };

function exifBlock(bytes: Uint8Array): Tiff | null {
  return eachJpegSegment(bytes, ({ marker, at }) => {
    if (marker !== APP1 || ascii(bytes, at + 3, 6) !== "Exif\0\0") return null;
    const start = at + 9;
    const end = Math.min(at + 1 + uint16(bytes, at + 1), bytes.length);
    const order = ascii(bytes, start, 2);
    if (end - start < 8 || (order !== "II" && order !== "MM")) return null;
    return { data: view(bytes), start, end, little: order === "II" };
  });
}

function orientationEntry(tiff: Tiff, directory: number): number | null {
  const { data, end, little } = tiff;
  if (directory + 2 > end) return null;
  const count = data.getUint16(directory, little);
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * 12;
    if (entry + 12 > end) return null;
    if (data.getUint16(entry, little) !== ORIENTATION_TAG) continue;
    if (data.getUint16(entry + 2, little) !== SHORT) return null;
    const value = data.getUint16(entry + 8, little);
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

/** The EXIF orientation of a JPEG, 1 to 8, or null when it states none (which means upright). */
export function exifOrientation(bytes: Uint8Array): number | null {
  const tiff = exifBlock(bytes);
  if (tiff === null) return null;
  return orientationEntry(tiff, tiff.start + tiff.data.getUint32(tiff.start + 4, tiff.little));
}

/** Orientations 5 to 8 turn the photo a quarter, so its shown width is its stored height. */
export function orientedSize(size: Size, orientation: number | null): Size {
  return orientation !== null && orientation >= 5 ? { width: size.height, height: size.width } : size;
}

/**
 * The file's full size, turned the way the bitmap is, when the browser decoded it smaller.
 * Chrome on Android decodes very large JPEGs at a reduced scale without saying so (measured
 * 2026-09-24: a 16320 x 12240 photo came back 12240 x 9180). Compared long edge to long edge,
 * so an EXIF rotation is not mistaken for a loss. Null when nothing was lost.
 */
export function fullSizeIfReduced(stored: Size, decoded: Size): Size | null {
  const long = Math.max(stored.width, stored.height);
  if (Math.max(decoded.width, decoded.height) >= long) return null;
  const short = Math.min(stored.width, stored.height);
  return decoded.width >= decoded.height ? { width: long, height: short } : { width: short, height: long };
}

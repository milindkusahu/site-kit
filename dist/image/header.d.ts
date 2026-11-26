import type { ImageFormat } from "./formats.ts";
export type Size = {
    readonly width: number;
    readonly height: number;
};
/** How much of a file to read for its header. A camera JPEG's EXIF, thumbnail and maker notes fit well inside this. */
export declare const HEADER_BYTES: number;
/** The format the first bytes announce, or null for one this reader does not know. */
export declare function headerFormat(bytes: Uint8Array): ImageFormat | null;
/** The frame header's size, or null when the bytes end before it. */
export declare function jpegSize(bytes: Uint8Array): Size | null;
/** The stored pixel size, or null when the header is cut short, not understood, or TIFF. */
export declare function headerSize(bytes: Uint8Array): Size | null;
/** The EXIF orientation of a JPEG, 1 to 8, or null when it states none (which means upright). */
export declare function exifOrientation(bytes: Uint8Array): number | null;
/** Orientations 5 to 8 turn the photo a quarter, so its shown width is its stored height. */
export declare function orientedSize(size: Size, orientation: number | null): Size;
/**
 * The file's full size, turned the way the bitmap is, when the browser decoded it smaller.
 * Chrome on Android decodes very large JPEGs at a reduced scale without saying so (measured
 * 2026-09-24: a 16320 x 12240 photo came back 12240 x 9180). Compared long edge to long edge,
 * so an EXIF rotation is not mistaken for a loss. Null when nothing was lost.
 */
export declare function fullSizeIfReduced(stored: Size, decoded: Size): Size | null;

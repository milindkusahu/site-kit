export type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif" | "heic" | "bmp" | "tiff";
/** Formats every current browser decodes with createImageBitmap. AVIF needs Safari 16+, which is current. */
export declare const BROWSER_FORMATS: readonly ImageFormat[];
export declare function formatLabel(format: ImageFormat): string;
export declare function mimeTypeOf(format: ImageFormat): string;
export declare function formatFromMime(type: string): ImageFormat | null;
/** The lower-case extension without its dot, or "" when the name has none. */
export declare function extensionOf(name: string): string;
export declare function formatFromName(name: string): ImageFormat | null;
export type FileFacts = {
    readonly name: string;
    readonly type: string;
    readonly header?: ImageFormat | null;
};
/** The bytes win over the mime type, and the mime type over the name: a renamed PNG is still a PNG. */
export declare function detectFormat(file: FileFacts): ImageFormat | null;
/** True for a known format and for any image/* type the browser may still open. */
export declare function looksLikeImage(file: FileFacts): boolean;
/**
 * An `accept` attribute for these formats: mime types plus extensions, so a HEIC
 * picked on Android, where the type is often empty, is still offered.
 */
export declare function acceptFor(formats: readonly ImageFormat[]): string;

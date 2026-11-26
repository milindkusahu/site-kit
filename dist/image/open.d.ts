import { type ImageFormat } from "./formats.ts";
import { type Size } from "./header.ts";
import { type HeicDecode } from "./heic.ts";
import { type OpenProblem } from "./problems.ts";
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
export declare const MAX_PIXELS = 100000000;
/** True when even the first byte can't be read: the handle went stale, not the file. */
export declare function isUnreadable(file: Blob): Promise<boolean>;
export declare function openImage(file: File, options?: OpenOptions): Promise<OpenResult>;
/** The bitmap again, for the full-size render after a preview: same orientation, same HEIC fallback. */
export declare function decodeAgain(file: File, options?: Pick<OpenOptions, "heic">): Promise<ImageBitmap>;
/**
 * On Android a picked file's handle can stop working while the page is open, so each file is
 * copied into memory as soon as it is picked. Elsewhere the files are returned as they are.
 * A file that can't be copied is kept as it is, and opening it later reports "unreadable".
 */
export declare function holdFiles(files: readonly File[], userAgent?: string): Promise<File[]>;

export type HeicReason = "not-loaded" | "empty" | "unreadable" | "out-of-memory";
export declare class HeicError extends Error {
    readonly reason: HeicReason;
    /** For out-of-memory: the failing step and the browser's words, short enough to read aloud. */
    readonly reference: string;
    constructor(reason: HeicReason, message: string, options?: {
        cause?: unknown;
        reference?: string;
    });
}
export type HeicDecode = (file: Blob) => Promise<ImageBitmap>;
export type HeicOptions = {
    /** Resolves to the libheif module (the emscripten factory already called). Default: libheif-js's wasm bundle. */
    readonly load?: () => Promise<unknown>;
    /** A heap past this is dropped after the decode that grew it. Default 256 MB. */
    readonly heapKept?: number;
    /** How long a failed decode waits before its one retry. Default 1000 ms. */
    readonly retryPauseMs?: number;
};
/**
 * Measured on a 50 megapixel phone photo: libheif's heap reaches 361 MB on the first decode
 * and 434 MB on the second, and wasm memory is never given back. Dropping the instance past
 * this lets the browser collect it; a 12 MP photo stays under and keeps its instance.
 */
export declare const HEAP_KEPT: number;
export declare const RETRY_PAUSE_MS = 1000;
/**
 * A HEIC decoder. Each call returns its own, with its own cached libheif instance. The promise
 * is cached, not the module, so two HEIC files opened together share one download.
 *
 * The first image is used (a live photo or burst holds several; the first is the one the phone
 * shows). A failure libheif did not explain is tried once more on a fresh instance after a pause,
 * because an allocation that failed beside a 400 MB heap can succeed without it; a second such
 * failure is reported as out of memory, since a damaged file gets "empty" or "unreadable".
 */
export declare function createHeicDecoder(options?: HeicOptions): HeicDecode;

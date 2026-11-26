import { type ImageFormat } from "./formats.ts";
import type { Size } from "./header.ts";
export type OpenProblem = 
/** The device no longer lets the page read the file (a picked file's handle went stale). */
{
    readonly kind: "unreadable";
    readonly name: string;
}
/** Not an image at all, as far as its bytes, type and name say. */
 | {
    readonly kind: "not-image";
    readonly name: string;
}
/** An image this browser cannot decode, such as HEIC with no HEIC decoder, or TIFF. */
 | {
    readonly kind: "unsupported";
    readonly name: string;
    readonly format: ImageFormat;
} | {
    readonly kind: "too-large";
    readonly name: string;
    readonly size: Size;
    readonly maxPixels: number;
}
/** A format the browser knows, whose bytes it could not decode. */
 | {
    readonly kind: "damaged";
    readonly name: string;
    readonly format: ImageFormat | null;
}
/** The HEIC decoder's code did not download. */
 | {
    readonly kind: "decoder-not-loaded";
    readonly name: string;
}
/** Decoding ran out of memory twice. `reference` is the failing step and the browser's words, to pass on. */
 | {
    readonly kind: "out-of-memory";
    readonly name: string;
    readonly reference: string;
};
export type ProblemCopy = {
    /** A heading for a dialog or banner. */
    readonly title: string;
    /** One sentence naming the file and the fix. */
    readonly line: string;
    /** Two or three words for a thumbnail badge. */
    readonly short: string;
};
export type CopyOptions = {
    /** The formats the page asks for, as the reader knows them. Default "JPG, PNG or WebP". */
    readonly accepted?: string;
};
export declare function megapixels(pixels: number): string;
export declare function isTooLarge(size: Size, maxPixels: number): boolean;
export declare function problemCopy(problem: OpenProblem, options?: CopyOptions): ProblemCopy;

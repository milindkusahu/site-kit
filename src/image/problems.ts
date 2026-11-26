// Why a file did not open, as data, and the words a reader sees for it.
// Never a raw browser exception: each message says what went wrong and what to do next.

import { formatLabel, type ImageFormat } from "./formats.ts";
import type { Size } from "./header.ts";

export type OpenProblem =
  /** The device no longer lets the page read the file (a picked file's handle went stale). */
  | { readonly kind: "unreadable"; readonly name: string }
  /** Not an image at all, as far as its bytes, type and name say. */
  | { readonly kind: "not-image"; readonly name: string }
  /** An image this browser cannot decode, such as HEIC with no HEIC decoder, or TIFF. */
  | { readonly kind: "unsupported"; readonly name: string; readonly format: ImageFormat }
  | { readonly kind: "too-large"; readonly name: string; readonly size: Size; readonly maxPixels: number }
  /** A format the browser knows, whose bytes it could not decode. */
  | { readonly kind: "damaged"; readonly name: string; readonly format: ImageFormat | null }
  /** The HEIC decoder's code did not download. */
  | { readonly kind: "decoder-not-loaded"; readonly name: string }
  /** Decoding ran out of memory twice. `reference` is the failing step and the browser's words, to pass on. */
  | { readonly kind: "out-of-memory"; readonly name: string; readonly reference: string };

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

export function megapixels(pixels: number): string {
  return `${String(Math.round(pixels / 1_000_000))} megapixels`;
}

export function isTooLarge(size: Size, maxPixels: number): boolean {
  return size.width * size.height > maxPixels;
}

function copyOf(problem: OpenProblem, accepted: string): ProblemCopy {
  const { name } = problem;
  switch (problem.kind) {
    case "unreadable":
      return { title: "This photo can't be read any more", line: `Your device stopped letting this page read ${name}. Add it again.`, short: "Add it again" };
    case "not-image":
      return { title: "That is not a photo", line: `${name} isn't a photo this page can open. Use ${accepted}.`, short: "Not a photo" };
    case "unsupported": {
      const label = formatLabel(problem.format);
      return { title: `This browser can't open ${label}`, line: `${name} is a ${label} file. Save it as ${accepted} first, then add it again.`, short: "Can't open here" };
    }
    case "too-large": {
      const { width, height } = problem.size;
      return { title: "This photo is too large", line: `${name} is ${String(width)} × ${String(height)} px. The limit is ${megapixels(problem.maxPixels)}. Shrink it first.`, short: "Too large to open" };
    }
    case "damaged":
      return { title: "This photo did not open", line: `${name} may be damaged. Save it again or choose another.`, short: "Did not open" };
    case "decoder-not-loaded":
      return { title: "The HEIC reader did not load", line: `${name} needs the HEIC reader, which did not download. Check your connection, then add it again.`, short: "Try again" };
    case "out-of-memory":
      return { title: "Not enough memory for this photo", line: `${name} needs more memory than this device has free. Close other tabs and try again, or use a smaller photo. Reference: ${problem.reference}.`, short: "Out of memory" };
  }
}

export function problemCopy(problem: OpenProblem, options: CopyOptions = {}): ProblemCopy {
  return copyOf(problem, options.accepted ?? "JPG, PNG or WebP");
}

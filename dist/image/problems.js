// Why a file did not open, as data, and the words a reader sees for it.
// Never a raw browser exception: each message says what went wrong and what to do next.
import { formatLabel } from "./formats.js";
export function megapixels(pixels) {
    return `${String(Math.round(pixels / 1_000_000))} megapixels`;
}
export function isTooLarge(size, maxPixels) {
    return size.width * size.height > maxPixels;
}
function copyOf(problem, accepted) {
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
export function problemCopy(problem, options = {}) {
    return copyOf(problem, options.accepted ?? "JPG, PNG or WebP");
}

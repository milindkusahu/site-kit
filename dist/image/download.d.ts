/**
 * Starts a download of `blob` named `name`. The object URL is kept until the next download or
 * until the page is hidden, not revoked at once: some mobile browsers read it after `click()`
 * returns, and an early revoke saves an empty or failed file. The link is attached to the page
 * for the click because Firefox and older Safari ignore a detached one.
 */
export declare function downloadBlob(blob: Blob, name: string): void;
/** Leaves room in Windows' 255 characters for a number and an extension. */
export declare const MAX_STEM_LENGTH = 120;
/**
 * Typed text as a file name stem: no path separators or characters Windows and macOS refuse,
 * no dots or spaces at either end, not a reserved device name, not over long. Empty when
 * nothing usable is left, so the caller falls back to the file's own name.
 */
export declare function cleanStem(text: string): string;

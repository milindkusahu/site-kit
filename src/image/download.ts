// Saving a blob as a file, and file names every system accepts.

let pendingUrl: string | null = null;

function revokePending(): void {
  if (pendingUrl !== null) URL.revokeObjectURL(pendingUrl);
  pendingUrl = null;
}

/**
 * Starts a download of `blob` named `name`. The object URL is kept until the next download or
 * until the page is hidden, not revoked at once: some mobile browsers read it after `click()`
 * returns, and an early revoke saves an empty or failed file. The link is attached to the page
 * for the click because Firefox and older Safari ignore a detached one.
 */
export function downloadBlob(blob: Blob, name: string): void {
  revokePending();
  const url = URL.createObjectURL(blob);
  pendingUrl = url;
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  globalThis.addEventListener("pagehide", revokePending, { once: true });
}

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Leaves room in Windows' 255 characters for a number and an extension. */
export const MAX_STEM_LENGTH = 120;

/**
 * Typed text as a file name stem: no path separators or characters Windows and macOS refuse,
 * no dots or spaces at either end, not a reserved device name, not over long. Empty when
 * nothing usable is left, so the caller falls back to the file's own name.
 */
export function cleanStem(text: string): string {
  const cleaned = text.replace(FORBIDDEN, " ").replace(/\s+/g, " ").replace(/^[. ]+|[. ]+$/g, "");
  const capped = cleaned.slice(0, MAX_STEM_LENGTH).replace(/[. ]+$/, "");
  return RESERVED.test(capped) ? `${capped}-file` : capped;
}

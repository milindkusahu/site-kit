import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanStem } from "../src/image/download.ts";
import { archiveFileName, archiveGroups, crc32, crc32Of, crc32OfBlob, dosTimestamp, splitName, uniqueNames, zipBlob, zipEntryCount, zipFrame, zipStore } from "../src/image/zip.ts";

const encode = (text: string) => new TextEncoder().encode(text);

describe("crc32", () => {
  it("matches the standard check value, whole, in pieces and streamed", async () => {
    expect(crc32(encode("123456789"))).toBe(0xcbf43926);
    expect(crc32Of([encode("1234"), encode("56789")])).toBe(0xcbf43926);
    expect(await crc32OfBlob(new Blob([encode("123456789")]))).toBe(0xcbf43926);
  });
});

describe("dosTimestamp", () => {
  it("clamps dates before 1980 and halves seconds", () => {
    expect(dosTimestamp(new Date(1970, 0, 1)).date >> 9).toBe(0);
    expect(dosTimestamp(new Date(2026, 10, 26, 12, 30, 59)).time & 0x1f).toBe(29);
  });
});

describe("zip archives", () => {
  const entries = [
    { name: "a-square.jpg", text: "first" },
    { name: "café ☕.png", text: "second file" },
  ];

  it("writes the same bytes from blobs as from buffers, with a readable directory", async () => {
    const modified = new Date(2026, 10, 26);
    const store = zipStore(entries.map((entry) => ({ name: entry.name, data: encode(entry.text) })), { modified });
    const blob = new Uint8Array(await (await zipBlob(entries.map((entry) => ({ name: entry.name, blob: new Blob([encode(entry.text)]) })), { modified })).arrayBuffer());
    expect(blob).toEqual(store);
    expect(zipEntryCount(store)).toBe(2);
    expect(new TextDecoder().decode(store.subarray(30 + 12, 30 + 12 + 5))).toBe("first");
  });

  it("extracts with Python's zipfile, names, bytes and checksums intact", () => {
    const dir = mkdtempSync(join(tmpdir(), "site-kit-zip-"));
    const archive = join(dir, "photos.zip");
    writeFileSync(archive, zipStore(entries.map((entry) => ({ name: entry.name, data: encode(entry.text) }))));
    const script = ["import json,sys,zipfile", "z=zipfile.ZipFile(sys.argv[1])", "print(json.dumps({'bad':z.testzip(),'files':{n:z.read(n).decode() for n in z.namelist()}}))"].join("\n");
    let output: string;
    try {
      output = execFileSync("python", ["-I", "-c", script, archive], { encoding: "utf8" });
    } catch {
      return;
    }
    expect(JSON.parse(output)).toEqual({ bad: null, files: Object.fromEntries(entries.map((entry) => [entry.name, entry.text])) });
  });

  it("refuses what 32-bit fields can't describe instead of writing a broken archive", () => {
    expect(() => zipFrame([{ name: "huge.mov", size: 2 ** 32, crc: 0 }])).toThrow("too large to put in a ZIP file");
    expect(() => zipFrame(Array.from({ length: 70_000 }, (_, index) => ({ name: `${String(index)}.jpg`, size: 1, crc: 0 })))).toThrow("at most 65535 files");
    expect(() => zipFrame([{ name: "a", size: 2 ** 31, crc: 0 }, { name: "b", size: 2 ** 31, crc: 0 }, { name: "c", size: 1, crc: 0 }])).toThrow("too large for one ZIP file");
  });

  it("reports no count for bytes that are not a zip", () => {
    expect(zipEntryCount(encode("nope"))).toBeNull();
  });
});

describe("names", () => {
  it("numbers repeats before the extension, without regard to case", () => {
    expect(uniqueNames(["a.jpg", "b.jpg", "A.jpg", "a.jpg"])).toEqual(["a.jpg", "b.jpg", "A-2.jpg", "a-3.jpg"]);
    expect(uniqueNames(["a.jpg", "a.jpg"], "paren")).toEqual(["a.jpg", "a (2).jpg"]);
  });

  it("never repeats a name it already numbered", () => {
    expect(uniqueNames(["a-2.jpg", "a.jpg", "a.jpg"])).toEqual(["a-2.jpg", "a.jpg", "a-3.jpg"]);
  });

  it("splits names and cleans typed stems", () => {
    expect(splitName("holiday.final.jpg")).toEqual({ stem: "holiday.final", extension: ".jpg" });
    expect(splitName(".env")).toEqual({ stem: ".env", extension: "" });
    expect(cleanStem('  my/photo: "best"?  ')).toBe("my photo best");
    expect(cleanStem("CON")).toBe("CON-file");
    expect(cleanStem("...")).toBe("");
  });

  it("groups a run into archives under the byte and file limits", () => {
    expect(archiveGroups([5, 5, 5, 20, 1], { bytes: 10 })).toEqual([[0, 1], [2], [3], [4]]);
    expect(archiveGroups([1, 1, 1], { files: 2 })).toEqual([[0, 1], [2]]);
    expect(archiveFileName("photos", { index: 0, count: 1 })).toBe("photos.zip");
    expect(archiveFileName("photos", { index: 1, count: 3 })).toBe("photos-part-2.zip");
  });
});

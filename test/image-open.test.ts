import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHeicDecoder } from "../src/image/heic.ts";
import { exifOrientation, headerFormat, headerSize, orientedSize } from "../src/image/header.ts";
import { decodeAgain, holdFiles, openImage, type OpenResult } from "../src/image/open.ts";
import { fixture, jpegHeader, pngHeader } from "./image-bytes.ts";

type FakeBitmap = { width: number; height: number; closed: boolean; close: () => void };

function bitmap(width: number, height: number): FakeBitmap {
  return { width, height, closed: false, close() { this.closed = true; } };
}

const decoded: { calls: number; scale: number } = { calls: 0, scale: 1 };

async function fakeCreateImageBitmap(source: Blob | { width: number; height: number }, options?: { imageOrientation?: string }) {
  decoded.calls += 1;
  if (!(source instanceof Blob)) return bitmap(source.width, source.height);
  const bytes = new Uint8Array(await source.arrayBuffer());
  const format = headerFormat(bytes);
  const size = headerSize(bytes);
  if (format === "heic" || size === null) throw new DOMException("The source image could not be decoded.", "InvalidStateError");
  const upright = options?.imageOrientation === "from-image" ? orientedSize(size, exifOrientation(bytes)) : size;
  return bitmap(Math.round(upright.width * decoded.scale), Math.round(upright.height * decoded.scale));
}

class FakeImageData {
  readonly data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

const file = (bytes: Uint8Array, name: string, type = "") => new File([new Uint8Array(bytes)], name, { type });

function opened(result: OpenResult) {
  if (result.kind !== "opened") throw new Error(`expected opened, got ${result.kind}`);
  return result;
}

beforeEach(() => {
  decoded.calls = 0;
  decoded.scale = 1;
  vi.stubGlobal("createImageBitmap", fakeCreateImageBitmap);
  vi.stubGlobal("ImageData", FakeImageData);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openImage", () => {
  it("opens a rotated JPEG upright and reports its EXIF orientation", async () => {
    const bytes = fixture("rotated-exif6.jpg");
    const stored = headerSize(bytes);
    const result = opened(await openImage(file(bytes, "mug.jpg", "image/jpeg")));
    expect(result.orientation).toBe(6);
    expect(result.size).toEqual({ width: stored?.height, height: stored?.width });
    expect(result.format).toBe("jpeg");
    expect(result.reducedFrom).toBeNull();
  });

  it("refuses a 100+ MP file from its header, without decoding it", async () => {
    const result = await openImage(file(pngHeader(12000, 9000), "pano.png", "image/png"));
    expect(result).toEqual({ kind: "too-large", name: "pano.png", size: { width: 12000, height: 9000 }, maxPixels: 100_000_000 });
    expect(decoded.calls).toBe(0);
  });

  it("honours a site's own pixel limit", async () => {
    const result = await openImage(file(jpegHeader(5000, 4000), "big.jpg"), { maxPixels: 16_000_000 });
    expect(result.kind).toBe("too-large");
  });

  it("calls a damaged JPEG damaged, and a text file not an image", async () => {
    expect(await openImage(file(fixture("damaged.jpg"), "broken.jpg", "image/jpeg"))).toEqual({ kind: "damaged", name: "broken.jpg", format: "jpeg" });
    expect(await openImage(file(new TextEncoder().encode("hello"), "notes.txt", "text/plain"))).toEqual({ kind: "not-image", name: "notes.txt" });
  });

  it("says a HEIC is unsupported when the page brought no decoder", async () => {
    expect(await openImage(file(fixture("sample.heic"), "IMG_0001.HEIC"))).toEqual({ kind: "unsupported", name: "IMG_0001.HEIC", format: "heic" });
  });

  it("opens a real HEIC with libheif when the browser can't", async () => {
    const heic = createHeicDecoder();
    const result = opened(await openImage(file(fixture("sample.heic"), "IMG_0001.HEIC", "application/octet-stream"), { heic }));
    expect(result.size).toEqual({ width: 320, height: 480 });
    expect(result.format).toBe("heic");
  }, 30_000);

  it("reports a stale handle as unreadable, not damaged", async () => {
    const stale = file(jpegHeader(10, 10), "a.jpg");
    vi.spyOn(stale, "slice").mockImplementation(() => {
      throw new DOMException("A requested file could not be read.", "NotReadableError");
    });
    expect(await openImage(stale)).toEqual({ kind: "unreadable", name: "a.jpg" });
  });

  it("notices when the browser decoded a large JPEG smaller than it is", async () => {
    decoded.scale = 0.75;
    const result = opened(await openImage(file(jpegHeader(8000, 6000), "camera.jpg")));
    expect(result.size).toEqual({ width: 6000, height: 4500 });
    expect(result.reducedFrom).toEqual({ width: 8000, height: 6000 });
  });

  it("decodes again for the full-size render, and throws a reader's message when it can't", async () => {
    expect((await decodeAgain(file(jpegHeader(40, 30), "a.jpg"))).width).toBe(40);
    await expect(decodeAgain(file(fixture("damaged.jpg"), "b.jpg"))).rejects.toThrow("b.jpg could not be read again. Add it again.");
  });
});

describe("holdFiles", () => {
  it("copies picked files on Android and leaves them alone elsewhere", async () => {
    const original = file(jpegHeader(10, 10), "a.jpg", "image/jpeg");
    const [held] = await holdFiles([original], "Mozilla/5.0 (Linux; Android 15)");
    expect(held).not.toBe(original);
    expect(held?.name).toBe("a.jpg");
    expect(held?.size).toBe(original.size);
    expect((await holdFiles([original], "Mozilla/5.0 (Windows NT 10.0)"))[0]).toBe(original);
  });
});

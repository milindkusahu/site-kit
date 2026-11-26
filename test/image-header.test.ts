import { describe, expect, it } from "vitest";
import { acceptFor, detectFormat, formatFromName, looksLikeImage } from "../src/image/formats.ts";
import { exifOrientation, fullSizeIfReduced, headerFormat, headerSize, jpegSize, orientedSize } from "../src/image/header.ts";
import { problemCopy } from "../src/image/problems.ts";
import { ascii, fixture, jpegHeader, pngHeader } from "./image-bytes.ts";

function box(type: string, body: number[]): number[] {
  const size = 8 + body.length;
  return [size >>> 24, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff, ...ascii(type), ...body];
}

const u32 = (value: number) => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];

function heifHeader(brand: string, extents: readonly (readonly [number, number])[]): Uint8Array {
  const ispe = extents.flatMap(([w, h]) => box("ispe", [0, 0, 0, 0, ...u32(w), ...u32(h)]));
  const meta = box("meta", [0, 0, 0, 0, ...box("hdlr", Array.from({ length: 24 }, () => 0)), ...box("iprp", box("ipco", ispe))]);
  return new Uint8Array([...box("ftyp", [...ascii(brand), 0, 0, 0, 0, ...ascii("mif1")]), ...meta]);
}

describe("headerFormat", () => {
  it("knows each format by its bytes", () => {
    expect(headerFormat(jpegHeader(10, 10))).toBe("jpeg");
    expect(headerFormat(pngHeader(10, 10))).toBe("png");
    expect(headerFormat(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))).toBe("webp");
    expect(headerFormat(new Uint8Array(ascii("GIF89a")))).toBe("gif");
    expect(headerFormat(new Uint8Array(ascii("II*\0")))).toBe("tiff");
  });

  it("tells AVIF from HEIC by the ftyp brands, compatible brands included", () => {
    expect(headerFormat(heifHeader("avif", []))).toBe("avif");
    expect(headerFormat(heifHeader("heic", []))).toBe("heic");
    expect(headerFormat(new Uint8Array(box("ftyp", [...ascii("mif1"), 0, 0, 0, 0, ...ascii("mif1"), ...ascii("avif")])))).toBe("avif");
    expect(headerFormat(fixture("sample.heic"))).toBe("heic");
  });

  it("returns null for text", () => {
    expect(headerFormat(new Uint8Array(ascii("hello world")))).toBeNull();
  });
});

describe("headerSize", () => {
  it("reads a JPEG frame after other segments, and a PNG header", () => {
    expect(jpegSize(jpegHeader(12000, 9000))).toEqual({ width: 12000, height: 9000 });
    expect(headerSize(pngHeader(1600, 1066))).toEqual({ width: 1600, height: 1066 });
  });

  it("reads a real HEIC's ispe box", () => {
    expect(headerSize(fixture("sample.heic"))).toEqual({ width: 320, height: 480 });
  });

  it("takes the largest ispe, the primary image, over tiles and thumbnails", () => {
    expect(headerSize(heifHeader("heic", [[512, 512], [8064, 6048], [320, 240]]))).toEqual({ width: 8064, height: 6048 });
  });

  it("reads a real JPEG as stored, before its EXIF rotation", () => {
    const bytes = fixture("rotated-exif6.jpg");
    const stored = headerSize(bytes);
    expect(stored).not.toBeNull();
    expect(exifOrientation(bytes)).toBe(6);
    if (stored) expect(orientedSize(stored, 6)).toEqual({ width: stored.height, height: stored.width });
  });

  it("returns null for truncated and damaged files", () => {
    expect(headerSize(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(headerSize(jpegHeader(400, 300).subarray(0, 12))).toBeNull();
    expect(headerSize(fixture("damaged.jpg"))).toBeNull();
  });

  it("never throws on random bytes", () => {
    for (let seed = 1; seed < 300; seed += 1) {
      const bytes = Uint8Array.from({ length: seed % 97 }, (_, index) => (seed * 31 + index * 17) & 0xff);
      bytes[0] = [0xff, 0x89, 0x52, 0x47, 0][seed % 5] ?? 0;
      expect(() => [headerSize(bytes), exifOrientation(bytes)]).not.toThrow();
    }
  });
});

describe("fullSizeIfReduced", () => {
  it("reports the stored size, turned like the bitmap, when the browser decoded smaller", () => {
    expect(fullSizeIfReduced({ width: 16320, height: 12240 }, { width: 12240, height: 9180 })).toEqual({ width: 16320, height: 12240 });
    expect(fullSizeIfReduced({ width: 16320, height: 12240 }, { width: 9180, height: 12240 })).toEqual({ width: 12240, height: 16320 });
  });

  it("does not mistake a rotation for a loss", () => {
    expect(fullSizeIfReduced({ width: 4032, height: 3024 }, { width: 3024, height: 4032 })).toBeNull();
  });
});

describe("formats", () => {
  it("trusts the bytes, then the mime type, then the name", () => {
    expect(detectFormat({ name: "photo.png", type: "image/png", header: "jpeg" })).toBe("jpeg");
    expect(detectFormat({ name: "x", type: "image/webp" })).toBe("webp");
    expect(detectFormat({ name: "IMG_1.HEIC", type: "application/octet-stream", header: null })).toBe("heic");
    expect(detectFormat({ name: "notes.pdf", type: "application/pdf" })).toBeNull();
    expect(formatFromName("scan.TIF")).toBe("tiff");
  });

  it("treats unknown image types as images", () => {
    expect(looksLikeImage({ name: "a.jxl", type: "image/jxl" })).toBe(true);
    expect(looksLikeImage({ name: "a.txt", type: "text/plain" })).toBe(false);
  });

  it("builds an accept list with extensions, so Android offers HEIC", () => {
    expect(acceptFor(["jpeg", "heic"]).split(",")).toEqual(expect.arrayContaining(["image/jpeg", "image/heic", ".jpg", ".heic", ".heif"]));
  });
});

describe("problemCopy", () => {
  it("names the file, the size and the limit for a large photo", () => {
    const copy = problemCopy({ kind: "too-large", name: "pano.jpg", size: { width: 12000, height: 9000 }, maxPixels: 100_000_000 });
    expect(copy.line).toBe("pano.jpg is 12000 × 9000 px. The limit is 100 megapixels. Shrink it first.");
  });

  it("uses the page's own list of formats", () => {
    expect(problemCopy({ kind: "unsupported", name: "a.tif", format: "tiff" }, { accepted: "JPG or PNG" }).line).toBe("a.tif is a TIFF file. Save it as JPG or PNG first, then add it again.");
  });

  it("passes the memory reference on", () => {
    expect(problemCopy({ kind: "out-of-memory", name: "a.heic", reference: "decode, RangeError" }).line).toContain("Reference: decode, RangeError.");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeicError, createHeicDecoder } from "../src/image/heic.ts";
import { fixture } from "./image-bytes.ts";

const MB = 1024 * 1024;
const INTERLEAVED = "interleaved";

type Step = "ok" | "throw" | "empty" | "unreadable";

const codec = { instances: 0, heap: 16 * MB, steps: ["ok"] as Step[], freed: 0, released: 0, stride: 16 };

function nextStep(): Step {
  return (codec.steps.length > 1 ? codec.steps.shift() : codec.steps[0]) ?? "ok";
}

function fakeLibheif() {
  codec.instances += 1;
  return {
    HeifDecoder: class {
      decode() {
        const step = nextStep();
        if (step === "throw") throw new RangeError("Array buffer allocation failed");
        return step === "empty" ? [] : [{ handle: step, free: () => { codec.freed += 1; } }];
      }
    },
    HEAPU8: { length: codec.heap },
    heif_js_decode_image2: (handle: unknown) => {
      if (handle === "unreadable") return { code: 1, image: {} };
      const data = new Uint8Array(codec.stride * 2).map((_, index) => index % 251);
      return { image: {}, channels: [{ id: INTERLEAVED, width: 4, height: 2, stride: codec.stride, data }] };
    },
    heif_image_release: () => { codec.released += 1; },
    heif_colorspace: { heif_colorspace_RGB: 0 },
    heif_chroma: { heif_chroma_interleaved_RGBA: 0 },
    heif_channel: { heif_channel_interleaved: INTERLEAVED },
  };
}

class FakeImageData {
  readonly data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

const painted: Uint8ClampedArray[] = [];

beforeEach(() => {
  Object.assign(codec, { instances: 0, heap: 16 * MB, steps: ["ok"], freed: 0, released: 0, stride: 16 });
  painted.length = 0;
  vi.stubGlobal("ImageData", FakeImageData);
  vi.stubGlobal("createImageBitmap", async (data: FakeImageData) => {
    painted.push(data.data);
    return { width: data.width, height: data.height, close: () => undefined };
  });
});

afterEach(() => vi.unstubAllGlobals());

const blob = () => new Blob([new Uint8Array([1, 2, 3])]);
const decoder = () => createHeicDecoder({ load: async () => fakeLibheif(), retryPauseMs: 0 });

describe("createHeicDecoder", () => {
  it("decodes the first image and frees every codec handle", async () => {
    const bitmap = await decoder()(blob());
    expect(bitmap).toMatchObject({ width: 4, height: 2 });
    expect(codec).toMatchObject({ freed: 1, released: 1 });
  });

  it("copies row by row past the codec's padding", async () => {
    codec.stride = 20;
    await decoder()(blob());
    expect(painted[0]?.slice(16, 20)).toEqual(new Uint8ClampedArray([20, 21, 22, 23]));
  });

  it("loads the codec once for several files", async () => {
    const decode = decoder();
    await Promise.all([decode(blob()), decode(blob())]);
    expect(codec.instances).toBe(1);
  });

  it("drops an instance whose heap grew past the limit", async () => {
    codec.heap = 400 * MB;
    const decode = decoder();
    await decode(blob());
    await decode(blob());
    expect(codec.instances).toBe(2);
  });

  it("retries an unexplained failure once on a fresh instance", async () => {
    codec.steps = ["throw", "ok"];
    await expect(decoder()(blob())).resolves.toMatchObject({ width: 4 });
    expect(codec.instances).toBe(2);
  });

  it("calls a second unexplained failure out of memory, with the failing step as a reference", async () => {
    codec.steps = ["throw"];
    const error = await decoder()(blob()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HeicError);
    expect(error).toMatchObject({ reason: "out-of-memory", reference: "parse, RangeError: Array buffer allocation failed" });
  });

  it("does not retry a file with no image, or one the codec could not read", async () => {
    codec.steps = ["empty"];
    await expect(decoder()(blob())).rejects.toMatchObject({ reason: "empty" });
    codec.steps = ["unreadable"];
    await expect(decoder()(blob())).rejects.toMatchObject({ reason: "unreadable" });
    expect(codec.released).toBe(1);
  });

  it("reports a codec that failed to download, and fetches it again next time", async () => {
    let attempts = 0;
    const decode = createHeicDecoder({ load: async () => { attempts += 1; if (attempts === 1) throw new Error("chunk failed"); return fakeLibheif(); }, retryPauseMs: 0 });
    await expect(decode(blob())).rejects.toMatchObject({ reason: "not-loaded" });
    await expect(decode(blob())).resolves.toMatchObject({ width: 4 });
  });

  it("decodes a real iPhone-style HEIC with the real libheif-js", async () => {
    const bitmap = await createHeicDecoder()(new Blob([fixture("sample.heic")]));
    expect(bitmap).toMatchObject({ width: 320, height: 480 });
    expect(painted[0]?.some((value) => value !== 0)).toBe(true);
  }, 30_000);
});

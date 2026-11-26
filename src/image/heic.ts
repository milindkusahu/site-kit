// HEIC, the format iPhones save photos in, decoded with libheif when the browser can't.
// Chrome, Firefox and Edge refuse HEIC; Safari opens it through macOS. libheif-js is an
// optional peer dependency (LGPL-3.0, about 1.9 MB with the wasm inlined): it is fetched only
// the first time a HEIC file needs it, so a page that never sees one never downloads it.
// The page's CSP needs 'wasm-unsafe-eval' in script-src (site-kit.config.json "wasm": true).

export type HeicReason = "not-loaded" | "empty" | "unreadable" | "out-of-memory";

export class HeicError extends Error {
  readonly reason: HeicReason;
  /** For out-of-memory: the failing step and the browser's words, short enough to read aloud. */
  readonly reference: string;

  constructor(reason: HeicReason, message: string, options?: { cause?: unknown; reference?: string }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "HeicError";
    this.reason = reason;
    this.reference = options?.reference ?? "";
  }
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
export const HEAP_KEPT = 256 * 1024 * 1024;

export const RETRY_PAUSE_MS = 1000;

const REFERENCE_LENGTH = 90;

type HeifImage = { readonly handle: unknown; readonly free: (() => void) | null };

type HeifChannel = { readonly width: number; readonly height: number; readonly stride: number; readonly data: Uint8Array };

type LibHeif = {
  readonly decode: (bytes: Uint8Array) => unknown;
  readonly decodeImage: (handle: unknown) => unknown;
  readonly release: (image: unknown) => void;
  readonly interleaved: unknown;
  readonly heapBytes: () => number;
};

/** Objects and functions alike: emscripten's embind exposes libheif's enums as functions. */
function record(value: unknown): Record<string, unknown> | null {
  return (typeof value === "object" && value !== null) || typeof value === "function" ? (value as Record<string, unknown>) : null;
}

function call(target: Record<string, unknown>, key: string, ...args: unknown[]): unknown {
  const method = target[key];
  if (typeof method !== "function") throw new Error(`libheif has no ${key}`);
  return Reflect.apply(method, target, args);
}

/** The few calls used here, checked once, so nothing below trusts the module's shape blindly. */
function asLibHeif(value: unknown): LibHeif {
  const lib = record(value);
  const Decoder = lib?.["HeifDecoder"];
  const colorspace = record(lib?.["heif_colorspace"])?.["heif_colorspace_RGB"];
  const chroma = record(lib?.["heif_chroma"])?.["heif_chroma_interleaved_RGBA"];
  const interleaved = record(lib?.["heif_channel"])?.["heif_channel_interleaved"];
  if (lib === null || typeof Decoder !== "function" || typeof lib["heif_js_decode_image2"] !== "function") throw new Error("not libheif");
  return {
    decode: (bytes) => {
      const decoder = record(Reflect.construct(Decoder, []));
      if (decoder === null) throw new Error("libheif gave no decoder");
      return call(decoder, "decode", bytes);
    },
    decodeImage: (handle) => call(lib, "heif_js_decode_image2", handle, colorspace, chroma),
    release: (image) => void call(lib, "heif_image_release", image),
    interleaved,
    heapBytes: () => {
      const heap = record(lib["HEAPU8"]);
      return typeof heap?.["length"] === "number" ? heap["length"] : 0;
    },
  };
}

function imagesOf(parsed: unknown): HeifImage[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item: unknown) => {
    const image = record(item);
    if (image === null || !("handle" in image)) return [];
    const free = image["free"];
    return [{ handle: image["handle"], free: typeof free === "function" ? () => void Reflect.apply(free, image, []) : null }];
  });
}

function channelOf(decoded: unknown, interleaved: unknown): HeifChannel | null {
  const result = record(decoded);
  if (result === null || Boolean(result["code"]) || !Array.isArray(result["channels"])) return null;
  const plane = record(result["channels"].find((item: unknown) => record(item)?.["id"] === interleaved));
  const { width, height, stride, data } = plane ?? {};
  if (typeof width !== "number" || typeof height !== "number" || typeof stride !== "number" || !(data instanceof Uint8Array)) return null;
  return { width, height, stride, data };
}

/**
 * Copied out of the codec's heap into ImageData, then into a bitmap. Painting the heap onto a
 * canvas would save a copy, but a canvas-made bitmap lives in graphics memory, the pool a phone
 * has least of (tried 2026-10-04: a run of nine 50 MP photos went from all converting to two).
 */
function bitmapOf(channel: HeifChannel): Promise<ImageBitmap> {
  const { width, height, stride, data } = channel;
  const whole = new ImageData(width, height);
  const rowBytes = width * 4;
  if (stride === rowBytes) whole.data.set(data.subarray(0, rowBytes * height));
  else for (let row = 0; row < height; row += 1) whole.data.set(data.subarray(row * stride, row * stride + rowBytes), row * rowBytes);
  return createImageBitmap(whole);
}

/** Runs one step, naming it in whatever it throws: a phone's failure can't be reproduced on a desk. */
async function step<T>(name: string, run: () => T | Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HeicError) throw error;
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(`${name}, ${detail.slice(0, REFERENCE_LENGTH)}`, { cause: error });
  }
}

async function firstBitmap(lib: LibHeif, images: readonly HeifImage[]): Promise<ImageBitmap> {
  const image = images[0];
  if (image === undefined) throw new HeicError("empty", "This HEIC file has no photo in it that can be read.");
  const decoded = await step("decode", () => lib.decodeImage(image.handle));
  const channel = channelOf(decoded, lib.interleaved);
  try {
    if (channel === null) throw new HeicError("unreadable", "The photo inside this HEIC file could not be read.");
    return await step("bitmap", () => bitmapOf(channel));
  } finally {
    const handle = record(decoded)?.["image"];
    if (handle !== undefined && handle !== null) lib.release(handle);
  }
}

async function defaultLoad(): Promise<unknown> {
  const module: { default: () => Promise<unknown> } = await import("libheif-js/libheif-wasm/libheif-bundle.mjs");
  return module.default();
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A HEIC decoder. Each call returns its own, with its own cached libheif instance. The promise
 * is cached, not the module, so two HEIC files opened together share one download.
 *
 * The first image is used (a live photo or burst holds several; the first is the one the phone
 * shows). A failure libheif did not explain is tried once more on a fresh instance after a pause,
 * because an allocation that failed beside a 400 MB heap can succeed without it; a second such
 * failure is reported as out of memory, since a damaged file gets "empty" or "unreadable".
 */
export function createHeicDecoder(options: HeicOptions = {}): HeicDecode {
  const load = options.load ?? defaultLoad;
  const heapKept = options.heapKept ?? HEAP_KEPT;
  const retryPauseMs = options.retryPauseMs ?? RETRY_PAUSE_MS;
  let loading: Promise<LibHeif> | null = null;

  function forget(instance: Promise<LibHeif>): void {
    if (loading === instance) loading = null;
  }

  function libheif(): Promise<LibHeif> {
    if (loading !== null) return loading;
    const instance: Promise<LibHeif> = load()
      .then(asLibHeif)
      .catch((error: unknown) => {
        forget(instance);
        throw new HeicError("not-loaded", "The HEIC reader could not be loaded. Check your connection and try again.", { cause: error });
      });
    loading = instance;
    return instance;
  }

  async function decodeOnce(file: Blob): Promise<ImageBitmap> {
    const instance = libheif();
    const lib = await instance;
    let images: HeifImage[] = [];
    try {
      const bytes = await step("read", async () => new Uint8Array(await file.arrayBuffer()));
      images = imagesOf(await step("parse", () => lib.decode(bytes)));
      return await firstBitmap(lib, images);
    } catch (error) {
      forget(instance);
      throw error;
    } finally {
      for (const image of images) image.free?.();
      if (lib.heapBytes() > heapKept) forget(instance);
    }
  }

  return async (file) => {
    try {
      return await decodeOnce(file);
    } catch (error) {
      if (error instanceof HeicError) throw error;
    }
    await pause(retryPauseMs);
    try {
      return await decodeOnce(file);
    } catch (error) {
      if (error instanceof HeicError) throw error;
      const reference = error instanceof Error ? error.message : "unknown";
      throw new HeicError("out-of-memory", "This HEIC photo is too large for this device's memory.", { cause: error, reference });
    }
  };
}

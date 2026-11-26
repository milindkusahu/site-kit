import { readFileSync } from "node:fs";

export const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/image/${name}`, import.meta.url)));

export const ascii = (text: string) => Array.from(new TextEncoder().encode(text));

export function jpegHeader(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...Array.from({ length: 12 }, () => 0)]);
}

export function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii("IHDR")]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}


// A store-only ZIP writer, plus the names that go inside it.
//
// Store only, no DEFLATE: JPEG, PNG and WebP are already compressed, so deflating them spends
// CPU to save fractions of a percent. One archive, because browsers block a page that starts
// more than a few downloads in a row. No Zip64: anything a 32-bit field can't describe (an entry
// or archive over 4 GB, more than 65,535 entries) throws instead of writing an archive that
// opens and is wrong. `archiveGroups` splits a run into archives below that.
const MAX_32 = 0xffffffff;
const MAX_ENTRIES = 0xffff;
const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const END_RECORD_BYTES = 22;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const UTF8_NAMES = 0x0800;
const VERSION = 20;
const STORED = 0;
const CRC_START = 0xffffffff;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
        value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
});
function crcStep(crc, data) {
    let next = crc;
    for (const byte of data)
        next = (CRC_TABLE[(next ^ byte) & 0xff] ?? 0) ^ (next >>> 8);
    return next;
}
export function crc32(data) {
    return (crcStep(CRC_START, data) ^ MAX_32) >>> 0;
}
/** The same checksum over pieces, so a file never has to be whole in memory. */
export function crc32Of(chunks) {
    let crc = CRC_START;
    for (const chunk of chunks)
        crc = crcStep(crc, chunk);
    return (crc ^ MAX_32) >>> 0;
}
/** The checksum of a blob, read as a stream. */
export async function crc32OfBlob(blob) {
    const reader = blob.stream().getReader();
    let crc = CRC_START;
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
        crc = crcStep(crc, chunk.value);
    return (crc ^ MAX_32) >>> 0;
}
/** MS-DOS time and date. Seconds are stored halved (even seconds only); years before 1980 clamp. */
export function dosTimestamp(when) {
    const year = Math.max(1980, when.getFullYear());
    return {
        time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
        date: ((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
    };
}
function prepare(files) {
    if (files.length > MAX_ENTRIES)
        throw new Error(`A ZIP file holds at most ${String(MAX_ENTRIES)} files; split the run into several archives.`);
    const encoder = new TextEncoder();
    let offset = 0;
    return files.map((file) => {
        if (file.size > MAX_32)
            throw new Error(`${file.name} is too large to put in a ZIP file.`);
        const name = encoder.encode(file.name);
        if (offset > MAX_32)
            throw new Error("These files are too large for one ZIP file; split the run into several archives.");
        const prepared = { name, size: file.size, crc: file.crc, offset };
        offset += LOCAL_HEADER_BYTES + name.length + file.size;
        return prepared;
    });
}
function writeFields(view, at, fields) {
    let offset = at;
    for (const [width, value] of fields) {
        if (width === "u16")
            view.setUint16(offset, value, true);
        else
            view.setUint32(offset, value, true);
        offset += width === "u16" ? 2 : 4;
    }
    return offset;
}
/** The fields the local and central headers share, from "flags" to "extra field length". */
function sharedFields(entry, stamp) {
    return [["u16", UTF8_NAMES], ["u16", STORED], ["u16", stamp.time], ["u16", stamp.date], ["u32", entry.crc], ["u32", entry.size], ["u32", entry.size], ["u16", entry.name.length], ["u16", 0]];
}
function localHeader(entry, stamp) {
    const bytes = new Uint8Array(LOCAL_HEADER_BYTES + entry.name.length);
    const end = writeFields(new DataView(bytes.buffer), 0, [["u32", LOCAL_SIGNATURE], ["u16", VERSION], ...sharedFields(entry, stamp)]);
    bytes.set(entry.name, end);
    return bytes;
}
function bodyBytes(prepared) {
    return prepared.reduce((total, entry) => total + LOCAL_HEADER_BYTES + entry.name.length + entry.size, 0);
}
/** The central directory and end record. An extractor reads these first, from the end of the file. */
function directory(prepared, stamp) {
    const size = prepared.reduce((total, entry) => total + CENTRAL_HEADER_BYTES + entry.name.length, 0);
    const body = bodyBytes(prepared);
    if (body > MAX_32)
        throw new Error("These files are too large for one ZIP file; split the run into several archives.");
    const bytes = new Uint8Array(size + END_RECORD_BYTES);
    const view = new DataView(bytes.buffer);
    let at = 0;
    for (const entry of prepared) {
        const tail = [["u16", 0], ["u16", 0], ["u16", 0], ["u32", 0], ["u32", entry.offset]];
        at = writeFields(view, at, [["u32", CENTRAL_SIGNATURE], ["u16", VERSION], ["u16", VERSION], ...sharedFields(entry, stamp), ...tail]);
        bytes.set(entry.name, at);
        at += entry.name.length;
    }
    writeFields(view, at, [["u32", END_SIGNATURE], ["u16", 0], ["u16", 0], ["u16", prepared.length], ["u16", prepared.length], ["u32", size], ["u32", body], ["u16", 0]]);
    return bytes;
}
/** Everything but the files' own bytes, for a writer that streams them itself. */
export function zipFrame(files, options = {}) {
    const prepared = prepare(files);
    const stamp = dosTimestamp(options.modified ?? new Date());
    return { headers: prepared.map((entry) => localHeader(entry, stamp)), end: directory(prepared, stamp) };
}
/** A whole archive in one buffer: right for a few small files already in memory. */
export function zipStore(entries, options = {}) {
    const frame = zipFrame(entries.map((entry) => ({ name: entry.name, size: entry.data.length, crc: crc32(entry.data) })), options);
    const parts = entries.flatMap((entry, index) => [frame.headers[index] ?? new Uint8Array(), entry.data]);
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, frame.end.length));
    let at = 0;
    for (const part of [...parts, frame.end]) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}
/**
 * An archive from blobs, as a blob whose parts are the headers and the files themselves. Each
 * file is read once, as a stream, for its checksum; nothing is copied into one buffer.
 */
export async function zipBlob(entries, options = {}) {
    const facts = [];
    for (const entry of entries)
        facts.push({ name: entry.name, size: entry.blob.size, crc: await crc32OfBlob(entry.blob) });
    const frame = zipFrame(facts, options);
    const parts = entries.flatMap((entry, index) => [frame.headers[index] ?? new Uint8Array(), entry.blob]);
    return new Blob([...parts, frame.end], { type: "application/zip" });
}
/** The entry count from an archive's end record, or null when the bytes don't end like a ZIP. For tests. */
export function zipEntryCount(bytes) {
    const at = bytes.length - END_RECORD_BYTES;
    if (at < 0)
        return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getUint32(at, true) === END_SIGNATURE ? view.getUint16(at + 10, true) : null;
}
/** `holiday.final.jpg` as `holiday.final` and `.jpg`. A leading dot belongs to the stem. */
export function splitName(name) {
    const dot = name.lastIndexOf(".");
    return dot <= 0 ? { stem: name, extension: "" } : { stem: name.slice(0, dot), extension: name.slice(dot) };
}
function numbered(name, number, style) {
    const { stem, extension } = splitName(name);
    return style === "paren" ? `${stem} (${String(number)})${extension}` : `${stem}-${String(number)}${extension}`;
}
/**
 * Names with collisions numbered before the extension (`photo-2.jpg`, or `photo (2).jpg` with
 * "paren"). Compared without case, because Windows and macOS extract `IMG.jpg` and `img.jpg`
 * to the same file, and against the numbered names too, so `a-2.jpg` then two `a.jpg` never
 * makes a second `a-2.jpg`.
 */
export function uniqueNames(names, style = "dash") {
    const taken = new Set();
    return names.map((name) => {
        let free = name;
        for (let number = 2; taken.has(free.toLowerCase()); number += 1)
            free = numbered(name, number, style);
        taken.add(free.toLowerCase());
        return free;
    });
}
/** Half the format's 4 GB limit: browsers often refuse a blob that large well before it. */
export const ARCHIVE_MAX_BYTES = 2 * 1024 ** 3;
/**
 * File indexes grouped into archives, in order, each as full as the limits allow. A single file
 * over the byte limit still gets an archive of its own.
 */
export function archiveGroups(sizes, limits = {}) {
    const maxBytes = limits.bytes ?? ARCHIVE_MAX_BYTES;
    const maxFiles = Math.min(limits.files ?? MAX_ENTRIES, MAX_ENTRIES);
    const groups = [];
    let held = 0;
    sizes.forEach((size, index) => {
        const current = groups.at(-1);
        if (current === undefined || held + size > maxBytes || current.length >= maxFiles) {
            groups.push([index]);
            held = size;
            return;
        }
        current.push(index);
        held += size;
    });
    return groups;
}
/** `photos.zip`, or `photos-part-2.zip` when the run needed more than one archive. */
export function archiveFileName(stem, part) {
    return part.count <= 1 ? `${stem}.zip` : `${stem}-part-${String(part.index + 1)}.zip`;
}

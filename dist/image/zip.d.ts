export type ZipEntry = {
    readonly name: string;
    readonly data: Uint8Array;
};
export type ZipBlobEntry = {
    readonly name: string;
    readonly blob: Blob;
};
/** A file the caller writes itself, described by its name, length and CRC-32. */
export type ZipFileFacts = {
    readonly name: string;
    readonly size: number;
    readonly crc: number;
};
export type ZipOptions = {
    /** The timestamp every entry gets. Default: now. */
    readonly modified?: Date;
};
export declare function crc32(data: Uint8Array): number;
/** The same checksum over pieces, so a file never has to be whole in memory. */
export declare function crc32Of(chunks: Iterable<Uint8Array>): number;
/** The checksum of a blob, read as a stream. */
export declare function crc32OfBlob(blob: Blob): Promise<number>;
/** MS-DOS time and date. Seconds are stored halved (even seconds only); years before 1980 clamp. */
export declare function dosTimestamp(when: Date): {
    readonly time: number;
    readonly date: number;
};
export type ZipFrame = {
    /** One local header per file, written just before that file's bytes. */
    readonly headers: readonly Uint8Array<ArrayBuffer>[];
    /** The central directory and end record, written after the last file. */
    readonly end: Uint8Array<ArrayBuffer>;
};
/** Everything but the files' own bytes, for a writer that streams them itself. */
export declare function zipFrame(files: readonly ZipFileFacts[], options?: ZipOptions): ZipFrame;
/** A whole archive in one buffer: right for a few small files already in memory. */
export declare function zipStore(entries: readonly ZipEntry[], options?: ZipOptions): Uint8Array<ArrayBuffer>;
/**
 * An archive from blobs, as a blob whose parts are the headers and the files themselves. Each
 * file is read once, as a stream, for its checksum; nothing is copied into one buffer.
 */
export declare function zipBlob(entries: readonly ZipBlobEntry[], options?: ZipOptions): Promise<Blob>;
/** The entry count from an archive's end record, or null when the bytes don't end like a ZIP. For tests. */
export declare function zipEntryCount(bytes: Uint8Array): number | null;
export type NumberStyle = "dash" | "paren";
/** `holiday.final.jpg` as `holiday.final` and `.jpg`. A leading dot belongs to the stem. */
export declare function splitName(name: string): {
    readonly stem: string;
    readonly extension: string;
};
/**
 * Names with collisions numbered before the extension (`photo-2.jpg`, or `photo (2).jpg` with
 * "paren"). Compared without case, because Windows and macOS extract `IMG.jpg` and `img.jpg`
 * to the same file, and against the numbered names too, so `a-2.jpg` then two `a.jpg` never
 * makes a second `a-2.jpg`.
 */
export declare function uniqueNames(names: readonly string[], style?: NumberStyle): string[];
/** Half the format's 4 GB limit: browsers often refuse a blob that large well before it. */
export declare const ARCHIVE_MAX_BYTES: number;
/**
 * File indexes grouped into archives, in order, each as full as the limits allow. A single file
 * over the byte limit still gets an archive of its own.
 */
export declare function archiveGroups(sizes: readonly number[], limits?: {
    readonly bytes?: number;
    readonly files?: number;
}): number[][];
/** `photos.zip`, or `photos-part-2.zip` when the run needed more than one archive. */
export declare function archiveFileName(stem: string, part: {
    readonly index: number;
    readonly count: number;
}): string;

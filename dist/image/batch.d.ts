export type BatchStatus = "queued" | "working" | "done" | "failed";
export type BatchItem<Result> = {
    readonly id: string;
    readonly file: File;
    readonly status: BatchStatus;
    readonly result: Result | null;
    /** Written for the reader. Null unless failed. */
    readonly error: string | null;
    /** How long `process` took, for the time-left estimate. */
    readonly ms: number | null;
};
export type BatchProgress = {
    readonly total: number;
    readonly done: number;
    readonly failed: number;
    /** Done plus failed. */
    readonly finished: number;
    /** 0 to 100; 100 for an empty queue. */
    readonly percent: number;
    /** Milliseconds the rest should take, from this run's own timings, or null before three files are in. */
    readonly remainingMs: number | null;
};
export type BatchSnapshot<Result> = {
    readonly items: readonly BatchItem<Result>[];
    readonly running: boolean;
    readonly progress: BatchProgress;
};
export type BatchOptions<Result> = {
    readonly process: (file: File, signal: AbortSignal) => Promise<Result>;
    /** Run files as soon as they are added. Default true; false waits for `start()`. */
    readonly autoStart?: boolean;
    /** Turns a thrown value into the reader's words. Default: the error's message. */
    readonly describeError?: (error: unknown) => string;
    readonly now?: () => number;
};
export type Batch<Result> = {
    readonly add: (files: readonly File[]) => readonly string[];
    readonly start: () => void;
    /** Stops after aborting the running file, which goes back in the queue. */
    readonly stop: () => void;
    readonly retry: (id: string) => void;
    readonly remove: (id: string) => void;
    readonly clear: () => void;
    readonly snapshot: () => BatchSnapshot<Result>;
    /** Called after every change. Returns the unsubscribe function. */
    readonly subscribe: (listener: () => void) => () => void;
    /** Settles when the queue has nothing left to run. */
    readonly idle: () => Promise<void>;
};
/** How many timed files a time-left figure needs before it is worth showing. */
export declare const ESTIMATE_AFTER = 3;
export declare function batchProgress(items: readonly BatchItem<unknown>[]): BatchProgress;
export declare function createBatch<Result>(options: BatchOptions<Result>): Batch<Result>;

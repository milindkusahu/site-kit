// A queue of files run one at a time, framework-free.
//
// One at a time on purpose: a decoded 48 MP photo is about 190 MB of bitmap, so running thirty
// at once gets a phone tab killed rather than finished sooner, and a strip that fills in from
// the left is the only progress display that never lies. Stopping aborts the running file's
// signal and drops anything it reports later, because work already handed to a decoder or a
// worker can't be recalled, and the queue moves on without waiting for it. What is done to each
// file is the caller's `process`.
/** How many timed files a time-left figure needs before it is worth showing. */
export const ESTIMATE_AFTER = 3;
export function batchProgress(items) {
    const done = items.filter((item) => item.status === "done");
    const failed = items.filter((item) => item.status === "failed").length;
    const finished = done.length + failed;
    const timed = done.flatMap((item) => (item.ms === null ? [] : [item.ms]));
    const left = items.length - finished;
    const mean = timed.reduce((total, ms) => total + ms, 0) / Math.max(1, timed.length);
    return {
        total: items.length,
        done: done.length,
        failed,
        finished,
        percent: items.length === 0 ? 100 : Math.round((finished / items.length) * 100),
        remainingMs: timed.length < ESTIMATE_AFTER || left === 0 ? null : Math.round(mean * left),
    };
}
function readable(error) {
    return error instanceof Error && error.message !== "" ? error.message : "That file could not be processed.";
}
let nextBatch = 0;
export function createBatch(options) {
    const autoStart = options.autoStart ?? true;
    const describe = options.describeError ?? readable;
    const now = options.now ?? (() => performance.now());
    const prefix = `b${String((nextBatch += 1))}-`;
    const listeners = new Set();
    let items = [];
    let armed = autoStart;
    let current = null;
    let pumping = Promise.resolve();
    let pumpingNow = false;
    let counter = 0;
    let view = { items, running: false, progress: batchProgress(items) };
    function emit() {
        view = { items, running: current !== null, progress: batchProgress(items) };
        for (const listener of listeners)
            listener();
    }
    function update(id, change) {
        items = items.map((item) => (item.id === id ? { ...item, ...change } : item));
    }
    async function runOne(item) {
        const controller = new AbortController();
        current = { id: item.id, controller };
        update(item.id, { status: "working", error: null });
        emit();
        const started = now();
        const aborted = new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("stopped")), { once: true }));
        aborted.catch(() => undefined);
        try {
            const result = await Promise.race([options.process(item.file, controller.signal), aborted]);
            if (!controller.signal.aborted)
                update(item.id, { status: "done", result, ms: now() - started });
        }
        catch (error) {
            if (!controller.signal.aborted)
                update(item.id, { status: "failed", error: describe(error), ms: null });
        }
        current = null;
        emit();
    }
    async function pump() {
        pumpingNow = true;
        let next = items.find((item) => item.status === "queued");
        while (armed && next !== undefined) {
            await runOne(next);
            next = items.find((item) => item.status === "queued");
        }
        pumpingNow = false;
    }
    function kick() {
        if (pumpingNow || !armed)
            return;
        pumping = pump();
    }
    function abortCurrent(requeue) {
        if (current === null)
            return;
        current.controller.abort();
        if (requeue)
            update(current.id, { status: "queued" });
    }
    return {
        add(files) {
            const added = files.map((file) => ({ id: `${prefix}${String((counter += 1))}`, file, status: "queued", result: null, error: null, ms: null }));
            items = [...items, ...added];
            emit();
            if (autoStart)
                armed = true;
            kick();
            return added.map((item) => item.id);
        },
        start() {
            armed = true;
            kick();
        },
        stop() {
            armed = false;
            abortCurrent(true);
            emit();
        },
        retry(id) {
            update(id, { status: "queued", result: null, error: null, ms: null });
            emit();
            kick();
        },
        remove(id) {
            if (current?.id === id)
                abortCurrent(false);
            items = items.filter((item) => item.id !== id);
            emit();
        },
        clear() {
            abortCurrent(false);
            items = [];
            emit();
        },
        snapshot: () => view,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        idle: () => pumping,
    };
}

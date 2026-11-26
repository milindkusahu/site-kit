import { describe, expect, it } from "vitest";
import { batchProgress, createBatch, type BatchItem } from "../src/image/batch.ts";

const files = (...names: string[]) => names.map((name) => new File([name], name));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe("createBatch", () => {
  it("runs files one at a time, in order", async () => {
    let running = 0;
    let most = 0;
    const order: string[] = [];
    const batch = createBatch({
      process: async (file) => {
        running += 1;
        most = Math.max(most, running);
        await Promise.resolve();
        order.push(file.name);
        running -= 1;
        return file.name.toUpperCase();
      },
    });
    batch.add(files("a", "b", "c"));
    await batch.idle();
    expect(most).toBe(1);
    expect(order).toEqual(["a", "b", "c"]);
    expect(batch.snapshot().items.map((item) => item.result)).toEqual(["A", "B", "C"]);
    expect(batch.snapshot().progress).toMatchObject({ done: 3, percent: 100 });
  });

  it("keeps a failure as the reader's words and moves on", async () => {
    const batch = createBatch({ process: async (file) => { if (file.name === "b") throw new Error("b is damaged."); return 1; } });
    batch.add(files("a", "b", "c"));
    await batch.idle();
    expect(batch.snapshot().items.map((item) => [item.status, item.error])).toEqual([["done", null], ["failed", "b is damaged."], ["done", null]]);
  });

  it("waits for start() when autoStart is off", async () => {
    const batch = createBatch({ process: async () => 1, autoStart: false });
    batch.add(files("a"));
    await batch.idle();
    expect(batch.snapshot().items[0]?.status).toBe("queued");
    batch.start();
    await batch.idle();
    expect(batch.snapshot().items[0]?.status).toBe("done");
  });

  it("stops without waiting for a file that ignores its signal, and drops its late result", async () => {
    const hang = deferred<string>();
    const seen: AbortSignal[] = [];
    const batch = createBatch({ process: (_, signal) => { seen.push(signal); return hang.promise; } });
    batch.add(files("a", "b"));
    await Promise.resolve();
    batch.stop();
    await batch.idle();
    hang.resolve("late");
    await Promise.resolve();
    expect(seen[0]?.aborted).toBe(true);
    expect(batch.snapshot().items.map((item) => item.status)).toEqual(["queued", "queued"]);
    expect(batch.snapshot().running).toBe(false);
  });

  it("retries a failed file and removes one that is running", async () => {
    let fail = true;
    const batch = createBatch({ process: async () => { if (fail) throw new Error("no"); return 2; } });
    const [id] = batch.add(files("a"));
    await batch.idle();
    fail = false;
    batch.retry(id ?? "");
    await batch.idle();
    expect(batch.snapshot().items[0]).toMatchObject({ status: "done", result: 2, error: null });
    batch.remove(id ?? "");
    expect(batch.snapshot().items).toEqual([]);
  });

  it("tells subscribers about every change", async () => {
    const batch = createBatch({ process: async () => 1 });
    let calls = 0;
    const stop = batch.subscribe(() => (calls += 1));
    batch.add(files("a"));
    await batch.idle();
    stop();
    batch.clear();
    expect(calls).toBe(3);
  });
});

describe("batchProgress", () => {
  const item = (status: BatchItem<null>["status"], ms: number | null = null): BatchItem<null> => ({ id: status, file: new File([], "x"), status, result: null, error: null, ms });

  it("estimates the time left only after three timed files", () => {
    expect(batchProgress([item("done", 100), item("done", 200), item("queued")]).remainingMs).toBeNull();
    expect(batchProgress([item("done", 100), item("done", 200), item("done", 300), item("queued"), item("working")]).remainingMs).toBe(400);
  });

  it("calls an empty queue complete", () => {
    expect(batchProgress([])).toMatchObject({ total: 0, percent: 100 });
  });
});

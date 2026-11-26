import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "../src/image/download.ts";

afterEach(() => vi.unstubAllGlobals());

describe("downloadBlob", () => {
  it("clicks an attached link and keeps the URL until the next download", () => {
    const revoked: string[] = [];
    const clicks: { href: string; download: string; attached: boolean }[] = [];
    let made = 0;
    const body = { children: new Set<object>(), append(node: object) { this.children.add(node); } };
    const link = () => {
      const node = {
        href: "", download: "", rel: "", style: { display: "" },
        click() { clicks.push({ href: node.href, download: node.download, attached: body.children.has(node) }); },
        remove() { body.children.delete(node); },
      };
      return node;
    };
    vi.stubGlobal("document", { createElement: link, body });
    vi.stubGlobal("URL", { createObjectURL: () => `blob:${String((made += 1))}`, revokeObjectURL: (url: string) => revoked.push(url) });
    vi.stubGlobal("addEventListener", () => undefined);
    downloadBlob(new Blob(["a"]), "a.jpg");
    expect(clicks).toEqual([{ href: "blob:1", download: "a.jpg", attached: true }]);
    expect(revoked).toEqual([]);
    downloadBlob(new Blob(["b"]), "b.zip");
    expect(revoked).toEqual(["blob:1"]);
    expect(body.children.size).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { groupByMonth, groupByYear } from "../src/seo/changelog.ts";

const entries = [
  { date: "2025-12-30", title: "a" },
  { date: "2026-11-02", title: "b" },
  { date: "2026-11-26", title: "c" },
  { date: "2026-11-26", title: "d" },
  { date: "2026-01-05", title: "e" },
];

describe("groupByMonth", () => {
  it("groups newest month first, entries newest first, same-day entries in listed order", () => {
    const months = groupByMonth(entries);
    expect(months.map((m) => [m.id, m.month, m.year])).toEqual([
      ["2026-11", "November", "2026"],
      ["2026-01", "January", "2026"],
      ["2025-12", "December", "2025"],
    ]);
    expect(months[0]?.entries.map((e) => e.title)).toEqual(["c", "d", "b"]);
  });

  it("keeps each site's own entry fields and does not change the input", () => {
    const copy = [...entries];
    expect(groupByMonth(entries)[2]?.entries[0]).toBe(entries[0]);
    expect(entries).toEqual(copy);
  });

  it("names months in the given locale", () => {
    expect(groupByMonth([{ date: "2026-03-01" }], "de-DE")[0]?.month).toBe("März");
  });

  it("refuses a date that is not YYYY-MM-DD", () => {
    expect(() => groupByMonth([{ date: "26/11/2026" }])).toThrow(/not YYYY-MM-DD/);
    expect(() => groupByMonth([{ date: "2026-13-01" }])).toThrow();
  });
});

describe("groupByYear", () => {
  it("groups months under their year, newest first", () => {
    expect(groupByYear(groupByMonth(entries)).map((y) => [y.year, y.months.map((m) => m.id)])).toEqual([
      ["2026", ["2026-11", "2026-01"]],
      ["2025", ["2025-12"]],
    ]);
    expect(groupByYear(groupByMonth([]))).toEqual([]);
  });
});

// Groups a site's changelog newest first, by month and then by year, for a /changelog/ page.
// Entries only need an ISO `date` (YYYY-MM-DD); each site keeps its own entry shape.

export type Dated = { readonly date: string };

export type ChangelogMonth<T extends Dated> = {
  readonly id: string;
  readonly year: string;
  readonly month: string;
  readonly entries: readonly T[];
};

export type ChangelogYear<T extends Dated> = { readonly year: string; readonly months: readonly ChangelogMonth<T>[] };

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function monthName(id: string, locale: string): string {
  return new Date(`${id}-01T00:00:00Z`).toLocaleDateString(locale, { month: "long", timeZone: "UTC" });
}

/** Newest month first; entries in a month newest first, same-day entries in their listed order. */
export function groupByMonth<T extends Dated>(entries: readonly T[], locale = "en-GB"): readonly ChangelogMonth<T>[] {
  const bad = entries.find((entry) => !ISO_DATE.test(entry.date));
  if (bad) throw new Error(`Changelog date "${bad.date}" is not YYYY-MM-DD.`);
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const months = new Map<string, T[]>();
  for (const entry of sorted) {
    const id = entry.date.slice(0, 7);
    months.set(id, [...(months.get(id) ?? []), entry]);
  }
  return [...months].map(([id, list]) => ({ id, year: id.slice(0, 4), month: monthName(id, locale), entries: list }));
}

export function groupByYear<T extends Dated>(months: readonly ChangelogMonth<T>[]): readonly ChangelogYear<T>[] {
  const years = new Map<string, ChangelogMonth<T>[]>();
  for (const month of months) years.set(month.year, [...(years.get(month.year) ?? []), month]);
  return [...years].map(([year, list]) => ({ year, months: list }));
}

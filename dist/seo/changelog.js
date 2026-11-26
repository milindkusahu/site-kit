// Groups a site's changelog newest first, by month and then by year, for a /changelog/ page.
// Entries only need an ISO `date` (YYYY-MM-DD); each site keeps its own entry shape.
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function monthName(id, locale) {
    return new Date(`${id}-01T00:00:00Z`).toLocaleDateString(locale, { month: "long", timeZone: "UTC" });
}
/** Newest month first; entries in a month newest first, same-day entries in their listed order. */
export function groupByMonth(entries, locale = "en-GB") {
    const bad = entries.find((entry) => !ISO_DATE.test(entry.date));
    if (bad)
        throw new Error(`Changelog date "${bad.date}" is not YYYY-MM-DD.`);
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const months = new Map();
    for (const entry of sorted) {
        const id = entry.date.slice(0, 7);
        months.set(id, [...(months.get(id) ?? []), entry]);
    }
    return [...months].map(([id, list]) => ({ id, year: id.slice(0, 4), month: monthName(id, locale), entries: list }));
}
export function groupByYear(months) {
    const years = new Map();
    for (const month of months)
        years.set(month.year, [...(years.get(month.year) ?? []), month]);
    return [...years].map(([year, list]) => ({ year, months: list }));
}

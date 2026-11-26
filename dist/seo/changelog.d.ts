export type Dated = {
    readonly date: string;
};
export type ChangelogMonth<T extends Dated> = {
    readonly id: string;
    readonly year: string;
    readonly month: string;
    readonly entries: readonly T[];
};
export type ChangelogYear<T extends Dated> = {
    readonly year: string;
    readonly months: readonly ChangelogMonth<T>[];
};
/** Newest month first; entries in a month newest first, same-day entries in their listed order. */
export declare function groupByMonth<T extends Dated>(entries: readonly T[], locale?: string): readonly ChangelogMonth<T>[];
export declare function groupByYear<T extends Dated>(months: readonly ChangelogMonth<T>[]): readonly ChangelogYear<T>[];

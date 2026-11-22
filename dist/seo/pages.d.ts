import type { SitePage } from "./types.ts";
export declare function findPage(pages: readonly SitePage[], path: string): SitePage;
export declare function indexable(pages: readonly SitePage[]): readonly SitePage[];
export type Crumb = {
    readonly name: string;
    readonly path: string;
};
export declare function breadcrumbTrail(pages: readonly SitePage[], page: SitePage): readonly Crumb[];

export type AuthorConfig = {
  readonly name: string;
  readonly slug: string;
  readonly jobTitle: string;
  readonly bio: string;
  readonly sameAs: readonly string[];
};

export type SiteConfig = {
  readonly name: string;
  readonly domain: string;
  readonly origin: string;
  readonly contactEmail: string;
  readonly defaultLocale: string;
  readonly description: string;
  readonly themeColor: string;
  readonly backgroundColor: string;
  readonly author: AuthorConfig;
  readonly sameAs: readonly string[];
  readonly launched: string;
};

export type PageType =
  | "home"
  | "tool"
  | "howto"
  | "comparison"
  | "explainer"
  | "hub"
  | "about"
  | "contact"
  | "author"
  | "legal"
  | "changelog"
  | "utility";

export type SitePage = {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly type: PageType;
  readonly breadcrumb: string;
  readonly parent: string | null;
  readonly lastUpdated: string;
  readonly indexable: boolean;
  readonly inNav: boolean;
  readonly inFooter: boolean;
};

import type { RouteMeta } from "./metadata.ts";
import type { Crumb } from "./pages.ts";
import type { SiteConfig, SitePage } from "./types.ts";
import { absoluteUrl } from "./url.ts";

export type JsonLdNode = { readonly [key: string]: unknown };
export type Entity = { readonly name: string; readonly sameAs?: string };
export type ImageInfo = { readonly src: string; readonly alt: string; readonly width: number; readonly height: number };
export type FaqItem = { readonly question: string; readonly answer: string };
export type HowToStep = { readonly name: string; readonly text: string; readonly image: string };

export function nodeIds(site: SiteConfig) {
  return {
    organization: `${site.origin}/#organization`,
    website: `${site.origin}/#website`,
    author: `${site.origin}/about/#author`,
  } as const;
}

export const PAGE_NODE_ID = {
  webpage: (canonical: string) => `${canonical}#webpage`,
  breadcrumb: (canonical: string) => `${canonical}#breadcrumb`,
  primaryImage: (canonical: string) => `${canonical}#primaryimage`,
  app: (canonical: string) => `${canonical}#app`,
} as const;

const PAGE_TYPE: Partial<Record<SitePage["type"], string>> = {
  about: "AboutPage",
  contact: "ContactPage",
  hub: "CollectionPage",
};

export function organizationNode(site: SiteConfig): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": nodeIds(site).organization,
    name: site.name,
    url: absoluteUrl(site.origin, "/"),
    email: site.contactEmail,
    logo: { "@type": "ImageObject", url: absoluteUrl(site.origin, "/icons/icon-512.png"), width: 512, height: 512 },
    ...(site.sameAs.length > 0 ? { sameAs: site.sameAs } : {}),
  };
}

export function websiteNode(site: SiteConfig): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": nodeIds(site).website,
    name: site.name,
    url: absoluteUrl(site.origin, "/"),
    inLanguage: site.defaultLocale,
    publisher: { "@id": nodeIds(site).organization },
  };
}

export function authorNode(site: SiteConfig): JsonLdNode {
  return {
    "@type": "Person",
    "@id": nodeIds(site).author,
    name: site.author.name,
    jobTitle: site.author.jobTitle,
    description: site.author.bio,
    url: absoluteUrl(site.origin, "/about/"),
    worksFor: { "@id": nodeIds(site).organization },
    ...(site.author.sameAs.length > 0 ? { sameAs: site.author.sameAs } : {}),
  };
}

function entityNodes(entities: readonly Entity[]): readonly JsonLdNode[] {
  return entities.map((e) => ({ "@type": "Thing", name: e.name, ...(e.sameAs ? { sameAs: e.sameAs } : {}) }));
}

export type WebPageOptions = {
  readonly about?: readonly Entity[];
  readonly mentions?: readonly Entity[];
  readonly hasBreadcrumb?: boolean;
  readonly primaryImage?: boolean;
};

export function webPageNode(site: SiteConfig, page: SitePage, meta: RouteMeta, options: WebPageOptions = {}): JsonLdNode {
  return {
    "@type": PAGE_TYPE[page.type] ?? "WebPage",
    "@id": PAGE_NODE_ID.webpage(meta.canonical),
    url: meta.canonical,
    name: meta.title,
    description: meta.description,
    inLanguage: site.defaultLocale,
    isPartOf: { "@id": nodeIds(site).website },
    dateModified: page.lastUpdated,
    ...(options.hasBreadcrumb === true ? { breadcrumb: { "@id": PAGE_NODE_ID.breadcrumb(meta.canonical) } } : {}),
    ...(options.primaryImage === true ? { primaryImageOfPage: { "@id": PAGE_NODE_ID.primaryImage(meta.canonical) } } : {}),
    ...(options.about && options.about.length > 0 ? { about: entityNodes(options.about) } : {}),
    ...(options.mentions && options.mentions.length > 0 ? { mentions: entityNodes(options.mentions) } : {}),
  };
}

export function breadcrumbNode(site: SiteConfig, trail: readonly Crumb[], canonical: string): JsonLdNode | null {
  if (trail.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    "@id": PAGE_NODE_ID.breadcrumb(canonical),
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(site.origin, crumb.path),
    })),
  };
}

export function imageObjectNode(site: SiteConfig, image: ImageInfo, id?: string): JsonLdNode {
  return {
    "@type": "ImageObject",
    ...(id ? { "@id": id } : {}),
    contentUrl: absoluteUrl(site.origin, image.src),
    url: absoluteUrl(site.origin, image.src),
    caption: image.alt,
    width: image.width,
    height: image.height,
  };
}

export function webApplicationNode(site: SiteConfig, meta: RouteMeta, app: { readonly category: string; readonly features: readonly string[] }): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": PAGE_NODE_ID.app(meta.canonical),
    name: meta.title,
    url: meta.canonical,
    description: meta.description,
    applicationCategory: app.category,
    operatingSystem: "Any",
    browserRequirements: "Requires a modern browser",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...(app.features.length > 0 ? { featureList: app.features } : {}),
    publisher: { "@id": nodeIds(site).organization },
  };
}

export function faqNode(items: readonly FaqItem[]): JsonLdNode | null {
  if (items.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function howToNode(site: SiteConfig, name: string, steps: readonly HowToStep[]): JsonLdNode | null {
  if (steps.length === 0) return null;
  return {
    "@type": "HowTo",
    name,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      image: absoluteUrl(site.origin, s.image),
    })),
  };
}

export function articleNode(site: SiteConfig, page: SitePage, meta: RouteMeta): JsonLdNode {
  return {
    "@type": "Article",
    headline: page.title,
    description: meta.description,
    mainEntityOfPage: { "@id": PAGE_NODE_ID.webpage(meta.canonical) },
    dateModified: page.lastUpdated,
    datePublished: page.lastUpdated,
    author: { "@id": nodeIds(site).author },
    publisher: { "@id": nodeIds(site).organization },
    image: meta.ogImage,
  };
}

export function graph(nodes: readonly (JsonLdNode | null)[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes.filter((n): n is JsonLdNode => n !== null) };
}

export function serializeJsonLd(value: JsonLdNode): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export type PageGraphOptions = {
  readonly trail: readonly Crumb[];
  readonly about?: readonly Entity[];
  readonly mentions?: readonly Entity[];
  readonly primaryImage?: ImageInfo;
  readonly extra?: readonly (JsonLdNode | null)[];
};

const ARTICLE_TYPES: readonly SitePage["type"][] = ["howto", "explainer", "comparison"];

export function pageGraph(site: SiteConfig, page: SitePage, meta: RouteMeta, options: PageGraphOptions): JsonLdNode {
  const crumbs = breadcrumbNode(site, options.trail, meta.canonical);
  const image = options.primaryImage ? imageObjectNode(site, options.primaryImage, PAGE_NODE_ID.primaryImage(meta.canonical)) : null;
  const pageNode = webPageNode(site, page, meta, {
    hasBreadcrumb: crumbs !== null,
    primaryImage: image !== null,
    ...(options.about ? { about: options.about } : {}),
    ...(options.mentions ? { mentions: options.mentions } : {}),
  });
  const article = ARTICLE_TYPES.includes(page.type) ? articleNode(site, page, meta) : null;
  return graph([organizationNode(site), websiteNode(site), authorNode(site), pageNode, crumbs, image, article, ...(options.extra ?? [])]);
}

import { WIKI_BASE, WIKI_ORIGIN } from "./constants";

/** MediaWiki title from a /wiki/... path segment (no leading /wiki/). */
export function wikiTitleFromPath(pathSegment: string): string {
  const withoutQuery = pathSegment.split("?")[0].split("#")[0];
  const decoded = decodeURIComponent(withoutQuery);
  return decoded.replace(/_/g, " ");
}

export function wikiTitleFromHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") {
    return null;
  }

  if (trimmed.startsWith("#")) {
    return null;
  }

  if (trimmed.startsWith("/wiki/")) {
    return wikiTitleFromPath(trimmed.slice("/wiki/".length));
  }

  let absolute = trimmed;
  if (trimmed.startsWith("//")) {
    absolute = `https:${trimmed}`;
  }

  try {
    const url = new URL(absolute, WIKI_ORIGIN);
    if (url.origin !== WIKI_ORIGIN) {
      return null;
    }
    if (url.pathname.startsWith("/wiki/")) {
      return wikiTitleFromPath(url.pathname.slice("/wiki/".length));
    }
    if (url.pathname === "/index.php") {
      const title = url.searchParams.get("title");
      if (title) {
        return wikiTitleFromPath(title);
      }
    }
  } catch {
    return null;
  }

  return null;
}

/** @deprecated use wikiTitleFromHref */
export function titleFromWikiHref(href: string): string | null {
  return wikiTitleFromHref(href);
}

export function browserUrlForTitle(title: string): string {
  return `${WIKI_BASE}${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function openInBrowser(url: string): void {
  if (window.dspWiki?.openExternal) {
    void window.dspWiki.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

import { WIKI_BASE } from "./constants";

export function titleFromWikiHref(href: string): string | null {
  if (href.startsWith("/wiki/")) {
    const encoded = href.slice("/wiki/".length).split("#")[0];
    try {
      return decodeURIComponent(encoded.replace(/_/g, " "));
    } catch {
      return null;
    }
  }
  if (href.startsWith(WIKI_BASE)) {
    const encoded = href.slice(WIKI_BASE.length).split("#")[0];
    try {
      return decodeURIComponent(encoded.replace(/_/g, " "));
    } catch {
      return null;
    }
  }
  return null;
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

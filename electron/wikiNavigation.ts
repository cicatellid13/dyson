const WIKI_ORIGIN = "https://dyson-sphere-program.fandom.com";

export function wikiTitleFromDevNavigation(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/wiki/")) {
      return null;
    }
    const segment = parsed.pathname.slice("/wiki/".length).split("/")[0];
    const decoded = decodeURIComponent(segment);
    const title = decoded.replace(/_/g, " ");
    return title || null;
  } catch {
    return null;
  }
}

export function isDevServerWikiNav(
  url: string,
  devServerOrigin: string | undefined,
): boolean {
  if (!devServerOrigin) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === devServerOrigin &&
      wikiTitleFromDevNavigation(url) !== null
    );
  } catch {
    return false;
  }
}

export const FANDOM_REFERER = `${WIKI_ORIGIN}/`;

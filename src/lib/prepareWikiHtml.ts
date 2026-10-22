import { wikiTitleFromHref } from "./wikiLinks";

/**
 * Fandom parse HTML assumes their site JS (lazyload) and absolute URLs.
 * Promote lazy images and tag wiki links for in-app navigation.
 */
export function prepareWikiHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const img of doc.querySelectorAll("img")) {
    const lazySrc = img.getAttribute("data-src");
    if (lazySrc && !lazySrc.startsWith("data:")) {
      img.setAttribute("src", lazySrc);
    }
    const lazySrcSet = img.getAttribute("data-srcset");
    if (lazySrcSet) {
      img.setAttribute("srcset", lazySrcSet);
    }
    img.removeAttribute("data-src");
    img.removeAttribute("data-srcset");
    img.classList.remove("lazyload");
    img.setAttribute("referrerpolicy", "no-referrer");
  }

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    const title = wikiTitleFromHref(href);
    if (title) {
      anchor.setAttribute("data-wiki-title", title);
      anchor.setAttribute("href", "#");
      anchor.removeAttribute("target");
      continue;
    }

    if (href.startsWith("#")) {
      continue;
    }

    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//")
    ) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  }

  return doc.body.innerHTML;
}

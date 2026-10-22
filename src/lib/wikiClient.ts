import { USER_AGENT, WIKI_API } from "./constants";
import { prepareWikiHtml } from "./prepareWikiHtml";

export type SearchHit = {
  title: string;
  snippet: string;
};

export type ParsedPage = {
  title: string;
  displayTitle: string;
  html: string;
};

class WikiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikiError";
  }
}

async function wikiGet(params: Record<string, string>): Promise<unknown> {
  const url = new URL(WIKI_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch {
    throw new WikiError("Could not reach the wiki. Check your connection.");
  }

  if (!response.ok) {
    throw new WikiError(`Wiki returned ${response.status}. Try again later.`);
  }

  const data = (await response.json()) as {
    error?: { info?: string };
  };

  if (data.error?.info) {
    throw new WikiError(data.error.info);
  }

  return data;
}

function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

export async function searchWiki(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const data = (await wikiGet({
    action: "query",
    list: "search",
    srsearch: trimmed,
    srlimit: "20",
  })) as {
    query?: {
      search?: Array<{ title: string; snippet: string }>;
    };
  };

  const hits = data.query?.search ?? [];
  return hits.map((hit) => ({
    title: hit.title,
    snippet: decodeHtmlEntities(hit.snippet.replace(/<[^>]+>/g, "")),
  }));
}

export async function suggestTitles(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const data = (await wikiGet({
    action: "opensearch",
    search: trimmed,
    limit: "10",
  })) as [string, string[]];

  return data[1] ?? [];
}

export async function fetchPage(title: string): Promise<ParsedPage> {
  const data = (await wikiGet({
    action: "parse",
    page: title,
    prop: "text|displaytitle",
    disableeditsection: "1",
  })) as {
    parse?: {
      title: string;
      displaytitle?: string;
      text?: { "*": string };
    };
  };

  const parse = data.parse;
  if (!parse?.text?.["*"]) {
    throw new WikiError(`Page not found: ${title}`);
  }

  return {
    title: parse.title,
    displayTitle: parse.displaytitle ?? parse.title,
    html: prepareWikiHtml(parse.text["*"]),
  };
}

export { WikiError };

import { useCallback, useEffect, useRef, useState } from "react";
import { HOME_PAGE, SHORTCUTS } from "./lib/constants";
import { loadRecents, pushRecent } from "./lib/recents";
import {
  browserUrlForTitle,
  openInBrowser,
  titleFromWikiHref,
} from "./lib/wikiLinks";
import {
  fetchPage,
  searchWiki,
  suggestTitles,
  WikiError,
  type ParsedPage,
  type SearchHit,
} from "./lib/wikiClient";

export function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);
  const [page, setPage] = useState<ParsedPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const [history, setHistory] = useState<string[]>([]);
  const debounceRef = useRef<number | null>(null);

  const loadTitle = useCallback(async (title: string, pushHistory = true) => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setSuggestions([]);

    if (pushHistory && page?.title && page.title !== title) {
      setHistory((h) => [...h, page.title]);
    }

    try {
      const parsed = await fetchPage(title);
      setPage(parsed);
      setRecents(pushRecent(parsed.title));
    } catch (e) {
      const message =
        e instanceof WikiError ? e.message : "Failed to load page.";
      setError(message);
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, [page?.title]);

  useEffect(() => {
    void loadTitle(HOME_PAGE, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial home load only
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void suggestTitles(query).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      return;
    }
    setLoading(true);
    setError(null);
    void searchWiki(q)
      .then((hits) => {
        setSearchResults(hits);
        if (hits.length === 1) {
          void loadTitle(hits[0].title);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof WikiError ? err.message : "Search failed.");
      })
      .finally(() => setLoading(false));
  };

  const goBack = () => {
    setHistory((h) => {
      const next = [...h];
      const prev = next.pop();
      if (prev) {
        void loadTitle(prev, false);
      }
      return next;
    });
  };

  const onArticleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    const title = titleFromWikiHref(href);
    if (title) {
      e.preventDefault();
      void loadTitle(title);
      return;
    }

    if (href.startsWith("http://") || href.startsWith("https://")) {
      e.preventDefault();
      openInBrowser(href);
    }
  };

  const displayTitle = page?.displayTitle.replace(/<[^>]+>/g, "") ?? "DSP Wiki";

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>DSP Wiki</h1>
          <p className="subtitle">Dyson Sphere Program</p>
        </header>

        <form className="search-form" onSubmit={onSearchSubmit}>
          <input
            type="search"
            placeholder="Search the wiki…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search wiki"
          />
          <button type="submit" disabled={loading}>
            Search
          </button>
        </form>

        {suggestions.length > 0 && (
          <ul className="suggestions" role="listbox">
            {suggestions.map((title) => (
              <li key={title}>
                <button type="button" onClick={() => void loadTitle(title)}>
                  {title}
                </button>
              </li>
            ))}
          </ul>
        )}

        <nav className="shortcuts" aria-label="Wiki shortcuts">
          {SHORTCUTS.map(({ label, page: pageTitle }) => (
            <button
              key={pageTitle}
              type="button"
              className={
                page?.title === pageTitle ? "shortcut active" : "shortcut"
              }
              onClick={() => void loadTitle(pageTitle)}
            >
              {label}
            </button>
          ))}
        </nav>

        {recents.length > 0 && (
          <section className="recents">
            <h2>Recent</h2>
            <ul>
              {recents.map((title) => (
                <li key={title}>
                  <button type="button" onClick={() => void loadTitle(title)}>
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <main className="main">
        <header className="toolbar">
          <div className="toolbar-left">
            <button
              type="button"
              className="ghost"
              disabled={history.length === 0}
              onClick={goBack}
            >
              ← Back
            </button>
            <h2>{displayTitle}</h2>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="ghost"
              disabled={!page || loading}
              onClick={() => page && void loadTitle(page.title, false)}
            >
              Refresh
            </button>
            <button
              type="button"
              className="primary"
              disabled={!page}
              onClick={() => page && openInBrowser(browserUrlForTitle(page.title))}
            >
              Open in browser
            </button>
          </div>
        </header>

        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}

        {loading && <div className="loading">Loading from Fandom…</div>}

        {searchResults && !loading && (
          <section className="search-results">
            <h3>Search results</h3>
            {searchResults.length === 0 ? (
              <p>No pages matched. Try a different term.</p>
            ) : (
              <ul>
                {searchResults.map((hit) => (
                  <li key={hit.title}>
                    <button type="button" onClick={() => void loadTitle(hit.title)}>
                      <strong>{hit.title}</strong>
                      {hit.snippet && <span>{hit.snippet}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {page && !searchResults && (
          <article
            className="wiki-article"
            onClick={onArticleClick}
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        )}
      </main>
    </div>
  );
}

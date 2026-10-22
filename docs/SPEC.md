# Dyson Sphere Program Wiki Desktop — Product Specification

**Version:** 1.0  
**Status:** Implemented baseline (MVP)  
**Reference:** [Dyson Sphere Program Wiki (Fandom)](https://dyson-sphere-program.fandom.com/wiki/Dyson_Sphere_Program_Wiki)

## 1. Purpose

Deliver a cross-platform desktop application (macOS and Windows) that lets players browse and search the official community wiki without relying on a generic web browser tab. The app uses the wiki’s public MediaWiki API; it does not scrape HTML or redistribute wiki content offline.

## 2. Goals and non-goals

### Goals

- Search wiki pages by title and content snippets.
- Read article HTML rendered in-app with readable typography.
- Quick access to high-traffic entry points (home, Components, Buildings, Technology).
- Open the same article on the live wiki in the system browser.
- Remember recent articles locally (no account required).

### Non-goals (v1)

- Offline full mirror of the wiki.
- Editing wiki pages or login to Fandom.
- Recipe/planning calculators (may be a future spec).

## 3. Users and scenarios

| ID | Scenario | Acceptance |
|----|----------|------------|
| U1 | Player looks up an item while planning a factory | Search returns relevant pages; opening one shows content within 3s on typical network |
| U2 | New player explores wiki structure | Sidebar shortcuts open known category/hub pages |
| U3 | Player shares a link with a friend | “Open in browser” uses canonical Fandom URL |
| U4 | Player revisits yesterday’s research | Recent list shows last 20 titles; click restores article |

## 4. Technical architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process                                   │
│  - Window lifecycle, external URL handler                │
│  - Optional: IPC for future cache                        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Renderer (React + TypeScript)                           │
│  - UI state, routing (in-memory)                         │
│  - WikiClient → MediaWiki Action API (HTTPS)             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              dyson-sphere-program.fandom.com/api.php
```

**Stack:** Electron 33+, Vite, React 18, TypeScript.  
**API base:** `https://dyson-sphere-program.fandom.com/api.php`  
**Article URLs:** `https://dyson-sphere-program.fandom.com/wiki/{encodedTitle}`

## 5. External API contract

All requests: `format=json`, `origin=*` where applicable, descriptive `User-Agent` per [MediaWiki etiquette](https://www.mediawiki.org/wiki/API:Etiquette).

### 5.1 Search

- **Endpoint:** `action=query&list=search&srsearch={query}&srlimit=20`
- **Response use:** `query.search[].title`, `snippet` (HTML entities decoded for display)

### 5.2 Page content

- **Endpoint:** `action=parse&page={title}&prop=text|displaytitle&disableeditsection=1`
- **Response use:** `parse.text['*']` injected into sandboxed article container; rewrite relative `/wiki/` links to in-app navigation

### 5.3 Open search (autocomplete)

- **Endpoint:** `action=opensearch&search={query}&limit=10`
- **Response use:** `[]` titles array for typeahead

### 5.4 Errors

| Condition | UX |
|-----------|-----|
| Network failure | Banner: “Could not reach the wiki. Check your connection.” |
| Empty search | Empty state with search tips |
| Missing page (API error) | Message + link to open search on Fandom |

## 6. UI specification

### 6.1 Layout

- **Shell:** Title bar region (drag), left sidebar (~240px), main content.
- **Sidebar:** App title, search field, shortcuts (Home, Components, Buildings, Technology), recent articles list.
- **Main:** Article title, toolbar (Back if history stack, Refresh, Open in browser), scrollable article body.

### 6.2 Theming

- Dark theme aligned with DSP / sci-fi aesthetic (deep blue-gray background, cyan accent).
- Article body: max-width ~800px, comfortable line height, wiki tables horizontally scrollable.

### 6.3 Navigation

- In-app wiki links (`href` starting with `/wiki/`): intercept click → load via API.
- External links: open via `shell.openExternal`.
- Internal history stack: back button pops stack (not system back).

## 7. Platform requirements

| Platform | Minimum |
|----------|---------|
| macOS | 11+ (Big Sur), arm64 or x64 |
| Windows | 10+, x64 |

Build targets via `electron-builder`: `dmg`/`zip` (mac), `nsis` (win).

## 8. Privacy and compliance

- No analytics in v1.
- Recent articles stored in `localStorage` only on device.
- User-Agent identifies app name and version for wiki operators.

## 9. Verification (test plan)

- [ ] App launches on macOS dev build (`npm run dev`).
- [ ] Search “Iron Ore” returns results; opening shows article body.
- [ ] Shortcut “Components” loads expected hub page.
- [ ] Click in-article wiki link navigates without leaving app.
- [ ] External link opens default browser.
- [ ] Recent list updates after viewing pages.
- [ ] Production build scripts documented in README.

## 10. Future spec candidates

- Favorites / pinned pages sync.
- Full-text offline cache with TTL.
- Production chain graph from wiki templates.

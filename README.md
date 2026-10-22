# DSP Wiki Desktop

Cross-platform desktop client for the [Dyson Sphere Program Wiki](https://dyson-sphere-program.fandom.com/wiki/Dyson_Sphere_Program_Wiki) on Fandom. Built with **spec-driven development** — see [`docs/SPEC.md`](docs/SPEC.md) for requirements, API contract, and acceptance criteria.

## Features

- Search and autocomplete against the live MediaWiki API
- Read articles in-app with in-wiki link navigation
- Shortcuts to Home, Components, Buildings, and Technology
- Recent pages stored locally on your machine
- Open any article in your system browser

## Requirements

- Node.js 20+ (22 recommended)
- macOS 11+ or Windows 10+ for packaged builds

## Development

```bash
npm install
npm run dev
```

This starts Vite and Electron together. The renderer hot-reloads on save.

## Build installers

```bash
npm run build
```

Outputs land in `release/` (macOS `.dmg`/`.zip`, Windows NSIS installer when built on Windows).

To produce an unpacked app directory without an installer:

```bash
npm run build:dir
```

## Project layout

| Path | Purpose |
|------|---------|
| `docs/SPEC.md` | Product specification (source of truth) |
| `electron/` | Main process and preload bridge |
| `src/lib/wikiClient.ts` | MediaWiki API client |
| `src/App.tsx` | Main UI |

## License

MIT. Wiki content © Fandom contributors; this app only fetches public pages from Fandom at runtime.

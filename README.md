# DSP Fieldguide

An offline desktop item and recipe reference for Dyson Sphere Program, for macOS and Windows.

- 172 enabled items and buildings, 160 recipes, and 172 locally bundled icons in the current snapshot
- Instant local search and category filters
- Clickable ingredients, outputs, production facilities, and used-in recipes
- Alternate recipes, unlock technology, crafting time, and quantity scaling
- Expandable production chains with cycle protection
- Persistent favorites
- Logistics Network: systems with nested planets, notes, import/export routes, and per-planet filters. Data saves automatically on this device.
- Dark Fog toggle hides combat content throughout the app or restores it in full color.

## Run

Node.js 20+ required (22 recommended).

```sh
npm install
npm run dev
```

Uses a dedicated development port, 5199. Electron opens the correct Vite server. No internet is needed after dependencies are installed: the catalog and images ship with the app.

## Package

```sh
npm run build:dir # unpacked native application in release/
npm run build     # macOS DMG/ZIP or Windows NSIS installer
```

Build on the target operating system. macOS builds are unsigned for local use; public distribution requires signing/notarization. Windows packaging is configured but needs validation on Windows.

## Data and updates

The bundled data comes from [DSP Wiki Module:Recipe/Data](https://dyson-sphere-program.fandom.com/wiki/Module:Recipe/Data). The catalog records the original revision, source timestamp, and download timestamp. Browsing makes no runtime wiki API calls and loads no remote images.

To deliberately refresh the snapshot (Python 3 and curl required):

```sh
npm run data:refresh
npm test
```

The importer reads declarative Lua literals without executing Lua, downloads icons, and atomically replaces the catalog after success. Existing icon files are reused. Rebuild to include the refreshed snapshot. No automatic expiration or background update requests.

Recipe quantities use whole batches. Fractionation shows expected statistical yields. Times are base recipe times, without machine speed or proliferator bonuses. Production chains use the first listed ingredient recipes, stop at cycles/eight levels, and do not reuse byproducts across branches. This is a recipe reference, not a factory optimizer or complete wiki mirror.

## Verification

```sh
npm run typecheck
npm test
```

Tests verify every item image, recipe references and quantities, known Processor inputs, batch rounding, and fractionation/alternate recipes.

Specification: [docs/SPEC.md](docs/SPEC.md).

## Attribution

Wiki text/data © DSP Wiki contributors, under the wiki's applicable [Fandom content license](https://www.fandom.com/licensing). Source revision and item-page links are displayed in the app. Game names and artwork belong to their respective rights holders (Youthcat Studio / Gamera Games); included as reference material. This is an unofficial companion app.

## Windows setup script

Download `scripts/install-windows.ps1` to a Windows 11 x64 or ARM64 PC and run it from PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\install-windows.ps1"
```

The execution policy override applies only to that process. The script downloads checksum-verified Node.js 22 build tools, obtains the private repository via GitHub login when needed, installs locked dependencies, runs checks, builds an NSIS installer, and installs DSP Fieldguide for your Windows account. No system-wide Node.js or Git installation is required. Internet is required for setup; the installed app works offline. GitHub authentication may require your browser.

Alternatively, download and extract the repository ZIP from GitHub while signed in, then run the script from its `scripts` folder. It uses the adjacent source and skips GitHub CLI setup/login.

Setup logs and build tools are retained under `%LOCALAPPDATA%\DSP-Fieldguide-Setup` for troubleshooting. The Windows installer is unsigned; Windows may show an app reputation prompt. Windows execution has not yet been validated on a Windows host. Mac favorites and planet notes do not automatically transfer.

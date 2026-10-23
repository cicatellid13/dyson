# DSP Fieldguide

An offline desktop item and recipe reference for Dyson Sphere Program, for macOS and Windows.

- 172 enabled items and buildings, 160 recipes, and 172 locally bundled icons in the current snapshot
- Instant local search and category filters
- Clickable ingredients, outputs, production facilities, and used-in recipes
- Alternate recipes, unlock technology, crafting time, and quantity scaling
- Expandable production chains with cycle protection
- Persistent favorites
- Logistics Network: systems with nested planets, notes, import/export routes, and per-planet filters. Data saves locally and syncs across machines through MongoDB.
- Planning: folders and plain-text notes with automatic saving, offline recovery and cross-machine sync.
- Planet types, compact expanding notes, and readable item filters for larger systems.
- Dark Fog toggle hides combat content throughout the app or restores it in full color.

## Run

Node.js 22 recommended. Copy `.env.example` to `.env` and supply your MongoDB URI before launching.

```sh
npm install
npm run dev
```

Uses a dedicated development port, 5199. Electron opens the correct Vite server. First setup requires MongoDB access. After initialization, the catalog, images and workspace are cached for offline use.

## Package

```sh
npm run build:dir # unpacked native application in release/
npm run build     # macOS DMG/ZIP or Windows NSIS installer
```

Build on the target operating system. macOS builds are unsigned for local use; public distribution requires signing/notarization. Windows installer packaging is checked by the repository’s Windows workflow.

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

The execution policy override applies only to that process. The script downloads checksum-verified Node.js 22 build tools, obtains the private repository via GitHub login when needed, installs locked dependencies, runs checks, builds an NSIS installer, and installs DSP Fieldguide for your Windows account. No system-wide Node.js or Git installation is required. Internet is required for setup and the first MongoDB connection; subsequent launches can use the offline cache. GitHub authentication may require your browser.

Alternatively, download and extract the repository ZIP from GitHub while signed in, then run the script from its `scripts` folder. It uses the adjacent source and skips GitHub CLI setup/login.

Setup logs and build tools are retained under `%LOCALAPPDATA%\DSP-Fieldguide-Setup` for troubleshooting. The Windows installer is unsigned; Windows may show an app reputation prompt. Windows installer packaging and tests are validated in GitHub Actions. Interactive installation on a separate Windows PC has not been tested here. Mac systems, planets, notes and favorites load automatically from the same MongoDB database.


## MongoDB configuration and sync

The Electron backend creates `dsp_fieldguide.wiki_catalog` and `dsp_fieldguide.workspace` automatically. `npm run db:seed` seeds the bundled catalog without replacing an existing snapshot or your workspace. The first connected desktop launch migrates that app profile’s existing planets, systems and favorites if no shared workspace exists; later devices use the shared workspace. A local legacy backup is retained.

Development reads the project `.env`. Installed apps read:
- macOS: `~/Library/Application Support/dsp-wiki-desktop/.env`
- Windows: `%APPDATA%\dsp-wiki-desktop\.env`

Use the fields from `.env.example`. The Windows setup script asks for the URI using hidden input and creates the file for you. Configure the same database on each computer; its IP must be permitted by your Atlas network settings. Real credentials are ignored by Git and excluded from installers. Database access stays inside the Electron backend; this is a trusted, single-user desktop deployment.

Edits save locally immediately and sync after a 750 ms pause. A shared workspace document allows an atomic revision check; only changed sections, planning folders/notes, or settings are written. Independent changes merge, while conflicting edits show a choice and retain a backup. The app checks other devices every 30 seconds and when focused. Offline edits retry automatically. Initial connection requires network access; subsequent launches use the cache. Local recovery files live beside the installed app’s `.env`.

Catalog seeding is intentionally idempotent. A new wiki snapshot requires an explicit backend catalog migration; `data:refresh` alone does not overwrite the shared catalog. Images remain bundled with the app.


### Windows installation from the repository ZIP

1. Sign into GitHub with the account that can access this private repository, then download the `main` branch ZIP to Downloads as `dyson-main.zip`.
2. Open Windows PowerShell and run:

```powershell
$sourceFolder = Join-Path $HOME 'Downloads\DSP-Fieldguide-Source'
Expand-Archive -LiteralPath "$HOME\Downloads\dyson-main.zip" -DestinationPath $sourceFolder -Force
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$sourceFolder\dyson-main\scripts\install-windows.ps1"
```

3. When prompted, paste the same MongoDB connection string used on your Mac and press Enter. Input is hidden. The script creates the private `.env` for your Windows account.
4. Open DSP Fieldguide from Start. Wait for **Cloud synced**, then open **Logistics Network**; your existing Sadira system and planets should appear. No local MongoDB server, Node.js or Git installation is required beforehand.
5. If cloud access fails, ensure Atlas Network Access allows this Windows machine's public IP, then reopen the app. If installation fails, use the setup log path printed by the script. Keep the window open until setup completes.

## Automatic Windows updates

Install the latest **DSP-Fieldguide-Setup.exe** from [Releases](https://github.com/cicatellid13/dyson/releases/latest) once to upgrade older installations that do not include an updater. Close the existing app first, then run the installer using the same Windows account. Your existing workspace and `%APPDATA%\dsp-wiki-desktop\.env` are preserved; do not uninstall or delete application data.

After this upgrade, the app checks for new stable releases at startup and every four hours, downloads them in the background, and installs them when you normally close the app. Open it again to use the new version. Offline checks retry automatically. The small version label below Dark Fog identifies the running release.

Pushing to `main` runs the Windows build/tests and publishes an update automatically. CI uses the version in `package.json` for a new release series (currently `1.2.0`), then increments the patch above the highest published release in that series. The installer and visible version always match. Installer, blockmap and `latest.yml` are uploaded to a draft before publishing; failed builds do not publish an update. The repository must be **public** for credential-free downloads. No GitHub token is stored on users' machines. These automatic updates currently target Windows x64 (including supported Windows ARM x64 emulation); Mac builds remain manually updated.

Installers are currently unsigned; Windows may show its usual unknown-publisher notice during initial setup. Update downloads use HTTPS and the release manifest's SHA-512 integrity check. Keep GitHub publishing access restricted to trusted maintainers.

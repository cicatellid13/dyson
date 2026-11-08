# DSP Toolkit

An unofficial desktop companion for **Dyson Sphere Program**, for macOS and Windows. Browse the offline item catalog, calculate factory requirements, plan planetary logistics, and keep notes and to-dos in one shared workspace.

## What is included

- **Item library:** searchable list and game-style grid, collapsible categories, Dark Fog filtering, local item icons, wiki overviews with clickable references, alternate recipes, quantity scaling, and expandable ingredient recipes.
- **Favorites:** star items from the catalog, drag items into Favorites, reorder them, and filter your saved items.
- **Factory Planner:** choose a recipe, production facility, belt, sorter and reach. Use **Target output** or **Maximize capacity**, optionally limiting each item to one belt. View machine counts, input/output rates and transport requirements. Equipment preferences survive restarts; unsaved planner state lasts for the session.
- **Saved factories:** save named plans to planets, reopen or rename them, inspect equipment details, and view a single factory or combined requirements. Add required inputs and outputs directly to the planet’s imports and exports.
- **Logistics Network:** organize planets under systems; record planet types, specializations and notes; select multiple destination/source planets grouped by system; create matching routes; inspect mismatches; and visualize planet-to-planet connections. Folders, selections and expansion state are remembered during the session.
- **Planning:** folders, scratch notes, automatic saving, drag reordering, and typed to-dos (import, export, production, power, issue and other), with filters and removal of completed tasks.
- **Find in network:** locate an item in planetary imports, exports and saved-factory inputs/outputs, with grouped results and direct navigation. Select suppliers from an import entry using the existing matching-route flow.
- **Undo removal:** restore the most recent planet, note, factory, route or favorite removal during the session, without rolling back unrelated edits. No history log is retained.
- **Shared storage:** local recovery plus MongoDB synchronization for your workspace and reference catalog. Database access stays in the Electron backend.

The proposed recursive **full production-chain factory planner is not implemented**. The existing expandable recipe reference and single-stage Factory Planner are separate features.

## Run from source

Use Node.js 22. Copy `.env.example` to `.env` and supply your MongoDB connection configuration. Never commit credentials.

```sh
npm ci
npm run dev
```

Development uses port **5199** and launches Electron. First initialization needs MongoDB access. After initialization, the catalog and workspace are cached locally; bundled images and browsing do not require wiki API requests.

## Build and verify

```sh
npm run typecheck
npm test
npm run build:dir # unpacked native app in release/
npm run build     # native installer/archive
```

Build on the target operating system. The Mac app is `release/mac-arm64/DSP Toolkit.app` on Apple Silicon. Windows produces `release/DSP-Toolkit-Setup.exe`. Tests cover catalog integrity, recipe calculations, logistics linking, workspace merging, saved factories, and updater behavior. The build runs type checking and tests before packaging.

The supplied app artwork is configured in `build/icons/`; the sidebar uses a transparent logo in `public/art/`. Product branding is **DSP Toolkit**. The internal package name, app ID, database name and storage locations remain stable to preserve existing installations’ data.

## Installation and configuration

Download the Windows installer from [the latest release](https://github.com/cicatellid13/dyson/releases/latest). Install under the same Windows account as before; do not uninstall or delete application data to upgrade. Existing MongoDB configuration is retained.

For a first installation, create a `.env` using the fields in `.env.example` at:

- Windows: `%APPDATA%\dsp-wiki-desktop\.env`
- macOS: `~/Library/Application Support/dsp-wiki-desktop/.env`

Configure the same MongoDB database on each machine and allow each machine’s IP in your Atlas network settings. No local MongoDB server is needed. This is a trusted, single-workspace desktop app, with no user accounts or per-user isolation. Sharing a database means sharing its workspace.

Alternatively, download the repository source and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\Downloads\dyson-main\scripts\install-windows.ps1"
```

The setup script obtains checksum-verified Node.js build tools, installs locked dependencies, builds and installs the app, and prompts for the MongoDB URI using hidden input. When run from the downloaded source it uses that copy; otherwise it can obtain the repository. Setup logs are stored under `%LOCALAPPDATA%\DSP-Toolkit-Setup`. The execution-policy override applies only to this PowerShell process.

## Application updates

### Windows

- **At startup and every four hours:** check for a stable release without downloading or installing it. A small update icon beside the version highlights when a newer release is available.
- **On demand:** click the icon to check. Choose **Update** to download, save pending workspace changes, and open the installer visibly; choose **Later** to keep working. Cached downloads can be reused by the updater.
- Updates do not install automatically on startup or quit. Failed checks/downloads show an error with retry and a release-download fallback. Windows can still ask for permission to run the installer.
- Development builds do not run the updater. The Mac button explains the manual rebuild requirement; Windows installers are not offered as Mac updates.

Pushing to `main` automatically runs the Windows build and publishes a release. CI uses the source version if it is newer than published releases; otherwise it increments the patch in the current release series. The installer, blockmap and `latest.yml` are uploaded to a draft before publication. Failed builds do not publish incomplete updates. The public repository allows credential-free update downloads. Installers are unsigned and may trigger Windows reputation warnings.

### macOS

The current Mac build is unsigned and **does not download or install app updates automatically**. Local updates are handled by rebuilding, reopening, and verifying the app. Quit it before replacing packaged files, preserve its data directory, and use the published Windows version for the corresponding Mac build. A signed distribution would require a separate signing and update setup.

## Workspace storage and synchronization

The backend creates `dsp_fieldguide.wiki_catalog` and `dsp_fieldguide.workspace` programmatically. `npm run db:seed` seeds the bundled catalog without overwriting an existing catalog or workspace. Initial migration imports the profile’s legacy data only if no shared workspace exists; later devices load the shared workspace. Local recovery and migration backups are retained.

Changes save locally and synchronize after a 750 ms pause. Revision checks protect against overwrites: independent changes merge, while conflicting changes offer a resolution choice and retain recovery data. Other-device changes are checked every 30 seconds and on window focus. Offline changes retry when connectivity returns. Secrets are excluded from Git and installers.

## Wiki data and calculation limits

The base reference data comes from the [Fandom DSP Wiki](https://dyson-sphere-program.fandom.com/wiki/Dyson_Sphere_Program_Wiki), including recipe data and item overviews. Reviewed additions from [DSP Wiki (dsp-wiki.com)](https://dsp-wiki.com/Items) supplement this snapshot with building specifications, logistics guidance, proliferation reference facts, the missing Crystal Explosive Unit overview, and Holo Beacon / Dark Fog Lens items and recipes. New item and recipe IDs come from the wiki's [game dataset](https://dsp-wiki.com/Module:GameData/protosets.json), version 0.10.35.29104. This is a supplemental snapshot, not a claim that every existing recipe has been refreshed to that version.

In-game descriptions appear first in every item overview. Buildings with verified specifications have a building-details button containing available footprint, speed, power and capacity facts, with a source link. Missing fields are omitted. Item overviews retain their existing text and linked references, with sources for additions. These reference additions do not change Factory Planner calculations.

To refresh local reference data deliberately:

```sh
npm run data:refresh
npm test
```

The importer requires Python 3 and curl, parses declarative Lua without executing it, and caches images. After importing Fandom data and overviews, it reapplies the reviewed additions in `scripts/data/dsp-wiki-supplement.json` using `scripts/apply-wiki-supplement.py`; this step needs no network access. It preserves upstream definitions of supplemental recipes and technologies if a future base import already includes them. Review and update the supplement deliberately when the wiki changes; it is not scraped at app startup. Rebuild to distribute refreshed assets. A newer bundled snapshot advances the local reference cache and, when reachable, the shared MongoDB catalog without replacing workspace data. Older snapshots cannot downgrade it.

Recipe-reference quantities use whole crafting batches; fractionation displays expected yields. Expandable reference chains use the first listed ingredient recipe, stop at cycles/depth limits, and do not reuse byproducts across branches.

Factory Planner is a single-stage rate estimate, not a tile-verified blueprint. It accounts for supported facility speeds, belt/sorter rates and reach under its connection budget. It assumes full power and continuous inputs; proliferation, stacking, pile sorters, fractionation and recycling-loop optimization are not modeled. Combined saved-factory requirements are gross totals, not netted planet-wide balances.

Specifications and implementation notes are in [docs/SPEC.md](docs/SPEC.md).

## Attribution

Wiki text and data © DSP Wiki contributors under the applicable [Fandom content license](https://www.fandom.com/licensing). Game names and artwork belong to their rights holders, Youthcat Studio / Gamera Games. DSP Toolkit is an unofficial companion app.

Supplemental material from [dsp-wiki.com contributors](https://dsp-wiki.com/) is available under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/), unless otherwise noted on the source page. We extracted and relabeled specification fields, adapted summaries into shorter guidance, resolved item references, and converted selected item/recipe records for this catalog. These adaptations remain under CC BY-SA 4.0; the app's code license does not replace third-party content licenses. Exact source URLs and retrieval dates are retained in the [reviewed supplement](scripts/data/dsp-wiki-supplement.json) and bundled catalog. The new item icons depict game artwork and remain subject to their rights holders.

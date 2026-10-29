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

- **At startup:** check for a stable release before opening the editing workspace. If an update is found, show “Updating to version …” with an OK button; the notice dismisses after five seconds. The app downloads, installs and relaunches automatically when this finishes within the startup window.
- **Startup timeout:** after 30 seconds the workspace opens rather than blocking indefinitely. A late download does not restart an active session; installation is deferred until quit.
- **While open:** check every four hours and download available updates in the background. Do not interrupt editing. A downloaded update installs when the app quits; the next launch uses the new version. The five-second notice is for the startup flow, not a background-release announcement.
- Offline or failed checks are retried. Development builds do not run the updater.

Pushing to `main` automatically runs the Windows build and publishes a release. CI uses the source version if it is newer than published releases; otherwise it increments the patch in the current release series. The installer, blockmap and `latest.yml` are uploaded to a draft before publication. Failed builds do not publish incomplete updates. The public repository allows credential-free update downloads. Installers are unsigned and may trigger Windows reputation warnings.

### macOS

The current Mac build is unsigned and **does not download or install app updates automatically**. Local updates are handled by rebuilding, reopening, and verifying the app. Quit it before replacing packaged files, preserve its data directory, and use the published Windows version for the corresponding Mac build. A signed distribution would require a separate signing and update setup.

## Workspace storage and synchronization

The backend creates `dsp_fieldguide.wiki_catalog` and `dsp_fieldguide.workspace` programmatically. `npm run db:seed` seeds the bundled catalog without overwriting an existing catalog or workspace. Initial migration imports the profile’s legacy data only if no shared workspace exists; later devices load the shared workspace. Local recovery and migration backups are retained.

Changes save locally and synchronize after a 750 ms pause. Revision checks protect against overwrites: independent changes merge, while conflicting changes offer a resolution choice and retain recovery data. Other-device changes are checked every 30 seconds and on window focus. Offline changes retry when connectivity returns. Secrets are excluded from Git and installers.

## Wiki data and calculation limits

The bundled reference data comes from [DSP Wiki](https://dyson-sphere-program.fandom.com/wiki/Dyson_Sphere_Program_Wiki), including its recipe data and item overviews. Item links open their corresponding wiki page. To refresh local reference data deliberately:

```sh
npm run data:refresh
npm test
```

The importer requires Python 3 and curl, parses declarative Lua without executing it, and caches images. Rebuild to distribute refreshed assets. Updating the bundled snapshot alone does not overwrite the shared MongoDB catalog; that requires an explicit backend catalog migration.

Recipe-reference quantities use whole crafting batches; fractionation displays expected yields. Expandable reference chains use the first listed ingredient recipe, stop at cycles/depth limits, and do not reuse byproducts across branches.

Factory Planner is a single-stage rate estimate, not a tile-verified blueprint. It accounts for supported facility speeds, belt/sorter rates and reach under its connection budget. It assumes full power and continuous inputs; proliferation, stacking, pile sorters, fractionation and recycling-loop optimization are not modeled. Combined saved-factory requirements are gross totals, not netted planet-wide balances.

Specifications and implementation notes are in [docs/SPEC.md](docs/SPEC.md).

## Attribution

Wiki text and data © DSP Wiki contributors under the applicable [Fandom content license](https://www.fandom.com/licensing). Game names and artwork belong to their rights holders, Youthcat Studio / Gamera Games. DSP Toolkit is an unofficial companion app.

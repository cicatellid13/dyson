# DSP Fieldguide — Offline recipe reference

## User outcome
Find an item, see exactly what builds it, and follow ingredients through their production chain without an internet connection.

## Data contract
Bundle a versioned snapshot of the Fandom Module:Recipe/Data and local image files (PNG/WebP/JPEG). Catalog is imported into the application bundle, avoiding even a file:// JSON fetch. No runtime wiki calls. Preserve source revision and date. Refresh is an explicit maintainer action using `python3 scripts/import-wiki.py`; failures must not replace the catalog. Wiki content attribution is visible in-app.

## Acceptance criteria
- First launch offline shows all enabled items and buildings, with bundled icons.
- Search by name/description and category filters run locally.
- Selecting an item shows description, stack size, recipes, exact input/output quantities, crafting time, facility and unlock technology.
- Multiple-output and alternate recipes are visible, without confusing byproducts with required inputs.
- Required input clicks expand/collapse recipes inline, recursively, without leaving the selected building/item. Nested quantities scale with the target, alternate recipes can be selected per branch, and circular chains stop with an explanation. Output/facility/used-in links still navigate; back restores the prior item.
- Quantity scales whole crafting batches, showing actual output and ingredients.
- Expandable production tree uses default recipes, clearly indicates its assumptions, and stops cycles.
- Used-in list and favorites work locally; favorites persist across restarts.
- macOS and Windows use Electron with isolated, sandboxed renderer. Only validated HTTP(S) source links open externally.
- Build/typecheck and catalog consistency checks pass; test local navigation and offline image loading.

## Scope
Recipe reference, not a factory throughput optimizer or a full offline wiki mirror. Recipe times are base values; production speeds and proliferator bonuses are not applied. Extraction sources are displayed for non-crafted resources.

## Defense item presentation
Turrets, defense buildings, ammunition, combat drones/ships, and combustible/explosive units are desaturated and muted in every item presentation, including favorites, input expansions, outputs, and production chains. They retain mouse and keyboard interaction. Shared industrial ingredients and Dark Fog materials retain normal styling.

Catalog lists (All items, every category, Favorites, and filtered search results) place muted defense items after other items, with alphabetical ordering within each group.

## Design workspace
- Design appears directly below Favorites.
- Create named standalone planets or systems. Systems can contain multiple named planets (one level deep).
- Every system and planet independently stores editable notes and import/export item lists.
- Trade entries have a catalog item, optional nonnegative amount, unit (items/min, items/s, items), and optional source/destination label. Add/edit/remove entries locally.
- Gray defense items retain their styling in trade entries and sort last in item choices and lists.
- Changes save immediately on this device and survive workspace changes and restarts. Failed writes show an explicit warning and retry; unreadable existing data is preserved.
- Section deletion requires inline confirmation, includes child planets for a system, and offers Undo.
- Verify hierarchy persistence, independent notes/lists, quantity edits, child creation, removal/undo, and switching back to the item library.

Import/export item pickers use custom dark menus with item names on the left and local icons on the right. Search, mouse selection, arrow-key navigation, Enter, Escape, outside-focus dismissal, and gray-last ordering are supported.

### Trade route planet selection
- To/From use two dark selectors: system, then a planet in that system. Only existing planets can be selected; standalone planets appear under “Standalone planets”. Empty systems explain that no planets exist yet.
- Store a planet ID so renaming a planet or system keeps routes connected. Switching systems clears the selected planet. Deleted planets show an unresolved-route message rather than silently pointing elsewhere.
- Preserve previous free-text destinations as a read-only migration hint until a created planet is selected. Routes remain optional.

### System-first planet creation
- The global creation action is + System. Planets can only be created from an existing system's + Add planet action.
- Display the planet name form inside that system's planet section, explicitly naming the parent system. After creation, open the planet and show it nested beneath its system. Navigation cancels an unfinished creation form.
- Validate that the parent is an existing system before adding a planet. Existing standalone planets remain readable under “Needs a system”, with a system assignment selector preserving IDs, notes, and routes.

### Contextual sidebar planet creation
- Selecting a system or one of its planets shows the current system in the sidebar and enables + Planet there.
- Sidebar + Planet opens a sidebar form explicitly showing “Adding to [system]”. The parent is automatically the selected planet's system (or the selected system), never the planet itself.
- System-page + Add planet retains its inline form. Only one creation form is shown at a time; navigation dismisses it. Creation opens the new planet, nested under its system, with the current-system indicator retained.
- With no current system (including legacy unassigned planets), sidebar planet creation is unavailable.

### Planet card trade previews
- System planet cards show every import and export entry, replacing numeric counts. Imports display icon + item name + right arrow; exports display left arrow + item name + icon.
- Label each list Imports/Exports and show None for empty lists. Use bundled item icons. Defense entries remain gray, clickable through the planet card, and sorted last within each list.
- Cards grow to show all entries, wrap long names, and still open their planet when clicked.
- Trade card layout refinement: both lists, labels, icons, and item names align left. Arrow badges sit on the right for both lists: blue right-pointing imports and green left-pointing exports, with SVG double chevrons, motion trails, and a subtle glow.

- Selected arrow style: Heavy industrial, a bold single arrow without a badge, glow, or trails. Blue imports point left; green exports point right. Both remain at the right edge, with item names and icons aligned left. This supersedes previous arrow direction and styling specifications.

### Per-planet card filters
- Each planet card in a system has independent Trade (All trades / Imports / Exports) and Item filters; combine them to filter the displayed rows without changing saved trade data.
- Item choices contain only unique IDs currently imported or exported by that planet, sorted by name with defense items last. Keep both directions in the item choices so a selected direction can clearly report no matches.
- Offer Clear filters, disable the item selector for planets without trades, and safely fall back to All items if a selected item no longer exists in that planet's lists.
- Use an explicit Open planet header button, keeping filter controls separate from navigation. Preserve left-aligned item icons and names and right-side blue import / green export arrows.

### Logistics bubble filters
- Replace the Logistics dropdown with blue left-arrow Imports and green right-arrow Exports circular toggle buttons using the Heavy industrial arrows.
- Initially neither is pressed and both trade lists appear. Clicking one highlights it and filters to that direction; clicking it again clears the direction filter. Clicking the other switches direction. Clear filters resets both buttons and the item choice.
- Show an Imports/Exports tooltip on hover or keyboard focus, including the click action. Buttons expose accessible names and pressed states. Item filtering remains independent.

### Dependent item filter
- Planet card Item uses the shared dark searchable ItemPicker, including local icons on the right, keyboard selection, and gray defense items last.
- Options come only from the selected direction's entries, or both lists when neither direction is selected. Changing direction clears an item that is no longer available, retaining a valid selection.
- Empty search means All items. Offer an item-only reset as well as Clear filters. Opening a new direction resets the open menu and keyboard highlight.

### Sidebar symbols and concise tooltips
- Logistics bubble tooltips contain only Imports or Exports.
- Each category below Buildings uses a distinct line icon: crystal, ingots, chip, package, transport arrows, factory, ornament, turret, shield, fog, and matrix. Icons inherit sidebar colors, remain decorative for accessibility, and require no remote assets.

### Dark Fog sidebar preference
- A compact Dark Fog switch sits at the bottom of the main sidebar, below the attribution footer. Default off; persist locally under dsp-dark-fog.
- On shows Turrets, Defense, and Dark Fog categories. Off hides all three and returns to All items if a hidden category was selected.
- This switch changes category visibility only. Items remain available, and existing defense-item grayscale and ordering rules continue to apply.

### Dark Fog visibility throughout the app
- Off excludes combat-only items and Dark Fog category items from the catalog view, favorites, counts, item details, recipes, production chains, facility links, and every logistics list and picker. Recipes requiring excluded items are omitted rather than showing incomplete ingredients.
- On restores items in full color and normal alphabetical order. All items and Favorites counts reflect visible items.
- Hidden favorites and saved logistics entries are preserved. Editing visible logistics entries must not delete hidden entries. Turning off clears hidden item selection/history and transient logistics searches.

## Shared MongoDB workspace (supersedes device-only persistence)
- Database `dsp_fieldguide` is isolated from other databases on the supplied cluster. The backend creates `wiki_catalog` and `workspace` programmatically; their built-in unique `_id` indexes identify the catalog and shared workspace.
- Only Electron main-process backend modules load `.env` or import the MongoDB driver. Renderer IPC is restricted to the app's main frame and validates workspace payloads. Credentials never enter the renderer, repository, logs, or packaged assets.
- First connected launch seeds an immutable catalog snapshot and migrates existing local data only if the shared workspace does not exist. Preserve a separate legacy backup. Subsequent devices load the existing shared workspace. First setup requires MongoDB access; later launches and edits work from the local cache while offline.
- Persist edits to an atomic local recovery file, debounce cloud writes for 750 ms, and update only changed sections/settings in one atomic workspace document. Reuse a small connection pool. Check for remote changes every 30 seconds and on focus; no writes when unchanged.
- Revision compare-and-swap prevents lost updates. Three-way merge combines independent edits, including favorite membership. Conflicting notes, lists, or edit/delete operations require an explicit local/cloud choice and preserve a recovery backup.
- Keep a renderer recovery outbox until backend acknowledgment; recover pending changes on restart. Surface pending, synced, offline, conflict, and save failures accurately.
- Test independent merges, conflicts, deletion, minimal patches, revision retries, offline restart recovery and explicit conflict resolution. Confirm live catalog seeding and workspace migration without modifying unrelated cluster data.

## Planet details and Planning
- Planets have an optional editable type, preserved across local cache, MongoDB sync and restarts. Existing planets remain untyped until edited.
- System and planet Notes start at two rows and grow/shrink with content and available width, including after navigating between planets.
- System planet cards retain readable minimum widths. Item filter choices keep complete names on one line; menus may expand beyond the field within the viewport. Long selected values remain available in the input and its tooltip.
- Import/export headings share the same heavy industrial arrows and blue-import/green-export colors as the system cards.
- Removal confirmation and undo messages name the removed kind: Planet removed or System removed.
- The Dysons Sphere title uses a bundled futuristic display font, available offline.
- Planning is a top-level navigation section directly below Logistics Network. Users can create, rename and delete folders, create/edit/move/delete plain-text notes, and keep notes outside folders. Deletions require confirmation and offer undo. No Save button; use the existing recovery, debounce, conflict and cloud-sync mechanisms.
- Planning data defaults to empty for old workspaces. Store notes/folders by ID in MongoDB and patch only changed records. Concurrent changes to separate notes merge; conflicting note bodies or folder deletion versus editing require resolution. Existing systems, planets, routes and favorites must survive migration.
- Export validation behavior is unchanged (the user withdrew that request).

## App version
- Show a small, muted release version below the Dark Fog toggle at the bottom left. Read the version from package.json at build time so development and installed builds label their own release without a network request.

## Windows automatic updates
- Packaged Windows installations check public GitHub releases on startup and every four hours. Development and Mac builds do not run the Windows updater.
- Download stable newer versions in the background; disallow prereleases/downgrades and concurrent downloads. Failed checks/downloads retry without interrupting workspace use.
- Install on normal app exit, after existing workspace shutdown persistence completes. Never force an active session to restart. Preserve app identity, userData, MongoDB configuration and recovery files.
- Every successful main-branch Windows workflow uses the package.json release version for a new series, then increments the patch above published releases in that series, builds/tests the installer, and stages installer, blockmap and latest.yml in a draft release before publishing atomically. Keep published versions immutable.
- GitHub is a public download source only; no GitHub token or MongoDB credential is bundled. Existing installations need one manual upgrade to receive the updater.

## Responsive banner and Planning navigation
- Galaxy artwork covers the whole title section at every window width, cropping proportionally rather than leaving unused horizontal space.
- Planning folders start collapsed and toggle their children with a disclosure arrow. Creating or moving a note into a folder expands that folder.
- Rename Unfiled notes to Scratch pad. New scratch entries use scratch N, advancing beyond existing numbered titles; preserve existing titles.
- Use outlined folder and document icons. Drag folder rows to reorder folders; drag notes to reorder within their current folder or Scratch pad. Highlight drop targets. Persist numeric ordering per record through validation, local recovery and MongoDB, keeping older records compatible and independent body edits mergeable.

- Scratch pad also starts collapsed, has a disclosure arrow and note count, and expands when creating or moving a scratch into it.

## Logistics Network hierarchy navigation
- Systems start collapsed with a disclosure arrow; clicking a system toggles its planets while opening the system editor. Creating a planet or opening it from a system card expands its parent.
- Drag systems to reorder systems and planets to reorder siblings within the same system. Reordering never reparents a planet. Highlight valid drop targets and retain the current selection.
- Store optional numeric order per section, preserve legacy order until changed, and use the same saved planet order for sidebar rows and system cards. Cloud round trips preserve order and merge independent notes edits.

## Drag required inputs to Favorites
- Required input rows, including nested expanded inputs, can be dragged to the Favorites navigation option or anywhere in its catalog pane while Favorites is selected. Preserve ordinary click-to-expand behavior.
- Highlight both available destinations and the active drop target. Accept only known visible catalog items dragged from this app; ignore unrelated drag payloads. Add without toggling/removing existing favorites or creating duplicates, and show a brief confirmation.
- Keep the current recipe selected. When dropping into an open Favorites pane, clear its search so the added item is visible. Persist through the existing shared favorites mechanism.

- Favorites rows show a small labeled remove icon on the right instead of a star. Removing saves immediately without changing the selected recipe; other catalog rows use their normal navigation chevron.

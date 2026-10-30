# User-controlled updates

The version footer includes a small update icon. Packaged Windows builds check at startup and every four hours. Availability highlights the icon but does not interrupt editing, download, or install. Clicking the icon checks now and opens a themed modal: current, available with Update/Later, checking, progress, or retryable error.

Only explicit Update downloads the release and opens a visible installer with relaunch requested. Renderer writes and backend persistence flush first. Ordinary app quit must never install a cached update. Failures preserve the workspace and offer retry or the public release page. Downloads use electron-updater's verified cache and differential support.

Unsigned Mac builds explain that they require manual rebuilding; development builds do not check or install. No native Mac automatic installation is enabled.

Validation: no automatic download/install; explicit download/save/install ordering and non-silent flags; save/download failure blocks installation; unsupported platforms; failed check recovery; duplicate checks and installs coalesce.

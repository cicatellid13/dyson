# Keep the local Mac app current

- After every future app update, rebuild the user's local Mac app at `release/mac-arm64/DSP Toolkit.app`, reopen it, and verify the displayed version before declaring completion.
- Quit the running app before replacing its packaged files. Preserve userData, .env, local recovery and MongoDB data.
- Use an explicitly requested version when given. Otherwise, after publishing a release, use that release version for the local Mac build so it matches Windows. Set the version before both Vite and Electron packaging; never change only the label.
- Keep the source package.json and package-lock.json versions consistent with the intended local build. Avoid pushing a version-only synchronization change that unnecessarily triggers another automatic release.
- This is an agent-managed local rebuild workflow. Do not claim native Mac automatic downloads are enabled: the unsigned Mac build cannot use the existing signed Squirrel updater.

# UI testing

- Let the user test UI changes. Do not perform UI testing unless explicitly asked to troubleshoot or test it.
- After implementing changes, provide a numbered list of specific UI checks for the user to report as passing or failing.
- Continue running appropriate code checks and builds. Reopening the local Mac app and verifying its displayed version remain required after app changes, as described above.

# Publishing and the local release script

- Only push code or publish a release when the user explicitly asks. App changes still require a local Mac rebuild even when no push is requested.
- When a push/release is requested, use `/Users/dom/dysons-app/.cache/release-mac-and-push.sh "Commit message"` to rebuild the Mac app, commit, push, and reopen the app. Inspect the pending changes first and explicitly stage any intended new source files; the script stages tracked changes itself.
- Keep this release script local to this machine and untracked. Never commit or push it; preserve the `.cache/` ignore rule.
- After the script finishes, verify the displayed Mac version and confirm the Windows release workflow started for the pushed commit. Report its actual status; do not claim the Windows release is complete while it is still building.

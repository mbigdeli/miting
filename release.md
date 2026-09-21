# Releasing Miting

This is the runbook for publishing the Miting desktop application. It records
the release path that is configured in this repository today, not an aspirational
CI/CD setup.

## How releases work today

- Pull requests and pushes to `main` run the quality checks in
  `.github/workflows/ci.yml`. CI does **not** build or publish releases.
- A release is built and published manually from a validated commit on `main`.
- The Tauri desktop application checks this endpoint for updates:

  ```text
  https://github.com/mbigdeli/miting/releases/latest/download/latest.json
  ```

  GitHub's `latest` alias resolves to the latest non-draft, non-prerelease
  release. Publishing a stable GitHub Release with a valid `latest.json` is
  therefore what makes an update available to installed users.
- The current published channel is Windows x86_64. A stable release must ship
  the NSIS installer, its Tauri updater signature, and `latest.json` together.
- The Chrome extension is built separately but bundled into the desktop
  installer. It has its own version and is not currently published through the
  Chrome Web Store.

`v1.0.0` is the reference release: its assets are
`Miting_1.0.0_x64-setup.exe`, `Miting_1.0.0_x64-setup.exe.sig`, and
`latest.json`.

## Version and release policy

Use Semantic Versioning and an annotated Git tag in the form
`vMAJOR.MINOR.PATCH`.

- Increment **PATCH** for compatible fixes, **MINOR** for compatible features,
  and **MAJOR** for breaking changes.
- Build and test candidate versions as GitHub prereleases when a tester
  install is needed. Prereleases do not reach the ordinary in-app updater
  channel because that channel follows GitHub's latest stable release.
- Publish a stable release only from the exact reviewed commit tagged for that
  version. Do not move or reuse a published tag.
- A hotfix is a new patch version and release; do not replace the installer or
  updater manifest on an already-published release.

## Windows stable-release checklist

Perform these steps on a Windows release machine with the project toolchains
installed (Node.js 20, pnpm 10, Rust, and the Windows Tauri build
dependencies). Start from a clean worktree at the reviewed `main` commit.

The repository provides the same commands through Mise and Make. Run
`mise install` once to provision the pinned Node, pnpm, and Rust toolchain;
then use `mise run release-check` and `mise run release-build` for steps 1–6
below. `make release-check` and `make release-build` are equivalent when Mise
is available (or when the required tools are already on `PATH`).

1. Run the normal quality gates before creating a release candidate:

   ```powershell
   cd extension
   npm ci
   npm run typecheck
   npm test

   cd ..\frontend
   pnpm install --no-frozen-lockfile
   pnpm run typecheck
   pnpm test
   ```

2. Choose the next version and update all desktop version sources to exactly
   that bare SemVer value (for example, `1.0.1`):

   - `frontend/package.json`
   - `frontend/src-tauri/tauri.conf.json`
   - `frontend/src-tauri/Cargo.toml`

   When the embedded extension changes, update both `extension/package.json`
   and `extension/manifest.json` to its intended extension version as part of
   the same release commit. The extension version does not have to equal the
   desktop version.

3. Build the extension and make the desktop build fail if it was not bundled:

   ```powershell
   cd extension
   npm run build

   cd ..
   node scripts/sync-extension-dist.mjs --require
   ```

   The synchronization copies `extension/dist` into
   `frontend/src-tauri/resources/extension`, which Tauri includes in the
   installer.

4. Configure signing secrets only in the release environment or repository
   secrets. The Tauri updater requires `TAURI_SIGNING_PRIVATE_KEY` and, when
   applicable, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; these must correspond to
   the public updater key in `tauri.conf.json`. Windows Authenticode signing is
   enabled by setting `DIGICERT_KEYPAIR_ALIAS` and requires DigiCert's `smctl`
   to be authenticated. The Windows signing script verifies the resulting
   signature and fails the build if it is invalid.

5. Build the installer from the repository root:

   ```powershell
   cd frontend
   pnpm tauri:build
   ```

   This command builds the Rust sidecars, includes the already-synced
   extension, and invokes `tauri build`. It also uses the host's detected GPU
   feature unless `TAURI_GPU_FEATURE` is explicitly set. Use the production
   feature choice intended for the release; do not silently change it between
   test and final builds.

6. Inspect the generated release bundle before publishing. `createUpdaterArtifacts`
   is enabled in `tauri.conf.json`; locate the generated installer and matching
   `.sig` file under `target/release/bundle/nsis`. Tauri generates the signed
   updater artifact, but this repository's static GitHub endpoint requires a
   manually assembled `latest.json`. Confirm all of the following:

   - the installer filename and embedded app version are the intended version;
   - the installer has a valid Windows signature when code signing is enabled;
   - the installer is accompanied by the matching Tauri-generated `.sig` file;
   - a clean Windows machine can install and launch the candidate, including
     the bundled extension-install flow.

7. Create `latest.json` next to the release assets. Substitute the selected
   version, release-note text, publication timestamp, and the exact installer
   name; copy the complete contents of the generated `.sig` file into
   `signature` without modification:

   ```json
   {
     "version": "MAJOR.MINOR.PATCH",
     "notes": "Release notes for this version.",
     "pub_date": "YYYY-MM-DDTHH:MM:SSZ",
     "platforms": {
       "windows-x86_64": {
         "signature": "CONTENTS_OF_THE_EXE_SIG_FILE",
         "url": "https://github.com/mbigdeli/miting/releases/download/vMAJOR.MINOR.PATCH/Miting_MAJOR.MINOR.PATCH_x64-setup.exe"
       }
     }
   }
   ```

   Validate the JSON and re-check that its version, URL, and signature match
   the generated artifacts. Never alter the signature itself.

8. Commit the version changes, merge them to `main`, then create and push the
   annotated tag from that exact commit:

   ```powershell
   git tag -a vMAJOR.MINOR.PATCH -m "Miting MAJOR.MINOR.PATCH"
   git push origin vMAJOR.MINOR.PATCH
   ```

9. In GitHub, create a Release from that tag. Start it as a draft (or mark it
   as a prerelease for the candidate channel), upload the installer, installer
   signature, and `latest.json`, and add concise release notes. Verify the
   uploaded filenames and download URLs before publishing. For a stable
   release, clear both **Draft** and **Set as a pre-release** so GitHub exposes
   it through `/releases/latest/download/latest.json`.

10. After publication, download each release asset from GitHub and verify its
   checksum against the local artifact. On a machine with the prior stable
   version installed, run the in-app update check, confirm it discovers the
   new version, install it, relaunch, and confirm the reported version and
   extension-install flow. Also test a fresh installer download.

## Rollback and recovery

If a draft or prerelease is bad, fix it before stable publication. Once a
stable release is public, do not delete or overwrite `latest.json`, the
installer, or its signature: existing clients may be downloading them. Publish
a newer patch release containing the correction instead. If an emergency
withdrawal is unavoidable, first determine the impact on clients already
offered the update and keep the previous stable release assets available.

## Future distribution channels

These channels are not configured or published by this repository today. Add
their build, signing, and publishing automation before calling them supported.

### macOS

Before releasing for macOS, configure an Apple Developer ID Application
certificate, notarization credentials, hardened-runtime entitlements, and
CI-safe secret handling. Produce signed and notarized `.dmg` and updater
artifacts for each supported architecture, validate installation on a clean
Mac, and add the matching `darwin-*` entries to the stable updater manifest.

### Linux

Before releasing for Linux, choose supported architectures and package
channels (the current Tauri targets include Debian and AppImage). Build on the
matching Linux environments, test installation and launch on clean systems,
publish the packages, and add verified updater artifacts for each supported
Linux target. Document any repository, signing-key, or dependency requirements
with the new automation.

### Chrome Web Store

The extension is currently distributed inside the desktop app only. A Chrome
Web Store release needs a Store developer account, a production extension ID,
store credentials held outside the repository, and a separate publish and
review workflow. Build the versioned `extension/dist` package, validate the
archive and permissions, publish it through the Store's staged rollout, and
verify that the released extension pairs with the matching desktop version.

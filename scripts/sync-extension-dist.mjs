#!/usr/bin/env node
// Sync the built companion extension (extension/dist) into the Tauri resource
// tree (frontend/src-tauri/resources/extension) so installers ship it and the
// in-app "Install extension" flow (Settings -> Chrome Extension) can extract it.
//
// Usage: node scripts/sync-extension-dist.mjs [--require]
//   --require  exit 1 when extension/dist is missing (CI release builds).
// Without --require a missing dist only warns: local dev builds keep working,
// the in-app installer reports "not bundled" until the extension is built once.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(repoRoot, 'extension', 'dist');
const dest = path.join(repoRoot, 'frontend', 'src-tauri', 'resources', 'extension');
const strict = process.argv.includes('--require');

if (!fs.existsSync(path.join(src, 'manifest.json'))) {
  const msg = `extension dist not found at ${src} — run "npm run build" in extension/ first`;
  if (strict) {
    console.error(`[sync-extension-dist] ${msg}`);
    process.exit(1);
  }
  console.warn(`[sync-extension-dist] ${msg}; skipping (extension will not be bundled)`);
  process.exit(0);
}

// Content digest (dotfiles like .gitkeep excluded) so unchanged trees are a
// no-op: tauri-build watches every bundled resource file, and rewriting them
// on each run would dirty every incremental `tauri dev`/`tauri build`.
function treeDigest(root) {
  const hash = crypto.createHash('sha1');
  const walk = (dir, rel) => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      const key = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, key);
      } else {
        hash.update(key);
        hash.update(fs.readFileSync(abs));
      }
    }
  };
  walk(root, '');
  return hash.digest('hex');
}

// tauri-build mirrors bundle resources into target/<profile>/resources, and
// only ever ADDS to that mirror. A file deleted from the extension keeps living
// there, so `tauri dev` (which reads the mirror, not this tree) and a bundled
// installer would both still ship the deleted page. Drop any mirror whose
// contents no longer match, and let the next build recreate it.
function dropStaleMirrors() {
  const roots = [process.env.CARGO_TARGET_DIR, path.join(repoRoot, 'target')].filter(Boolean);
  const wanted = treeDigest(src);
  for (const root of roots) {
    for (const profile of ['debug', 'release']) {
      const mirror = path.join(root, profile, 'resources', 'extension');
      if (!fs.existsSync(path.join(mirror, 'manifest.json'))) continue;
      if (treeDigest(mirror) === wanted) continue;
      fs.rmSync(mirror, { recursive: true, force: true });
      console.log(`[sync-extension-dist] dropped stale mirror ${mirror}`);
    }
  }
}

if (fs.existsSync(path.join(dest, 'manifest.json')) && treeDigest(src) === treeDigest(dest)) {
  // The synced tree can be current while a mirror is not — always check.
  dropStaleMirrors();
  console.log('[sync-extension-dist] bundled extension already up to date');
  process.exit(0);
}

// Full refresh; recreate .gitkeep so the folder always exists for tauri.conf's
// bundle.resources entry even on a fresh checkout.
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(path.join(dest, '.gitkeep'), '');
fs.cpSync(src, dest, { recursive: true });

dropStaleMirrors();

const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
console.log(
  `[sync-extension-dist] bundled extension v${manifest.version} -> ${path.relative(repoRoot, dest)}`
);

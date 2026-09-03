#!/usr/bin/env node
/**
 * Build the sidecar executables Tauri expects in `frontend/src-tauri/binaries/`.
 *
 * `tauri.conf.json` declares them under `externalBin`, and Tauri's build script
 * refuses to run unless every one exists. They are gitignored build output, so
 * a fresh clone has the sources but none of the binaries and the build fails
 * before it starts. `build/ffmpeg.rs` already downloads the fourth (ffmpeg);
 * this covers the three built from this repo.
 *
 * Usage: node scripts/build-sidecars.mjs [--release]
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = process.argv.includes('--release');
const profile = release ? 'release' : 'debug';

/** Crate directory -> the binary name its Cargo.toml produces. */
const SIDECARS = [
  { crate: 'llama-helper', bin: 'llama-helper' },
  // The crate directory and its [[bin]] name deliberately differ.
  { crate: 'pairing-host', bin: 'miting-pairing-host' },
  // Not a workspace member, so it needs its own manifest path.
  { crate: 'shenava-helper', bin: 'shenava-helper' },
];

const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });

/** e.g. x86_64-pc-windows-msvc — Tauri wants it in every sidecar filename. */
function hostTriple() {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const match = out.match(/^host:\s*(\S+)$/m);
  if (!match) throw new Error('could not read host triple from `rustc -vV`');
  return match[1];
}

const triple = hostTriple();
const ext = process.platform === 'win32' ? '.exe' : '';
const outDir = join(root, 'frontend', 'src-tauri', 'binaries');
mkdirSync(outDir, { recursive: true });

for (const { crate, bin } of SIDECARS) {
  const manifest = join(root, crate, 'Cargo.toml');
  console.log(`building ${bin} (${profile})`);
  run('cargo', [
    'build',
    ...(release ? ['--release'] : []),
    '--manifest-path',
    manifest,
    '--bin',
    bin,
  ]);

  // Workspace members share the root target dir; shenava-helper has its own.
  const candidates = [
    join(root, 'target', profile, `${bin}${ext}`),
    join(root, crate, 'target', profile, `${bin}${ext}`),
  ];
  const built = candidates.find((p) => {
    try {
      copyFileSync(p, join(outDir, `${bin}-${triple}${ext}`));
      return true;
    } catch {
      return false;
    }
  });
  if (!built) throw new Error(`${bin} built but was not found in ${candidates.join(' or ')}`);
  console.log(`  -> binaries/${bin}-${triple}${ext}`);
}

console.log(`\n${SIDECARS.length} sidecars ready in frontend/src-tauri/binaries/`);

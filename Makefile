# Make task aliases. When Mise is available, every command uses the pinned
# toolchain from mise.toml; otherwise the required tools must be on PATH.

MISE := $(shell command -v mise 2>/dev/null)
ifdef MISE
RUN := mise exec --
else
RUN :=
endif

.DEFAULT_GOAL := help

.PHONY: help setup install dev tauri-dev \
	build-frontend build-extension build-sidecars build-sidecars-release sync-extension build-tauri release-build \
	typecheck typecheck-frontend typecheck-extension test test-frontend test-extension test-rust release-check \
	e2e-extension fmt fmt-check clippy check-file-length ci

help:
	@printf '%s\n' \
		'Usage: make <target>' \
		'' \
		'Setup' \
		'  setup                  Install Mise-managed tools and JavaScript dependencies' \
		'  install                Install frontend and extension dependencies' \
		'' \
		'Development' \
		'  dev                    Run Next.js on :3118' \
		'  tauri-dev              Run the Tauri app with auto GPU detection' \
		'' \
		'Build' \
		'  build-frontend         Build Next.js' \
		'  build-extension        Build the companion extension' \
		'  build-sidecars         Build debug sidecars' \
		'  build-sidecars-release Build release sidecars' \
		'  sync-extension         Copy extension output into Tauri resources' \
		'  build-tauri            Build the Tauri installer' \
		'  release-build          Install, bundle the extension, and build release installers' \
		'' \
		'Checks' \
		'  typecheck              Type-check frontend and extension' \
		'  test                   Run frontend, extension, and Rust unit tests' \
		'  release-check          Run type checks and tests for a release' \
		'  e2e-extension          Run extension Playwright tests' \
		'  fmt / fmt-check        Format or check Rust formatting' \
		'  clippy                 Run Clippy with warnings denied' \
		'  check-file-length      Run the pull-request file-length check' \
		'  ci                     Run local CI-equivalent checks' \
		'' \
		'Use `mise run <task>` for the same tasks. Without Mise, tools must be on PATH.'

setup:
ifdef MISE
	mise install
endif
	$(MAKE) install

install:
	$(RUN) pnpm --dir frontend install --no-frozen-lockfile
	$(RUN) npm ci --prefix extension

dev:
	$(RUN) pnpm --dir frontend run dev

tauri-dev:
	$(RUN) pnpm --dir frontend run tauri:dev

build-frontend:
	$(RUN) pnpm --dir frontend run build

build-extension:
	$(RUN) npm --prefix extension run build

build-sidecars:
	$(RUN) node scripts/build-sidecars.mjs

build-sidecars-release:
	$(RUN) node scripts/build-sidecars.mjs --release

sync-extension:
	$(RUN) node scripts/sync-extension-dist.mjs

build-tauri:
	$(RUN) pnpm --dir frontend run tauri:build

release-build: install
	$(MAKE) build-extension
	$(RUN) node scripts/sync-extension-dist.mjs --require
	$(MAKE) build-tauri

typecheck-frontend:
	$(RUN) pnpm --dir frontend run typecheck

typecheck-extension:
	$(RUN) npm --prefix extension run typecheck

typecheck: typecheck-frontend typecheck-extension

test-frontend:
	$(RUN) pnpm --dir frontend run test

test-extension:
	$(RUN) npm --prefix extension test

test-rust:
	$(RUN) cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib -- --skip audio:: --skip whisper --skip parakeet

test: test-frontend test-extension test-rust

release-check: typecheck test

e2e-extension:
	$(RUN) npm --prefix extension run e2e

fmt:
	$(RUN) cargo fmt --all

fmt-check:
	$(RUN) cargo fmt --all --check

clippy:
	$(RUN) cargo clippy --manifest-path frontend/src-tauri/Cargo.toml --lib -- -D warnings

check-file-length:
	$(RUN) node scripts/check-file-length.mjs

ci: typecheck test check-file-length

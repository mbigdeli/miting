# Third-Party Notices

Miting's own source code is licensed under the MIT License (see `LICENSE.md`).
The components below ship alongside it under their own terms.

## FFmpeg (bundled executable)

Miting bundles `ffmpeg` and runs it as a **separate process**; no FFmpeg code is
linked into the application binary.

The bundled Windows build is `8.0.1-essentials_build-www.gyan.dev`, configured
with `--enable-gpl --enable-version3`, and is therefore distributed under the
**GNU General Public License version 3 or later**. That license covers the
FFmpeg executable only. Its source is available from <https://ffmpeg.org/> and
from the build publisher at <https://www.gyan.dev/ffmpeg/builds/>.

FFmpeg is a trademark of Fabrice Bellard. See <https://ffmpeg.org/legal.html>.

## whisper.cpp (via whisper-rs)

Speech recognition uses the `whisper-rs` bindings to whisper.cpp, both under the
MIT License. Whisper model weights are downloaded by the user at runtime and are
licensed by their respective publishers.

## Shenava model weights

The optional Shenava v1.0 Persian speech model is licensed separately by its
author and is not covered by this project's license. It is downloaded by the
user at runtime and is not redistributed here.

## Vazirmatn

The Vazirmatn typeface is used for Persian text under the SIL Open Font License.

## Rust and npm dependencies

Remaining dependencies are listed in `frontend/src-tauri/Cargo.toml` and
`frontend/package.json`, and are used under their published licenses.

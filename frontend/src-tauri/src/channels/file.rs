//! `channels.bin`: a 6-byte header (`MTCA`, a version byte, a reserved byte;
//! version 1 means 100 ms frames) followed by two bytes per frame, mic then
//! system, each `(dB + 100) * 2` clamped to 0..=200. An hour is about 72 KB.

use std::io;
use std::path::Path;

use super::activity::SILENCE_DB;
use super::Levels;

const MAGIC: &[u8; 4] = b"MTCA";
const VERSION: u8 = 1;
const HEADER_LEN: usize = 6;

pub fn save(path: &Path, levels: &[Levels]) -> io::Result<()> {
    std::fs::write(path, encode(levels))
}

/// `Ok(None)` when the meeting has no file (older recordings, imports).
pub fn load(path: &Path) -> io::Result<Option<Vec<Levels>>> {
    match std::fs::read(path) {
        Ok(bytes) => decode(&bytes).map(Some),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

#[must_use]
pub fn encode(levels: &[Levels]) -> Vec<u8> {
    let mut out = Vec::with_capacity(HEADER_LEN + levels.len() * 2);
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.push(0);
    for l in levels {
        out.push(quantize(l.mic_db));
        out.push(quantize(l.sys_db));
    }
    out
}

pub fn decode(bytes: &[u8]) -> io::Result<Vec<Levels>> {
    let bad = |what: &str| io::Error::new(io::ErrorKind::InvalidData, what.to_string());
    if bytes.len() < HEADER_LEN || &bytes[..4] != MAGIC {
        return Err(bad("not a channels file"));
    }
    if bytes[4] != VERSION {
        return Err(bad("unsupported channels file version"));
    }
    Ok(bytes[HEADER_LEN..]
        .chunks_exact(2)
        .map(|p| Levels {
            mic_db: dequantize(p[0]),
            sys_db: dequantize(p[1]),
        })
        .collect())
}

fn quantize(db: f32) -> u8 {
    ((db - SILENCE_DB) * 2.0).round().clamp(0.0, 200.0) as u8
}

fn dequantize(q: u8) -> f32 {
    f32::from(q) / 2.0 + SILENCE_DB
}

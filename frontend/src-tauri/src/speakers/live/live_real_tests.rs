//! Live pass vs. full pass on a real recording: time, and how often the two
//! agree on who is speaking. Run locally:
//! `MITING_DIARIZE_WAV=path/audio.mp4 cargo test live_vs_full -- --ignored --nocapture`
//! (`MITING_MODELS_DIR` defaults to a temp folder; models download once).

use std::path::PathBuf;
use std::time::Instant;

use crate::diarize_engine::cleanup::clean_turns;
use crate::diarize_engine::engine::diarize;
use crate::diarize_engine::runner::{half_the_cores, limit_threads, Runner};
use crate::diarize_engine::{SpeakerTurn, TARGET_SAMPLE_RATE};

use super::audio::quiet_cut;
use super::chunk::{process, ChunkTools};
use super::registry::Registry;
use super::result::{to_raw, LiveTurn};
use super::voiceprint::Voiceprints;
use super::worker::CHUNK_SECS;

fn frames(turns: &[SpeakerTurn], len: usize) -> Vec<Option<usize>> {
    let mut out = vec![None; len];
    for t in turns {
        let (a, b) = (
            (t.start * 10.0) as usize,
            ((t.end * 10.0) as usize).min(len),
        );
        out[a.min(len)..b]
            .iter_mut()
            .for_each(|f| *f = Some(t.speaker));
    }
    out
}

/// Share of jointly labelled frames that agree under the best greedy mapping.
fn agreement(a: &[Option<usize>], b: &[Option<usize>]) -> f64 {
    let mut counts = std::collections::HashMap::<(usize, usize), usize>::new();
    let mut both = 0;
    for (x, y) in a.iter().zip(b) {
        if let (Some(x), Some(y)) = (x, y) {
            *counts.entry((*x, *y)).or_default() += 1;
            both += 1;
        }
    }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|p, q| q.1.cmp(&p.1));
    let (mut used_a, mut used_b, mut hit) = (Vec::new(), Vec::new(), 0);
    for ((x, y), n) in pairs {
        if !used_a.contains(&x) && !used_b.contains(&y) {
            used_a.push(x);
            used_b.push(y);
            hit += n;
        }
    }
    hit as f64 / both.max(1) as f64
}

#[test]
#[ignore = "needs a local recording and the speaker models"]
fn live_vs_full() {
    let path = std::env::var("MITING_DIARIZE_WAV").expect("set MITING_DIARIZE_WAV");
    let models = std::env::var("MITING_MODELS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("miting-diarize-test"));
    let decoded = crate::audio::decoder::decode_audio_file(std::path::Path::new(&path)).unwrap();
    let samples = decoded.to_whisper_format();
    let secs = samples.len() as f64 / f64::from(TARGET_SAMPLE_RATE);
    println!("audio: {:.1} min", secs / 60.0);

    let t = Instant::now();
    let full = diarize(&samples, &models, None).unwrap();
    println!(
        "full pass ({} threads): {:.1}s",
        half_the_cores(),
        t.elapsed().as_secs_f64()
    );

    let runner = Runner::load(&models, 1).unwrap();
    let prints = Voiceprints::load(&models).unwrap();
    let tools = ChunkTools {
        runner: &runner,
        prints: &prints,
    };
    let (mut reg, mut turns, mut offset, mut rest) =
        (Registry::default(), Vec::new(), 0.0, &samples[..]);
    let chunk = CHUNK_SECS * TARGET_SAMPLE_RATE as usize;
    while !rest.is_empty() {
        let last = rest.len() <= chunk;
        limit_threads(if last { half_the_cores() } else { 2 });
        let cut = if last {
            rest.len()
        } else {
            quiet_cut(rest, chunk)
        };
        let t = Instant::now();
        turns.extend(process(&tools, &mut reg, &rest[..cut], offset).unwrap());
        let label = if last { "final" } else { "live" };
        println!(
            "{label} chunk at {:.0}s: {:.1}s",
            offset,
            t.elapsed().as_secs_f64()
        );
        offset += cut as f64 / f64::from(TARGET_SAMPLE_RATE);
        rest = &rest[cut..];
    }
    let root = reg.reconcile();
    let live: Vec<LiveTurn> = turns
        .iter()
        .map(|&(start, end, v)| LiveTurn {
            start,
            end,
            voice: root[v],
            remote: true,
        })
        .collect();
    let live = clean_turns(&to_raw(&live));

    let len = (secs * 10.0) as usize + 1;
    let count = |t: &[SpeakerTurn]| t.iter().map(|x| x.speaker + 1).max().unwrap_or(0);
    println!(
        "speakers: full {}, live {} (registry {}); agreement {:.1}%",
        count(&full),
        count(&live),
        reg.len(),
        agreement(&frames(&full, len), &frames(&live, len)) * 100.0
    );
    assert!(count(&live) >= 1);
}

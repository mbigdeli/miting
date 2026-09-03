// audio/level_capture.rs
//
// Real input-level capture for the "Test mic" check: one cpal stream per
// requested device; each callback stores its block levels into a shared map
// the emit loop drains. Streams are !Send — the caller's thread owns them.

use super::audio_processing::audio_to_mono;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat};
use log::{error, warn};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Per-device (latest block RMS, peak held since last drain).
pub type SharedLevels = Arc<Mutex<HashMap<String, (f32, f32)>>>;

/// RMS + peak of one interleaved sample block, downmixed to mono.
pub fn block_levels(samples: &[f32], channels: u16) -> (f32, f32) {
    if samples.is_empty() {
        return (0.0, 0.0);
    }
    let mono = if channels > 1 {
        audio_to_mono(samples, channels)
    } else {
        samples.to_vec()
    };
    let rms = (mono.iter().map(|&x| x * x).sum::<f32>() / mono.len() as f32).sqrt();
    let peak = mono.iter().map(|&x| x.abs()).fold(0.0, f32::max);
    (rms.min(1.0), peak.min(1.0))
}

fn store(levels: &SharedLevels, name: &str, rms: f32, peak: f32) {
    if let Ok(mut map) = levels.lock() {
        let entry = map.entry(name.to_string()).or_insert((0.0, 0.0));
        entry.0 = rms;
        entry.1 = entry.1.max(peak);
    }
}

/// Open a monitoring stream for every requested input device that exists.
pub fn build_input_streams(device_names: &[String], levels: &SharedLevels) -> Vec<cpal::Stream> {
    let host = cpal::default_host();
    let inputs: Vec<cpal::Device> = host
        .input_devices()
        .map(|devices| devices.collect())
        .unwrap_or_default();
    let mut streams = Vec::new();
    for wanted in device_names {
        let found = inputs
            .iter()
            .find(|device| device.name().map(|name| &name == wanted).unwrap_or(false));
        let Some(device) = found else {
            warn!("Level capture: input device not found: {wanted}");
            continue;
        };
        match build_stream(device, wanted, levels.clone()) {
            Ok(stream) => streams.push(stream),
            Err(e) => warn!("Level capture: could not open {wanted}: {e}"),
        }
    }
    streams
}

fn build_stream(
    device: &cpal::Device,
    name: &str,
    levels: SharedLevels,
) -> anyhow::Result<cpal::Stream> {
    let config = device.default_input_config()?;
    let channels = config.channels();
    let stream_config = config.config();
    let err_fn = |e| error!("Level-capture stream error: {e}");
    let name = name.to_string();
    let stream = match config.sample_format() {
        SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let (rms, peak) = block_levels(data, channels);
                store(&levels, &name, rms, peak);
            },
            err_fn,
            None,
        )?,
        SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                let converted: Vec<f32> = data.iter().map(|&s| s.to_sample()).collect();
                let (rms, peak) = block_levels(&converted, channels);
                store(&levels, &name, rms, peak);
            },
            err_fn,
            None,
        )?,
        SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                let converted: Vec<f32> = data.iter().map(|&s| s.to_sample()).collect();
                let (rms, peak) = block_levels(&converted, channels);
                store(&levels, &name, rms, peak);
            },
            err_fn,
            None,
        )?,
        other => anyhow::bail!("unsupported sample format {other:?}"),
    };
    stream.play()?;
    Ok(stream)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sine_block_has_expected_rms_and_peak() {
        let samples: Vec<f32> = (0..4800)
            .map(|i| 0.5 * (i as f32 * 0.05).sin())
            .collect();
        let (rms, peak) = block_levels(&samples, 1);
        assert!((rms - 0.3535).abs() < 0.01, "rms was {rms}");
        assert!((peak - 0.5).abs() < 0.01, "peak was {peak}");
    }

    #[test]
    fn silence_is_zero_and_empty_is_zero() {
        assert_eq!(block_levels(&[0.0; 960], 1), (0.0, 0.0));
        assert_eq!(block_levels(&[], 2), (0.0, 0.0));
    }

    #[test]
    fn stereo_downmix_averages_channels() {
        // L = 0.8, R = 0.0 interleaved -> mono 0.4 constant.
        let samples: Vec<f32> = (0..1000)
            .map(|i| if i % 2 == 0 { 0.8 } else { 0.0 })
            .collect();
        let (rms, peak) = block_levels(&samples, 2);
        assert!((rms - 0.4).abs() < 0.01, "rms was {rms}");
        assert!((peak - 0.4).abs() < 0.01, "peak was {peak}");
    }
}

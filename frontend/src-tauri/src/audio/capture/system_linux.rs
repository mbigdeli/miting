//! Linux system audio: capture the desktop's sound from a PulseAudio /
//! PipeWire "monitor" source.
//!
//! On Linux every output has a matching monitor source that plays back what
//! the speakers play, and it enumerates as a plain INPUT device — no special
//! loopback API like WASAPI is needed. This used to `bail!` while the device
//! list still advertised "(System Audio)" entries, so the UI promised what
//! the recorder then refused.
//!
//! UNVERIFIED ON REAL HARDWARE: written against cpal's ALSA host with the
//! `pulse` plugin; needs a PulseAudio and a PipeWire box to confirm.

use anyhow::Result;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use futures_channel::mpsc;
use futures_util::StreamExt;
use log::{info, warn};

use super::SystemAudioStream;

fn find_monitor_device(host: &cpal::Host) -> Option<cpal::Device> {
    let devices = host.input_devices().ok()?;
    for device in devices {
        if let Ok(name) = device.name() {
            if name.to_lowercase().contains("monitor") {
                info!("Linux system capture: using monitor source '{name}'");
                return Some(device);
            }
        }
    }
    None
}

pub(super) fn start_monitor_capture() -> Result<SystemAudioStream> {
    info!("Starting monitor-source system capture (Linux)");

    let (tx, rx) = mpsc::unbounded::<Vec<f32>>();
    let (drop_tx, drop_rx) = std::sync::mpsc::channel::<()>();
    let (rate_tx, rate_rx) = std::sync::mpsc::channel::<Result<u32, String>>();

    // A cpal Stream is !Send: build and keep it on its own thread, exactly
    // like the Windows loopback path.
    std::thread::spawn(move || {
        let build = || -> Result<(cpal::Stream, u32)> {
            let host = cpal::default_host();
            let device = find_monitor_device(&host).ok_or_else(|| {
                anyhow::anyhow!(
                    "no monitor source found: is the PulseAudio/PipeWire ALSA plugin installed?"
                )
            })?;
            let supported = device
                .default_input_config()
                .map_err(|e| anyhow::anyhow!("default_input_config failed: {e}"))?;
            let sample_rate = supported.sample_rate().0;
            let sample_format = supported.sample_format();
            let config: cpal::StreamConfig = supported.into();

            let err_fn = |e| warn!("monitor capture stream error: {e}");

            let stream = match sample_format {
                cpal::SampleFormat::F32 => {
                    let tx = tx.clone();
                    device.build_input_stream(
                        &config,
                        move |data: &[f32], _: &cpal::InputCallbackInfo| {
                            let _ = tx.unbounded_send(data.to_vec());
                        },
                        err_fn,
                        None,
                    )
                }
                cpal::SampleFormat::I16 => {
                    let tx = tx.clone();
                    device.build_input_stream(
                        &config,
                        move |data: &[i16], _: &cpal::InputCallbackInfo| {
                            let f: Vec<f32> =
                                data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                            let _ = tx.unbounded_send(f);
                        },
                        err_fn,
                        None,
                    )
                }
                other => {
                    return Err(anyhow::anyhow!("unsupported monitor sample format: {other:?}"))
                }
            }
            .map_err(|e| anyhow::anyhow!("build monitor input stream: {e}"))?;

            stream
                .play()
                .map_err(|e| anyhow::anyhow!("play monitor stream: {e}"))?;
            Ok((stream, sample_rate))
        };

        match build() {
            Ok((stream, sample_rate)) => {
                let _ = rate_tx.send(Ok(sample_rate));
                let _ = drop_rx.recv();
                drop(stream);
                info!("monitor-source capture stopped");
            }
            Err(e) => {
                let _ = rate_tx.send(Err(e.to_string()));
            }
        }
    });

    let sample_rate = rate_rx
        .recv()
        .map_err(|_| anyhow::anyhow!("monitor capture thread exited before init"))?
        .map_err(|e| anyhow::anyhow!("failed to start system capture: {e}"))?;

    let receiver = rx.map(futures_util::stream::iter).flatten();
    info!("monitor-source capture started ({sample_rate} Hz)");

    Ok(SystemAudioStream {
        drop_tx,
        sample_rate,
        receiver: Box::pin(receiver),
    })
}

// audio/simple_level_monitor.rs
//
// "Test mic" level monitoring with REAL capture (see level_capture). cpal
// streams are not Send, so a dedicated OS thread owns them and runs the
// 100 ms emit loop pushing `audio-levels` events to the frontend.

use anyhow::Result;
use log::{error, info};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Runtime};

use super::level_capture::{build_input_streams, SharedLevels};

#[derive(Debug, Serialize, Clone)]
pub struct AudioLevelData {
    pub device_name: String,
    pub device_type: String, // "input" or "output"
    pub rms_level: f32,      // linear 0.0..1.0
    pub peak_level: f32,     // linear 0.0..1.0
    pub is_active: bool,     // above the noise floor
}

#[derive(Debug, Serialize, Clone)]
pub struct AudioLevelUpdate {
    pub timestamp: u64,
    pub levels: Vec<AudioLevelData>,
}

static IS_MONITORING: AtomicBool = AtomicBool::new(false);
/// Bumped per start; a monitor thread exits once the generation moves on.
static GENERATION: AtomicU64 = AtomicU64::new(0);

const NOISE_FLOOR_RMS: f32 = 0.001;

/// Start level monitoring for the named input devices.
pub async fn start_monitoring<R: Runtime>(
    app_handle: AppHandle<R>,
    device_names: Vec<String>,
) -> Result<()> {
    info!("Starting audio level monitoring for devices: {:?}", device_names);
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    IS_MONITORING.store(true, Ordering::SeqCst);
    std::thread::Builder::new()
        .name("miting-level-meter".into())
        .spawn(move || monitor_thread(app_handle, device_names, generation))?;
    Ok(())
}

fn monitor_thread<R: Runtime>(app: AppHandle<R>, device_names: Vec<String>, generation: u64) {
    let levels: SharedLevels = Arc::new(Mutex::new(HashMap::new()));
    let streams = build_input_streams(&device_names, &levels);
    if streams.is_empty() {
        error!("Audio level monitoring: no input stream could be opened");
    }

    while IS_MONITORING.load(Ordering::SeqCst) && GENERATION.load(Ordering::SeqCst) == generation {
        std::thread::sleep(std::time::Duration::from_millis(100));
        let snapshot: Vec<AudioLevelData> = {
            let Ok(mut map) = levels.lock() else { break };
            device_names
                .iter()
                .filter_map(|name| {
                    map.get_mut(name).map(|entry| {
                        let data = AudioLevelData {
                            device_name: name.clone(),
                            device_type: "input".to_string(),
                            rms_level: entry.0,
                            peak_level: entry.1,
                            is_active: entry.0 > NOISE_FLOOR_RMS,
                        };
                        entry.1 = 0.0; // release the peak hold once reported
                        data
                    })
                })
                .collect()
        };
        if snapshot.is_empty() {
            continue;
        }
        let update = AudioLevelUpdate {
            timestamp: now_ms(),
            levels: snapshot,
        };
        if let Err(e) = app.emit("audio-levels", &update) {
            error!("Failed to emit audio levels: {e}");
            break;
        }
    }

    drop(streams);
    info!("Audio level monitoring thread ended");
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Stop audio level monitoring (the thread notices within one tick).
pub async fn stop_monitoring() -> Result<()> {
    info!("Stopping audio level monitoring");
    IS_MONITORING.store(false, Ordering::SeqCst);
    Ok(())
}

/// Check if currently monitoring.
pub fn is_monitoring() -> bool {
    IS_MONITORING.load(Ordering::SeqCst)
}

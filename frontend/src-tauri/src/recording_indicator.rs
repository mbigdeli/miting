//! A slow-blinking red dot on the tray and taskbar while recording.
//!
//! The window can be minimised or behind Chrome for a whole meeting; nothing
//! outside the app said a recording was running. The dot is composited onto
//! the app's own icon at runtime, so no extra image assets have to exist.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::image::Image;
use tauri::{AppHandle, Manager, Runtime};

static BLINKING: AtomicBool = AtomicBool::new(false);

/// Half-period of the blink. Slow on purpose: a presence cue, not an alarm.
const BLINK_MS: u64 = 1200;

/// The app icon with a red dot drawn over its lower-right quarter.
fn with_red_dot(base: &Image<'_>) -> Image<'static> {
    let (w, h) = (base.width() as i64, base.height() as i64);
    let mut rgba = base.rgba().to_vec();
    let r = (w.min(h) as f64) * 0.22;
    let (cx, cy) = (w as f64 - r - 1.0, h as f64 - r - 1.0);
    for y in 0..h {
        for x in 0..w {
            let d = ((x as f64 - cx).powi(2) + (y as f64 - cy).powi(2)).sqrt();
            if d <= r {
                let i = ((y * w + x) * 4) as usize;
                // Soft edge on the outer pixel so the dot is not jagged.
                let a = ((r - d).clamp(0.0, 1.0) * 255.0) as u16;
                let blend = |old: u8, new: u8| -> u8 {
                    ((new as u16 * a + old as u16 * (255 - a)) / 255) as u8
                };
                rgba[i] = blend(rgba[i], 0xdc);
                rgba[i + 1] = blend(rgba[i + 1], 0x36);
                rgba[i + 2] = blend(rgba[i + 2], 0x2e);
                rgba[i + 3] = rgba[i + 3].max(((a * 255) / 255) as u8);
            }
        }
    }
    Image::new_owned(rgba, base.width(), base.height())
}

/// A bare red dot on a transparent square — the taskbar overlay badge.
/// Overlaying the full app icon rendered the icon twice, mini-icon-in-corner.
fn dot_badge(size: u32) -> Image<'static> {
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let r = size as f64 * 0.42;
    let c = size as f64 / 2.0;
    for y in 0..size {
        for x in 0..size {
            let d = ((x as f64 - c).powi(2) + (y as f64 - c).powi(2)).sqrt();
            if d <= r {
                let a = ((r - d).clamp(0.0, 1.0) * 255.0) as u8;
                let i = ((y * size + x) * 4) as usize;
                rgba[i] = 0xdc;
                rgba[i + 1] = 0x36;
                rgba[i + 2] = 0x2e;
                rgba[i + 3] = a.max(if d <= r - 1.0 { 255 } else { a });
            }
        }
    }
    Image::new_owned(rgba, size, size)
}

fn apply<R: Runtime>(app: &AppHandle<R>, dot: bool) {
    let Some(base) = app.default_window_icon().cloned() else {
        return;
    };
    let icon = if dot {
        with_red_dot(&base)
    } else {
        Image::new_owned(base.rgba().to_vec(), base.width(), base.height())
    };
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_icon(Some(icon.clone()));
    }
    // Taskbar: an overlay badge on Windows; harmless no-op elsewhere.
    #[cfg(target_os = "windows")]
    if let Some(window) = app.get_webview_window("main") {
        let overlay = dot.then(|| dot_badge(16));
        let _ = window.set_overlay_icon(overlay);
    }
}

/// Start or stop the indicator. Idempotent; safe to call from any thread.
pub fn set_recording<R: Runtime>(app: &AppHandle<R>, recording: bool) {
    let was = BLINKING.swap(recording, Ordering::SeqCst);
    if was == recording {
        return;
    }
    if !recording {
        apply(app, false);
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut on = true;
        while BLINKING.load(Ordering::SeqCst) {
            apply(&app, on);
            on = !on;
            tokio::time::sleep(std::time::Duration::from_millis(BLINK_MS)).await;
        }
        // One last pass so a stop mid-blink never strands the dot.
        apply(&app, false);
    });
}

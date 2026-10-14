//! Load a meeting's saved recording as 16 kHz mono samples for the diarizer.

use std::path::Path;

use crate::audio::decoder::decode_audio_file;
use crate::audio::retranscription::find_audio_file;

/// Decode the recording inside `folder` (audio.mp4 or any supported file)
/// and resample to 16 kHz mono. Blocking: call from `spawn_blocking`.
pub fn load_meeting_audio(folder: &Path) -> Result<Vec<f32>, String> {
    let path = find_audio_file(folder).map_err(|e| format!("no recording found: {e}"))?;
    let decoded = decode_audio_file(&path).map_err(|e| format!("could not read recording: {e}"))?;
    let samples = decoded.to_whisper_format();
    if samples.is_empty() {
        return Err("the recording is empty".into());
    }
    Ok(samples)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_folder_reports_no_recording() {
        let err = load_meeting_audio(Path::new("definitely/not/a/folder")).unwrap_err();
        assert!(err.contains("no recording"), "{err}");
    }
}

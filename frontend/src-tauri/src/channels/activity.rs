//! Running loudness of the microphone and system channels, one value per
//! 100 ms frame. Fed the aligned windows the pipeline mixes, so frame `i`
//! starts at `i * FRAME_SECS` in the saved recording.

use super::{Levels, FRAME_SECS};

/// Floor for silence, in dBFS.
pub const SILENCE_DB: f32 = -100.0;

#[derive(Debug)]
pub struct ChannelActivity {
    frame_len: usize,
    filled: usize,
    mic_energy: f64,
    sys_energy: f64,
    levels: Vec<Levels>,
}

impl ChannelActivity {
    #[must_use]
    pub fn new(sample_rate: u32) -> Self {
        let frame_len = ((f64::from(sample_rate) * FRAME_SECS) as usize).max(1);
        Self {
            frame_len,
            filled: 0,
            mic_energy: 0.0,
            sys_energy: 0.0,
            levels: Vec::new(),
        }
    }

    /// Add one aligned pair of windows. The shorter one is treated as silent
    /// past its end, the same way the mixer pads it.
    pub fn push(&mut self, mic: &[f32], sys: &[f32]) {
        let len = mic.len().max(sys.len());
        for i in 0..len {
            let m = f64::from(mic.get(i).copied().unwrap_or(0.0));
            let s = f64::from(sys.get(i).copied().unwrap_or(0.0));
            self.mic_energy += m * m;
            self.sys_energy += s * s;
            self.filled += 1;
            if self.filled == self.frame_len {
                self.close_frame();
            }
        }
    }

    /// Levels so far, including a trailing partial frame. Leaves the
    /// accumulator empty so a second call returns nothing new.
    pub fn finish(&mut self) -> Vec<Levels> {
        if self.filled > 0 {
            self.close_frame();
        }
        std::mem::take(&mut self.levels)
    }

    /// Frames closed so far.
    #[must_use]
    pub fn len(&self) -> usize {
        self.levels.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.levels.is_empty()
    }

    fn close_frame(&mut self) {
        let n = self.filled as f64;
        self.levels.push(Levels {
            mic_db: to_db(self.mic_energy / n),
            sys_db: to_db(self.sys_energy / n),
        });
        self.filled = 0;
        self.mic_energy = 0.0;
        self.sys_energy = 0.0;
    }
}

/// Mean-square energy to dBFS, floored at [`SILENCE_DB`].
fn to_db(mean_square: f64) -> f32 {
    if mean_square <= 0.0 {
        return SILENCE_DB;
    }
    ((10.0 * mean_square.log10()) as f32).max(SILENCE_DB)
}

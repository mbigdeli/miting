//! 48 kHz to 16 kHz by averaging each group of three samples. Crude next to a
//! sinc resampler, but the speaker models only look at the band below 8 kHz
//! and this costs one add per sample on the audio thread.

pub const FACTOR: usize = 3;

#[derive(Debug, Default)]
pub struct Downsampler {
    carry: Vec<f32>,
}

impl Downsampler {
    /// Downsample `input`, keeping a leftover of up to two samples for the
    /// next call so window boundaries never drop or duplicate audio.
    pub fn push(&mut self, input: &[f32], out: &mut Vec<f32>) {
        let mut iter = self.carry.drain(..).chain(input.iter().copied());
        let mut group = [0.0f32; FACTOR];
        let mut leftover = Vec::new();
        'outer: loop {
            for (i, slot) in group.iter_mut().enumerate() {
                match iter.next() {
                    Some(x) => *slot = x,
                    None => {
                        leftover.extend_from_slice(&group[..i]);
                        break 'outer;
                    }
                }
            }
            out.push(group.iter().sum::<f32>() / FACTOR as f32);
        }
        drop(iter);
        self.carry = leftover;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn averages_groups_and_carries_the_remainder() {
        let mut d = Downsampler::default();
        let mut out = Vec::new();
        d.push(&[3.0, 3.0, 3.0, 6.0], &mut out);
        assert_eq!(out, vec![3.0]);
        d.push(&[6.0, 6.0], &mut out);
        assert_eq!(out, vec![3.0, 6.0]);
    }

    #[test]
    fn length_is_a_third_across_odd_windows() {
        let mut d = Downsampler::default();
        let mut out = Vec::new();
        for _ in 0..10 {
            d.push(&[0.0; 1000], &mut out);
        }
        assert_eq!(out.len(), 10_000 / FACTOR);
    }
}

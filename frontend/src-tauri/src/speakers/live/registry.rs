//! The voices met so far on one channel, so a speaker found in a later chunk
//! keeps the identity they had in an earlier one. Each voice is the running,
//! talk-time-weighted mean of its voiceprints. Pure logic.

/// Cosine at or above which a chunk voice is the same person as a known one.
pub const MATCH: f32 = 0.5;
/// After the meeting, two known voices this close are folded together: the
/// means are cleaner than any single chunk's print, so this is stricter.
pub const MERGE: f32 = 0.6;

/// A voice found in one chunk: its print (None when it spoke too little to
/// get one) and how long it spoke.
#[derive(Debug, Clone)]
pub struct ChunkVoice {
    pub print: Option<Vec<f32>>,
    pub secs: f64,
}

#[derive(Debug, Default)]
pub struct Registry {
    sums: Vec<Vec<f32>>,
    secs: Vec<f64>,
}

impl Registry {
    pub fn len(&self) -> usize {
        self.sums.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sums.is_empty()
    }

    /// Map each chunk voice to a known voice (or a new one). One chunk voice
    /// per known voice: the diarizer already said they are different people.
    pub fn assign(&mut self, voices: &[ChunkVoice]) -> Vec<usize> {
        let mut pairs: Vec<(f32, usize, usize)> = Vec::new();
        for (c, v) in voices.iter().enumerate() {
            let Some(print) = &v.print else { continue };
            for k in 0..self.len() {
                let sim = cosine(print, &self.sums[k]);
                if sim >= MATCH {
                    pairs.push((sim, c, k));
                }
            }
        }
        pairs.sort_by(|a, b| b.0.total_cmp(&a.0));
        let mut out: Vec<Option<usize>> = vec![None; voices.len()];
        let mut taken = vec![false; self.len()];
        for (_, c, k) in pairs {
            if out[c].is_none() && !taken[k] {
                out[c] = Some(k);
                taken[k] = true;
            }
        }
        voices
            .iter()
            .zip(out)
            .map(|(v, known)| {
                let k = known.unwrap_or_else(|| self.add_empty(v));
                self.absorb(k, v);
                k
            })
            .collect()
    }

    /// Fold voices that turned out to be one person. Returns, for every
    /// voice, the voice it now belongs to (itself when kept).
    pub fn reconcile(&self) -> Vec<usize> {
        let mut parent: Vec<usize> = (0..self.len()).collect();
        for b in 0..self.len() {
            for a in 0..b {
                if parent[a] == a && cosine(&self.sums[a], &self.sums[b]) >= MERGE {
                    parent[b] = a;
                    break;
                }
            }
        }
        (0..self.len()).map(|v| parent[v]).collect()
    }

    fn add_empty(&mut self, v: &ChunkVoice) -> usize {
        let dim = v.print.as_ref().map_or(0, Vec::len);
        self.sums.push(vec![0.0; dim]);
        self.secs.push(0.0);
        self.sums.len() - 1
    }

    fn absorb(&mut self, k: usize, v: &ChunkVoice) {
        if let Some(print) = &v.print {
            let sum = &mut self.sums[k];
            if sum.len() != print.len() {
                *sum = vec![0.0; print.len()];
            }
            let w = v.secs.max(0.1) as f32;
            sum.iter_mut().zip(print).for_each(|(s, p)| *s += p * w);
        }
        self.secs[k] += v.secs;
    }
}

/// Cosine similarity; 0 for empty or mismatched vectors.
#[must_use]
pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let na = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if na == 0.0 || nb == 0.0 {
        0.0
    } else {
        dot / (na * nb)
    }
}

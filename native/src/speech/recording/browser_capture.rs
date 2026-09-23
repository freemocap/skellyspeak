//! Bounded, ordered PCM transport. Detection and publication remain shared.
#[derive(Default)]
pub(super) struct BrowserCapture {
    rate: Option<u32>,
    sequence: u32,
    samples: Vec<f32>,
}
impl BrowserCapture {
    pub fn push(
        &mut self,
        sequence: u32,
        rate: u32,
        samples: Vec<f32>,
    ) -> Result<(), &'static str> {
        if sequence != self.sequence {
            return Err("Microphone audio arrived out of sequence.");
        }
        if !(8000..=96000).contains(&rate) || self.rate.is_some_and(|value| value != rate) {
            return Err("Microphone sample rate changed or is unsupported.");
        }
        if samples.is_empty()
            || samples.len() > 8192
            || samples.iter().any(|v| !v.is_finite() || v.abs() > 1.0)
        {
            return Err("Invalid microphone audio chunk.");
        }
        if self.samples.len() + samples.len() > rate as usize * 2 {
            return Err("Microphone audio delivery fell behind. Listening stopped.");
        }
        self.rate = Some(rate);
        self.sequence += 1;
        self.samples.extend(samples);
        Ok(())
    }
    pub fn drain(&mut self) -> Option<(u32, Vec<f32>)> {
        self.rate
            .map(|rate| (rate, std::mem::take(&mut self.samples)))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_order_and_rejects_gaps_duplicates_rate_changes_and_overflow() {
        let mut capture = BrowserCapture::default();
        assert!(capture.drain().is_none());
        capture.push(0, 8000, vec![0.1; 8000]).unwrap();
        assert!(capture.push(0, 8000, vec![0.2]).is_err());
        assert!(capture.push(2, 8000, vec![0.2]).is_err());
        assert!(capture.push(1, 16000, vec![0.2]).is_err());
        capture.push(1, 8000, vec![0.2; 8000]).unwrap();
        assert!(capture.push(2, 8000, vec![0.3]).is_err());
        let (rate, samples) = capture.drain().unwrap();
        assert_eq!(rate, 8000);
        assert_eq!(samples.len(), 16000);
        assert_eq!(samples[7999], 0.1);
        assert_eq!(samples[8000], 0.2);
        assert!(capture.push(2, 8000, vec![f32::NAN]).is_err());
        capture.push(2, 8000, vec![0.3]).unwrap();
    }
}

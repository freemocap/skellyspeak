//! A single recording's live spectrogram: the analysis a listening run shows,
//! fed from the recording's own samples so Chat and Practice draw the same stream.
use super::browser_capture::BrowserCapture;
use crate::speech::analysis::spectrogram::{LiveAnalysis, LiveSpectrogram};

/// Analysed history kept for the view; the stream shows the last twelve seconds.
const HISTORY_SECONDS: f64 = 12.0;

#[derive(Default)]
pub(super) struct LiveView {
    analysis: Option<LiveAnalysis>,
    /// Ordered copies of browser-captured audio. The recording itself still
    /// arrives whole, as the WAV sent to `mic_transcribe`.
    browser: BrowserCapture,
}
impl LiveView {
    pub fn feed(&mut self, rate: u32, pcm: &[f32]) {
        if pcm.is_empty() {
            return;
        }
        self.analysis
            .get_or_insert_with(|| LiveAnalysis::new(rate, HISTORY_SECONDS))
            .push(pcm);
    }
    /// Accept the next browser chunk in order and analyse it at once, so copies
    /// never queue behind the recording.
    pub fn push_browser(
        &mut self,
        sequence: u32,
        rate: u32,
        samples: Vec<f32>,
    ) -> Result<(), &'static str> {
        self.browser.push(sequence, rate, samples)?;
        let (rate, pcm) = self
            .browser
            .drain()
            .expect("an accepted chunk has a sample rate");
        self.feed(rate, &pcm);
        Ok(())
    }
    /// Frames after `after` seconds, or none before any audio has arrived.
    pub fn snapshot_since(&self, after: Option<f64>) -> Option<LiveSpectrogram> {
        self.analysis
            .as_ref()
            .map(|analysis| analysis.snapshot_since(after))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_copies_are_analysed_in_order_and_gaps_are_refused() {
        let mut view = LiveView::default();
        assert!(view.snapshot_since(None).is_none());
        view.push_browser(0, 16000, vec![0.1; 8000]).unwrap();
        let first = view.snapshot_since(None).unwrap();
        assert!(!first.data.bins.is_empty());
        assert!((first.end_seconds - 0.5).abs() < 1e-9);
        assert!(view.push_browser(2, 16000, vec![0.1; 800]).is_err());
        assert!(view.push_browser(1, 8000, vec![0.1; 800]).is_err());
        view.push_browser(1, 16000, vec![0.1; 8000]).unwrap();
        let last = *first.data.frame_start_seconds.last().unwrap();
        let next = view.snapshot_since(Some(last)).unwrap();
        assert!(!next.data.bins.is_empty());
        assert!(
            next.data
                .frame_start_seconds
                .iter()
                .all(|time| *time > last)
        );
        assert!((next.end_seconds - 1.0).abs() < 1e-9);
    }
}

#[cfg(all(test, desktop))]
mod recording_tests {
    use crate::application::Application;
    use crate::speech::recording::{owner::RecordingOwner, voice};
    #[test]
    fn a_single_recording_reports_each_frame_once_on_its_own_clock() {
        let dir = tempfile::tempdir().unwrap();
        let app = Application::recording_fixture(&dir.path().join("live.sqlite3"));
        let item = {
            let mut store = app.lock().unwrap();
            store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", ["http://127.0.0.1:9/v1"]).unwrap();
            let item = store
                .create_drill_item(crate::drill::DrillItemInput {
                    text: "Hola".into(),
                    language: "spanish".into(),
                    variety: None,
                    explanation: "english".into(),
                    explanation_variety: None,
                })
                .unwrap();
            let session = store.start_drill_session("spanish").unwrap();
            store.enter_drill_visit(&session, &item.id).unwrap();
            item.id
        };
        *app.capture.lock().unwrap() = Some(voice::fixture(
            &app,
            RecordingOwner::DrillItem(item),
            vec![0.1; 8000],
        ));
        let first = voice::live_spectrogram(&app, "continuous-fixture", None)
            .unwrap()
            .unwrap();
        assert!(!first.data.bins.is_empty());
        assert!((first.end_seconds - 1.0).abs() < 1e-9);
        let last = *first.data.frame_start_seconds.last().unwrap();
        let again = voice::live_spectrogram(&app, "continuous-fixture", Some(last))
            .unwrap()
            .unwrap();
        assert!(again.data.bins.is_empty());
        assert!((again.end_seconds - 1.0).abs() < 1e-9);
        assert!(voice::live_spectrogram(&app, "another-recording", None).is_err());
        assert!(voice::live_spectrogram(&app, "continuous-fixture", Some(f64::NAN)).is_err());
    }
}

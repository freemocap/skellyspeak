//! Microphone capture, in the core.
//!
//! The webview cannot do this on every platform. `navigator.mediaDevices`
//! exists only in a secure context, and WKWebView does not treat Tauri's
//! `tauri://localhost` scheme as one — the only mechanism that would is a
//! private Apple API on `WKProcessPool`. So a packaged macOS build has no
//! browser recording API at all. Rather than keep one platform on a different
//! recorder, every desktop platform records here.
//!
//! cpal opens the input device; hound writes the 16-bit WAV that Whisper is
//! sent. Both are held to one code path: there is no software fallback if the
//! device cannot be opened, and no second recorder to try instead.

use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample};
use log::info;

/// Keep every Nth sample for the waveform. The UI draws a scrolling
/// oscilloscope at ~60fps and cannot use 48,000 points a second; one in 64 is
/// about 750/s, which is more than the strip can show.
const WAVE_STRIDE: usize = 64;

/// Cap on the waveform backlog, so a recording nobody is watching cannot grow
/// the buffer without bound.
const WAVE_MAX: usize = 8_192;

/// Longest recording accepted, in seconds. A held button or a stuck auto-stop
/// would otherwise fill memory with audio no one is going to transcribe.
/// Reaching it is an error, not a silent truncation — see [`Capture::finish`].
const MAX_SECONDS: u32 = 120;

#[derive(Default)]
struct Buffers {
    /// Every captured sample, mono, for the WAV.
    pcm: Vec<f32>,
    /// Decimated samples the UI has not drawn yet.
    wave: Vec<f32>,
    /// Set when `pcm` hit [`MAX_SECONDS`]. The recording is no longer complete,
    /// so finishing it must fail rather than hand back a truncated clip.
    overflowed: bool,
    error: Option<String>,
}

/// A recording in progress.
///
/// `cpal::Stream` is not `Send`, so it cannot be parked in shared state. It
/// lives on its own thread instead, which builds it, plays it, and blocks until
/// told to stop — the thread IS the stream's lifetime.
pub struct Capture {
    stop: Sender<()>,
    buffers: Arc<Mutex<Buffers>>,
    sample_rate: u32,
    thread: Option<std::thread::JoinHandle<()>>,
    device_label: String,
}

fn open(name: Option<&str>) -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    match name {
        Some(wanted) => host
            .input_devices()
            .map_err(|e| format!("The system would not list microphones: {e}"))?
            .find(|d| d.name().map(|n| n == wanted).unwrap_or(false))
            .ok_or_else(|| {
                format!(
                    "The microphone \"{wanted}\" is not connected. Pick another one in \
                     Settings, or choose System default."
                )
            }),
        None => host
            .default_input_device()
            .ok_or_else(|| "This computer has no microphone available.".to_string()),
    }
}

/// Mix a frame down to mono and record it.
fn push(buffers: &Arc<Mutex<Buffers>>, mono: &[f32], limit: usize) {
    let mut b = buffers.lock().expect("audio buffers");
    if b.overflowed {
        return;
    }
    if b.pcm.len() + mono.len() > limit {
        b.overflowed = true;
        return;
    }
    let offset = b.pcm.len();
    b.pcm.extend_from_slice(mono);
    // Strided against the running total, not the callback, so the decimation
    // stays even across buffer boundaries.
    let mut i = offset.next_multiple_of(WAVE_STRIDE);
    while i < offset + mono.len() {
        b.wave.push(mono[i - offset]);
        i += WAVE_STRIDE;
    }
    if b.wave.len() > WAVE_MAX {
        let excess = b.wave.len() - WAVE_MAX;
        b.wave.drain(..excess);
    }
}

/// Build the input stream for one sample format.
fn stream_for<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    buffers: Arc<Mutex<Buffers>>,
    limit: usize,
) -> Result<cpal::Stream, cpal::BuildStreamError>
where
    T: cpal::SizedSample + 'static,
    f32: FromSample<T>,
{
    let channels = config.channels as usize;
    let errors = buffers.clone();
    device.build_input_stream(
        config,
        move |data: &[T], _: &cpal::InputCallbackInfo| {
            let mono: Vec<f32> = data
                .chunks(channels)
                .map(|frame| {
                    frame.iter().map(|s| f32::from_sample(*s)).sum::<f32>() / channels as f32
                })
                .collect();
            push(&buffers, &mono, limit);
        },
        move |e| {
            errors.lock().expect("audio buffers").error =
                Some(format!("Microphone stream failed: {e}"));
        },
        None,
    )
}

/// Open the device and start recording.
///
/// Blocks until the stream is actually playing, so a device that cannot be
/// opened fails here — at the moment the user pressed the button — rather than
/// producing an empty recording later.
pub fn start(device_name: Option<&str>) -> Result<Capture, String> {
    let buffers = Arc::new(Mutex::new(Buffers::default()));
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(u32, String), String>>();

    let thread_buffers = buffers.clone();
    let wanted = device_name.map(str::to_string);
    let thread = std::thread::spawn(move || {
        // iOS must configure AVAudioSession before cpal can capture anything;
        // a failure here is reported at the moment the user pressed record.
        #[cfg(target_os = "ios")]
        if let Err(e) = ios_session::prepare() {
            let _ = ready_tx.send(Err(e));
            return;
        }
        let built = (|| -> Result<(cpal::Stream, u32, String), String> {
            let device = open(wanted.as_deref())?;
            let label = device
                .name()
                .map_err(|e| format!("Could not identify microphone: {e}"))?;
            let supported = device
                .default_input_config()
                .map_err(|e| format!("The microphone \"{label}\" would not open: {e}"))?;
            let sample_rate = supported.sample_rate().0;
            let format = supported.sample_format();
            let config: cpal::StreamConfig = supported.into();
            let limit = (sample_rate * MAX_SECONDS) as usize;
            let stream = match format {
                cpal::SampleFormat::F32 => {
                    stream_for::<f32>(&device, &config, thread_buffers, limit)
                }
                cpal::SampleFormat::I16 => {
                    stream_for::<i16>(&device, &config, thread_buffers, limit)
                }
                cpal::SampleFormat::U16 => {
                    stream_for::<u16>(&device, &config, thread_buffers, limit)
                }
                other => {
                    return Err(format!(
                        "The microphone \"{label}\" records in a format this app cannot \
                         read ({other}). Pick another one in Settings."
                    ));
                }
            }
            .map_err(|e| format!("The microphone \"{label}\" would not start: {e}"))?;
            stream
                .play()
                .map_err(|e| format!("The microphone \"{label}\" would not start: {e}"))?;
            Ok((stream, sample_rate, label))
        })();

        match built {
            Ok((stream, sample_rate, label)) => {
                if ready_tx.send(Ok((sample_rate, label))).is_err() {
                    return; // caller gave up; drop the stream
                }
                // The stream stops when it is dropped, so this thread parks
                // here holding it until `finish` or `cancel` says otherwise.
                let _ = stop_rx.recv();
                drop(stream);
            }
            Err(e) => {
                let _ = ready_tx.send(Err(e));
            }
        }
    });

    match ready_rx.recv() {
        Ok(Ok((sample_rate, device_label))) => {
            info!("[mic] capture started at {sample_rate}Hz");
            Ok(Capture {
                stop: stop_tx,
                buffers,
                sample_rate,
                thread: Some(thread),
                device_label,
            })
        }
        Ok(Err(e)) => Err(e),
        Err(_) => Err("The recording thread stopped before it could start.".into()),
    }
}

impl Capture {
    /// Samples the UI has not drawn yet, removed from the buffer as they are
    /// handed over.
    pub fn take_wave(&self) -> Result<Vec<f32>, String> {
        let mut b = self.buffers.lock().expect("audio buffers");
        if let Some(error) = &b.error {
            return Err(error.clone());
        }
        if b.overflowed {
            return Err(format!(
                "Recording exceeded {MAX_SECONDS} seconds. Record a shorter message."
            ));
        }
        Ok(std::mem::take(&mut b.wave))
    }

    fn halt(&mut self) {
        let _ = self.stop.send(());
        if let Some(t) = self.thread.take()
            && t.join().is_err()
        {
            self.buffers.lock().expect("audio buffers").error =
                Some("Recording thread failed.".into());
        }
        // Hand the microphone back once the stream is dropped.
        #[cfg(target_os = "ios")]
        ios_session::teardown();
    }

    /// Stop recording and return the WAV.
    pub fn finish(mut self) -> Result<Vec<u8>, String> {
        self.halt();
        let b = self.buffers.lock().expect("audio buffers");
        if let Some(error) = &b.error {
            return Err(error.clone());
        }
        if b.overflowed {
            return Err(format!(
                "That recording passed {MAX_SECONDS} seconds and was not kept. \
                 Record a shorter one."
            ));
        }
        if b.pcm.is_empty() {
            return Err(format!(
                "No audio came from \"{}\". Check that it is not muted, and that \
                 SkellySpeak is allowed to use the microphone in your system settings.",
                self.device_label
            ));
        }
        let wav = encode_wav(&b.pcm, self.sample_rate)?;
        info!(
            "[mic] capture finished: {} samples, {} bytes of WAV",
            b.pcm.len(),
            wav.len()
        );
        Ok(wav)
    }
}

/// Mono 16-bit PCM WAV, which is what the transcription endpoints accept.
fn encode_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| format!("The recording could not be encoded: {e}"))?;
        for s in samples {
            let clamped = s.clamp(-1.0, 1.0);
            writer
                .write_sample((clamped * i16::MAX as f32) as i16)
                .map_err(|e| format!("The recording could not be encoded: {e}"))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("The recording could not be encoded: {e}"))?;
    }
    Ok(cursor.into_inner())
}

impl Drop for Capture {
    fn drop(&mut self) {
        self.halt();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wav_contains_mono_clamped_pcm_with_actual_rate() {
        let bytes = encode_wav(&[-2.0, 0.0, 2.0], 48000).unwrap();
        let mut reader = hound::WavReader::new(std::io::Cursor::new(bytes)).unwrap();
        assert_eq!(reader.spec().channels, 1);
        assert_eq!(reader.spec().sample_rate, 48000);
        assert_eq!(
            reader
                .samples::<i16>()
                .collect::<Result<Vec<_>, _>>()
                .unwrap(),
            vec![-32767, 0, 32767]
        );
    }
    #[test]
    fn recording_bound_is_explicit_and_does_not_silently_truncate() {
        let buffers = Arc::new(Mutex::new(Buffers::default()));
        push(&buffers, &[0.0, 0.1], 2);
        push(&buffers, &[0.2], 2);
        let buffer = buffers.lock().unwrap();
        assert!(buffer.overflowed);
        assert_eq!(buffer.pcm.len(), 2);
    }
}

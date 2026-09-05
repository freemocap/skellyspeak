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
const MAX_SECONDS: u32 = 300;

#[derive(Default)]
struct Buffers {
    /// Every captured sample, mono, for the WAV.
    pcm: Vec<f32>,
    /// Decimated samples the UI has not drawn yet.
    wave: Vec<f32>,
    /// Set when `pcm` hit [`MAX_SECONDS`]. The recording is no longer complete,
    /// so finishing it must fail rather than hand back a truncated clip.
    overflowed: bool,
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

/// Every input device the host offers, by name.
pub fn devices() -> Result<Vec<String>, String> {
    let host = cpal::default_host();
    let found = host
        .input_devices()
        .map_err(|e| format!("The system would not list microphones: {e}"))?;
    Ok(found.filter_map(|d| d.name().ok()).collect())
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
    let mut b = buffers.lock().unwrap_or_else(|p| p.into_inner());
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
        // The stream survives a bad buffer, so this is genuinely a log — the
        // failure that matters (no audio at all) surfaces from `finish`.
        |e| log::error!("[mic] capture stream error: {e}"),
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
            let label = device.name().unwrap_or_else(|_| "microphone".into());
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
                    ))
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
            info!("[mic] capture started: {device_label} at {sample_rate}Hz");
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
    /// How many waveform samples a second `take_wave` produces.
    ///
    /// The device picks the sample rate, so the UI is told rather than left to
    /// assume 48kHz — guessing puts a visible drift in the waveform's time axis
    /// on any device that runs at 44.1.
    pub fn wave_rate(&self) -> f32 {
        self.sample_rate as f32 / WAVE_STRIDE as f32
    }

    /// Samples the UI has not drawn yet, removed from the buffer as they are
    /// handed over.
    pub fn take_wave(&self) -> Vec<f32> {
        let mut b = self.buffers.lock().unwrap_or_else(|p| p.into_inner());
        std::mem::take(&mut b.wave)
    }

    fn halt(&mut self) {
        let _ = self.stop.send(());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
        // Hand the microphone back once the stream is dropped.
        #[cfg(target_os = "ios")]
        ios_session::teardown();
    }

    /// Stop recording and return the WAV.
    pub fn finish(mut self) -> Result<Vec<u8>, String> {
        self.halt();
        let b = self.buffers.lock().unwrap_or_else(|p| p.into_inner());
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

    /// Stop recording and throw the audio away.
    pub fn discard(mut self) {
        self.halt();
        info!("[mic] capture cancelled");
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

/// iOS AVAudioSession configuration.
///
/// cpal's coreaudio host opens the raw audio unit but does NOT configure the
/// session: it links only the C API (coreaudio-rs/coreaudio-sys), so it cannot
/// reach the Objective-C AVAudioSession. Without this, iOS records silence and
/// never shows the microphone permission prompt. The category must allow
/// recording and the session must be active before any capture starts.
///
/// Method names are objc2 0.6's camelCase-preserving codegen (NOT the old
/// snake_case): setCategory:withOptions:error: becomes
/// setCategory_withOptions_error, and the error methods are `unsafe fn`
/// returning Result<(), Retained<NSError>>.
#[cfg(target_os = "ios")]
mod ios_session {
    use std::sync::mpsc;

    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_avf_audio::{
        AVAudioSession, AVAudioSessionCategoryPlayAndRecord, AVAudioSessionCategoryOptions,
        AVAudioSessionModeMeasurement, AVAudioSessionRecordPermission, AVAudioSessionSetActiveOptions,
    };
    use objc2_foundation::NSError;

    fn nserror_to_string(err: &NSError) -> String {
        err.localizedDescription().to_string()
    }

    /// Ask for (and await) microphone permission.
    ///
    /// The callback may run on another thread. Wait on the capture thread
    /// spawned in `audio::start`, leaving the main thread free for the prompt.
    fn request_record_permission(session: &AVAudioSession) -> Result<bool, String> {
        match unsafe { session.recordPermission() } {
            AVAudioSessionRecordPermission::Granted => return Ok(true),
            AVAudioSessionRecordPermission::Denied => return Ok(false),
            AVAudioSessionRecordPermission::Undetermined => {}
            permission => return Err(format!("Unknown microphone permission: {permission:?}")),
        }
        let (tx, rx) = mpsc::channel::<bool>();
        let handler = RcBlock::new(move |granted: Bool| {
            tx.send(granted.as_bool())
                .expect("microphone permission receiver disconnected");
        });
        // RcBlock owns the heap-allocated callback retained by AVAudioSession.
        unsafe { session.requestRecordPermission(&handler) };
        rx.recv()
            .map_err(|e| format!("microphone permission prompt never returned: {e}"))
    }

    /// Configure and activate the session so cpal can capture the microphone.
    pub fn prepare() -> Result<(), String> {
        let session = unsafe { AVAudioSession::sharedInstance() };
        if !request_record_permission(&session)? {
            return Err(
                "Microphone access is denied. Allow SkellySpeak in iOS Settings → Privacy & Security → Microphone, then try again."
                    .into(),
            );
        }
        unsafe {
            // playAndRecord: the app also plays TTS audio, and this category
            // lets both directions run. defaultToSpeaker keeps playback on the
            // speaker rather than the earpiece.
            session
                .setCategory_withOptions_error(
                    AVAudioSessionCategoryPlayAndRecord
                        .ok_or("iOS PlayAndRecord audio category is unavailable")?,
                    AVAudioSessionCategoryOptions::DefaultToSpeaker,
                )
                .map_err(|e| format!("setCategory failed: {}", nserror_to_string(&e)))?;
            // measurement disables Apple's automatic gain control and signal
            // processing — flat, unprocessed audio is what speech-to-text wants.
            session
                .setMode_error(
                    AVAudioSessionModeMeasurement
                        .ok_or("iOS Measurement audio mode is unavailable")?,
                )
                .map_err(|e| format!("setMode failed: {}", nserror_to_string(&e)))?;
            session
                .setActive_withOptions_error(true, AVAudioSessionSetActiveOptions::empty())
                .map_err(|e| format!("setActive failed: {}", nserror_to_string(&e)))?;
        }
        Ok(())
    }

    /// Deactivate the session once recording is done so other apps can take
    /// the microphone back.
    pub fn teardown() {
        let session = unsafe { AVAudioSession::sharedInstance() };
        unsafe {
            session
                .setActive_withOptions_error(
                    false,
                    AVAudioSessionSetActiveOptions::NotifyOthersOnDeactivation,
                )
                .expect("failed to deactivate the iOS audio session");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Opens the real default microphone and records for a moment.
    ///
    /// Ignored by default because it needs hardware and a granted permission,
    /// so it cannot run in CI. Run it by hand on a machine with a microphone —
    /// especially on macOS, where the whole reason this module exists is that
    /// the webview recorder is unavailable:
    ///
    ///     cargo test --lib records_from_the_real_default_device -- --ignored --nocapture
    #[test]
    #[ignore = "needs a microphone and permission"]
    fn records_from_the_real_default_device() {
        let capture = start(None).expect("the default input device should open");
        std::thread::sleep(std::time::Duration::from_millis(400));
        let wave = capture.take_wave();
        let wav = capture.finish().expect("the recording should encode");
        println!("captured {} waveform samples, {} bytes of WAV", wave.len(), wav.len());
        assert_eq!(&wav[0..4], b"RIFF");
        assert!(wav.len() > 44, "the WAV must carry samples, not just a header");
        assert!(!wave.is_empty(), "the waveform must receive samples too");
    }

    #[test]
    fn wav_has_a_riff_header_and_one_channel() {
        let wav = encode_wav(&[0.0, 0.5, -0.5], 16_000).unwrap();
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        // Channel count and sample rate live at fixed offsets in the fmt chunk.
        assert_eq!(u16::from_le_bytes([wav[22], wav[23]]), 1);
        assert_eq!(
            u32::from_le_bytes([wav[24], wav[25], wav[26], wav[27]]),
            16_000
        );
    }

    #[test]
    fn full_scale_samples_do_not_wrap_to_the_opposite_sign() {
        // `1.0 * i16::MAX` is exactly representable, but anything above it
        // would wrap to a large negative value and click loudly.
        let wav = encode_wav(&[1.0, -1.0, 2.0, -2.0], 8_000).unwrap();
        let data = &wav[44..];
        let read = |i: usize| i16::from_le_bytes([data[i * 2], data[i * 2 + 1]]);
        assert_eq!(read(0), i16::MAX);
        assert_eq!(read(1), -i16::MAX);
        assert_eq!(read(2), i16::MAX, "clamped, not wrapped");
        assert_eq!(read(3), -i16::MAX, "clamped, not wrapped");
    }

    #[test]
    fn the_waveform_buffer_is_decimated_evenly_across_callbacks() {
        let buffers = Arc::new(Mutex::new(Buffers::default()));
        // Two callbacks whose lengths are not multiples of the stride: the
        // stride must follow the running total, or the decimation clusters at
        // every buffer boundary.
        push(&buffers, &vec![0.1; 100], usize::MAX);
        push(&buffers, &vec![0.2; 100], usize::MAX);
        let b = buffers.lock().unwrap();
        assert_eq!(b.pcm.len(), 200);
        // Indices 0, 64, 128, 192 -> four samples.
        assert_eq!(b.wave.len(), 4);
    }

    #[test]
    fn passing_the_length_cap_is_recorded_rather_than_truncating_silently() {
        let buffers = Arc::new(Mutex::new(Buffers::default()));
        push(&buffers, &[0.1; 10], 15);
        push(&buffers, &[0.1; 10], 15);
        let b = buffers.lock().unwrap();
        assert!(b.overflowed, "the second frame must not be quietly dropped");
    }
}

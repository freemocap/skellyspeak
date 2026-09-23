/// Mono 16-bit PCM WAV, which is what the transcription endpoints accept.
pub(super) fn encode_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
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

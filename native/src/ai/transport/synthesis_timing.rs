//! Recording-clock timing projection. Provider frames remain content, not authority.
use crate::speech::alignment::{CharacterAlignment, SpeechAlignment};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Default)]
pub(super) struct Timings {
    original: Option<CharacterAlignment>,
    normalized: Option<CharacterAlignment>,
    invalid: [bool; 2],
}
#[derive(Deserialize)]
struct Wire {
    characters: Vec<String>,
    character_start_times_seconds: Vec<f64>,
    character_end_times_seconds: Vec<f64>,
}
impl Timings {
    pub fn append(&mut self, value: &Value) {
        for (index, (target, field)) in [
            (&mut self.original, "alignment"),
            (&mut self.normalized, "normalized_alignment"),
        ]
        .into_iter()
        .enumerate()
        {
            if value[field].is_null() {
                continue;
            }
            let decoded = serde_json::from_value::<Wire>(value[field].clone())
                .ok()
                .map(|v| CharacterAlignment {
                    characters: v.characters,
                    starts: v.character_start_times_seconds,
                    ends: v.character_end_times_seconds,
                });
            // A provider may send an empty timing object on an audio-only tail.
            // All three arrays must be empty; mismatched arrays remain invalid.
            if decoded.as_ref().is_some_and(|v| {
                v.characters.is_empty() && v.starts.is_empty() && v.ends.is_empty()
            }) {
                continue;
            }
            let Some(next) = decoded.filter(|v| v.valid()) else {
                self.invalid[index] = true;
                continue;
            };
            if let Some(previous) = target {
                if next.starts[0] < *previous.starts.last().unwrap()
                    || previous.characters.len() + next.characters.len() > 20000
                    || previous
                        .characters
                        .iter()
                        .chain(&next.characters)
                        .map(String::len)
                        .sum::<usize>()
                        > 80000
                {
                    self.invalid[index] = true;
                    continue;
                }
                previous.characters.extend(next.characters);
                previous.starts.extend(next.starts);
                previous.ends.extend(next.ends);
            } else {
                *target = Some(next);
            }
        }
    }
    // Provider endpoints are approximate display positions, not audio integrity
    // checks. Preserve both lanes unchanged; the inspection clips its display.
    pub fn projection(&self, source: &str, _duration: f64) -> SpeechAlignment {
        let lane = |value: &Option<CharacterAlignment>, invalid: bool| {
            value.as_ref().filter(|_| !invalid).cloned()
        };
        SpeechAlignment {
            source_text: source.into(),
            original: lane(&self.original, self.invalid[0]),
            normalized: lane(&self.normalized, self.invalid[1]),
        }
    }
    pub fn diagnostics(&self, duration: f64) -> Value {
        let mut result = json!({});
        for (index, (field, lane)) in [
            ("original", &self.original),
            ("normalized", &self.normalized),
        ]
        .into_iter()
        .enumerate()
        {
            let reason = if self.invalid[index] {
                "invalid_provider_timing"
            } else if lane
                .as_ref()
                .is_some_and(|v| v.ends.iter().any(|end| *end > duration))
            {
                "display_clipped_to_audio"
            } else if lane.is_none() {
                "not_supplied"
            } else {
                "available"
            };
            result[field] = json!({"status": if matches!(reason, "available" | "display_clipped_to_audio") {"available"} else {"unavailable"}, "reason":reason, "duration_seconds":duration, "maximum_end_seconds":lane.as_ref().and_then(|v| v.ends.iter().copied().reduce(f64::max)), "character_count":lane.as_ref().map_or(0, |v| v.characters.len())});
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn lane(text: &str, start: f64, end: f64) -> Value {
        let chars: Vec<_> = text.chars().map(|c| c.to_string()).collect();
        json!({"characters":chars, "character_start_times_seconds":vec![start;chars.len()],
            "character_end_times_seconds":vec![end;chars.len()]})
    }
    #[test]
    fn preserves_source_and_recording_clock_across_audio_only_tail() {
        for source in ["café", "cafe\u{301}", "مرحبا", "你好", "नमस्ते"] {
            let mut timings = Timings::default();
            timings.append(&json!({"alignment":lane(source,0.1,0.8)}));
            assert!(timings.projection(source, 0.2).original.is_some());
            timings.append(&json!({"alignment":null}));
            let result = timings.projection(source, 1.0);
            assert_eq!(result.source_text, source);
            let original = result.original.unwrap();
            assert_eq!(original.characters.concat(), source);
            assert_eq!(original.starts, vec![0.1; source.chars().count()]);
            assert_eq!(original.ends, vec![0.8; source.chars().count()]);
        }
        let mut timings = Timings::default();
        timings.append(&json!({"alignment":lane("one ",0.0,0.1)}));
        timings.append(&json!({"alignment":lane("two",0.1,0.3)}));
        timings.append(&json!({"alignment":null}));
        let words = timings.projection("one two", 0.3).words(0.3).unwrap();
        assert_eq!(words.words.last().unwrap().word, "two");
        assert_eq!(words.words.last().unwrap().start, 0.1);
        assert_eq!(words.words.last().unwrap().end, 0.3);
    }
    #[test]
    fn malformed_lane_is_not_revived_by_null_or_valid_frames() {
        for bad in [
            json!({}),
            lane("\0", 0.0, 0.1),
            lane("a", -0.1, 0.2),
            json!({"characters":["a"],"character_start_times_seconds":[true],"character_end_times_seconds":[0.2]}),
        ] {
            let mut timings = Timings::default();
            timings.append(&json!({"alignment":bad,"normalized_alignment":lane("a",0.0,0.1)}));
            timings.append(&json!({"alignment":null}));
            timings.append(&json!({"alignment":lane("b",0.1,0.2)}));
            let result = timings.projection("ab", 1.0);
            assert!(result.original.is_none());
            assert!(result.normalized.is_some());
            assert_eq!(
                timings.diagnostics(1.0)["original"]["reason"],
                "invalid_provider_timing"
            );
        }
        let mut timings = Timings::default();
        timings.append(&json!({"alignment":lane("a",0.5,0.8)}));
        timings.append(&json!({"alignment":lane("b",0.1,0.2)}));
        assert!(timings.projection("ab", 1.0).original.is_none());
    }
}

#[cfg(test)]
mod provider_boundary_tests {
    use super::*;
    #[test]
    fn empty_tail_and_float_roundoff_keep_reference_words() {
        let mut timing = Timings::default();
        timing.append(&json!({"alignment":{"characters":["one"],"character_start_times_seconds":[0.0],"character_end_times_seconds":[6.720000000000001]}}));
        timing.append(&json!({"alignment":{"characters":[],"character_start_times_seconds":[],"character_end_times_seconds":[]}}));
        let alignment = timing.projection("one", 6.72);
        assert_eq!(
            alignment.original.as_ref().unwrap().ends[0],
            6.720000000000001
        );
        let words = alignment.words(6.72).unwrap();
        assert_eq!(words.words[0].end, 6.720000000000001);
        assert_eq!(
            timing.diagnostics(6.72)["original"]["reason"],
            "display_clipped_to_audio"
        );
        assert!(timing.projection("one", 6.719).original.is_some());
    }
}

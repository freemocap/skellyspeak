//! The three translation prompts, ported **verbatim** from the original
//! `python-only` branch (the IP that makes word-aligned translation work).
//!
//! They are kept as plain string templates with `{named}` placeholders and
//! filled by `render` — the direct Rust equivalent of Python's `.format(...)`.

use crate::models::LanguageConfig;

/// Full-text translation (one call per target language).
pub const FULL_TEXT_TRANSLATION_SYSTEM_PROMPT: &str = r##"
You are an expert translator. 

You will be given the result of a Whisper transcription of an audio recording in {original_language} which has already
 been translated into the following language:  

{target_language_with_their_romanization_methods}

You will be provided with a transcript of the original language, and your task is to translate the text into the target
language and provide the romanization method specified (if applicable).

Remember, this is an audio transcription, so the text may contain errors. Please do your best to provide an accurate 
translation of the transcription and attempt to match the speaker's meaning and intention as closely as possible.


-------
ORIGINAL LANGUAGE TRANSCRIPT:

'''
{original_language_transcript}
'''
END OF ORIGINAL LANGUAGE TRANSCRIPT


-------

REMEMBER! Your task is to translate the text from the ORIGINAL LANGUAGE TRANSCRIPT into the target
language and provide the romanization method specified (if applicable).

Remember, this is an audio transcription, so the text may contain errors. Please do your best to provide an accurate 
translation of the transcription and attempt to match the speaker's meaning and intention as closely as possible.

If the target languages matches the original language, just return the original language transcript.
"##;

/// Segment-level translation (one call per segment × language), with the full
/// transcript as context.
pub const SEGMENT_LEVEL_TRANSCRIPT_TRANSLATION_SYSTEM_PROMPT: &str = r##"
You are an expert translator. 

You will be given the result of a Whisper transcription of an audio recording in {original_language} and asked to translate a section of it into the following language:

{target_language_with_their_romanization_methods}


Your task is to provide a translation for a  single timestamped segment from the list of segments  that make up the full transcript. Your 
job is to translate the provided segment into the target language and provide the romanization method specified (if applicable). 


Remember, this is an audio transcription, so the text may contain errors. Please do your best to provide an accurate 
translation of the transcription and attempt to match the speaker's meaning and intention as closely as possible.

Here is the full transcript for context:
-------
FULL TRANSCRIPTION TEXT START: 

{full_transcription_text_in_original_language}

FULL TRANSCRIPTION TEXT END

----

Here is the segment you should translate:

SECTION OF ORIGINAL TEXT TO TRANSLATE (Section# {segment_number} of {total_segments}):

{current_segment_in_original_language}

starting_timestamp: {start_timestamp}
ending_timestamp: {end_timestamp}
total_transcript_audio_duration: {duration}

END OF SECTION OF ORIGINAL TEXT TO TRANSLATE
-------

REMEMBER! Your task is to translate the text from the `SECTION OF ORIGINAL TEXT TO TRANSLATE` into the target language and provide the romanization method specified (if applicable).

If the target languages matches the original language, just return the original language transcript.

Your answer must match the form of the JSON schema provided. 

"##;

/// Word-level matching (one call per segment × language) — the signature
/// feature. Aligns each original word to its closest target-language word,
/// allowing many-to-one matches.
pub const WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS: &str = r##"
You are an expert translator. 

You will be given the result of a Whisper transcription of an audio recording in {original_language} which has already
 been translated into the following language:  

{target_language_with_their_romanization_methods}

You will be shown a segment of the original language transcript with the words are indexed, so e.g. "Hi my name is Jon" 
becomes "([0]Hi) ([1]my) ([2]name) ([3]is) ([4]Jon)"

You will then be provided with an indexed list of words from the target language (where the index corresponds to the 
position of the target-language word in the translated segement).

Your task is to match the word from the original language with the closest matching word from the target languages. 
If you cannot find a matching word, do your best!

If a word in the target language covers multiple words in the original language (such as 'hablo' in Spanish encompassing
 both 'I' and 'speak' in English), you can match the same word multiple times. 

### EXAMPLE OF A TIME WHEN THE TARGET LANGUAGE WORD COVERS MULTIPLE WORDS IN THE ORIGINAL LANGUAGE ###
 
Example original language segment: "My Name is Jon"
([0] Hello, [starting_timestamp: 0.0, ending_timestamp: 0.42])
([1] my [starting_timestamp: 0.46, ending_timestamp: 0.58])
([2] name [starting_timestamp: 0.58, ending_timestamp: 0.78])
([3] is [starting_timestamp: 0.78, ending_timestamp: 0.96])
([4] Jon [starting_timestamp: 0.96, ending_timestamp: 1.14])

Example target language word list in Arabic:
([0]مرحبًا)
([1]اسمي)
([2]جون)

Note that the Arabic word 'اسمي' covers all of the words in `my name is` in English, so you would match each of the 
English words 'I', 'name', and 'is' with the Arabic word 'اسمي' in this case.

So the correct matching would be:
hello: مرحبًا 
my: اسمي
name: اسمي
is: اسمي
Jon: جون

### END OF EXAMPLE ###


### BEGINNING OF THE TEXT DATA YOU WILL BE WORKING WITH ###

Here is segment of the original language transcript (including each words index in the segment and the start/end timestamp of when the word was spoken in the original audio): 

{current_segment_in_original_language_including_indexed_words_and_timestamps}


Here is the indexed list of words from the target language

{indexed_list_of_available_words_in_target_languages}

### END OF TEXT DATA ###

Your job is to find find the best matching word from the indexed list of translated words for each word in the original 
language segment.

if a word is repeated in the segment, attempt to match the word in the target language who's index is closest to the 
original word's index (e.g. If the word 'you' is used at the beginning of the segement and then again at the end,
    try to match the first 'you' with the first 'you' in the target language list, and the second 'you' with the second
    'you' in the target language list)

The idea is that we're going to be putting these on a video as subtitles, and when the speaker says the word in the
 original language, we want the subtitle to show the word in the target language that best matches the original word. 
Obviously this won't be perfectly one-to-one because of the complexities of language, but do your best to match the
 words as closely as possible with the intention of finding matches that make the most linguistic sense and would help 
 a person who speaks the target language understand the original language and vice versa.

If the target languages matches the original language, just return the original language transcript.

Your answer must be provided in accordance to the JSON format provided in the prompt.

"##;

/// Fill `{named}` placeholders in a template. The Rust equivalent of
/// Python's `str.format(**kwargs)`.
fn render(template: &str, vars: &[(&str, &str)]) -> String {
    let mut out = template.to_string();
    for (key, value) in vars {
        out = out.replace(&format!("{{{key}}}"), value);
    }
    out
}

/// Build the full-text translation prompt for one target language.
pub fn full_text_prompt(
    original_language: &str,
    target_config: &LanguageConfig,
    transcript: &str,
) -> String {
    let config_json = target_config.prompt_json();
    render(FULL_TEXT_TRANSLATION_SYSTEM_PROMPT, &[
        ("original_language", original_language),
        ("target_language_with_their_romanization_methods", config_json.as_str()),
        ("original_language_transcript", transcript),
    ])
}

/// Build the segment-level translation prompt for one (segment, language).
#[allow(clippy::too_many_arguments)]
pub fn segment_level_prompt(
    original_language: &str,
    target_config: &LanguageConfig,
    full_transcript: &str,
    segment_number: usize,
    total_segments: usize,
    current_segment: &str,
    start_seconds: f64,
    end_seconds: f64,
    duration_seconds: f64,
) -> String {
    let config_json = target_config.prompt_json();
    let segment_number = segment_number.to_string();
    let total_segments = total_segments.to_string();
    let start_timestamp = start_seconds.to_string();
    let end_timestamp = end_seconds.to_string();
    let duration = duration_seconds.to_string();
    render(SEGMENT_LEVEL_TRANSCRIPT_TRANSLATION_SYSTEM_PROMPT, &[
        ("original_language", original_language),
        ("target_language_with_their_romanization_methods", config_json.as_str()),
        ("full_transcription_text_in_original_language", full_transcript),
        ("segment_number", segment_number.as_str()),
        ("total_segments", total_segments.as_str()),
        ("current_segment_in_original_language", current_segment),
        ("start_timestamp", start_timestamp.as_str()),
        ("end_timestamp", end_timestamp.as_str()),
        ("duration", duration.as_str()),
    ])
}

/// Build the word-matching prompt for one (segment, language).
pub fn word_level_prompt(
    original_language: &str,
    target_config: &LanguageConfig,
    indexed_original_words_with_timestamps: &str,
    indexed_target_words: &str,
) -> String {
    let config_json = target_config.prompt_json();
    render(WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS, &[
        ("original_language", original_language),
        ("target_language_with_their_romanization_methods", config_json.as_str()),
        (
            "current_segment_in_original_language_including_indexed_words_and_timestamps",
            indexed_original_words_with_timestamps,
        ),
        (
            "indexed_list_of_available_words_in_target_languages",
            indexed_target_words,
        ),
    ])
}

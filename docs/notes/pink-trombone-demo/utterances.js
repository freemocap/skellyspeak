/*
    THE AUTHORED LAYER.

    Pink Trombone is a physical model. It has no idea what a word is. To make it
    say anything you must hand it a sequence of articulatory targets, and this
    file is that sequence. Everything else in this folder is either vendored
    third-party code or plumbing.

    That split is the point of the demo: the synthesizer is free (MIT), and this
    file is the work.

    WHERE THESE NUMBERS COME FROM
    -----------------------------
    The upstream exhibit places its own labels on the tract diagram, in
    TractUI.drawPositions() in vendor/pink_trombone_script.js. Those labels give
    a horizontal index for each IPA sound, and a vertical offset used only for
    chart text placement. They are hand-placed for English, never measured, and
    they are visibly approximate - the exhibit puts /ae/ above /e/ on the chart,
    which is backwards phonetically. They are transcribed here as a starting
    point because they are the only articulatory mapping that ships with the
    code, NOT because they are reference data.

    Nothing here has been validated against a phonetic source. Treat every
    number as a dial to turn by ear.

    PARAMETER REFERENCE (from vendor/pink_trombone_processor.js)
    -----------------------------------------------------------
    tongue: [index, diameter]
        index     0 = throat, 44 = lips. Where the tongue body is bunched.
        diameter  2.05 (high / close) .. 3.50 (low / open). This is the gap
                  between tongue and roof, so SMALLER = higher tongue.

    constriction: [index, diameter] | null
        A separate narrow channel drawn on top of the tongue shape. Used for
        consonants. diameter 0 or less = complete closure, a stop. Around
        0.5-0.8 = a fricative. Around 1.2 = an approximant. index 0 disables it
        entirely, so `null` is written as index 0.

    velum: 0.01 = nose shut (oral sounds). 0.40 = nose open (nasals).
    lip:   1.50 = spread, 0 = pressed shut. Used for rounding and labials.
    voiced: glottis intensity. 0 = voiceless, 1 = full voicing. This is the
           only difference between /s/ and /z/, or between /f/ and /v/.
    tense: glottis tenseness, 0 = breathy .. 1 = strained.
    pitch: fundamental in Hz.
*/

// The model's own rest state, reproduced from the processor defaults.
export const REST = {
    pitch: 120,
    voiced: 1,
    tense: 0.6,
    velum: 0.01,
    tongue: [12.9, 2.43],
    constriction: null,
    lip: 1.5,
};

/*
    Reusable articulatory targets. Vowel tongue positions are transcribed from
    the upstream chart labels; consonant constriction indices likewise. The
    constriction diameters, the lip values and every voicing decision are this
    demo's own guesses.
*/
export const SHAPES = {
    // --- vowels ---
    "ɑ": { tongue: [13.0, 2.405] },   // father
    "e": { tongue: [20.0, 3.500] },   // bed (Australian/Scottish-ish)
    "æ": { tongue: [15.0, 2.900] },   // cat
    "ʌ": { tongue: [18.1, 2.555] },   // strut
    "ə": { tongue: [21.0, 2.900] },   // schwa
    "ɪ": { tongue: [27.0, 2.975] },   // kit
    "i": { tongue: [27.4, 2.315] },   // fleece
    "ɔ": { tongue: [17.7, 2.075], lip: 0.70 },  // thought, rounded
    "u": { tongue: [23.0, 2.150], lip: 0.50 },  // goose, rounded

    // --- nasals: closure at the named place, plus an open velum ---
    "m": { velum: 0.40, constriction: [41.0, 0.0] },
    "n": { velum: 0.40, constriction: [35.0, 0.0] },
    "ŋ": { velum: 0.40, constriction: [22.0, 0.0] },

    // --- voiced stops ---
    "b": { constriction: [41.5, 0.0] },
    "d": { constriction: [35.0, 0.0] },
    "g": { constriction: [22.0, 0.0] },

    // --- voiceless stops ---
    "p": { voiced: 0, constriction: [41.5, 0.0] },
    "t": { voiced: 0, constriction: [35.0, 0.0] },
    "k": { voiced: 0, constriction: [22.0, 0.0] },

    // --- fricatives: same articulators, voicing is the whole contrast ---
    "s": { voiced: 0, constriction: [36.5, 0.55] },
    "z": { voiced: 1, constriction: [36.5, 0.55] },
    "ʃ": { voiced: 0, constriction: [33.0, 0.70] },
    "ʒ": { voiced: 1, constriction: [33.0, 0.70] },
    "f": { voiced: 0, constriction: [39.5, 0.80], lip: 1.20 },
    "v": { voiced: 1, constriction: [39.5, 0.80], lip: 1.20 },
    "h": { voiced: 0, constriction: [4.5, 0.90] },

    // --- approximants ---
    "l": { constriction: [38.0, 1.20] },
    "w": { tongue: [23.0, 2.150], lip: 0.40 },
    "ɹ": { constriction: [28.6, 1.20] },
};

/*
    Utterances.

    `segments` is a plain mouth-full-of-shapes list, run in order. Each segment
    takes `dur` seconds and is approached over `ramp` seconds, so the tract is
    always moving toward the next target while the current one sounds - which is
    the only reason any of this sounds like speech rather than a row of beeps.

    A segment's `shape` names an entry in SHAPES, or can be written inline as an
    object for one-offs. Any parameter may be overridden on the segment itself.
*/
export const UTTERANCES = [
    {
        group: "Vowels",
        id: "vowel-ɑ",
        label: "ɑ",
        ipa: "ɑ",
        note: "Open back. The reference the others are heard against.",
        ramp: 0.05,
        segments: [{ shape: "ɑ", dur: 0.70 }],
    },
    {
        group: "Vowels",
        id: "vowel-i",
        label: "i",
        ipa: "i",
        note: "Close front. Small tongue diameter, tongue pushed forward.",
        ramp: 0.05,
        segments: [{ shape: "i", dur: 0.70 }],
    },
    {
        group: "Vowels",
        id: "vowel-u",
        label: "u",
        ipa: "u",
        note: "Close back, rounded. Compare with i: same height, opposite end.",
        ramp: 0.05,
        segments: [{ shape: "u", dur: 0.70 }],
    },
    {
        group: "Vowels",
        id: "vowel-glide",
        label: "ɑ → i → u",
        ipa: "ɑi u",
        note: "Continuous movement. Watch the tract reshape rather than snap.",
        ramp: 0.14,
        segments: [
            { shape: "ɑ", dur: 0.45 },
            { shape: "i", dur: 0.45 },
            { shape: "u", dur: 0.55 },
        ],
    },
    {
        group: "Vowels",
        id: "vowel-contour",
        label: "ɑ with pitch fall",
        ipa: "ɑː",
        note: "Same shape, moving pitch. Shows prosody is a separate channel.",
        ramp: 0.05,
        segments: [
            { shape: "ɑ", dur: 0.35, pitch: 165 },
            { shape: "ɑ", dur: 0.45, pitch: 105 },
        ],
    },
    {
        group: "Contrasts",
        id: "s-z",
        label: "s / z",
        ipa: "s z",
        note: "Identical articulators. One parameter differs: voicing.",
        ramp: 0.05,
        segments: [
            { shape: "s", dur: 0.45 },
            { shape: "z", dur: 0.45 },
        ],
    },
    {
        group: "Contrasts",
        id: "f-v",
        label: "f / v",
        ipa: "f v",
        note: "Same again, at the lips.",
        ramp: 0.05,
        segments: [
            { shape: "f", dur: 0.45 },
            { shape: "v", dur: 0.45 },
        ],
    },
    {
        group: "Contrasts",
        id: "b-m",
        label: "b / m",
        ipa: "b m",
        note: "Identical closure. One parameter differs: the velum.",
        ramp: 0.05,
        segments: [
            { shape: "b", dur: 0.45 },
            { shape: "m", dur: 0.45 },
        ],
    },
    {
        group: "Contrasts",
        id: "nasals",
        label: "m / n / ŋ",
        ipa: "m n ŋ",
        note: "Same velum opening, three constriction places. ŋ often reads as a hum.",
        ramp: 0.06,
        segments: [
            { shape: "m", dur: 0.40 },
            { shape: "n", dur: 0.40 },
            { shape: "ŋ", dur: 0.50 },
        ],
    },
    {
        group: "Consonants",
        id: "stops",
        label: "p / t / k",
        ipa: "p t k",
        note: "Short closures. The release burst is the model's own transient.",
        ramp: 0.03,
        segments: [
            { shape: "p", dur: 0.16 },
            { shape: "ʌ", dur: 0.30 },
            { shape: "t", dur: 0.16 },
            { shape: "ʌ", dur: 0.30 },
            { shape: "k", dur: 0.16 },
            { shape: "ʌ", dur: 0.40 },
        ],
    },
    {
        group: "Consonants",
        id: "fricatives",
        label: "s / ʃ / f / h",
        ipa: "s ʃ f h",
        note: "Four voiceless fricatives. h is barely more than breath.",
        ramp: 0.05,
        segments: [
            { shape: "s", dur: 0.45 },
            { shape: "ʃ", dur: 0.45 },
            { shape: "f", dur: 0.45 },
            { shape: "h", dur: 0.45 },
        ],
    },
    {
        group: "Words",
        id: "mama",
        label: "mama",
        ipa: "ˈmɑmɑ",
        note: "Two nasal closures with an open vowel between, twice.",
        ramp: 0.05,
        segments: [
            { shape: "m", dur: 0.18 },
            { shape: "ɑ", dur: 0.30, pitch: 138 },
            { shape: "m", dur: 0.18 },
            { shape: "ɑ", dur: 0.45, pitch: 118 },
        ],
    },
    {
        group: "Words",
        id: "papa",
        label: "papa",
        ipa: "ˈpɑpɑ",
        note: "Voiceless counterpart of mama.",
        ramp: 0.04,
        segments: [
            { shape: "p", dur: 0.16 },
            { shape: "ɑ", dur: 0.30, pitch: 138 },
            { shape: "p", dur: 0.16 },
            { shape: "ɑ", dur: 0.45, pitch: 118 },
        ],
    },
    {
        group: "Words",
        id: "nana",
        label: "nana",
        ipa: "ˈnɑnɑ",
        note: "Same shape as mama at a different constriction place.",
        ramp: 0.05,
        segments: [
            { shape: "n", dur: 0.18 },
            { shape: "ɑ", dur: 0.30, pitch: 138 },
            { shape: "n", dur: 0.18 },
            { shape: "ɑ", dur: 0.45, pitch: 118 },
        ],
    },
    {
        group: "Words",
        id: "banana",
        label: "banana",
        ipa: "bəˈnɑnə",
        note: "Six segments. A reasonable stress test for the sequencing.",
        ramp: 0.05,
        segments: [
            { shape: "b", dur: 0.15 },
            { shape: "ə", dur: 0.20, pitch: 132 },
            { shape: "n", dur: 0.16 },
            { shape: "ɑ", dur: 0.30, pitch: 142 },
            { shape: "n", dur: 0.16 },
            { shape: "ə", dur: 0.40, pitch: 110 },
        ],
    },
    {
        group: "Words",
        id: "isisi",
        label: "sisi",
        ipa: "ˈsiːsi",
        note: "Voiceless fricative into a close front vowel, twice.",
        ramp: 0.05,
        segments: [
            { shape: "s", dur: 0.30 },
            { shape: "i", dur: 0.35, pitch: 150 },
            { shape: "s", dur: 0.30 },
            { shape: "i", dur: 0.40, pitch: 130 },
        ],
    },
    {
        group: "Words",
        id: "wawa",
        label: "wawa",
        ipa: "ˈwɑwɑ",
        note: "Lip rounding into an open vowel.",
        ramp: 0.06,
        segments: [
            { shape: "w", dur: 0.22 },
            { shape: "ɑ", dur: 0.32, pitch: 138 },
            { shape: "w", dur: 0.22 },
            { shape: "ɑ", dur: 0.45, pitch: 118 },
        ],
    },
    {
        group: "Words",
        id: "haha",
        label: "haha",
        ipa: "ˈhɑhɑ",
        note: "Breathy onset. Lowest confidence of anything here.",
        ramp: 0.05,
        segments: [
            { shape: "h", dur: 0.22 },
            { shape: "ɑ", dur: 0.32, pitch: 140 },
            { shape: "h", dur: 0.22 },
            { shape: "ɑ", dur: 0.45, pitch: 120 },
        ],
    },
];

// Resolve a segment's shape name (or inline object) and apply its overrides.
export function resolveShape(segment) {
    const base = typeof segment.shape === "string" ? SHAPES[segment.shape] : segment.shape;
    if (!base) throw new Error(`Unknown shape: ${segment.shape}`);

    const merged = { ...REST, ...base };
    for (const key of ["pitch", "voiced", "tense", "velum", "lip", "tongue", "constriction"]) {
        if (segment[key] !== undefined) merged[key] = segment[key];
    }
    return merged;
}

// Flatten an utterance into absolute-time keyframes.
// Each key is reached at `at`; the transition into it begins `ramp` seconds earlier.
export function toKeyframes(utterance) {
    const keys = [];
    let at = 0;
    for (const segment of utterance.segments) {
        const ramp = segment.ramp ?? utterance.ramp ?? 0.05;
        at += segment.dur;
        keys.push({ at, ramp, params: resolveShape(segment), segment });
    }
    return keys;
}

export function utteranceDuration(utterance) {
    return utterance.segments.reduce((sum, s) => sum + s.dur, 0);
}

// Flat label/value list for the on-screen readout. Kept beside the shape
// definitions so the two cannot drift apart.
export function describeShape(shape) {
    return [
        ["frequency", `${shape.pitch.toFixed(0)} Hz`],
        ["voicing", shape.voiced.toFixed(2)],
        ["tenseness", shape.tense.toFixed(2)],
        ["velum", shape.velum.toFixed(2)],
        ["tongue index", shape.tongue[0].toFixed(2)],
        ["tongue diameter", shape.tongue[1].toFixed(3)],
        ["constriction index", shape.constriction ? shape.constriction[0].toFixed(1) : "—"],
        ["constriction diameter", shape.constriction ? shape.constriction[1].toFixed(2) : "—"],
        ["lip aperture", shape.lip.toFixed(2)],
    ];
}

/*
    Plumbing between the vendored synthesizer and the authored data in
    utterances.js.

    The whole job here is: turn a list of articulatory keyframes into scheduled
    AudioParam automation on the tract and glottis worklets. Pink Trombone has
    no notion of a "note" or a "word", so everything is ramps.
*/

import { MPT_Voice } from "./vendor/pink_trombone_script.js";
import { toKeyframes } from "./utterances.js";

const LEAD = 0.06;      // scheduling headroom before the first sound
const TAIL = 0.06;      // silence appended after the last segment
const RELEASE = 0.08;   // fade-out time for the tail

// One automation channel per AudioParam: `of` reads the value a keyframe wants,
// `param` finds the AudioParam to schedule it on. A null constriction is
// written as index 0, which is the value the tract processor treats as "no
// constriction" (it ignores the whole thing when the index is zero).
const CHANNELS = [
    { of: k => k.pitch, param: v => v.glottis.parameters.get("frequency") },
    { of: k => k.voiced, param: v => v.glottis.parameters.get("intensity") },
    { of: k => k.tense, param: v => v.glottis.parameters.get("tenseness") },
    { of: k => k.velum, param: v => v.tract.parameters.get("velum-target") },
    { of: k => k.tongue[0], param: v => v.tract.parameters.get("tongue-index") },
    { of: k => k.tongue[1], param: v => v.tract.parameters.get("tongue-diameter") },
    {
        of: k => (k.constriction ? k.constriction[0] : 0),
        param: v => v.tract.parameters.get("constriction-index"),
    },
    {
        of: k => (k.constriction ? k.constriction[1] : 1.5),
        param: v => v.tract.parameters.get("constriction-diameter"),
    },
    { of: k => k.lip, param: v => v.tract.parameters.get("lip-diameter") },
];

export class TromboneEngine {
    constructor() {
        this.ctx = null;
        this.voice = null;
        this.starting = null;
        this.movementSpeed = 15;
        this.playing = false;
        this.keys = [];
        this.segments = [];
        this.startTime = 0;
        this.endTime = 0;
    }

    get ready() {
        return this.voice !== null;
    }

    get enabled() {
        return this.ctx !== null && this.ctx.state === "running";
    }

    /*
        Must be called from a user gesture. Module loading needs a same-origin
        URL, so the page has to be served over HTTP - see README.md.
    */
    async start() {
        if (this.ctx) {
            await this.ctx.resume();
            return;
        }
        if (this.starting) return this.starting;

        const ctx = new AudioContext();
        this.starting = this.build(ctx);
        try {
            await this.starting;
        } finally {
            // Cleared on failure too, so a retry is possible after the page has
            // been served correctly.
            this.starting = null;
        }
    }

    async build(ctx) {

        try {
            await ctx.audioWorklet.addModule("./vendor/pink_trombone_processor.js");
        } catch (cause) {
            await ctx.close();
            throw new Error(
                "Could not load the Pink Trombone AudioWorklet. This page has to be " +
                    "served over HTTP, it will not run from a file:// path. " +
                    "Underlying error: " +
                    cause.message,
            );
        }

        // A detached canvas: TractUI draws into it and its mouse handlers can
        // never fire, so the sequencer is never fighting a pointer.
        this.voice = new MPT_Voice("demo", ctx, document.createElement("canvas"));
        this.voice.connect(ctx.destination);
        this.voice.tract.parameters.get("fricative-strength").value = 1;
        this.applyMovementSpeed();

        this.ctx = ctx;
        await ctx.resume();
    }

    applyMovementSpeed() {
        if (!this.voice) return;
        this.voice.tract.parameters.get("movement-speed").value = this.movementSpeed;
    }

    stop() {
        if (!this.voice) return;
        for (const channel of CHANNELS) {
            channel.param(this.voice).cancelScheduledValues(0);
        }
        this.voice.gainNode.gain.cancelScheduledValues(0);
        this.voice.gainNode.gain.value = 0;
        this.playing = false;
    }

    /*
        Play `utterance`, optionally starting at segment `from` with no ramp-in.
        Returns the index of the first segment that will sound.
    */
    play(utterance, from = 0) {
        if (!this.voice) throw new Error("Engine has not been started.");

        const keys = toKeyframes(utterance);
        const start = Math.min(Math.max(from, 0), keys.length - 1);
        const base = start === 0 ? 0 : keys[start - 1].at;
        const t0 = this.ctx.currentTime + LEAD;

        const relative = key => key.at - base + t0;

        // Append one synthetic key that releases voicing, so the tail key
        // participates in the same scheduling pass as every other parameter.
        const last = keys[keys.length - 1];
        keys.push({
            at: last.at + TAIL,
            ramp: TAIL,
            params: { ...last.params, voiced: 0 },
            segment: null,
        });

        const end = relative(keys[keys.length - 1]) + RELEASE;

        for (const channel of CHANNELS) {
            const audioParam = channel.param(this.voice);
            audioParam.cancelScheduledValues(0);
            audioParam.setValueAtTime(channel.of(keys[start].params), t0);

            // `scheduled` tracks the last time this parameter already has an
            // event at. A hold event is only needed when the next ramp starts
            // after that point; inserting one otherwise would place an event
            // fractionally before an existing ramp and clip it.
            let scheduled = t0;
            for (let i = start + 1; i < keys.length; i++) {
                const target = relative(keys[i]);
                const rampStart = Math.max(t0, target - keys[i].ramp);
                if (rampStart > scheduled + 1e-9) {
                    audioParam.setValueAtTime(channel.of(keys[i - 1].params), rampStart);
                }
                audioParam.linearRampToValueAtTime(channel.of(keys[i].params), target);
                scheduled = target;
            }
        }

        // Guarantee silence afterwards: a final voiceless fricative would
        // otherwise hiss forever, since its noise path is independent of
        // glottal voicing. The cancel matters: replaying before a previous
        // fade-out has elapsed would otherwise let that older ramp cut the new
        // utterance short.
        const fricative = this.voice.tract.parameters.get("fricative-strength");
        fricative.cancelScheduledValues(0);
        fricative.setValueAtTime(1, t0);
        fricative.linearRampToValueAtTime(0, end);

        const gain = this.voice.gainNode.gain;
        gain.cancelScheduledValues(0);
        gain.setValueAtTime(1, t0);
        gain.setValueAtTime(1, end);
        gain.linearRampToValueAtTime(0, end + RELEASE);

        this.keys = keys;
        this.segments = utterance.segments;
        this.startTime = t0;
        this.base = base;
        this.endTime = end + RELEASE;
        this.playing = true;
        return start;
    }

    /*
        Index of the segment currently sounding, or -1 when idle.

        A segment owns its own duration: segment i runs from the moment segment
        i-1 reached its target, for `dur` seconds. That is what the `dur` values
        mean and it keeps the readout aligned with the segment chips. The tract
        is of course already moving toward segment i+1 across the ramp window
        before the boundary, which is the point of putting `ramp` in the data.
    */
    currentSegment() {
        if (!this.playing || !this.ctx) return -1;
        const t = this.ctx.currentTime;
        if (t >= this.endTime) {
            this.playing = false;
            return -1;
        }
        const local = t - this.startTime + this.base;
        let index = -1;
        for (let i = 0; i < this.segments.length; i++) {
            const start = i === 0 ? 0 : this.keys[i - 1].at;
            if (local >= start) index = i;
            else break;
        }
        return index;
    }

    /*
        The authored tongue value at the current moment, linearly interpolated
        across the ramp window. The tract outline itself comes from the audio
        thread and is exact; this only drives the tongue-position ring, which is
        a UI affordance rather than audio state.
    */
    currentShape() {
        const index = this.currentSegment();
        if (index < 0) return null;

        const t = this.ctx.currentTime;
        const here = this.keys[index];
        const target = here.at - this.base + this.startTime;
        const previous = index === 0 ? null : this.keys[index - 1];
        const from = previous ? previous.params : here.params;
        const rampStart = Math.max(this.startTime, target - here.ramp);

        const span = target - rampStart;
        const mix = span <= 0 ? 1 : Math.min(1, Math.max(0, (t - rampStart) / span));

        return {
            index,
            ramp: mix,
            tongue: [
                from.tongue[0] + (here.params.tongue[0] - from.tongue[0]) * mix,
                from.tongue[1] + (here.params.tongue[1] - from.tongue[1]) * mix,
            ],
            params: here.params,
        };
    }

    /*
        Draw the vendored TractUI into a detached canvas and blit it. Returns
        false until the audio thread has reported its first block.
    */
    render(ctx2d, width, height) {
        if (!this.voice || !this.voice.d) return false;
        this.voice.UI.draw();
        ctx2d.drawImage(this.voice.UI.cnv, 0, 0, width, height);
        return true;
    }
}

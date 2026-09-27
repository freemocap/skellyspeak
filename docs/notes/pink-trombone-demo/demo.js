import { TromboneEngine } from "./engine.js";
import { UTTERANCES, describeShape, resolveShape, utteranceDuration } from "./utterances.js";

const engine = new TromboneEngine();

const libraryEl = document.getElementById("library");
const noteEl = document.getElementById("note");
const chipsEl = document.getElementById("chips");
const readoutEl = document.getElementById("readout");
const statusEl = document.getElementById("status");
const enableEl = document.getElementById("enable");
const playEl = document.getElementById("play");
const stopEl = document.getElementById("stop");
const speedEl = document.getElementById("speed");
const speedValueEl = document.getElementById("speed-value");
const canvas = document.getElementById("tract");
const ctx2d = canvas.getContext("2d");

let selected = UTTERANCES[0];
let live = -1;

/* --- library -------------------------------------------------------- */

const groups = new Map();
for (const utterance of UTTERANCES) {
    if (!groups.has(utterance.group)) groups.set(utterance.group, []);
    groups.get(utterance.group).push(utterance);
}

for (const [name, items] of groups) {
    const section = document.createElement("div");
    section.className = "group";
    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = name;
    section.append(title);

    for (const utterance of items) {
        const button = document.createElement("button");
        button.className = "item";
        button.type = "button";
        button.append(utterance.label);
        const ipa = document.createElement("span");
        ipa.className = "ipa";
        ipa.textContent = utterance.ipa;
        button.append(ipa);
        button.addEventListener("click", () => select(utterance));
        utterance._button = button;
        section.append(button);
    }
    libraryEl.append(section);
}

/* --- selection ------------------------------------------------------ */

function select(utterance) {
    selected = utterance;
    for (const item of UTTERANCES) {
        item._button.setAttribute("aria-current", String(item === utterance));
    }
    noteEl.textContent = `${utterance.label} — ${utterance.note}`;
    buildChips();
    updateReadout(null);
}

function buildChips() {
    chipsEl.replaceChildren();
    selected.segments.forEach((segment, index) => {
        const chip = document.createElement("button");
        chip.className = "chip";
        chip.type = "button";
        const name = typeof segment.shape === "string" ? segment.shape : "inline";
        chip.textContent = `${index + 1}. ${name} ${segment.dur.toFixed(2)}s`;
        chip.title = "Play from here";
        chip.addEventListener("click", () => play(index));
        chipsEl.append(chip);
    });
}

/* --- transport ------------------------------------------------------ */

async function enable() {
    try {
        await engine.start();
        statusEl.textContent = "Audio is on.";
        statusEl.classList.remove("error");
        enableEl.disabled = true;
        playEl.disabled = false;
        stopEl.disabled = false;
    } catch (error) {
        statusEl.textContent = error.message;
        statusEl.classList.add("error");
    }
}

function play(from = 0) {
    if (!engine.ready) return;
    live = engine.play(selected, from);
}

enableEl.addEventListener("click", enable);
playEl.addEventListener("click", () => play(0));
stopEl.addEventListener("click", () => {
    engine.stop();
    live = -1;
});

speedEl.addEventListener("input", () => {
    engine.movementSpeed = Number(speedEl.value);
    speedValueEl.textContent = speedEl.value;
    engine.applyMovementSpeed();
});

/* --- readout and render loop ---------------------------------------- */

function updateReadout(shape) {
    readoutEl.replaceChildren();
    const resolved = shape ?? resolveShape(selected.segments[0]);
    for (const [label, value] of describeShape(resolved)) {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = label;
        const amount = document.createElement("td");
        amount.textContent = value;
        row.append(name, amount);
        readoutEl.append(row);
    }
}

function frame() {
    const width = canvas.width;
    const height = canvas.height;

    ctx2d.fillStyle = "#1c1f25";
    ctx2d.fillRect(0, 0, width, height);

    // Playback has ended: drop the highlight rather than leaving the last
    // segment looking live.
    if (engine.ready && !engine.playing && live >= 0) {
        live = -1;
        for (const chip of chipsEl.children) chip.dataset.live = "false";
        statusEl.textContent = "Ready.";
    }

    if (engine.render(ctx2d, width, height)) {
        // The tract outline is exact (it comes from the audio thread). The
        // tongue-position ring is a UI affordance, so follow the authored ramp.
        const shape = engine.currentShape();
        if (shape) {
            engine.voice.UI.tongueIndex = shape.tongue[0];
            engine.voice.UI.tongueDiameter = shape.tongue[1];
            engine.voice.UI.draw();
            ctx2d.drawImage(engine.voice.UI.cnv, 0, 0, width, height);
        }
        if (shape && shape.index !== live) {
            live = shape.index;
            updateReadout(shape.params);
            [...chipsEl.children].forEach((chip, index) => {
                chip.dataset.live = String(index === live);
            });
            statusEl.textContent =
                `Segment ${live + 1} of ${selected.segments.length}` +
                ` · ${utteranceDuration(selected).toFixed(2)}s total`;
        }
    } else if (engine.enabled) {
        ctx2d.fillStyle = "#6f7883";
        ctx2d.font = "24px system-ui, sans-serif";
        ctx2d.textAlign = "center";
        ctx2d.fillText("waiting for the audio thread…", width / 2, height / 2);
    }

    requestAnimationFrame(frame);
}

select(selected);
requestAnimationFrame(frame);

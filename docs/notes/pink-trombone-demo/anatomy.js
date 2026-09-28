/*
    An anatomically readable alternative to the vendored tract renderer.

    The model underneath is unchanged: the tract processor still reports one
    cross-sectional diameter per station, 44 of them, glottis to lips. That is
    the same class of data an articulatory synthesiser works in. The vendored
    TractUI draws those 44 numbers as a fan of spokes around a pivot, which is
    an impedance diagram. This module draws the same 44 numbers as a tongue in a
    side-on head.

    WHAT IS MODELLED, AND WHAT IS SCENERY
    -------------------------------------
    Modelled by the audio engine, and therefore honest in this picture:
      - the tongue surface, as the floor of the tract
      - the constriction, which is a narrowing of that same surface
      - the lip aperture
      - the velum, which opens and closes the nasal port
      - voicing, at the glottis

    NOT modelled by the audio engine. These are drawn as fixed scenery:
      - the jaw does not rotate
      - there is no separate tongue tip and tongue body; one surface does both
      - the larynx does not rise or fall
      - the nasal cavity, teeth and skull are decoration

    So this is an interpretation of a one-dimensional tube, not measured
    anatomy. It is honest about the tongue, the lips, the velum and voicing,
    and it is scenery everywhere else.

    THE MAPPING
    -----------
    A path is laid down for the tract roof - the posterior pharyngeal wall, then
    the soft palate, the hard palate, the alveolar ridge and the upper lip. It
    is resampled to 44 stations at equal arc length, and at each station the
    floor is placed at

        floor = roof + normal * diameter * PX_PER_CM

    Holding the roof still and letting the moving surface fall out of the area
    function is what the "reference palate" articulatory models do, and it is
    the reason this works at all: the palate is bone, so it does not move.

    Proportions are plausible rather than measured. The tract runs about 17 cm
    glottis to lips at PX_PER_CM, which is roughly an adult male.
*/

export const PX_PER_CM = 16;
export const STATIONS = 44;

// The whole diagram is offset so the head sits centred in a 600x600 view.
const OFFSET_X = 18;
const OFFSET_Y = 4;

// Head in profile, facing right. Closed outline, clockwise from the crown:
// down the face, under the jaw, down the neck, then up the back of the skull.
// Extra points crowd the nose, the lips and the chin, because a Catmull-Rom
// spline rounds off any feature whose neighbours are not close to it.
export const HEAD = [
    [300, 78], [360, 88], [400, 118], [418, 160], [414, 182],
    [424, 196], [444, 218], [466, 240], [484, 256], [470, 270],
    [452, 280], [454, 292], [452, 306], [446, 320], [442, 338],
    [438, 358], [406, 376], [360, 388], [332, 406], [318, 436],
    [314, 560], [216, 560], [202, 460], [192, 380], [188, 280],
    [192, 190], [214, 130], [256, 96],
];

// The tract roof, glottis first, lips last. Roughly 330 px glottis to lips,
// which at PX_PER_CM is a tract about 20 cm long - an adult, maybe a tall one.
export const ROOF = [
    [302, 468], [294, 430], [288, 395], [285, 362], [286, 335], [292, 315],
    [304, 300], [322, 291], [348, 286], [382, 283], [412, 286], [432, 294],
    [446, 303], [452, 312],
];

// Nasal cavity: the arch over the palate, nostrils at the front, velum at the
// back. Drawn as a band, so this is its upper edge.
const NASAL = [
    [452, 272], [440, 248], [416, 232], [384, 224], [352, 226], [326, 238],
    [310, 262], [304, 284],
];

// Floor of the mouth: inner lower lip, back along the inside of the jaw, then
// up behind the tongue root toward the glottis.
const MOUTH_FLOOR = [
    [446, 328], [436, 356], [414, 376], [376, 390], [340, 396], [318, 400],
    [307, 406],
];

// The tongue polygon starts here rather than at the glottis. The model's tube
// is only 0.6 cm across at the glottis, so a polygon drawn from station 0
// pinches into a thread; the narrow throat is better left as airway.
const TONGUE_FROM = 8;

/* --- geometry helpers ------------------------------------------------ */

/*
    Catmull-Rom through the given points. `open` matters: the head and the
    nasal cavity are closed outlines, but the tract roof and the mouth floor are
    open paths. Wrapping an open path joins its last point back to its first,
    which for the tract roof would run a phantom segment from the lips down
    through the middle of the head to the glottis.
*/
function spline(points, samples = 600, open = false) {
    const n = points.length;
    const segments = open ? n - 1 : n;
    const at = (k) => points[open ? Math.min(Math.max(k, 0), n - 1) : (k + n) % n];
    const out = [];
    for (let s = 0; s < samples; s++) {
        const t = (s / samples) * segments;
        const i = Math.floor(t);
        const f = t - i;
        const [x0, y0] = at(i - 1);
        const [x1, y1] = at(i);
        const [x2, y2] = at(i + 1);
        const [x3, y3] = at(i + 2);
        const f2 = f * f;
        const f3 = f2 * f;
        out.push([
            0.5 * (2 * x1 + (-x0 + x2) * f + (2 * x0 - 5 * x1 + 4 * x2 - x3) * f2 + (-x0 + 3 * x1 - 3 * x2 + x3) * f3),
            0.5 * (2 * y1 + (-y0 + y2) * f + (2 * y0 - 5 * y1 + 4 * y2 - y3) * f2 + (-y0 + 3 * y1 - 3 * y2 + y3) * f3),
        ]);
    }
    if (open) out.push(points[n - 1]);
    return out;
}

function resample(path, count) {
    const lengths = [0];
    for (let i = 1; i < path.length; i++) {
        lengths.push(lengths[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    }
    const total = lengths[lengths.length - 1];
    const out = [];
    let segment = 0;
    for (let i = 0; i < count; i++) {
        const target = (i / (count - 1)) * total;
        while (segment < lengths.length - 2 && lengths[segment + 1] < target) segment++;
        const span = lengths[segment + 1] - lengths[segment] || 1;
        const f = (target - lengths[segment]) / span;
        const a = path[segment];
        const b = path[segment + 1];
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return out;
}

function poly(ctx2d, points) {
    points.forEach(([x, y], i) => (i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y)));
}

/*
    Mirrors the tract processor's static geometry: the resting tube, the tongue
    inscription, and the constriction, in the processor's own units.

    This is here so a shape can be drawn without playing it, and so the picture
    is not blank before audio starts. Once audio is running the live diameter
    array from the processor is used instead, because that carries the model's
    own movement smoothing.

    Constants and formulae are transcribed from getTargetDiameters() in
    vendor/pink_trombone_processor.js. If upstream changes, this drifts.
*/
export function diametersFor(shape = {}, n = STATIONS) {
    const bladeStart = Math.floor((10 * n) / 44);
    const tipStart = Math.floor((32 * n) / 44);
    const lipStart = Math.floor((39 * n) / 44);
    const [tongueIndex, tongueDiameter] = shape.tongue ?? [12.9, 2.43];

    const out = [];
    for (let i = 0; i < n; i++) {
        let diameter;
        if (i < (7 * n) / 44 - 0.5) diameter = 0.6;
        else if (i < (12 * n) / 44) diameter = 1.1;
        else diameter = 1.5;

        if (i >= bladeStart && i < lipStart) {
            const t = (1.1 * Math.PI * (tongueIndex - i)) / (tipStart - bladeStart);
            const fixed = 2 + (tongueDiameter - 2) / 1.5;
            let curve = (1.5 - fixed + 1.7) * Math.cos(t);
            if (i === bladeStart - 2 || i === lipStart - 1) curve *= 0.8;
            if (i === bladeStart || i === lipStart - 2) curve *= 0.94;
            diameter = 1.5 - curve;
        }
        out.push(diameter);
    }

    // The constriction, laid over the tongue shape. The processor writes into
    // targetDiameter as: if (dia < target) target = dia + (target-dia)*shrink,
    // where shrink widens the narrowing toward its edges.
    const constriction = shape.constriction;
    if (constriction) {
        const [index, value] = constriction;
        const dia = Math.max(value, 0);
        if (index && index >= 2 && index < n && dia < 3) {
            // width = map(index, 25/44*n, tipStart, 10, 5)/44*n, clamped to [5,10]
            const from = (25 * n) / 44;
            let mapped = 5;
            if (tipStart !== from) mapped = 10 + ((index - from) * (5 - 10)) / (tipStart - from);
            mapped = Math.min(Math.max(mapped, 5), 10);
            const width = ((mapped / 44) * n) / 2;

            const centre = Math.round(index);
            for (let k = -Math.ceil(width) - 1; k < width + 1; k++) {
                const j = centre + k;
                if (j < 0 || j >= n) continue;
                const relpos = Math.abs(j - index) - 0.5;
                let shrink;
                if (relpos <= 0) shrink = 0;
                else if (relpos > width) shrink = 1;
                else shrink = 0.5 * (1 - Math.cos((Math.PI * relpos) / width));
                if (dia < out[j]) out[j] = dia + (out[j] - dia) * shrink;
            }
        }
    }

    return out.map((d) => Math.max(d, 0.05));
}

export function restDiameters(n = STATIONS) {
    return diametersFor({}, n);
}

function tractFor(diameter, n = STATIONS) {
    const roof = resample(spline(ROOF, 900, true), n);
    const floor = [];
    for (let i = 0; i < n; i++) {
        const a = roof[Math.max(i - 1, 0)];
        const b = roof[Math.min(i + 1, n - 1)];
        let dx = b[0] - a[0];
        let dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        // Rotate the heading so the normal points into the airway.
        const d = (diameter[i] ?? 1.5) * PX_PER_CM;
        floor.push([roof[i][0] + -dy * d, roof[i][1] + dx * d]);
    }
    return { roof, floor };
}

/* --- drawing --------------------------------------------------------- */

const BG = "#0d1015";
const TISSUE = "#242b36";
const TISSUE_LINE = "#525d6e";
const CAVITY = "#05070a";
const TONGUE = "#c2859a";
const TONGUE_LINE = "#e0aabc";
const BONE = "#77839a";
const TOOTH = "#e6ebf2";
const VELUM = "#d09aae";
const ACCENT = "#f0a0cc";
const LABEL = "rgba(206,214,226,0.72)";

export function drawAnatomy(ctx2d, options) {
    const {
        diameter = restDiameters(),
        velum = 0.01,
        voiced = 0,
        pitch = 120,
        time = 0,
        width = 600,
        height = 600,
    } = options;

    ctx2d.save();
    ctx2d.fillStyle = BG;
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.translate(OFFSET_X, OFFSET_Y);
    ctx2d.lineJoin = "round";
    ctx2d.lineCap = "round";

    // --- head ---
    ctx2d.beginPath();
    poly(ctx2d, spline(HEAD, 900));
    ctx2d.closePath();
    ctx2d.fillStyle = TISSUE;
    ctx2d.fill();
    ctx2d.strokeStyle = TISSUE_LINE;
    ctx2d.lineWidth = 2.5;
    ctx2d.stroke();

    // Ear and eye. Neither is modelled and neither is needed for speech, but
    // without them a profile reads as an anonymous blob rather than a head.
    ctx2d.strokeStyle = TISSUE_LINE;
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(296, 232);
    ctx2d.bezierCurveTo(268, 244, 264, 288, 288, 300);
    ctx2d.bezierCurveTo(302, 306, 310, 288, 306, 268);
    ctx2d.bezierCurveTo(304, 254, 302, 240, 296, 232);
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.moveTo(288, 262);
    ctx2d.bezierCurveTo(280, 272, 280, 284, 290, 290);
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.moveTo(428, 194);
    ctx2d.bezierCurveTo(440, 198, 444, 206, 440, 214);
    ctx2d.stroke();

    const { roof, floor } = tractFor(diameter);

    // --- nasal cavity ---
    const nasal = spline(NASAL, 300);
    ctx2d.beginPath();
    poly(ctx2d, nasal);
    for (let i = nasal.length - 1; i >= 0; i--) {
        ctx2d.lineTo(nasal[i][0] + 30, nasal[i][1] + 16);
    }
    ctx2d.closePath();
    ctx2d.fillStyle = CAVITY;
    ctx2d.fill();

    // --- airway: the whole space between the roof and the moving floor ---
    ctx2d.beginPath();
    poly(ctx2d, roof);
    for (let i = floor.length - 1; i >= 0; i--) ctx2d.lineTo(floor[i][0], floor[i][1]);
    ctx2d.closePath();
    ctx2d.fillStyle = CAVITY;
    ctx2d.fill();

    // --- tongue, the moving part ---
    ctx2d.beginPath();
    poly(ctx2d, floor.slice(TONGUE_FROM));
    poly(ctx2d, spline(MOUTH_FLOOR, 200, true));
    ctx2d.closePath();
    ctx2d.fillStyle = TONGUE;
    ctx2d.fill();
    ctx2d.strokeStyle = TONGUE_LINE;
    ctx2d.lineWidth = 2;
    ctx2d.stroke();

    // --- hard palate: the bone over the roof, stations 26 to 38 ---
    ctx2d.beginPath();
    poly(ctx2d, roof.slice(26, 39));
    for (let i = 38; i >= 26; i--) {
        ctx2d.lineTo(roof[i][0] - 12, roof[i][1] - 13);
    }
    ctx2d.closePath();
    ctx2d.fillStyle = BONE;
    ctx2d.fill();

    // --- teeth: upper incisors, hung from the alveolar ridge ---
    for (let i = 34; i < 39; i++) {
        const [x, y] = roof[i];
        ctx2d.save();
        ctx2d.translate(x, y);
        ctx2d.fillStyle = TOOTH;
        ctx2d.fillRect(-2.5, 0, 5, 9);
        ctx2d.restore();
    }

    // --- velum: hangs off the soft palate and swings with the nasal port ---
    // The audio engine has the velum at 0.01 for oral sounds and 0.40 for
    // nasals, so that range drives the swing.
    const port = Math.min(Math.max(velum / 0.4, 0), 1);
    const hinge = roof[23];
    const tipX = hinge[0] + 6 - port * 14;
    const tipY = hinge[1] + 20 + port * 18;
    ctx2d.beginPath();
    ctx2d.moveTo(hinge[0] - 10, hinge[1] - 6);
    ctx2d.quadraticCurveTo(hinge[0] - 1, hinge[1] + 10, tipX, tipY);
    ctx2d.quadraticCurveTo(hinge[0] + 8, hinge[1] + 9, hinge[0] + 2, hinge[1] - 2);
    ctx2d.closePath();
    ctx2d.fillStyle = VELUM;
    ctx2d.fill();

    // --- vocal folds at the glottis ---
    const fold = 0.5 + 0.5 * Math.abs(Math.sin((time * Math.PI * pitch) / 40));
    const opening = voiced > 0.01 ? 1.5 + fold * 8 : 1.5;
    const [gx, gy] = roof[0];
    for (const sign of [1, -1]) {
        ctx2d.beginPath();
        ctx2d.moveTo(gx + sign * 14, gy - 20);
        ctx2d.lineTo(gx + sign * (13 - opening), gy - 3);
        ctx2d.lineTo(gx + sign * 14, gy + 14);
        ctx2d.closePath();
        ctx2d.fillStyle = voiced > 0.01 ? ACCENT : TONGUE_LINE;
        ctx2d.fill();
    }

    // --- labels ---
    ctx2d.fillStyle = LABEL;
    ctx2d.font = "13px system-ui, sans-serif";
    ctx2d.textAlign = "left";
    ctx2d.fillText("nasal cavity", 322, 208);
    ctx2d.fillText("palate", 392, 256);
    ctx2d.fillText("velum", 232, 330);
    ctx2d.fillText("tongue", 356, 372);
    ctx2d.fillText("lips", 492, 302);
    ctx2d.fillText("pharynx", 214, 430);
    ctx2d.fillText("vocal folds", 232, 508);

    ctx2d.restore();
}

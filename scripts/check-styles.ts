import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type Declaration, type Root } from "postcss";

/// The stylesheet root. `index.css` is the manifest and `tokens.css` is the only
/// sheet that may hold literal values; every other sheet is owned by one surface.
const root = "src/styles";
const manifest = "index.css";
const tokens = "tokens.css";

/// Media queries cannot read custom properties, so the breakpoint set lives
/// here. A query on any other width or height fails the check.
const BREAKPOINTS = { width: [380, 480, 600, 860], height: [550] };

/// The one source module allowed to hold hex colours: the skill-domain palette.
/// Its values are data a component paints at runtime, and contrast.test.ts
/// measures them directly.
const PALETTE_MODULES = new Set(["src/domain/skills/skill-domains.ts"]);

const errors: string[] = [];
const sheets = readdirSync(root).filter((name) => name.endsWith(".css")).sort();

// ── Manifest ────────────────────────────────────────────────────────────────
const index = readFileSync(join(root, manifest), "utf8");
const imported = [...index.matchAll(/@import\s+'\.\/([\w.-]+\.css)'/g)].map((m) => m[1]);
for (const name of sheets) {
  if (name !== manifest && !imported.includes(name))
    errors.push(`${root}/${name}: exists but ${manifest} does not import it, so nothing loads it`);
}
for (const name of imported) {
  if (!sheets.includes(name)) errors.push(`${root}/${manifest}: imports ${name}, which does not exist`);
}
if (imported[0] !== tokens)
  errors.push(`${root}/${manifest}: ${tokens} must be the first import, so every later sheet can read the custom properties`);

const parsed: { name: string; path: string; css: Root }[] = sheets.map((name) => {
  const path = `${root}/${name}`;
  return { name, path, css: postcss.parse(readFileSync(path, "utf8"), { from: path }) };
});
const where = (path: string, node: { source?: { start?: { line: number } } }) =>
  `${path}:${node.source?.start?.line ?? 0}`;

// ── Custom properties: declared once, in tokens.css :root ──────────────────
const declared = new Set<string>();
for (const { name, path, css } of parsed) {
  css.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    const parent = decl.parent;
    if (name !== tokens || parent?.type !== "rule" || (parent as { selector?: string }).selector !== ":root")
      errors.push(`${where(path, decl)}: ${decl.prop} is declared outside ${tokens} :root; declare it there`);
    if (declared.has(decl.prop)) errors.push(`${where(path, decl)}: ${decl.prop} is declared twice`);
    declared.add(decl.prop);
  });
}

/// Every var() must name a declared token and carry no fallback: tokens.css
/// gives each one a default, so a fallback can only hide a typo.
function checkReferences(text: string, at: string) {
  for (const [, name, comma] of text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    if (!declared.has(name)) errors.push(`${at}: ${name} is not declared in ${tokens}`);
    if (comma) errors.push(`${at}: var(${name}, …) has a fallback; ${tokens} already gives it a default`);
  }
}

// ── Literal values outside tokens.css ──────────────────────────────────────
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const NAMED_COLOUR = /(^|[\s,(])(white|black)(?=$|[\s,)])/;
const COLOUR_PROPERTY = /^(color|background(-color)?|border(-[a-z-]+)?-color|border(-[a-z]+)*|outline(-color)?|fill|stroke|box-shadow|text-shadow|accent-color|caret-color|text-decoration(-color)?)$/;
const LENGTH = /(?<![\w-])-?\d*\.?\d+(px|rem|%)(?![\w-])/;
const TIME = /(?<![\w-])\d*\.?\d+m?s(?![\w-])/;

function literalProblem(decl: Declaration): string | null {
  const { prop, value } = decl;
  if (COLOUR_LITERAL.test(value)) return "a literal colour; use a semantic colour token";
  if (COLOUR_PROPERTY.test(prop) && NAMED_COLOUR.test(value)) return "a named colour; use a semantic colour token";
  if (value.includes("var(--c-")) return "a palette primitive; primitives are private to tokens.css";
  if (prop === "font-size" && /\d(px|rem)/.test(value)) return "a literal font size; use a --text-* token";
  if (prop === "font" && /\d(px|rem)/.test(value)) return "a literal font size; use a --text-* token";
  if (prop === "font-weight" && /^(\d+|bold|bolder|lighter)$/.test(value)) return "a literal font weight; use a --weight-* token";
  if (prop === "font" && /^(\d{3}|bold|bolder|lighter)\s/.test(value)) return "a literal font weight; use a --weight-* token";
  if (/radius$/.test(prop) && LENGTH.test(value)) return "a literal radius; use a --radius-* token";
  if (prop === "z-index" && !/^(var\(|auto$)/.test(value)) return "a literal layer; use a --z-* token";
  if (/^(transition|animation)(-duration|-delay)?$/.test(prop) && TIME.test(value)) return "a literal duration; use a --dur-* token";
  return null;
}

// ── Sheets ──────────────────────────────────────────────────────────────────
// One selector index shared across every sheet: a selector group owned twice is
// a defect no matter which file holds the second copy.
const seen = new Map<string, string>();
for (const { name, path, css } of parsed) {
  css.walkAtRules("media", (rule) => {
    for (const [, , axis, px] of rule.params.matchAll(/\((min|max)-(width|height)\s*:\s*(\d+)px\)/g)) {
      if (!BREAKPOINTS[axis as "width" | "height"].includes(Number(px)))
        errors.push(`${where(path, rule)}: ${axis} breakpoint ${px}px is not in BREAKPOINTS (${BREAKPOINTS[axis as "width" | "height"].join(", ")})`);
    }
  });
  css.walkRules((rule) => {
    const scope: string[] = [];
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === "atrule") scope.unshift(`@${parent.name} ${parent.params}`);
    }
    if (scope.some((s) => s.startsWith("@keyframes"))) return;
    const key = `${scope.join(" / ")} | ${rule.selector}`;
    const first = seen.get(key);
    if (first !== undefined)
      errors.push(`${where(path, rule)}: repeated selector ${rule.selector} in the same scope (first at ${first})`);
    seen.set(key, where(path, rule));

    const properties = new Set<string>();
    rule.each((node) => {
      if (node.type !== "decl") return;
      const at = where(path, node);
      if (properties.has(node.prop)) errors.push(`${at}: repeated property ${node.prop}`);
      properties.add(node.prop);
      if (node.important) errors.push(`${at}: !important is not permitted; resolve component ownership or specificity`);
    });
  });
  css.walkDecls((decl) => {
    const at = where(path, decl);
    checkReferences(decl.value, at);
    if (name === tokens) return;
    const problem = literalProblem(decl);
    if (problem) errors.push(`${at}: ${decl.prop}: ${decl.value} is ${problem}`);
  });
}

// ── TypeScript: the same token contract for inline styles and runtime writes ─
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
for (const path of sources("src")) {
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    checkReferences(line, at);
    for (const [, name] of line.matchAll(/(?:setProperty\(\s*|['"])(--[\w-]+)['"]?\s*[:,)]/g)) {
      if (!declared.has(name)) errors.push(`${at}: ${name} is written from TypeScript but not declared in ${tokens}`);
    }
    if (line.includes("var(--c-")) errors.push(`${at}: a palette primitive; primitives are private to tokens.css`);
    if (!PALETTE_MODULES.has(path) && /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\(/.test(line))
      errors.push(`${at}: a literal colour; reference a token (var(--…) or cssToken) instead`);
  });
}

if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `Styles: ${sheets.length} sheets, manifest complete, every token reference declared, no literal colours, sizes, weights, radii, durations or layers outside ${tokens}, breakpoints within the set, no repeated selectors or properties and no !important.`,
);

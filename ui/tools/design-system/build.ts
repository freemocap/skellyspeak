/// Regenerates the design system in docs/design-system/ from the application.
///
///   node ui/tools/design-system/build.ts            write generated files
///   node ui/tools/design-system/build.ts --check    fail if anything is stale
///   node ui/tools/design-system/build.ts --stage D  also assemble D/project/ for publishing
///
/// Hand-written (never touched here): README.md, components/<Name>/README.md,
/// components/Cover/preview.html, assets/<Group>/README.md, every token's name
/// and usage note. Generated: token VALUES (from tokens.css via meta.sourceVars),
/// components/bundle.css (the app cascade), components/<Name>/preview.html (real
/// components rendered by previews.tsx) and assets/Icons/*.svg (ToolbarIcon).
import { build } from "esbuild";
import postcss, { type Rule } from "postcss";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = "docs/design-system";
const STYLES = "ui/src/styles";
const FONTS = "ui/public/fonts";
const CACHE = "ui/node_modules/.cache/design-system";

const args = process.argv.slice(2);
const check = args.includes("--check");
const stageAt = args.includes("--stage") ? args[args.indexOf("--stage") + 1] : null;
const errors: string[] = [];
const outputs = new Map<string, string>();

// ── Token values ────────────────────────────────────────────────────────────
type Theme = "light" | "dark";
const sheet = postcss.parse(readFileSync(join(STYLES, "foundations/tokens.css"), "utf8"));
const declared: Record<Theme, Map<string, string>> = { light: new Map(), dark: new Map() };
sheet.each((node) => {
  if (node.type !== "rule") return;
  const selector = (node as Rule).selector.replace(/"/g, "'");
  const theme = selector === ":root" ? "light" : selector === ":root[data-theme='dark']" ? "dark" : null;
  if (theme) (node as Rule).walkDecls((decl) => { declared[theme].set(decl.prop, decl.value); });
});

function lookup(prop: string, theme: Theme): string {
  const value = (theme === "dark" && declared.dark.get(prop)) || declared.light.get(prop);
  if (value === undefined) throw new Error(`tokens.css does not declare ${prop}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => lookup(inner, theme));
}

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const alpha = (percent: string) => String(Number(percent) / 100);
/// Rewrites CSS Color 4 forms the design-system format cannot read into rgba().
function portable(value: string): string {
  return value
    .replace(/color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, transparent\)/gi, (_, hex: string, p: string) =>
      `rgba(${channel(hex, 0)},${channel(hex, 1)},${channel(hex, 2)},${alpha(p)})`)
    .replace(/rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/g, (_, r, g, b, p: string) => `rgba(${r},${g},${b},${alpha(p)})`)
    .replace(/#[0-9A-F]{3,8}\b/g, (hex) => hex.toLowerCase());
}
function length(value: string): string {
  const scaled = /^calc\((\d+(?:\.\d+)?px) \* var\(--layout-scale\)\)$/.exec(value);
  return scaled ? scaled[1] : value;
}

const tokensPath = join(OUT, "tokens.json");
const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
const sourceVars: Record<string, string> = tokens.meta.sourceVars;
function refresh(entry: { name: string; value: unknown }, family: string) {
  const prop = sourceVars[entry.name];
  if (!prop) {
    if (!(typeof entry.value === "string" && entry.value.startsWith("{"))) errors.push(`tokens.json ${entry.name}: no meta.sourceVars entry`);
    return;
  }
  try {
    if (family === "color" || family === "shadow") {
      const light = portable(lookup(prop, "light")), dark = portable(lookup(prop, "dark"));
      for (const v of [light, dark]) if (/var\(|color-mix|calc\(/.test(v)) errors.push(`${entry.name}: ${prop} resolves to ${v}, which the format cannot hold`);
      entry.value = light === dark ? light : { light, dark };
    } else entry.value = length(declared.light.get(prop) ?? lookup(prop, "light"));
  } catch (error) { errors.push(`${entry.name}: ${(error as Error).message}`); }
}
for (const family of ["color", "spacing", "radius", "shadow", "control"])
  for (const entry of tokens[family]?.tokens ?? []) refresh(entry, family);
for (const group of tokens.type.groups) for (const style of group.styles) {
  const prop = sourceVars[style.name];
  if (prop) style.fontSize = lookup(prop, "light");
}
outputs.set(tokensPath, JSON.stringify(tokens, null, 1) + "\n");

// ── bundle.css: the app cascade, in manifest order ──────────────────────────
function inline(file: string): string {
  return readFileSync(file, "utf8").replace(/^@import '\.\/([\w./-]+)';$/gm, (_, path: string) =>
    `/* ── ${path} ── */\n${inline(join(dirname(file), path))}`);
}
const cascade = postcss.parse(inline(join(STYLES, "index.css")));
cascade.walkAtRules("font-face", (rule) => { rule.remove(); }); // the system's own tokens.css declares the fonts
outputs.set(join(OUT, "components/bundle.css"), `/* GENERATED by ui/tools/design-system/build.ts from ui/src/styles/index.css — do not edit. */
${cascade.toString().trim()}

/* Preview frame only: the app shell pins body to the window and hides overflow. */
html, body { height: auto; overflow: visible; }
body { padding: 16px; background: var(--sheet); }
.ds-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.ds-stack { max-width: 360px; }
.ds-text { margin: 0; font-size: var(--type-body); }
.ds-inline-dialog { position: static; margin: 0; }
`);

// ── Previews and icons: real components ─────────────────────────────────────
mkdirSync(CACHE, { recursive: true });
const bundled = join(CACHE, "previews.mjs");
/// Vite's eager `import.meta.glob` (used for locale dictionaries) as static imports.
const viteGlob = {
  name: "vite-glob",
  setup(plugin: { onLoad: Function }) {
    plugin.onLoad({ filter: /\.tsx?$/ }, (file: { path: string }) => {
      const source = readFileSync(file.path, "utf8");
      if (!source.includes("import.meta.glob")) return undefined;
      const contents = source.replace(/import\.meta\.glob(?:<[^>]*>)?\('\.\/([\w-]+)\/\*\.json', \{ eager: true, import: 'default' \}\)/g, (_, folder: string) => {
        const entries = readdirSync(join(dirname(file.path), folder)).filter((name) => name.endsWith(".json"))
          .map((name) => `${JSON.stringify(`./${folder}/${name}`)}: require(${JSON.stringify(`./${folder}/${name}`)})`);
        return `({ ${entries.join(", ")} })`;
      });
      return { contents, loader: file.path.endsWith("x") ? "tsx" : "ts", resolveDir: dirname(file.path) };
    });
  },
};
await build({
  entryPoints: ["ui/tools/design-system/previews.tsx"], outfile: bundled, bundle: true, format: "esm",
  platform: "node", jsx: "automatic", external: ["react", "react-dom"], logLevel: "error", plugins: [viteGlob],
});
// Components read the document (UI direction, media queries) while rendering.
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html lang='en'><body></body></html>", { pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { render } = await import(pathToFileURL(resolve(bundled)).href + `?t=${Date.now()}`);
const rendered = render() as { previews: { name: string; group: string; height: number; html: string }[]; icons: { name: string; svg: string }[] };
const generatedCards = new Set<string>();
for (const { name, group, height, html } of rendered.previews) {
  generatedCards.add(name);
  if (!existsSync(join(OUT, "components", name, "README.md"))) errors.push(`components/${name}/README.md is missing`);
  outputs.set(join(OUT, "components", name, "preview.html"), `<!-- @dsCard group="${group}" height=${height} -->
<!-- GENERATED by ui/tools/design-system/build.ts from ui/tools/design-system/previews.tsx — do not edit. Static render of the real component. -->
${html}
`);
}
const ink = declared.light.get("--c-spectrum-ink")!;
for (const { name, svg } of rendered.icons)
  outputs.set(join(OUT, "assets/Icons", `${name}.svg`), svg
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(' aria-hidden="true"', "")
    .replaceAll("currentColor", ink) + "\n");
for (const dir of readdirSync(join(OUT, "components"), { withFileTypes: true }))
  if (dir.isDirectory() && dir.name !== "Cover" && !generatedCards.has(dir.name))
    errors.push(`components/${dir.name}/ has no preview in previews.tsx`);

// ── Write or check ──────────────────────────────────────────────────────────
let stale = 0;
for (const [path, text] of outputs) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === text) continue;
  stale++;
  if (check) errors.push(`${path} is stale; run node ui/tools/design-system/build.ts`);
  else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); console.log(`wrote ${path}`); }
}

if (stageAt && !errors.length) {
  const project = join(stageAt, "project");
  rmSync(project, { recursive: true, force: true });
  cpSync(OUT, project, { recursive: true, filter: (src) => !src.endsWith(".svg") });
  mkdirSync(join(project, "fonts"), { recursive: true });
  for (const font of tokens.type.fonts) cpSync(join(FONTS, font.file.replace(/^fonts\//, "")), join(project, font.file));
  for (const file of readdirSync(FONTS)) if (file.endsWith("-OFL.txt")) cpSync(join(FONTS, file), join(project, "fonts", file));
  console.log(`staged ${project} (icons are uploads; publish assets/Icons/*.svg from ${OUT} separately)`);
}

if (errors.length) { for (const error of errors) console.error(error); process.exit(1); }
console.log(check ? "design system is current" : `${stale} file(s) updated`);

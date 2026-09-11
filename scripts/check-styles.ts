import { readFileSync } from "node:fs";
import postcss from "postcss";

const path = "src/styles.css";
const root = postcss.parse(readFileSync(path, "utf8"), { from: path });
const seen = new Map<string, number>();
const errors: string[] = [];
root.walkRules((rule) => {
  const scope: string[] = [];
  for (
    let parent: typeof rule.parent | typeof root.parent = rule.parent;
    parent;
    parent = parent.parent
  ) {
    if (parent.type === "atrule")
      scope.unshift(`@${parent.name} ${parent.params}`);
  }
  for (const selector of [rule.selector]) {
    const key = `${scope.join(" / ")} | ${selector}`;
    const line = rule.source?.start?.line ?? 0;
    const previous = seen.get(key);
    if (previous !== undefined)
      errors.push(
        `${path}:${line}: repeated selector ${selector} in the same scope (first at ${previous})`,
      );
    seen.set(key, line);
  }
  const properties = new Set<string>();
  rule.each((node) => {
    if (node.type !== "decl") return;
    const location = `${path}:${node.source?.start?.line ?? 0}`;
    if (properties.has(node.prop))
      errors.push(`${location}: repeated property ${node.prop}`);
    properties.add(node.prop);
    if (node.important)
      errors.push(
        `${location}: !important is not permitted; resolve component ownership or specificity`,
      );
  });
});
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Styles: no repeated selectors in the same scope, duplicate properties or !important declarations.",
);

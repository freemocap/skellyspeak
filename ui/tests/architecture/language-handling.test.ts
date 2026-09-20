import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import ts from 'typescript'
import { buildGraph, isTestFile } from '../../../tools/import-graph'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))

/** Check actual regex/string syntax, not translated labels or comments. Unicode
 * script interpretation belongs to the language owner; renderers ask capabilities. */
function scriptMatchers(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const matches: string[] = []
  function visit(node: ts.Node) {
    if ((ts.isRegularExpressionLiteral(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && /\\[pP]\{(?:Script|Script_Extensions|sc|scx)=/.test(node.getText(file))) matches.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return matches
}

it('keeps Unicode script matching inside language handling', () => {
  const modules = buildGraph(repositoryRoot).modules.filter(path => path.startsWith('ui/src/')
    && /\.tsx?$/.test(path) && !isTestFile(path)
    && !path.startsWith('ui/src/generated/') && !path.startsWith('ui/src/domain/language/'))
  expect(modules.length).toBeGreaterThan(50)
  const violations = modules.flatMap(path => scriptMatchers(path, readFileSync(repositoryRoot + path, 'utf8')).map(match => `${path}: ${match}`))
  expect(violations).toEqual([])
})

it('catches script regexes and constructor strings while allowing plain labels', () => {
  expect(scriptMatchers('example.ts', String.raw`const a = /\p{Script=Arabic}/u; const b = new RegExp('\\p{sc=Devanagari}', 'u'); const label = 'Arabic'; // \p{Script=Latin}`)).toHaveLength(2)
})

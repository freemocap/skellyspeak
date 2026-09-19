import ts from 'typescript'

// Brand names, measurement symbols and diagnostic field identifiers retain
// their exact spelling. This is not an exemption for user-facing prose.
const literalTerms = new Set(['AI', 'XP', 'SKELLYSPEAK', 'SkellySpeak', 'npm run tauri dev', 's', 'px', '· HTTP', 'avg_logprob', 'no_speech_prob'])
const textAttributes = new Set(['title', 'placeholder', 'aria-label', 'aria-valuetext', 'aria-description', 'alt', 'label'])

/** Inspect only rendered expressions: conditions, IDs and CSS are not prose. */
function renderedLiterals(node: ts.Node): string[] {
  if (ts.isStringLiteralLike(node)) return [node.text]
  if (ts.isParenthesizedExpression(node)) return renderedLiterals(node.expression)
  if (ts.isConditionalExpression(node)) return [...renderedLiterals(node.whenTrue), ...renderedLiterals(node.whenFalse)]
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return renderedLiterals(node.right)
    if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) return [...renderedLiterals(node.left), ...renderedLiterals(node.right)]
  }
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.flatMap(span => [...renderedLiterals(span.expression), span.literal.text])]
  return []
}

export function checkUiSource(file: string, text: string, keys: ReadonlySet<string>): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const errors: string[] = []
  const error = (node: ts.Node, message: string) => errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`)
  function checkText(node: ts.Node, values: string[]) {
    for (const text of values) {
      const value = text.trim()
      if (/\p{L}{2}/u.test(value) && !literalTerms.has(value)) error(node, `untranslated UI text ${JSON.stringify(value)}`)
    }
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source)
      if (['tr', 't', 'messageKey'].includes(name)) {
        const argument = node.arguments[name === 't' ? 1 : 0]
        if (argument) for (const key of renderedLiterals(argument)) if (!keys.has(key)) error(argument, `missing message ${JSON.stringify(key)}`)
      }
      if (file.endsWith('.tsx') && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toFixed') error(node, 'Use locale-aware number formatting in interface components.')
    }
    if (ts.isJsxText(node)) checkText(node, [node.text])
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) checkText(node, renderedLiterals(node.expression))
    if (ts.isJsxAttribute(node) && textAttributes.has(node.name.getText(source)) && node.initializer) {
      const expression = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
      if (expression) checkText(node, renderedLiterals(expression))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return errors
}

export function missingCatalogMessages(catalog: { label: string; description: string; criterion: string }[], keys: ReadonlySet<string>): string[] {
  return [...new Set(catalog.flatMap(node => [node.label, node.description, node.criterion]))].filter(key => !keys.has(key))
}

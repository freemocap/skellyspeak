export function renderDocument(template:string,data:unknown,script:string){
 // Replacement callbacks preserve literal $&, $' and $` in content and minified code.
 return template.replace('<!--DATA-->',()=>`<script type="application/json" id="prompt-explorer-data">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`)
  .replace('<!--SCRIPT-->',()=>`<script>${script.replaceAll('</script','<\\/script')}</script>`);
}

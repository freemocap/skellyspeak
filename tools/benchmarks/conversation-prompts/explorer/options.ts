/** Visible button alternatives to native selects; preserves the same change handlers. */
export function exposeOptions(root:HTMLElement){
 for(const select of root.querySelectorAll<HTMLSelectElement>('select')){
  select.hidden=true;
  const group=document.createElement('div');
  group.className='option-buttons';group.setAttribute('role','group');
  const label=select.parentElement?.childNodes[0]?.textContent?.trim()||'Options';
  group.setAttribute('aria-label',label);
  for(const option of select.options){
   const button=document.createElement('button');button.type='button';
   button.textContent=option.value===''?'All':option.text.replace(/^Prompt (\d+) · /,'$1 · ');
   button.dataset.selectValue=option.value;
   button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change'));syncOptions(root);};
   group.append(button);
  }
  select.after(group);
 }
 syncOptions(root);
}
export function syncOptions(root:HTMLElement){
 for(const select of root.querySelectorAll<HTMLSelectElement>('select')){
  for(const button of select.nextElementSibling?.querySelectorAll<HTMLButtonElement>('button')??[]){
   button.setAttribute('aria-pressed',String(button.dataset.selectValue===select.value));
  }
 }
}

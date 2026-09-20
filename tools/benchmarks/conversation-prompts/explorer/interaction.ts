export type HighlightLayer={label:string;color:string;ids:Set<string>};
export const layerColors=['#ffca58','#ba9cff','#52e0d1','#ff86b5'];
export function installDivider(workspace:HTMLElement,divider:HTMLElement){
 let ratio=.62;
 const set=(value:number)=>{
  ratio=Math.max(.25,Math.min(.78,value));
  workspace.style.setProperty('--left-width',ratio*100+'%');
  divider.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
 };
 divider.onpointerdown=e=>{
  if(e.button!==0)return;
  divider.setPointerCapture(e.pointerId);
  const move=(event:PointerEvent)=>{const rect=workspace.getBoundingClientRect();set((event.clientX-rect.left)/rect.width);};
  divider.onpointermove=move;
  divider.onpointerup=()=>{divider.onpointermove=null;divider.onpointerup=null;};
  e.preventDefault();
 };
 divider.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  set(e.key==='Home'?.25:e.key==='End'?.78:ratio+(e.key==='ArrowRight'?.02:-.02));e.preventDefault();
 };
 divider.ondblclick=()=>set(.62);
 set(ratio);
}

export function installTopDivider(header:HTMLElement,divider:HTMLElement){
 let height=Math.min(header.scrollHeight,innerHeight*.45);
 const set=(value:number)=>{
  height=Math.max(64,Math.min(innerHeight*.75,value));
  header.style.height=height+'px';
  divider.setAttribute('aria-valuenow',String(Math.round(height)));
  divider.setAttribute('aria-valuemax',String(Math.round(innerHeight*.75)));
  divider.setAttribute('aria-valuetext',Math.round(height)+' pixels');
 };
 divider.onpointerdown=e=>{
  if(e.button!==0)return;
  const startY=e.clientY,startHeight=height;
  divider.setPointerCapture(e.pointerId);
  divider.onpointermove=event=>set(startHeight+event.clientY-startY);
  const stop=()=>{divider.onpointermove=null;divider.onpointerup=null;divider.onpointercancel=null;};
  divider.onpointerup=stop;divider.onpointercancel=stop;
  e.preventDefault();
 };
 divider.onkeydown=e=>{
  if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  set(e.key==='Home'?64:e.key==='End'?innerHeight*.75:height+(e.key==='ArrowDown'?20:-20));
  e.preventDefault();
 };
 divider.ondblclick=()=>set(Math.min(header.scrollHeight,innerHeight*.45));
 window.addEventListener('resize',()=>set(height));
 set(height);
}

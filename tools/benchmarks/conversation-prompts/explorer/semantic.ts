import type {HighlightLayer} from './interaction.ts';
import {name,prompts, type Row} from './compare.ts';
declare const Plotly:any;
const palette=['#5da7e7','#e7a251','#6fc29a','#d98ac3','#b0a8ec','#5bc9cb','#ed7777','#bac967'];
// React maintains camera position while selection changes; switching maps resets it.
export function semantic(el:HTMLElement,data:any,projectionIndex:number,rows:Row[],highlight:Set<string>|null,colorBy:string,choose:(r:Row[],label?:string)=>void,layers:HighlightLayer[]=[]){
 const p=data.projections.projections[projectionIndex],three=p.dimensions===3;
 const coordinate=new Map<string,number[]>(data.projections.hashes.map((h:string,i:number)=>[h,p.coordinates[i]]));
 const values=[...new Set(rows.map(r=>String(r[colorBy])))].sort((a,b)=>colorBy==='prompt'?prompts.indexOf(a)-prompts.indexOf(b)||a.localeCompare(b):a.localeCompare(b));
 const traces:any[]=[];
 const ink=getComputedStyle(el).color;
 for(const [i,value] of values.entries()){
  const group=rows.filter(r=>String(r[colorBy])===value);
  if(!group.length)continue;
  traces.push({type:three?'scatter3d':'scattergl',mode:'markers',name:name(value),legendgroup:value,showlegend:true,
   x:group.map(r=>coordinate.get(r.textHash)![0]),y:group.map(r=>coordinate.get(r.textHash)![1]),
   ...(three?{z:group.map(r=>coordinate.get(r.textHash)![2])}:{}),
   customdata:group.map(r=>r.id),text:group.map(r=>r.text.replaceAll('&','&amp;').replaceAll('<','&lt;')),
   hovertemplate:'%{text}<extra></extra>',
   ...(!three?{selected:{marker:{opacity:.85}},unselected:{marker:{opacity:.85}}}:{}),
   marker:{color:palette[i%palette.length],opacity:.85,size:6}});
 }
 // An extra hollow-marker layer adds emphasis without changing any base trace.
 for(const [layerIndex,layer] of layers.entries()){
  const group=rows.filter(r=>layer.ids.has(r.id));
  traces.push({type:three?'scatter3d':'scattergl',mode:'markers',name:'Highlight outline',showlegend:false,
   x:group.map(r=>coordinate.get(r.textHash)![0]),y:group.map(r=>coordinate.get(r.textHash)![1]),
   ...(three?{z:group.map(r=>coordinate.get(r.textHash)![2])}:{}),
   customdata:group.map(r=>r.id),hoverinfo:'skip',
   ...(!three?{selected:{marker:{opacity:1}},unselected:{marker:{opacity:1}}}:{}),
   marker:{symbol:'circle-open',color:layer.color,size:11+layerIndex*5,opacity:1,line:{color:layer.color,width:2}}});
 }
 
 Plotly.react(el,traces,{height:510,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:ink},
  margin:{t:20,r:15,b:45,l:40},uirevision:String(projectionIndex),dragmode:three?'orbit':'lasso',
  legend:{orientation:'h'},xaxis:{title:'Projection axis 1',gridcolor:'#515661'},yaxis:{title:'Projection axis 2',gridcolor:'#515661'},
  scene:{xaxis:{title:'Axis 1'},yaxis:{title:'Axis 2'},zaxis:{title:'Axis 3'},bgcolor:'transparent'}},
  {responsive:true,displaylogo:false}).then(()=>{
   const target=el as any;target.removeAllListeners('plotly_click');target.removeAllListeners('plotly_selected');target.removeAllListeners('plotly_legendclick');target.removeAllListeners('plotly_legenddoubleclick');
   const pick=(event:any)=>{if(!event?.points)return;const ids=new Set(event.points.map((v:any)=>v.customdata));choose(rows.filter(r=>ids.has(r.id)),'Semantic map selection');};
   target.on('plotly_legendclick',(event:any)=>{const value=traces[event.curveNumber].legendgroup;choose(rows.filter(r=>String(r[colorBy])===value),name(value));return false;});target.on('plotly_legenddoubleclick',()=>false);target.on('plotly_click',pick);target.on('plotly_selected',pick);
  });
}

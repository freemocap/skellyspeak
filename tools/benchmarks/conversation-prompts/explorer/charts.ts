import type {HighlightLayer} from './interaction.ts';
import {levels,prompts,name,type Row} from './compare.ts';
declare const d3:any;
const palette=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)'];
export function plot(el:SVGSVGElement,all:Row[],visible:Row[],selected:Set<string>|null,kind:string,measure:string,variance:number[],choose:(rows:Row[])=>void,layers:HighlightLayer[]=[]){
 const studyPrompts=[...new Set(all.map(r=>r.prompt))].sort((a,b)=>prompts.indexOf(a)-prompts.indexOf(b)||a.localeCompare(b));
 const width=el.parentElement!.clientWidth-2,height=kind==='semantic'?370:265;
 const svg=d3.select(el).attr('viewBox',`0 0 ${width} ${height}`);svg.selectAll('*').remove();
 const left=kind==='semantic'?65:105,right=width-22,top=22,bottom=height-54;
 const metric=kind==='strata'?'words':measure;
 const extent=d3.extent(all.map(r=>kind==='semantic'?r.x:r[metric]));const pad=(extent[1]-extent[0]||1)*.08;
 const x=d3.scaleLinear().domain([extent[0]-pad,extent[1]+pad]).range([left+7,right-7]);
 const ye=d3.extent(all.map(r=>r.y));const yp=(ye[1]-ye[0]||1)*.08;
 const y=kind==='semantic'?d3.scaleLinear().domain([ye[0]-yp,ye[1]+yp]).range([bottom-7,top+7]):d3.scalePoint().domain(levels).range([top+30,bottom-30]);
 const pos=(r:Row)=>[x(kind==='semantic'?r.x:r[metric]),kind==='semantic'?y(r.y):y(r.level)+((Number(r.trial.match(/-r(\d+)$/)?.[1]??0)-5.5)*3.4)];
 svg.append('rect').attr('x',left).attr('y',top).attr('width',right-left).attr('height',bottom-top).attr('fill','none').attr('stroke','var(--line)');
 svg.append('g').attr('transform',`translate(0,${bottom})`).call(d3.axisBottom(x).ticks(width<450?4:7));
 svg.append('g').attr('transform',`translate(${left},0)`).call(kind==='semantic'?d3.axisLeft(y).ticks(4):d3.axisLeft(y).tickFormat(name));
 if(kind==='strata')for(const [i,range]of [[3,5],[6,11],[13,23]].entries()){
  svg.append('rect').attr('x',x(range[0])).attr('y',y(levels[i])-23).attr('width',x(range[1])-x(range[0])).attr('height',46).attr('fill','var(--fg)').attr('opacity',.08);
 }
 const label=kind==='semantic'?`PC1 · ${(variance[0]*100).toFixed(1)}% variance`:metric==='words'?'Words per response':metric==='wordsPerSentence'?'Mean words per sentence':'Mean letters per word';
 svg.append('text').attr('x',(left+right)/2).attr('y',height-12).attr('text-anchor','middle').text(label);
 if(kind==='semantic')svg.append('text').attr('transform',`translate(16,${(top+bottom)/2}) rotate(-90)`).attr('text-anchor','middle').text(`PC2 · ${(variance[1]*100).toFixed(1)}% variance`);
 svg.append('g').selectAll('path').data(visible).join('path').attr('d',(r:Row)=>d3.symbol().type(r.persona==='persona'?d3.symbolCircle:d3.symbolDiamond).size(30)()).attr('transform',(r:Row)=>`translate(${pos(r)})`).attr('fill',(r:Row)=>palette[studyPrompts.indexOf(r.prompt)%palette.length]).attr('opacity',.66);
 // Hollow outlines are additive; base positions, colors, sizes and opacity stay fixed.
 for(const [i,layer] of layers.entries())svg.append('g').attr('class','highlight-outlines').selectAll('path').data(visible.filter(r=>layer.ids.has(r.id))).join('path')
  .attr('d',(r:Row)=>d3.symbol().type(r.persona==='persona'?d3.symbolCircle:d3.symbolDiamond).size(75+i*55)())
  .attr('transform',(r:Row)=>`translate(${pos(r)})`).attr('fill','none').attr('stroke',layer.color).attr('stroke-width',1.5).attr('pointer-events','none');
 const tooltip=document.querySelector<HTMLElement>('.tooltip')!;
 const near=(ev:any)=>{const [px,py]=d3.pointer(ev,el);const list=visible.map(r=>({r,d:Math.hypot(pos(r)[0]-px,pos(r)[1]-py)})).sort((a,b)=>a.d-b.d);return list.length&&list[0].d<22?list.filter(x=>x.d<=list[0].d+1).map(x=>x.r):[];};
 const brush=d3.brush().extent([[left,top],[right,bottom]]).on('end',(e:any)=>{
  if(!e.sourceEvent)return;tooltip.hidden=true;
  if(!e.selection){choose(near(e.sourceEvent));return;}
  const [[a,b],[c,d]]=e.selection;choose(visible.filter(r=>{const [px,py]=pos(r);return px>=a&&px<=c&&py>=b&&py<=d;}));
 });
 svg.append('g').call(brush).select('.overlay').on('mousemove',(e:MouseEvent)=>{const list=near(e);tooltip.hidden=!list.length;if(!list.length)return;tooltip.textContent=`${list[0].text} · ${name(list[0].level)}${list.length>1?` · ${list.length} overlapping responses`:''}`;tooltip.style.left=`${Math.max(5,Math.min(e.clientX+10,window.innerWidth-310))}px`;tooltip.style.top=`${Math.min(e.clientY+15,window.innerHeight-120)}px`;}).on('mouseleave',()=>tooltip.hidden=true);
}

import { ItemAccess } from './ItemAccess';
import { useId, useState } from 'react';
import type { DesignSection } from '../lib/design';
import type { Item } from '../lib/catalog';
import { logisticsRoutes } from '../lib/logisticsGraph';
import { LogisticsArrow } from './LogisticsArrow';
import '../styles/systemGraph.css';
export function VisualizeIcon(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="6" cy="7" r="3"/><circle cx="18" cy="5" r="2"/><circle cx="16" cy="18" r="4"/><path d="m9 7 7-2M8 10l5 5m5-8-1 7"/></svg>;}
export function SystemGraph({planets,items,onClose}:{planets:DesignSection[];items:Map<number,Item>;onClose:()=>void}){
 const [selected,setSelected]=useState<string|null>(null);
 const marker=useId().replace(/:/g,'');
 const width=Math.max(800,Math.ceil(planets.length/6)*250+550), height=Math.max(560,Math.ceil(planets.length/8)*180+380);
 const positions=planets.map((planet,index)=>{const angle=-Math.PI/2+index*2*Math.PI/Math.max(1,planets.length);return {planet,x:planets.length===1?width/2:width/2+Math.cos(angle)*(width/2-135),y:planets.length===1?height/2:height/2+Math.sin(angle)*(height/2-115)};});
 const routes=logisticsRoutes(planets,new Set(items.keys()));
 const active=positions.find(p=>p.planet.id===selected);
 return <section className="system-graph" aria-label="System logistics map">
  <div className="graph-toolbar"><div><h3>Orbital logistics</h3><p>Select a planet to inspect its cargo.</p></div><button className="design-button" onClick={onClose}>Back to details</button></div>
  {!planets.length?<p className="graph-empty">Add planets to this system to start its map.</p>:<div className="graph-scroll"><div className="graph-space" style={{width,height}}>
   <svg className="graph-routes" width={width} height={height} aria-label={`${routes.length} directed planet routes`}><defs>{['blue','green','muted'].map((color)=><marker key={color} id={`${marker}-${color}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8 2 4Z" fill={color==='blue'?'#79caff':color==='green'?'#9bdfad':'#668c9b'}/></marker>)}</defs><ellipse cx={width/2} cy={height/2} rx={width/2-135} ry={height/2-115} fill="none" stroke="#7896aa18" strokeDasharray="3 12"/>{routes.map(route=>{
    const a=positions.find(p=>p.planet.id===route.from)!,b=positions.find(p=>p.planet.id===route.to)!;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);const color=selected===route.to?'blue':selected===route.from?'green':'muted';
    return <path key={`${route.from}-${route.to}`} d={`M ${a.x+dx/len*42} ${a.y+dy/len*42} Q ${(a.x+b.x)/2-dy*.13} ${(a.y+b.y)/2+dx*.13} ${b.x-dx/len*46} ${b.y-dy/len*46}`} fill="none" stroke={color==='blue'?'#79caff':color==='green'?'#9bdfad':'#668c9b'} strokeWidth={color==='muted'?1.4:2.2} opacity={selected&&color==='muted'?.25:.8} markerEnd={`url(#${marker}-${color})`}><title>{a.planet.name} → {b.planet.name}: {route.items.map(id=>items.get(id)?.name).join(', ')}</title></path>;
   })}</svg>
   <div className="graph-sun" style={{left:width/2,top:height/2}} aria-hidden="true"/>
   {positions.map(({planet,x,y},index)=><button key={planet.id} className={`graph-planet ${selected===planet.id?'selected':''}`} style={{left:x,top:y,'--planet-hue':`${[190,30,260,145,350,210][index%6]}deg`} as React.CSSProperties} aria-label={`View logistics for ${planet.name}`} aria-pressed={selected===planet.id} onClick={()=>setSelected(selected===planet.id?null:planet.id)}><span className="planet-globe"><span/></span><strong>{planet.name||'Unnamed planet'}</strong></button>)}
   {active&&<aside className="graph-cargo" aria-label={`${active.planet.name} logistics`} style={{left:active.x>width/2?Math.max(12,active.x-330):Math.min(width-292,active.x+65),top:Math.max(12,Math.min(height-310,active.y-55))}}><header><strong>{active.planet.name}</strong><button aria-label="Close planet details" onClick={()=>setSelected(null)}>×</button></header>{(['imports','exports'] as const).map(direction=><div key={direction}><h4>{direction}</h4>{active.planet[direction].filter(e=>items.has(e.itemId)).map(entry=>{const item=items.get(entry.itemId)!;return <div className="graph-resource" key={entry.id}><img src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/><ItemAccess id={item.id} name={item.name}><span>{item.name}</span></ItemAccess><LogisticsArrow direction={direction}/></div>;})}{!active.planet[direction].some(e=>items.has(e.itemId))&&<p className="graph-none">None</p>}</div>)}</aside>}
  </div></div>}
  <p className="graph-caption">Arrows follow assigned routes within this system. Selected planet: <span className="graph-blue">blue imports</span> · <span className="graph-green">green exports</span>. Unassigned and external cargo appears in its panel.</p>
 </section>;
}

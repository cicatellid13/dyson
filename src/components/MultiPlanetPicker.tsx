import { useEffect, useRef, useState, type ReactNode } from 'react';
import { routePlanets, type DesignSection, type TradeEntry } from '../lib/design';
function CheckMenu({label,summary,children}:{label:string;summary:string;children:ReactNode}){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 return <div className="route-check-menu" ref={root} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}><span>{label}</span><button type="button" aria-label={label} aria-expanded={open} onClick={()=>setOpen(!open)}>{summary||`Select ${label.toLowerCase()}`}<span>▾</span></button>{open&&<div className="route-check-options" role="group" aria-label={`${label} choices`}>{children}</div>}</div>;
}
function SystemCheck({name,checked,partial,onChange}:{name:string;checked:boolean;partial:boolean;onChange:(checked:boolean)=>void}){
 const input=useRef<HTMLInputElement>(null);useEffect(()=>{if(input.current)input.current.indeterminate=partial;},[partial]);
 return <label className="route-system-choice"><input ref={input} type="checkbox" checked={checked} aria-checked={partial?'mixed':checked} onChange={e=>onChange(e.target.checked)}/><strong>{name}</strong></label>;
}
export function MultiPlanetPicker({sections,entry,ownerId,onChange}:{sections:DesignSection[];entry:TradeEntry;ownerId?:string;onChange:(patch:Partial<TradeEntry>)=>void}){
 const planets=sections.filter(s=>s.kind==='planet'&&s.id!==ownerId),ids=routePlanets(entry);
 const systems=[...new Set([...(entry.systemIds??[]),...planets.filter(p=>ids.includes(p.id)).map(p=>p.parentId!).filter(Boolean)])];
 const systemChoices=sections.filter(s=>s.kind==='system').sort((a,b)=>a.name.localeCompare(b.name));
 const children=(systemId:string)=>planets.filter(p=>p.parentId===systemId).sort((a,b)=>a.name.localeCompare(b.name));
 function save(systemIds:string[],planetIds:string[]){onChange({systemIds,planetIds:[...new Set(planetIds)],planetId:planetIds[0]??null,destination:''});}
 function selectSystem(systemId:string,checked:boolean){const childIds=children(systemId).map(p=>p.id);save(checked?[...new Set([...systems,systemId])]:systems.filter(id=>id!==systemId),checked?[...ids,...childIds]:ids.filter(id=>!childIds.includes(id)));}
 const groups=systemChoices.filter(s=>systems.includes(s.id));
 const summary=groups.flatMap(s=>{const all=children(s.id),selected=all.filter(p=>ids.includes(p.id));return selected.length===0?[]:selected.length===all.length?[`${s.name} (all)`]:[`${s.name}: ${selected.map(p=>p.name).join(', ')}`];}).join('; ');
 return <div className="multi-planet-picker"><CheckMenu label="Systems" summary={systemChoices.filter(s=>systems.includes(s.id)).map(s=>s.name).join(', ')}>{systemChoices.map(s=><label key={s.id}><input type="checkbox" checked={systems.includes(s.id)} onChange={e=>selectSystem(s.id,e.target.checked)}/><span>{s.name}</span></label>)}</CheckMenu><CheckMenu label="Planets" summary={summary}>{groups.map(s=>{const all=children(s.id),count=all.filter(p=>ids.includes(p.id)).length;return <div className="route-planet-group" key={s.id}><SystemCheck name={s.name} checked={all.length>0&&count===all.length} partial={count>0&&count<all.length} onChange={checked=>{const childIds=all.map(p=>p.id);save(systems,checked?[...ids,...childIds]:ids.filter(id=>!childIds.includes(id)));}}/>{all.map(p=><label className="route-planet-choice" key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={e=>save(systems,e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/><span>{p.name}</span></label>)}{!all.length&&<p>No other planets in this system.</p>}</div>;})}{!groups.length&&<p>Select a system first.</p>}</CheckMenu></div>;
}

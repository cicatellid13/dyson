import { useEffect, useRef, useState } from 'react';
import { routePlanets, type DesignSection, type TradeEntry } from '../lib/design';
function CheckMenu({label,choices,selected,onChange}:{label:string;choices:{id:string;name:string}[];selected:string[];onChange:(ids:string[])=>void}){
 const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 return <div className="route-check-menu" ref={root} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}><span>{label}</span><button type="button" aria-label={label} aria-expanded={open} onClick={()=>setOpen(!open)}>{selected.length?choices.filter(c=>selected.includes(c.id)).map(c=>c.name).join(', ')||`${selected.length} selected`:`Select ${label.toLowerCase()}`}<span>▾</span></button>{open&&<div className="route-check-options" role="group" aria-label={`${label} choices`}>{choices.map(c=><label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={e=>onChange(e.target.checked?[...selected,c.id]:selected.filter(id=>id!==c.id))}/><span>{c.name}</span></label>)}{!choices.length&&<p>Select a system with another planet first.</p>}</div>}</div>;
}
export function MultiPlanetPicker({sections,entry,ownerId,onChange}:{sections:DesignSection[];entry:TradeEntry;ownerId?:string;onChange:(patch:Partial<TradeEntry>)=>void}){
 const planets=sections.filter(s=>s.kind==='planet'&&s.id!==ownerId),ids=routePlanets(entry);
 const systems=[...new Set([...(entry.systemIds??[]),...planets.filter(p=>ids.includes(p.id)).map(p=>p.parentId!).filter(Boolean)])];
 const systemChoices=sections.filter(s=>s.kind==='system').sort((a,b)=>a.name.localeCompare(b.name));
 const choices=planets.filter(p=>systems.includes(p.parentId!)).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>({id:p.id,name:`${p.name} · ${sections.find(s=>s.id===p.parentId)?.name??''}`}));
 return <div className="multi-planet-picker"><CheckMenu label="Systems" choices={systemChoices} selected={systems} onChange={systemIds=>{const planetIds=ids.filter(id=>planets.some(p=>p.id===id&&systemIds.includes(p.parentId!)));onChange({systemIds,planetIds,planetId:planetIds[0]??null,destination:''});}}/><CheckMenu label="Planets" choices={choices} selected={ids} onChange={planetIds=>onChange({systemIds:systems,planetIds,planetId:planetIds[0]??null,destination:''})}/></div>;
}

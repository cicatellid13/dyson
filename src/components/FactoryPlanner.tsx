import { ItemLink } from './ItemAccess';
import { SaveFactory } from './SavedFactories';
import type { SavedFactory } from '../lib/savedFactories';
import { useEffect, useState } from 'react';
import { recipesFor, type Catalog, type Item } from '../lib/catalog';
import { BELTS, FACILITIES, SORTERS } from '../lib/factoryEquipment';
import { calculateFactory, type Stream } from '../lib/factoryPlanner';
import { ItemPicker } from './ItemPicker';
import { ThemedSelect } from './ThemedSelect';
import '../styles/factoryPlanner.css';
import { FactoryPlannerIcon } from './FactoryPlannerIcon';
import { usePlannerPreferences, updatePlannerPreferences } from '../lib/plannerPreferences';

const number=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:3});
const rate=(n:number)=>`${number(n)}/s · ${number(n*60)}/min`;
function Gauge({label,value}:{label:string;value:number}) {
  return <div className="planner-gauge"><span>{label}<b>{number(value*100)}%</b></span><meter min={0} max={1} value={value} aria-label={label}/></div>;
}
function ResourceRows({title,streams,items}:{title:string;streams:Stream[];items:Map<number,Item>}) {
  return <section className="planner-resources"><h4>{title}</h4>{streams.map(s=><div className="planner-resource" key={s.id}><ItemLink id={s.id} name={items.get(s.id)?.name}>{items.get(s.id)?.icon&&<img src={`${import.meta.env.BASE_URL}${items.get(s.id)!.icon}`} alt=""/>}<strong>{items.get(s.id)?.name??`Item ${s.id}`}</strong></ItemLink><span>{rate(s.rate)}<small>{s.belts} belt{s.belts===1?'':'s'} · {number(s.beltUtilization*100)}% used</small></span><span>{s.sorters} sorters<small>{s.sortersPerMachine} per machine</small></span></div>)}</section>;
}
/** Both surfaces deliberately instantiate the same controls and calculator with independent state. */
function Calculator({catalog,item,compact=false,saved,planetId}:{catalog:Catalog;item:Item;compact?:boolean;saved?:SavedFactory;planetId?:string}) {
  const recipes=recipesFor(catalog,item.id);
  const [recipeId,setRecipeId]=useState(saved?.recipeId??recipes[0]?.id);
  const recipe=recipes.find(r=>r.id===recipeId)??(saved?undefined:recipes[0]);
  const defaults=usePlannerPreferences();
  const [overrides,setOverrides]=useState(saved?{facilityId:saved.facilityId,beltId:saved.beltId,sorterId:saved.sorterId,reach:saved.reach}:null);
  const preferences=overrides??defaults;
  const changeEquipment=(patch:Partial<typeof defaults>)=>{if(overrides)setOverrides({...overrides,...patch});else updatePlannerPreferences(patch);};
  const {beltId,sorterId,reach}=preferences;
  const facilityId=preferences.facilityId;
  const [mode,setMode]=useState<'infrastructure'|'machines'>(saved?.mode??'infrastructure');
  const [machineCount,setMachineCount]=useState(String(saved?.machineCount??1));
  const [oneBeltPerItem,setOneBeltPerItem]=useState(saved?.oneBeltPerItem??true);
  const [customTarget,setTarget]=useState<string|null>(saved?String(saved.target):null);
  const [unit,setUnit]=useState<'second'|'minute'>(saved?.unit??'minute');
  const target=customTarget??String((BELTS.find(b=>b.id===beltId)?.rate??6)*(unit==='minute'?60:1));
  const items=new Map(catalog.items.map(i=>[i.id,i]));
  const facilities=FACILITIES.filter(f=>f.type===recipe?.type&&items.has(f.id));
  const facility=facilities.find(f=>f.id===facilityId)??facilities[0];
  const result=recipe?calculateFactory({recipe,itemId:item.id,facilityId:facility?.id??0,beltId,sorterId,reach,mode,machineCount:Number(machineCount),oneBeltPerItem,target:Number(target),unit}):{ok:false as const,reason:'This item has no crafting recipe. Extraction and gathering are not modeled.'};
  const changeUnit=(next:'second'|'minute')=>{if(customTarget!==null&&next!==unit&&target.trim()&&Number.isFinite(Number(target)))setTarget(String(Number(target)*(next==='minute'?60:1/60)));setUnit(next);};
  const equipmentIcon=(value:string)=>{const equipment=items.get(Number(value));return equipment?.icon?<img className="equipment-icon" src={`${import.meta.env.BASE_URL}${equipment.icon}`} alt=""/>:null;};
  return <div className={`factory-calculator ${compact?'compact':''}`}>
    {recipe&&<div className="planner-controls">
      {recipes.length>1&&<label>Recipe<ThemedSelect aria-label="Planner recipe" value={recipe.id} onChange={e=>setRecipeId(Number(e.target.value))}>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</ThemedSelect></label>}
      {!!facilities.length&&<label>Production facility<ThemedSelect aria-label="Production facility" value={facility.id} renderIcon={equipmentIcon} onChange={e=>changeEquipment({facilityId:Number(e.target.value)})}>{facilities.map(f=><option key={f.id} value={f.id}>{items.get(f.id)?.name} · {f.speed}×</option>)}</ThemedSelect></label>}
      <label>Conveyor belt<ThemedSelect aria-label="Conveyor belt" value={beltId} renderIcon={equipmentIcon} onChange={e=>changeEquipment({beltId:Number(e.target.value)})}>{BELTS.map(b=><option key={b.id} value={b.id}>{items.get(b.id)?.name} · {b.rate}/s</option>)}</ThemedSelect></label>
      <label>Sorter<ThemedSelect aria-label="Sorter tier" value={sorterId} renderIcon={equipmentIcon} onChange={e=>changeEquipment({sorterId:Number(e.target.value)})}>{SORTERS.map(s=><option key={s.id} value={s.id}>{items.get(s.id)?.name}</option>)}</ThemedSelect></label>
      <label>Sorter reach<ThemedSelect aria-label="Sorter reach" value={reach} renderIcon={value=><svg className="sorter-reach-icon" width="36" height="24" viewBox="0 0 36 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{Array.from({length:Number(value)},(_,i)=><rect key={i} x={1+i*12} y="7" width="10" height="10" rx="1" fill="currentColor" fillOpacity=".12"/>)}</svg>} onChange={e=>changeEquipment({reach:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{n} grid{n===1?'':'s'}</option>)}</ThemedSelect></label>
      <div className="planner-output-controls"><div className="catalog-view-controls"><div role="group" aria-label="Output planning mode"><button type="button" aria-pressed={mode==='infrastructure'} onClick={()=>setMode('infrastructure')}>Target output</button><button type="button" aria-pressed={mode==='machines'} onClick={()=>setMode('machines')}>Maximize capacity</button></div></div>{mode==='machines'&&<label>Number of {recipe.type==='SMELT'?'smelters':recipe.type==='ASSEMBLE'?'assemblers':'facilities'}<input aria-label="Number of production facilities" type="number" min="1" max="1000000" step="1" value={machineCount} onChange={e=>setMachineCount(e.target.value)}/></label>}<label>Target output<div className="planner-target"><input aria-label="Target output" type="number" min="0" step="any" value={mode==='machines'?(result.ok?String(Number((result.target*(unit==='minute'?60:1)).toPrecision(12))):''):target} readOnly={mode==='machines'} onChange={e=>setTarget(e.target.value)}/><ThemedSelect aria-label="Target rate unit" value={unit} onChange={e=>changeUnit(e.target.value as typeof unit)}><option value="minute">items/min</option><option value="second">items/s</option></ThemedSelect></div>{mode==='infrastructure'&&<button className="planner-fill-belt" type="button" onClick={()=>setTarget(null)}>Fill one belt</button>}</label>{mode==='machines'&&<div className="planner-belt-option"><label className="planner-belt-limit"><input type="checkbox" checked={oneBeltPerItem} onChange={e=>setOneBeltPerItem(e.target.checked)}/>One belt per item</label><button type="button" className="planner-belt-info" aria-label="About one belt per item" data-tooltip="Limits each input and output to one belt. If everything already fits, output stays the same. With more machines, output is capped by the first belt to fill.">i</button></div>}</div>
    </div>}
    {result.ok&&recipe&&facility&&<SaveFactory initial={saved} initialPlanetId={planetId} settings={{itemId:item.id,recipeId:recipe.id,facilityId:facility.id,beltId,sorterId,reach,mode,target:result.target*(unit==='minute'?60:1),unit,machineCount:Number.isSafeInteger(Number(machineCount))&&Number(machineCount)>0?Number(machineCount):1,oneBeltPerItem}}/>}
    {!result.ok?<p className="planner-warning" role="status">{result.reason}</p>:<>
      <div className="planner-stats"><div><small>{mode==='machines'?'Selected facilities':'Recommended facilities'}</small><strong>{number(result.machines)}</strong><span>{items.get(facility.id)?.name}</span></div><div><small>Target output</small><strong>{number(result.target*60)}<em>/min</em></strong><span>{number(result.target)} items/s</span></div><div><small>Expected sustainable output</small><strong>{number(result.sustainable*60)}<em>/min</em></strong><span>With the supporting logistics below</span></div></div>
      <div className="planner-gauges"><Gauge label="Machine utilization" value={result.machineUtilization}/><Gauge label="Selected output belts" value={result.beltUtilization}/></div>
      <p className="planner-caption">Per facility: {rate(result.perMachine)} · Installed capacity: {rate(result.installed)}</p>
      <ResourceRows title="Input requirements" streams={result.inputs} items={items}/><ResourceRows title="Outputs & byproducts" streams={result.outputs} items={items}/>
      <div className="planner-logistics"><strong>{result.inputs.reduce((n,s)=>n+s.belts,0)} input belts · {result.outputs.reduce((n,s)=>n+s.belts,0)} output belts · {result.sorters} sorters</strong><span>Each sorter: {rate(result.sorterRate)} at {reach}-grid reach</span></div>
      {mode==='machines'&&result.beltLimited&&<p className="planner-warning">One belt per item limits output: {result.limitingBeltItems.map(id=>items.get(id)?.name??`Item ${id}`).join(', ')}. Your {result.machines} facilities run at {number(result.machineUtilization*100)}% capacity.</p>}
      {mode==='machines'&&result.sorterLimited?<p className="planner-warning">Sorter capacity limits these facilities. Faster sorters or shorter reach may increase output.</p>:mode==='infrastructure'&&result.machines>result.machineOnlyCount&&<p className="planner-warning">{result.notes[0]}</p>}
    </>}
  </div>;
}
export function FactoryPlanner({catalog,request}:{catalog:Catalog;request?:{id:number;sequence:number;saved?:SavedFactory;planetId?:string}}) {
  const [selection,setSelection]=useState('');
  const [useSaved,setUseSaved]=useState(false);
  useEffect(()=>{if(request){const chosen=catalog.items.find(i=>i.id===request.id);if(chosen){setSelection(chosen.name);setUseSaved(!!request.saved);}}},[request,catalog.items]);
  const craftable=catalog.items;
  const item=craftable.find(i=>i.name.toLowerCase()===selection.trim().toLowerCase());
  return <section className="factory-planner-page"><div className="design-section-heading planner-heading"><h2>Factory Planner</h2></div><div className="planner-select"><ItemPicker items={craftable} value={selection} onChange={value=>{setSelection(value);setUseSaved(false);}} label="Factory Planner item"/></div>{item?<Calculator key={`${item.id}-${useSaved?request?.sequence:0}`} catalog={catalog} item={item} saved={useSaved?request?.saved:undefined} planetId={useSaved?request?.planetId:undefined}/>:<div className="planner-empty"><FactoryPlannerIcon/><h3>What are you building?</h3><p>Choose an item to plan its machines, belts and sorters.</p></div>}</section>;
}
export function EmbeddedFactoryPlanner({catalog,item}:{catalog:Catalog;item:Item}) {
  const [open,setOpen]=useState(false);
  return <section className="planner-accordion"><button className="planner-accordion-trigger" aria-expanded={open} onClick={()=>setOpen(!open)}><FactoryPlannerIcon/><strong>Factory Planner</strong><span>{open?'−':'+'}</span></button>{open&&<Calculator key={item.id} catalog={catalog} item={item} compact/>}</section>;
}

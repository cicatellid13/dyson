import type { Catalog } from '../lib/catalog';
import { orderedSections, type DesignData } from '../lib/design';
import { todoTypes } from '../lib/planning';
import { useSessionExpansion, useSessionSelection } from '../lib/sessionExpansion';
import { updateWorkspace } from '../lib/persistence';
import { LogisticsArrow } from './LogisticsArrow';
import { useItemAccess } from './ItemAccess';
import { PriorityFlag } from './PriorityFlag';

const labels = {all:'All',import:'Import',export:'Export',production:'Production',power:'Power',issue:'Issue',other:'Other',untyped:'Untyped'};
const symbols = {all:'▦',production:'⚙',power:'ϟ',issue:'!',other:'•••',untyped:'•'};
type Filter = keyof typeof labels;
function TypeIcon({type}:{type:Filter}) { return type==='import'||type==='export'?<LogisticsArrow direction={type==='import'?'imports':'exports'}/>:<>{symbols[type]}</>; }
export function NetworkTodos({data,catalog,onOpen}:{data:DesignData;catalog:Catalog;onOpen:(planetId:string,taskId:string)=>void}) {
  const [selected,setSelected]=useSessionSelection('network-todo-filter','all');
  const filter=(selected??'all') as Filter;
  const [completed,setCompleted]=useSessionSelection('network-todo-completed');
  const [collapsed,setCollapsed]=useSessionExpansion('network-todo-collapsed');
  const actions=useItemAccess();
  const itemMap=new Map(catalog.items.map(item=>[item.id,item]));
  const planets=orderedSections(data.sections.filter(s=>s.kind==='planet')).sort((a,b)=>Number(!!b.priority)-Number(!!a.priority));
  const tasks=planets.flatMap(p=>p.checklist??[]);
  const eligible=tasks.filter(t=>completed||!t.done);
  const filters:Filter[]=['all',...todoTypes,...(tasks.some(t=>!t.type)?['untyped' as const]:[])];
  const systems=[...orderedSections(data.sections.filter(s=>s.kind==='system')).map(s=>({id:s.id,name:s.name})),{id:'unassigned',name:'Needs a system'}];
  function toggle(id:string){setCollapsed(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  let shown=0;
  return <section className="network-todos"><header className="design-section-heading"><h2>Network To-do</h2><label><input type="checkbox" checked={!!completed} onChange={e=>setCompleted(e.target.checked?'yes':null)}/> Show completed</label></header>
    <div className="todo-filters" role="group" aria-label="Filter network to-dos">{filters.map(type=><button key={type} className={`todo-filter ${type}`} aria-pressed={filter===type} onClick={()=>setSelected(filter===type?'all':type)}><span className="todo-filter-icon"><TypeIcon type={type}/></span>{labels[type]}<small>{eligible.filter(t=>type==='all'||(t.type??'untyped')===type).length}</small></button>)}</div>
    {systems.map(system=>{
      const children=planets.filter(p=>(p.parentId??'unassigned')===system.id).map(planet=>({planet,visible:(planet.checklist??[]).filter(t=>(completed||!t.done)&&(filter==='all'||(t.type??'untyped')===filter))})).filter(p=>p.visible.length);
      if(!children.length)return null;
      shown+=children.length;
      return <section className="network-todo-system" key={system.id}><button className="network-todo-heading" aria-expanded={!collapsed.has(system.id)} onClick={()=>toggle(system.id)}><span>{collapsed.has(system.id)?'▸':'▾'}</span>{system.name}</button>{!collapsed.has(system.id)&&children.map(({planet,visible})=><section className="network-todo-planet" key={planet.id}><button className="network-todo-heading" aria-expanded={!collapsed.has(planet.id)} onClick={()=>toggle(planet.id)}><span>{collapsed.has(planet.id)?'▸':'▾'}</span>{planet.name}{planet.priority&&<span className="priority-marker"><PriorityFlag/></span>}<small>{(planet.checklist??[]).filter(t=>t.done).length}/{planet.checklist?.length??0}</small></button>{!collapsed.has(planet.id)&&visible.map(task=><div className={`checklist-row network-todo-row ${task.done?'complete':''}`} key={task.id}><input type="checkbox" checked={task.done} aria-label={`Complete ${task.text||'untitled task'}`} onChange={e=>{const done=e.target.checked;updateWorkspace(current=>({...current,design:{...current.design,sections:current.design.sections.map(p=>p.id===planet.id?{...p,checklist:(p.checklist??[]).map(t=>t.id===task.id?{...t,done}:t)}:p)}}));}}/><span className={`todo-type todo-type-icon ${task.type??''}`} data-tooltip={labels[task.type??'untyped']}><TypeIcon type={task.type??'untyped'}/></span><button className="network-task-text" onClick={()=>onOpen(planet.id,task.id)}>{task.text||'Untitled task'}</button><div className="network-task-items">{(task.itemIds??[]).map(id=>{const item=itemMap.get(id);return item?<button key={id} data-tooltip={item.name} aria-label={item.name} onClick={()=>actions.navigate(id)}><img src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>{task.requiredInputs?.[id]&&<span className="task-input-arrow" aria-label="Required input">←</span>}</button>:null;})}</div></div>)}</section>)}</section>;
    })}
    {!shown&&<p className="design-empty-small">No {completed?'matching':'pending'} tasks{filter==='all'?'':` in ${labels[filter]}`}.</p>}
  </section>;
}

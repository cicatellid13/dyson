import { LogisticsArrow } from './LogisticsArrow';
import { useState } from 'react';
import { todoTypes, type TodoType, type ChecklistItem } from '../lib/planning';
export function NoteChecklist({entries,onChange}:{entries:ChecklistItem[];onChange:(entries:ChecklistItem[])=>void}){
 const [filter,setFilter]=useState<TodoType|'all'|'untyped'>('all');
 const visible=entries.filter(entry=>filter==='all'||(filter==='untyped'?!entry.type:entry.type===filter));
 const filters=['all',...todoTypes,...(entries.some(entry=>!entry.type)?['untyped' as const]:[])] as const;
 const labels={all:'All',import:'Import',export:'Export',production:'Production',power:'Power',issue:'Issue',untyped:'Other'};
 const symbols={all:'▦',production:'⚙',power:'ϟ',issue:'!',untyped:'•'};
 const [choosing,setChoosing]=useState(false);
 const [newId,setNewId]=useState<string|null>(null);
 function add(type:TodoType){const id=crypto.randomUUID();onChange([...entries,{id,type,text:'',done:false}]);setNewId(id);setChoosing(false);setFilter(type);}
 const done=entries.filter(e=>e.done).length;
 return <section className="note-checklist"><header><h3>To-do</h3>{!!entries.length&&<span>{done} / {entries.length} complete</span>}<button type="button" className="todo-clear" title="Remove completed tasks from this note, including hidden types" disabled={!done} onClick={()=>onChange(entries.filter(entry=>!entry.done))}>Clear completed</button></header>{!!entries.length&&<progress value={done} max={entries.length} aria-label="To-do progress"/>}
 <div className="todo-filters" role="group" aria-label="Filter to-dos by type">{filters.map(type=>{const count=type==='all'?entries.length:entries.filter(e=>type==='untyped'?!e.type:e.type===type).length;return <button key={type} type="button" className={`todo-filter ${type}`} aria-pressed={filter===type} aria-label={`${labels[type]} to-dos, ${count}`} onClick={()=>setFilter(type===filter?'all':type)}><span className="todo-filter-icon" aria-hidden="true">{type==='import'||type==='export'?<LogisticsArrow direction={type==='import'?'imports':'exports'}/>:symbols[type]}</span><span>{labels[type]}</span><small>{count}</small></button>;})}</div>
 {!!entries.length&&!visible.length&&<p className="todo-filter-empty">No {filter==='untyped'?'untyped':filter} tasks in this note.</p>}
 {visible.map(entry=><div className={`checklist-row ${entry.done?'complete':''}`} key={entry.id}><input type="checkbox" checked={entry.done} aria-label={`Complete ${entry.text}`} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,done:e.target.checked}:t))}/><button type="button" onClick={()=>setFilter(filter===(entry.type??'untyped')?'all':entry.type??'untyped')} aria-pressed={filter===(entry.type??'untyped')} className={`todo-type todo-type-icon ${entry.type??''}`} title={entry.type?labels[entry.type]:'Other'} aria-label={entry.type?labels[entry.type]:'Other'}><span aria-hidden="true">{entry.type==='import'||entry.type==='export'?<LogisticsArrow direction={entry.type==='import'?'imports':'exports'}/>:symbols[entry.type??'untyped']}</span></button><input autoFocus={entry.id===newId} placeholder="Describe the task…" className="checklist-text" aria-label="To-do task" maxLength={1000} value={entry.text} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,text:e.target.value}:t))}/><button aria-label={`Remove task ${entry.text}`} onClick={()=>onChange(entries.filter(t=>t.id!==entry.id))}>×</button></div>)}
 <div className="todo-add"><button type="button" className="design-button todo-add-button" aria-label="Add task" title="Add task" disabled={entries.length>=1000} aria-expanded={choosing} onClick={()=>setChoosing(value=>!value)}>+</button>
 {choosing&&<div className="todo-type-menu" role="group" aria-label="Choose task type">{todoTypes.map(type=><button type="button" className={`todo-type todo-type-icon ${type}`} title={labels[type]} aria-label={`Add ${labels[type]} task`} key={type} onClick={()=>add(type)}>{type==='import'||type==='export'?<LogisticsArrow direction={type==='import'?'imports':'exports'}/>:symbols[type]}</button>)}<button type="button" onClick={()=>setChoosing(false)}>Cancel</button></div>}</div>
 </section>;
}

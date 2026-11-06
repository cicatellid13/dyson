import type { Catalog } from '../lib/catalog';
import { TodoItemGrid } from './TodoItemGrid';
import { useItemAccess } from './ItemAccess';
import { themeDrag } from '../lib/dragAppearance';
import { reorderTodos } from '../lib/reorderTodos';
import { LogisticsArrow } from './LogisticsArrow';
import { useState } from 'react';
import { todoTypes, type TodoType, type ChecklistItem } from '../lib/planning';
export function NoteChecklist({catalog,entries,onChange}:{catalog:Catalog;entries:ChecklistItem[];onChange:(entries:ChecklistItem[])=>void}){
 const actions = useItemAccess();
 const itemMap = new Map(catalog.items.map(item => [item.id, item]));
 const [draggingId, setDraggingId] = useState<string | null>(null);
 const [dropId, setDropId] = useState<string | null>(null);
 function finishDrag() {
   setDraggingId(null);
   setDropId(null);
 }
 const [filter,setFilter]=useState<TodoType|'all'|'untyped'>('all');
 const visible=entries.filter(entry=>filter==='all'||(filter==='untyped'?!entry.type:entry.type===filter));
 const filters=['all',...todoTypes,...(entries.some(entry=>!entry.type)?['untyped' as const]:[])] as const;
 const labels={all:'All',import:'Import',export:'Export',production:'Production',power:'Power',issue:'Issue',other:'Other',untyped:'Untyped'};
 const symbols={all:'▦',production:'⚙',power:'ϟ',issue:'!',other:'•••',untyped:'•'};
 const [choosing,setChoosing]=useState(false);
 const [newId,setNewId]=useState<string|null>(null);
 function add(type:TodoType|'untyped'){const id=crypto.randomUUID();onChange([...entries,{id,type:type==='untyped'?undefined:type,text:'',done:false}]);setNewId(id);setChoosing(false);setFilter(type);}
 function selectFilter(next: typeof filter) {
   setChoosing(false);
   setFilter(next === filter ? 'all' : next);
 }
 function handleAdd() {
   if (filter === 'all') setChoosing(value => !value);
   else add(filter);
 }
 const done=entries.filter(e=>e.done).length;
 return <section className="note-checklist"><header><h3>To-do</h3>{!!entries.length&&<span>{done} / {entries.length} complete</span>}<button type="button" className="todo-clear" data-tooltip="Remove completed tasks from this note, including hidden types" disabled={!done} onClick={()=>onChange(entries.filter(entry=>!entry.done))}>Clear completed</button></header>{!!entries.length&&<progress value={done} max={entries.length} aria-label="To-do progress"/>}
 <div className="todo-filters" role="group" aria-label="Filter to-dos by type">{filters.map(type=>{const count=type==='all'?entries.length:entries.filter(e=>type==='untyped'?!e.type:e.type===type).length;return <button key={type} type="button" className={`todo-filter ${type}`} aria-pressed={filter===type} aria-label={`${labels[type]} to-dos, ${count}`} onClick={()=>selectFilter(type)}><span className="todo-filter-icon" aria-hidden="true">{type==='import'||type==='export'?<LogisticsArrow direction={type==='import'?'imports':'exports'}/>:symbols[type]}</span><span>{labels[type]}</span><small>{count}</small></button>;})}<TodoItemGrid items={catalog.items} onLink={(taskId,id)=>onChange(entries.map(task=>task.id===taskId?{...task,itemIds:[...new Set([...(task.itemIds??[]),id])]}:task))}/></div>
 {!!entries.length&&!visible.length&&<p className="todo-filter-empty">No {filter==='untyped'?'untyped':filter} tasks in this note.</p>}
 {visible.map(entry=><div className={`checklist-row ${entry.done?'complete':''} ${dropId === entry.id ? 'todo-drop-target' : ''}`} key={entry.id} data-todo-id={entry.id}
   onDragOverCapture={event => {
     if (event.dataTransfer.types.includes('application/x-dsp-item')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setDropId(entry.id); return; }
     if (!draggingId || draggingId === entry.id) return;
     event.preventDefault();
     event.stopPropagation();
     event.dataTransfer.dropEffect = 'move';
     setDropId(entry.id);
   }}
   onDragLeave={event => {
     if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropId(null);
   }}
   onDropCapture={event => {
     if (event.dataTransfer.types.includes('application/x-dsp-item')) {
       event.preventDefault(); event.stopPropagation();
       const id = Number(event.dataTransfer.getData('application/x-dsp-item'));
       if (itemMap.has(id)) onChange(entries.map(task => task.id === entry.id ? {...task, itemIds: [...new Set([...(task.itemIds ?? []), id])]} : task));
       finishDrag(); actions.drag(null); return;
     }
     if (!draggingId) return;
     event.preventDefault();
     event.stopPropagation();
     onChange(reorderTodos(entries, visible.map(task => task.id), draggingId, entry.id));
     finishDrag();
   }}><input type="checkbox" checked={entry.done} aria-label={`Complete ${entry.text}`} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,done:e.target.checked}:t))}/><button type="button" onClick={()=>selectFilter(entry.type??'untyped')} aria-pressed={filter===(entry.type??'untyped')} className={`todo-type todo-type-icon ${entry.type??''}`} data-tooltip={entry.type?labels[entry.type]:'Other'} aria-label={entry.type?labels[entry.type]:'Other'}><span aria-hidden="true">{entry.type==='import'||entry.type==='export'?<LogisticsArrow direction={entry.type==='import'?'imports':'exports'}/>:symbols[entry.type??'untyped']}</span></button><input autoFocus={entry.id===newId} placeholder="Describe the task…" className="checklist-text" aria-label="To-do task" maxLength={1000} value={entry.text} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,text:e.target.value}:t))}/><button type="button" className="todo-drag-handle" draggable aria-label={`Reorder task ${entry.text}`} data-tooltip="Drag to reorder"
   onDragStart={event => {
     event.stopPropagation();
     themeDrag(event);
     event.dataTransfer.effectAllowed = 'move';
     event.dataTransfer.setData('application/x-dsp-todo', entry.id);
     setDraggingId(entry.id);
   }}
   onDragEnd={finishDrag}
   onKeyDown={event => {
     if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
     event.preventDefault();
     const index = visible.findIndex(task => task.id === entry.id);
     const target = visible[index + (event.key === 'ArrowUp' ? -1 : 1)];
     if (target) onChange(reorderTodos(entries, visible.map(task => task.id), entry.id, target.id));
   }}><svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="1.4"/><circle cx="11" cy="5" r="1.4"/><circle cx="5" cy="10" r="1.4"/><circle cx="11" cy="10" r="1.4"/><circle cx="5" cy="15" r="1.4"/><circle cx="11" cy="15" r="1.4"/></svg></button><button type="button" className="favorite-remove" aria-label={`Remove task ${entry.text}`} onClick={()=>onChange(entries.filter(t=>t.id!==entry.id))}>×</button><div className="todo-linked-items">{(entry.itemIds??[]).map(id=>{const item=itemMap.get(id);return item?<button type="button" key={id} aria-label={`Open ${item.name}`} data-tooltip={item.name} onClick={()=>actions.navigate(id)}><img src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/></button>:null;})}</div></div>)}
 <div className="todo-add"><button type="button" className="design-button todo-add-button" aria-label="Add task" data-tooltip="Add task" disabled={entries.length>=1000} aria-expanded={choosing} onClick={handleAdd}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button>
 {choosing&&<div className="todo-type-menu" role="group" aria-label="Choose task type">{todoTypes.map(type=><button type="button" className={`todo-type todo-type-icon ${type}`} data-tooltip={labels[type]} aria-label={`Add ${labels[type]} task`} key={type} onClick={()=>add(type)}>{type==='import'||type==='export'?<LogisticsArrow direction={type==='import'?'imports':'exports'}/>:symbols[type]}</button>)}<button type="button" className="todo-type-cancel" aria-label="Cancel adding task" data-tooltip="Cancel" onClick={()=>setChoosing(false)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>}</div>
 </section>;
}

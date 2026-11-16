import { updateTaskTooltip } from '../lib/truncatedTaskTooltip';
import { taskItemAttachment, removeTaskItem } from '../lib/taskItemLinks';
import { TodoLinkedItems } from './TodoLinkedItems';
import { pairs, recipesFor, type Catalog } from '../lib/catalog';
import { TodoItemGrid } from './TodoItemGrid';
import { useItemAccess } from './ItemAccess';
import { themeDrag } from '../lib/dragAppearance';
import { reorderTodos } from '../lib/reorderTodos';
import { TodoTypeIcon, todoTypeLabels as labels } from './TodoTypeIcon';
import { useEffect, useId, useRef, useState } from 'react';
import { todoTypes, type TodoType, type ChecklistItem } from '../lib/planning';
export function NoteChecklist({catalog,entries,onChange,focusTaskId,focusRequest}:{focusTaskId?:string|null;focusRequest?:string;catalog:Catalog;entries:ChecklistItem[];onChange:(entries:ChecklistItem[])=>void}){
 const actions = useItemAccess();
 const itemMap = new Map(catalog.items.map(item => [item.id, item]));
 const [draggingId, setDraggingId] = useState<string | null>(null);
 const [dropId, setDropId] = useState<string | null>(null);
 const [recipeDrop, setRecipeDrop] = useState<{ taskId: string; itemId: number } | null>(null);
 const recipeDialog = useRef<HTMLDialogElement>(null);
 const recipeTitle = useId();
 const recipeOptions = recipeDrop ? recipesFor(catalog, recipeDrop.itemId) : [];

 useEffect(() => {
   if (!recipeDrop) return;
   const dialog = recipeDialog.current;
   dialog?.showModal();
   return () => dialog?.close();
 }, [recipeDrop]);

 function attachItem(taskId: string, itemId: number, includeInputs: boolean, recipeId?: number) {
   if (!entries.some(task => task.id === taskId) || !itemMap.has(itemId)) return;
   onChange(entries.map(task => task.id === taskId
     ? { ...task, ...taskItemAttachment(catalog, task, itemId, includeInputs, recipeId) }
     : task));
 }

 function handleItemDrop(taskId: string, itemId: number, includeInputs: boolean) {
   if (includeInputs && recipesFor(catalog, itemId).length > 1) {
     setRecipeDrop({ taskId, itemId });
     return;
   }
   attachItem(taskId, itemId, includeInputs);
 }

 function finishDrag() {
   setDraggingId(null);
   setDropId(null);
 }
 const [filter,setFilter]=useState<TodoType|'all'|'untyped'>('all');
 const visible=entries.filter(entry=>filter==='all'||(filter==='untyped'?!entry.type:entry.type===filter));
 const filters=['all',...todoTypes,...(entries.some(entry=>!entry.type)?['untyped' as const]:[])] as const;
 useEffect(()=>{
   if(!focusTaskId)return;
   setFilter('all');
   const frame=requestAnimationFrame(()=>{
     const row=Array.from(document.querySelectorAll<HTMLElement>('[data-todo-id]')).find(el=>el.dataset.todoId===focusTaskId);
     row?.scrollIntoView({block:'center',behavior:'smooth'});
     row?.classList.add('network-task-highlight');
   });
   const timer=window.setTimeout(()=>document.querySelectorAll('.network-task-highlight').forEach(el=>el.classList.remove('network-task-highlight')),2200);
   return()=>{cancelAnimationFrame(frame);clearTimeout(timer);};
 },[focusTaskId,focusRequest]);
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
 <div className="todo-filters" role="group" aria-label="Filter to-dos by type">{filters.map(type=>{const count=type==='all'?entries.length:entries.filter(e=>type==='untyped'?!e.type:e.type===type).length;return <button key={type} type="button" className={`todo-filter ${type}`} aria-pressed={filter===type} aria-label={`${labels[type]} to-dos, ${count}`} onClick={()=>selectFilter(type)}><span className="todo-filter-icon" aria-hidden="true">{<TodoTypeIcon type={type}/>}</span><span>{labels[type]}</span><small>{count}</small></button>;})}<TodoItemGrid items={catalog.items} onLink={handleItemDrop}/></div>
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
   }}><input type="checkbox" checked={entry.done} aria-label={`Complete ${entry.text}`} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,done:e.target.checked}:t))}/><button type="button" onClick={()=>selectFilter(entry.type??'untyped')} aria-pressed={filter===(entry.type??'untyped')} className={`todo-type todo-type-icon ${entry.type??''}`} data-tooltip={entry.type?labels[entry.type]:'Other'} aria-label={entry.type?labels[entry.type]:'Other'}><span aria-hidden="true">{<TodoTypeIcon type={entry.type??'untyped'}/>}</span></button><input autoFocus={entry.id===newId} placeholder="Describe the task…" className="checklist-text" onMouseEnter={event=>updateTaskTooltip(event.currentTarget)} onFocus={event=>updateTaskTooltip(event.currentTarget)} aria-label="To-do task" maxLength={1000} value={entry.text} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,text:e.target.value}:t))}/><button type="button" className="todo-drag-handle" draggable aria-label={`Reorder task ${entry.text}`} data-tooltip="Drag to reorder"
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
   }}><svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="1.4"/><circle cx="11" cy="5" r="1.4"/><circle cx="5" cy="10" r="1.4"/><circle cx="11" cy="10" r="1.4"/><circle cx="5" cy="15" r="1.4"/><circle cx="11" cy="15" r="1.4"/></svg></button><button type="button" className="favorite-remove" aria-label={`Remove task ${entry.text}`} onClick={()=>onChange(entries.filter(t=>t.id!==entry.id))}>×</button><TodoLinkedItems requiredInputs={entry.requiredInputs} items={(entry.itemIds??[]).flatMap(id=>{const item=itemMap.get(id);return item?[item]:[];})} onRemoveInputs={ids=>onChange(entries.map(task=>task.id===entry.id?ids.reduce((next,id)=>({...next,...removeTaskItem(next,id,false)}),task):task))} onRemove={(id,removeInputs)=>onChange(entries.map(task=>task.id===entry.id?{...task,...removeTaskItem(task,id,removeInputs)}:task))}/></div>)}
 <div className="todo-add"><button type="button" className="design-button todo-add-button" aria-label="Add task" data-tooltip="Add task" disabled={entries.length>=1000} aria-expanded={choosing} onClick={handleAdd}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button>
 {choosing&&<div className="todo-type-menu" role="group" aria-label="Choose task type">{todoTypes.map(type=><button type="button" className={`todo-type todo-type-icon ${type}`} data-tooltip={labels[type]} aria-label={`Add ${labels[type]} task`} key={type} onClick={()=>add(type)}>{<TodoTypeIcon type={type}/>}</button>)}<button type="button" className="todo-type-cancel" aria-label="Cancel adding task" data-tooltip="Cancel" onClick={()=>setChoosing(false)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>}</div>
 {recipeDrop && (
   <dialog className="network-dialog todo-recipe-dialog" ref={recipeDialog} aria-labelledby={recipeTitle}
     onCancel={event => { event.preventDefault(); setRecipeDrop(null); }}>
     <h2 id={recipeTitle}>Choose a recipe for {itemMap.get(recipeDrop.itemId)?.name}</h2>
     <div className="todo-recipe-options">
       {recipeOptions.map(recipe => {
         const inputs = pairs(recipe.inputs).map(({id, count}) => `${count} × ${itemMap.get(id)?.name ?? `Item ${id}`}`);
         return <button type="button" className="design-button" key={recipe.id} onClick={() => {
           attachItem(recipeDrop.taskId, recipeDrop.itemId, true, recipe.id);
           setRecipeDrop(null);
         }}>
           <strong>{recipe.name}</strong>
           <small>{inputs.length ? inputs.join(' · ') : 'No required inputs'}</small>
         </button>;
       })}
     </div>
     <button type="button" className="design-button" onClick={() => setRecipeDrop(null)}>Cancel</button>
   </dialog>
 )}
 </section>;
}

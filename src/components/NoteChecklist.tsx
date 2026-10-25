import { useState } from 'react';
import type { ChecklistItem } from '../lib/planning';
export function NoteChecklist({entries,onChange}:{entries:ChecklistItem[];onChange:(entries:ChecklistItem[])=>void}){
 const [text,setText]=useState('');
 const done=entries.filter(e=>e.done).length;
 return <section className="note-checklist"><header><h3>To-do</h3>{!!entries.length&&<span>{done} / {entries.length} complete</span>}<button type="button" className="todo-clear" disabled={!done} onClick={()=>onChange(entries.filter(entry=>!entry.done))}>Clear completed</button></header>{!!entries.length&&<progress value={done} max={entries.length} aria-label="To-do progress"/>}
 {entries.map(entry=><div className={`checklist-row ${entry.done?'complete':''}`} key={entry.id}><input type="checkbox" checked={entry.done} aria-label={`Complete ${entry.text}`} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,done:e.target.checked}:t))}/><input className="checklist-text" aria-label="To-do task" maxLength={1000} value={entry.text} onChange={e=>onChange(entries.map(t=>t.id===entry.id?{...t,text:e.target.value}:t))}/><button aria-label={`Remove task ${entry.text}`} onClick={()=>onChange(entries.filter(t=>t.id!==entry.id))}>×</button></div>)}
 <form onSubmit={e=>{e.preventDefault();if(!text.trim()||entries.length>=1000)return;onChange([...entries,{id:crypto.randomUUID(),text:text.trim(),done:false}]);setText('');}}><input aria-label="New to-do task" placeholder="Add a task…" maxLength={1000} value={text} onChange={e=>setText(e.target.value)}/><button className="design-button" disabled={!text.trim()||entries.length>=1000}>+ Add task</button></form>
 </section>;
}

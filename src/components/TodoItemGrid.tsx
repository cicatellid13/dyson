import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../lib/catalog';
import { CatalogGrid } from './CatalogGrid';
import { useItemAccess } from './ItemAccess';

export function TodoItemGrid({ items, onLink }: { items: Item[]; onLink: (taskId: string, itemId: number) => void }) {
  const linkRef = useRef(onLink);
  linkRef.current = onLink;
  const [ghost, setGhost] = useState<{id:number;x:number;y:number}|null>(null);
  const stopPointer = useRef<() => void>();
  const suppressClick = useRef(false);
  useEffect(() => () => stopPointer.current?.(), []);
  function startPointer(event: ReactPointerEvent, id:number) {
    if(event.button !== 0) return;
    event.preventDefault();
    suppressClick.current=false;
    const origin={x:event.clientX,y:event.clientY};
    let moved=false;
    let target:HTMLElement|null=null;
    function cleanup() {
      target?.classList.remove('todo-drop-target');
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',cancel,true);
      window.removeEventListener('blur',cancel);
      document.removeEventListener('keydown',key,true);
      setDragging(false);setGhost(null);draggingRef.current=false;
      stopPointer.current=undefined;
    }
    function move(e:PointerEvent) {
      if(!moved && Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<6)return;
      moved=true;draggingRef.current=true;suppressClick.current=true;setDragging(true);
      setGhost({id,x:e.clientX,y:e.clientY});
      target?.classList.remove('todo-drop-target');
      target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-todo-id]')??null;
      target?.classList.add('todo-drop-target');
    }
    function up(e:PointerEvent) {
      if(moved){e.preventDefault();e.stopPropagation();const row=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-todo-id]');if(row?.dataset.todoId)linkRef.current(row.dataset.todoId,id);setOpen(false);}
      cleanup();
    }
    function cancel(){cleanup();}
    function key(e:KeyboardEvent){if(e.key==='Escape')cancel();}
    stopPointer.current?.();stopPointer.current=cleanup;
    window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);document.addEventListener('keydown',key,true);
  }
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const hideFrame = useRef<number>();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const actions = useItemAccess();
  useEffect(() => {
    if (!open) return;
    function close() { cancelAnimationFrame(hideFrame.current ?? 0); draggingRef.current = false; setOpen(false); setDragging(false); }
    function dropped() { setTimeout(close, 0); }
    function blur() { if (!draggingRef.current) close(); }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') close(); }
    function outside(event: PointerEvent) {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('drop', dropped, true);
    document.addEventListener('dragend', dropped, true);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('drop', dropped, true);
      document.removeEventListener('dragend', dropped, true);
      window.removeEventListener('blur', blur);
      cancelAnimationFrame(hideFrame.current ?? 0);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!trigger.current || !panel.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const popup = panel.current;
      popup.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - popup.offsetWidth - 8))}px`;
      popup.style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - popup.offsetHeight - 8))}px`;
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);
  return <><button ref={trigger} type="button" className="todo-grid-toggle" aria-label="Open item grid" data-tooltip="Item grid" aria-expanded={open} onClick={() => setOpen(value => !value)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{[3,10,17].flatMap(x => [3,10,17].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx=".6"/>))}</svg></button>{open && createPortal(<div ref={panel} className="todo-item-grid" role="dialog" aria-label="Link items to tasks" style={{opacity: dragging ? 0 : 1, pointerEvents: dragging ? 'none' : 'auto'}} onDragStartCapture={() => { draggingRef.current = true; }} onDragLeave={event => { if (draggingRef.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) hideFrame.current = requestAnimationFrame(() => setDragging(true)); }}>
    <header><span>Drag items onto a task</span><button type="button" aria-label="Close item grid" onClick={() => setOpen(false)}>×</button></header>
    <CatalogGrid items={items} onItemPointerDown={startPointer} onSelect={id => { if(suppressClick.current){suppressClick.current=false;return;} setOpen(false); actions.navigate(id); }}/>
  </div>, document.body)}{ghost && createPortal(<div className="todo-drag-ghost" style={{left:ghost.x+10,top:ghost.y+10}}><img src={`${import.meta.env.BASE_URL}${items.find(item=>item.id===ghost.id)?.icon}`} alt=""/></div>,document.body)}</>;
}

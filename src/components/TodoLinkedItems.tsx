import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../lib/catalog';
import { useItemAccess } from './ItemAccess';

export function TodoLinkedItems({ items, onRemove }: { items: Item[]; onRemove: (id: number) => void }) {
  const actions = useItemAccess();
  const [drag, setDrag] = useState<{id:number;x:number;y:number;outside:boolean}|null>(null);
  const track = useRef<HTMLDivElement>(null);
  const cleanup = useRef<() => void>();
  const suppressClick = useRef(false);
  const removeRef = useRef(onRemove);
  removeRef.current = onRemove;
  useEffect(() => () => cleanup.current?.(), []);
  function start(event: ReactPointerEvent, id:number) {
    if(event.button !== 0) return;
    event.preventDefault();
    suppressClick.current=false;
    const origin={x:event.clientX,y:event.clientY};
    let moved=false;
    function outside(x:number,y:number) {
      const rect=track.current?.getBoundingClientRect();
      return !!rect && (x<rect.left || x>rect.right || y<rect.top || y>rect.bottom);
    }
    function finish() {
      document.documentElement.classList.remove('task-item-dragging');
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',cancel,true);
      window.removeEventListener('blur',cancel);
      document.removeEventListener('keydown',key,true);
      setDrag(null);cleanup.current=undefined;
    }
    function move(e:PointerEvent) {
      if(!moved && Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<6)return;
      document.documentElement.classList.add('task-item-dragging');
      moved=true;suppressClick.current=true;
      setDrag({id,x:e.clientX,y:e.clientY,outside:outside(e.clientX,e.clientY)});
    }
    function up(e:PointerEvent) {
      if(moved){e.preventDefault();e.stopPropagation();if(outside(e.clientX,e.clientY))removeRef.current(id);}
      finish();
    }
    function cancel(){finish();}
    function key(e:KeyboardEvent){if(e.key==='Escape')cancel();}
    cleanup.current?.();cleanup.current=finish;
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);
    window.addEventListener('pointercancel',cancel,true);
    window.addEventListener('blur',cancel);
    document.addEventListener('keydown',key,true);
  }
  if(!items.length)return <div className="todo-linked-items is-empty" aria-hidden="true"/>;
  const dragged=items.find(item=>item.id===drag?.id);
  return <div className={`todo-linked-items ${items.length === 1 ? 'single' : ''} ${drag?'dragging':''}`} role="group" aria-label="Linked task items" style={{'--linked-count':items.length} as CSSProperties}>
    <div ref={track} className="todo-linked-track">{items.map((item,index)=><button key={item.id} type="button" style={{'--linked-index':index,'--linked-layer':Math.max(1,6-index)} as CSSProperties} data-tooltip={item.name} aria-label={`Open ${item.name}`} draggable={false} onPointerDown={event=>start(event,item.id)} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}actions.navigate(item.id);}} onKeyDown={event=>{if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeRef.current(item.id);}}}><img draggable={false} src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/></button>)}</div>
    {drag&&dragged&&createPortal(<div className={`todo-drag-ghost ${drag.outside?'removing':''}`} style={{left:drag.x-12,top:drag.y-10}}><img src={`${import.meta.env.BASE_URL}${dragged.icon}`} alt=""/>{drag.outside&&<span aria-hidden="true">×</span>}</div>,document.body)}
  </div>;
}

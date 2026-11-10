import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { pinToken, type PinId, type PinnedStripEntry } from '../lib/pinnedItems';
import { createPointerDragSession } from '../lib/pointerDragSession';

export function LocationPinIcon({kind}:{kind:'planet'|'system'}) {
  return <svg width="29" height="29" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='planet'?<><circle cx="16" cy="16" r="9"/><ellipse cx="16" cy="16" rx="15" ry="4" transform="rotate(-28 16 16)"/></>:<><path d="m16 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="currentColor" strokeWidth="1.2"/><path d="M8 5.5a13 13 0 0 1 19 17M24 26.5a13 13 0 0 1-19-17"/><circle cx="6" cy="7" r="2.3"/><circle cx="26" cy="25" r="2.3"/></>}</svg>;
}

export function PinItemButton({name, pinned, onClick, kind='item'}: {name:string;pinned:boolean;onClick:()=>void;kind?:'item'|'planet'|'system'}) {
  return <button type="button" className="pin-item-button" aria-label={`${pinned?'Unpin':'Pin'} ${name}`} aria-pressed={pinned} data-tooltip={pinned?`Unpin ${kind}`:`Pin ${kind} for quick switching`} onClick={onClick}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill={pinned?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 3 7 7-3 1-3 5-2 1-3-3-3-3 1-2 5-3 1-3Z"/><path d="m10 14-7 7"/></svg>
  </button>;
}

export function PinnedItemStrip({items,active,onSelect,onClose,onReorder,acceptingItems=false,dropActive=false,dropProps}: {items:PinnedStripEntry[];active:PinId|null;onSelect:(id:PinId)=>void;onClose:(id:PinId)=>void;onReorder:(source:PinId,target:PinId)=>void;acceptingItems?:boolean;dropActive?:boolean;dropProps?:Pick<HTMLAttributes<HTMLElement>,'onDragOver'|'onDragLeave'|'onDrop'>}) {
  const track = useRef<HTMLElement>(null);
  const cleanup = useRef<() => void>();
  const suppressClick = useRef(false);
  const entries=useRef(items);entries.current=items;
  const callbacks = useRef({onClose,onReorder});
  callbacks.current = {onClose,onReorder};
  const [drag,setDrag] = useState<{id:PinId;x:number;y:number;outside:boolean;target:PinId|null}|null>(null);
  useEffect(()=>()=>cleanup.current?.(),[]);
  function start(event:ReactPointerEvent,id:PinId) {
    if(event.button!==0)return;
    event.preventDefault();
    cleanup.current?.();
    suppressClick.current=false;
    const pointerId=event.pointerId;
    let finished=false;
    function location(x:number,y:number) {
      const strip=track.current;
      const rect=strip?.getBoundingClientRect();
      const outside=!!rect&&(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom);
      const node=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-pinned-item]');
      return {outside,target:!outside&&node&&strip?.contains(node)?entries.current.find(entry=>pinToken(entry.id)===node.dataset.pinnedItem)?.id??null:null};
    }
    function finish() {
      if(finished)return;
      finished=true;
      document.documentElement.classList.remove('task-item-dragging');
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',cancel,true);
      window.removeEventListener('blur',cancel);
      window.removeEventListener('resize',cancel);
      document.removeEventListener('keydown',key,true);
      setDrag(null);cleanup.current=undefined;
    }
    const session=createPointerDragSession({x:event.clientX,y:event.clientY},{
      start:()=>{suppressClick.current=true;document.documentElement.classList.add('task-item-dragging');return true;},
      over:point=>{setDrag({id,...point,...location(point.x,point.y)});return true;},
      drop:point=>{const {outside,target}=location(point.x,point.y);if(outside)callbacks.current.onClose(id);else if(target!==null&&target!==id)callbacks.current.onReorder(id,target);},
      end:finish,
    });
    function move(event:PointerEvent){if(event.pointerId!==pointerId)return;session.move({x:event.clientX,y:event.clientY});}
    function up(event:PointerEvent){if(event.pointerId!==pointerId)return;if(session.release({x:event.clientX,y:event.clientY})){event.preventDefault();event.stopPropagation();}finish();}
    function cancel(){session.cancel();finish();}
    function key(event:KeyboardEvent){if(event.key==='Escape')cancel();}
    cleanup.current=cancel;
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);
    window.addEventListener('pointercancel',cancel,true);
    window.addEventListener('blur',cancel);
    window.addEventListener('resize',cancel);
    document.addEventListener('keydown',key,true);
  }
  if (!items.length && !acceptingItems) return null;
  const dragged=items.find(item=>item.id===drag?.id);
  return <nav ref={track} className={`pinned-item-strip ${acceptingItems?'accepting-items':''} ${dropActive?'incoming-drop-target':''}`} aria-label="Pinned items" {...dropProps}>
    {!items.length&&<span className="pinned-drop-hint" data-tooltip="Drop here to pin" aria-label="Drop here to pin"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 3 7 7-3 1-3 5-2 1-3-3-3-3 1-2 5-3 1-3Z"/><path d="m10 14-7 7"/></svg></span>}
    {items.map(item=><div data-pinned-item={pinToken(item.id)} className={`pinned-item ${active===item.id?'active':''} ${drag&&!drag.outside&&drag.target===item.id&&drag.id!==item.id?'drop-target':''}`} key={item.id}>
      <button type="button" className="pinned-item-open" aria-label={item.name} aria-current={active===item.id?'page':undefined} data-tooltip={item.name} draggable={false} onPointerDown={event=>start(event,item.id)} onClick={event=>{if(suppressClick.current&&event.detail!==0){suppressClick.current=false;return;}onSelect(item.id);}}
        onKeyDown={event=>{
          if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();onClose(item.id);}
          if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();const target=items[items.indexOf(item)+(event.key==='ArrowLeft'?-1:1)];if(target)onReorder(item.id,target.id);}
        }}>
        {item.icon?<img src={`${import.meta.env.BASE_URL}${item.icon}`} alt="" draggable={false}/>:item.kind!=='item'?<LocationPinIcon kind={item.kind}/>:<span aria-hidden="true">◇</span>}
      </button>
      <button type="button" className="pinned-item-close" aria-label={`Unpin ${item.name}`} data-tooltip={`Unpin ${item.name}`} onClick={()=>onClose(item.id)}><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6"/></svg></button>
    </div>)}
    {drag&&dragged&&createPortal(<div className={`todo-drag-ghost ${drag.outside?'removing':''}`} style={{left:drag.x-12,top:drag.y-10}}>{dragged.icon?<img src={`${import.meta.env.BASE_URL}${dragged.icon}`} alt=""/>:dragged.kind!=='item'?<LocationPinIcon kind={dragged.kind}/>:null}{drag.outside&&<span aria-hidden="true">×</span>}</div>,document.body)}
  </nav>;
}

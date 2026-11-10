import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { classifyPinDrop, pinToken, type PinDropSide, type PinItemSource, type PinId, type PinnedStripEntry, type PinnedGroupItem } from '../lib/pinnedItems';
import { createPointerDragSession } from '../lib/pointerDragSession';

export function LocationPinIcon({kind}:{kind:'planet'|'system'}) {
  return <svg width="29" height="29" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='planet'?<><circle cx="16" cy="16" r="9"/><ellipse cx="16" cy="16" rx="15" ry="4" transform="rotate(-28 16 16)"/></>:<><path d="m16 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="currentColor" strokeWidth="1.2"/><path d="M8 5.5a13 13 0 0 1 19 17M24 26.5a13 13 0 0 1-19-17"/><circle cx="6" cy="7" r="2.3"/><circle cx="26" cy="25" r="2.3"/></>}</svg>;
}

export function PinItemButton({name, pinned, onClick, kind='item'}: {name:string;pinned:boolean;onClick:()=>void;kind?:'item'|'planet'|'system'}) {
  return <button type="button" className="pin-item-button" aria-label={`${pinned?'Unpin':'Pin'} ${name}`} aria-pressed={pinned} data-tooltip={pinned?`Unpin ${kind}`:`Pin ${kind} for quick switching`} onClick={onClick}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill={pinned?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 3 7 7-3 1-3 5-2 1-3-3-3-3 1-2 5-3 1-3Z"/><path d="m10 14-7 7"/></svg>
  </button>;
}

type Intent = {kind:'group';planet:string}|{kind:'group-reorder';planet:string;target:number}|{kind:'reorder';target:PinId|null;side:PinDropSide};
type DragSource={id:PinId;planet?:string};
type Props={items:PinnedStripEntry[];active:PinId|null;onSelect:(id:PinId)=>void;onClose:(id:PinId)=>void;onReorder:(source:PinId,target:PinId)=>void;onInsert:(id:PinId,target:PinId|null,side:PinDropSide,fromPlanet?:string)=>void;onStore:(planet:string,id:number,source:PinItemSource)=>void;onRemoveGrouped:(planet:string,id:number)=>void;onReorderGrouped:(planet:string,id:number,target:number)=>void;incomingItemId:number|null;acceptingItems?:boolean;dropActive?:boolean;dropProps?:Pick<HTMLAttributes<HTMLElement>,'onDragOver'|'onDragLeave'|'onDrop'>};

export function PinnedItemStrip(props:Props) {
  const {items,active,onSelect,onClose,onReorder,acceptingItems=false,dropActive=false,dropProps,incomingItemId}=props;
  const track=useRef<HTMLElement>(null),cleanup=useRef<()=>void>(),suppressClick=useRef(false);
  const current=useRef(props);current.current=props;
  const [drag,setDrag]=useState<{source:DragSource;x:number;y:number;outside:boolean;intent:Intent}|null>(null);
  const [incoming,setIncoming]=useState<Intent|null>(null);
  useEffect(()=>()=>cleanup.current?.(),[]);
  useEffect(()=>{if(!acceptingItems)setIncoming(null);},[acceptingItems]);
  function hit(x:number,y:number,source:DragSource):{outside:boolean;intent:Intent} {
    const strip=track.current,rect=strip?.getBoundingClientRect();
    const outside=!!rect&&(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom);
    const hitNode=document.elementFromPoint(x,y);
    let unit=hitNode?.closest<HTMLElement>('[data-pinned-unit]');
    if(unit&&!strip?.contains(unit))unit=null;
    const units=Array.from(strip?.querySelectorAll<HTMLElement>('[data-pinned-unit]')??[]);
    if(!unit&&!outside)unit=units.reduce<HTMLElement|null>((nearest,node)=>{
      const r=node.getBoundingClientRect(),n=nearest?.getBoundingClientRect();
      return !n||Math.abs(x-(r.left+r.right)/2)<Math.abs(x-(n.left+n.right)/2)?node:nearest;
    },null);
    const entry=current.current.items.find(entry=>pinToken(entry.id)===unit?.dataset.pinnedUnit);
    if(!entry||!unit)return {outside,intent:{kind:'reorder',target:null,side:'after'}};
    if(!outside&&typeof source.id==='number'&&entry.kind==='planet'){
      const planet=String(entry.id),child=hitNode?.closest<HTMLElement>('[data-group-item]');
      if(child&&unit.contains(child))return {outside,intent:source.planet===planet?{kind:'group-reorder',planet,target:Number(child.dataset.groupItem)}:{kind:'group',planet}};
      const button=unit.querySelector<HTMLElement>('[data-planet-pin]'),r=button?.getBoundingClientRect();
      if(r&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom&&classifyPinDrop(x,r.left,r.width,true).kind==='group')return {outside,intent:{kind:'group',planet}};
    }
    const r=unit.getBoundingClientRect(),side=classifyPinDrop(x,r.left,r.width,false);
    return {outside,intent:{kind:'reorder',target:entry.id,side:side.kind==='reorder'?side.side:'before'}};
  }
  function apply(source:DragSource,intent:Intent,outside:boolean) {
    const actions=current.current;
    if(outside){if(source.planet&&typeof source.id==='number')actions.onRemoveGrouped(source.planet,source.id);else actions.onClose(source.id);return;}
    if(intent.kind==='group'&&typeof source.id==='number')actions.onStore(intent.planet,source.id,source.planet?{planet:source.planet}:'strip');
    else if(intent.kind==='group-reorder'&&typeof source.id==='number')actions.onReorderGrouped(intent.planet,source.id,intent.target);
    else if(intent.kind==='reorder')actions.onInsert(source.id,intent.target,intent.side,source.planet);
  }
  function start(event:ReactPointerEvent,source:DragSource){
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();cleanup.current?.();suppressClick.current=false;
    const pointerId=event.pointerId;let finished=false;
    function finish(){
      if(finished)return;finished=true;
      document.documentElement.classList.remove('task-item-dragging');
      window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);window.removeEventListener('resize',cancel);document.removeEventListener('keydown',key,true);
      setDrag(null);cleanup.current=undefined;
    }
    const session=createPointerDragSession({x:event.clientX,y:event.clientY},{
      start:()=>{suppressClick.current=true;document.documentElement.classList.add('task-item-dragging');return true;},
      over:point=>{setDrag({source,...point,...hit(point.x,point.y,source)});return true;},
      drop:point=>{const result=hit(point.x,point.y,source);apply(source,result.intent,result.outside);},end:finish,
    });
    function move(event:PointerEvent){if(event.pointerId===pointerId)session.move({x:event.clientX,y:event.clientY});}
    function up(event:PointerEvent){if(event.pointerId!==pointerId)return;if(session.release({x:event.clientX,y:event.clientY})){event.preventDefault();event.stopPropagation();}finish();}
    function cancel(){session.cancel();finish();}
    function key(event:KeyboardEvent){if(event.key==='Escape')cancel();}
    cleanup.current=cancel;window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);document.addEventListener('keydown',key,true);
  }
  function open(event:React.MouseEvent,id:PinId){if(suppressClick.current&&event.detail!==0){suppressClick.current=false;return;}onSelect(id);}
  const intent=drag&&!drag.outside?drag.intent:incoming;
  const dragged=drag?.source.planet?items.find(entry=>entry.id===drag.source.planet)?.children?.find(item=>item.id===drag.source.id):items.find(item=>item.id===drag?.source.id);
  const renderIcon=(item:PinnedStripEntry|PinnedGroupItem)=>item.icon?<img src={`${import.meta.env.BASE_URL}${item.icon}`} alt="" draggable={false}/>:'kind' in item&&item.kind!=='item'?<LocationPinIcon kind={item.kind}/>:<span aria-hidden="true">◇</span>;
  if(!items.length&&!acceptingItems)return null;
  return <nav ref={track} className={`pinned-item-strip ${acceptingItems?'accepting-items':''} ${dropActive?'incoming-drop-target':''}`} aria-label="Pinned items"
    onDragOver={event=>{
      if(incomingItemId!==null&&event.dataTransfer.types.includes('application/x-dsp-item')){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';setIncoming(hit(event.clientX,event.clientY,{id:incomingItemId}).intent);}
      else dropProps?.onDragOver?.(event);
    }}
    onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setIncoming(null);dropProps?.onDragLeave?.(event);}}
    onDrop={event=>{
      if(incomingItemId!==null&&Number(event.dataTransfer.getData('application/x-dsp-item'))===incomingItemId){
        event.preventDefault();event.stopPropagation();const result=hit(event.clientX,event.clientY,{id:incomingItemId}).intent;
        if(result.kind==='group')current.current.onStore(result.planet,incomingItemId,'external');
        else if(result.kind==='reorder')current.current.onInsert(incomingItemId,result.target,result.side);
        setIncoming(null);
      }else dropProps?.onDrop?.(event);
    }}>
    {!items.length&&<span className="pinned-drop-hint" data-tooltip="Drop here to pin" aria-label="Drop here to pin">+</span>}
    {items.map(item=>{
      const children=item.children??[],planet=String(item.id),grouped=item.kind==='planet'&&children.length>0;
      const grouping=intent?.kind==='group'&&intent.planet===item.id;
      const insert=intent?.kind==='reorder'&&intent.target===item.id?`insert-${intent.side}`:'';
      const expanding=!!drag?.source.planet&&drag.source.planet===item.id||intent?.kind==='group-reorder'&&intent.planet===item.id;
      return <div data-pinned-unit={pinToken(item.id)} className={`pinned-unit ${grouped?'pinned-planet-group':''} ${grouping?'group-drop-target':''} ${insert} ${expanding?'group-dragging':''}`} key={item.id} role={grouped?'group':undefined} aria-label={grouped?`${item.name} pinned item group`:undefined}>
        <div className={`pinned-item ${active===item.id?'active':''}`}>
          <button type="button" className="pinned-item-open" data-planet-pin={item.kind==='planet'?'true':undefined} aria-label={item.name} aria-current={active===item.id?'page':undefined} data-tooltip={item.name} draggable={false} onPointerDown={event=>start(event,{id:item.id})} onClick={event=>open(event,item.id)}
            onKeyDown={event=>{
              if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();onClose(item.id);}
              if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();const target=items[items.indexOf(item)+(event.key==='ArrowLeft'?-1:1)];if(target)onReorder(item.id,target.id);}
            }}>{renderIcon(item)}</button>
          <button type="button" className="pinned-item-close" aria-label={`Unpin ${item.name}`} data-tooltip={`Unpin ${item.name}`} onClick={()=>onClose(item.id)}>×</button>
        </div>
        {grouped&&<div className={`todo-linked-items pinned-group-items ${children.length===1?'single':''}`} style={{'--linked-count':children.length} as CSSProperties}>
          <div className="todo-linked-track">{children.map((child,index)=><button key={child.id} type="button" data-group-item={child.id} style={{'--linked-index':index,'--linked-layer':Math.max(1,6-index)} as CSSProperties} className={`${active===child.id?'active':''} ${intent?.kind==='group-reorder'&&intent.planet===planet&&intent.target===child.id?'drop-target':''}`} aria-label={child.name} data-tooltip={child.name} draggable={false} onPointerDown={event=>start(event,{id:child.id,planet})} onClick={event=>open(event,child.id)}
            onKeyDown={event=>{if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();current.current.onRemoveGrouped(planet,child.id);}if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();const target=children[index+(event.key==='ArrowLeft'?-1:1)];if(target)current.current.onReorderGrouped(planet,child.id,target.id);}}}>{renderIcon(child)}{child.requiredInput&&<span className="task-input-arrow" aria-label="Required input">←</span>}</button>)}</div>
        </div>}
      </div>;
    })}
    {drag&&dragged&&createPortal(<div className={`todo-drag-ghost ${drag.outside?'removing':''}`} style={{left:drag.x-12,top:drag.y-10}}>{renderIcon(dragged)}{drag.outside&&<span aria-hidden="true">×</span>}</div>,document.body)}
    {intent?.kind==='group'&&<span className="pinned-group-drop-message" role="status">Drop to group with planet</span>}
  </nav>;
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export function AppTooltips(){
 const [target,setTarget]=useState<HTMLElement|null>(null);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;let active:HTMLElement|null=null;
  const hide=()=>{clearTimeout(timer);active=null;setTarget(null);};
  const show=(event:Event)=>{
   const next=event.target instanceof Element?event.target.closest<HTMLElement>('[data-tooltip]'):null;
   if(next===active)return;hide();if(!next?.dataset.tooltip)return;active=next;
   timer=setTimeout(()=>{if(next.isConnected)setTarget(next);},100);
  };
  const leave=(event:MouseEvent)=>{if(active&&!(event.relatedTarget instanceof Node&&active.contains(event.relatedTarget)))hide();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  document.addEventListener('mouseover',show);document.addEventListener('mouseout',leave);document.addEventListener('focusin',show);document.addEventListener('focusout',hide);
  document.addEventListener('pointerdown',hide,true);document.addEventListener('scroll',hide,true);document.addEventListener('keydown',key);window.addEventListener('blur',hide);window.addEventListener('resize',hide);
  return ()=>{hide();document.removeEventListener('mouseover',show);document.removeEventListener('mouseout',leave);document.removeEventListener('focusin',show);document.removeEventListener('focusout',hide);document.removeEventListener('pointerdown',hide,true);document.removeEventListener('scroll',hide,true);document.removeEventListener('keydown',key);window.removeEventListener('blur',hide);window.removeEventListener('resize',hide);};
 },[]);
 useLayoutEffect(()=>{
  if(!target||!ref.current)return;
  const box=target.getBoundingClientRect(), tip=ref.current;
  tip.style.left=`${Math.max(8,Math.min(box.left+(box.width-tip.offsetWidth)/2,innerWidth-tip.offsetWidth-8))}px`;
  tip.style.top=`${box.top>tip.offsetHeight+16?box.top-tip.offsetHeight-8:Math.min(box.bottom+8,innerHeight-tip.offsetHeight-8)}px`;
  const previous=target.getAttribute('aria-describedby');target.setAttribute('aria-describedby',[previous,'app-tooltip'].filter(Boolean).join(' '));
  return ()=>{if(previous)target.setAttribute('aria-describedby',previous);else target.removeAttribute('aria-describedby');};
 },[target]);
 return target&&createPortal(<div ref={ref} id="app-tooltip" className="app-tooltip" role="tooltip">{target.dataset.tooltip}</div>,target.closest('dialog')??document.body);
}

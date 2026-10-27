import { themeDrag } from '../lib/dragAppearance';
import { createContext, useContext, type DragEvent, type ReactNode } from 'react';
export const ItemAccessContext = createContext<{navigate:(id:number)=>void;drag:(id:number|null)=>void}>({navigate:()=>{},drag:()=>{}});
export function useItemAccess(){
 const actions=useContext(ItemAccessContext);
 return {...actions, dragProps:(id:number)=>({draggable:true,onDragStart:(event:DragEvent)=>{event.stopPropagation();themeDrag(event);event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData('application/x-dsp-item',String(id));actions.drag(id);},onDragEnd:()=>actions.drag(null)})};
}
export function ItemJump({id,name}:{id:number;name?:string}){
 const actions=useItemAccess();
 return <button type="button" className="item-jump" aria-label={`Open ${name??'item'}`} data-tooltip={`Open ${name??'item'}`} onClick={event=>{event.preventDefault();event.stopPropagation();actions.navigate(id);}}>↗</button>;
}
export function ItemAccess({id,name,children}:{id:number;name?:string;children:ReactNode}){
 const actions=useItemAccess();
 return <span className="item-access" {...actions.dragProps(id)}>{children}<ItemJump id={id} name={name}/></span>;
}

export function ItemLink({id,name,children}:{id:number;name?:string;children:ReactNode}){const actions=useItemAccess();return <button type="button" className="logistics-item-link" data-tooltip={`Open ${name??'item'}`} {...actions.dragProps(id)} onClick={()=>actions.navigate(id)}>{children}</button>;}

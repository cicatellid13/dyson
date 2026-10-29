import type { SavedFactory } from '../lib/savedFactories';
import { FactoryPlannerIcon } from './FactoryPlannerIcon';
import { themeDrag } from '../lib/dragAppearance';
import { createContext, useContext, type DragEvent, type ReactNode } from 'react';
export const ItemAccessContext = createContext<{navigate:(id:number)=>void;planet:(id:string,entryId?:string,factoryId?:string)=>void;network:(id:number,consumer?:{planetId:string;entryId:string})=>void;plan:(id:number,saved?:SavedFactory,planetId?:string)=>void;drag:(id:number|null)=>void}>({navigate:()=>{},planet:()=>{},network:()=>{},plan:()=>{},drag:()=>{}});
export function useItemAccess(){
 const actions=useContext(ItemAccessContext);
 return {...actions, dragProps:(id:number)=>({draggable:true,onDragStart:(event:DragEvent)=>{event.stopPropagation();themeDrag(event);event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData('application/x-dsp-item',String(id));actions.drag(id);},onDragEnd:()=>actions.drag(null)})};
}
export function ItemJump({id,name}:{id:number;name?:string}){
 const actions=useItemAccess();
 return <button type="button" className="item-jump" aria-label={`Plan ${name??'item'}`} data-tooltip="Factory Planner" onClick={event=>{event.preventDefault();event.stopPropagation();actions.plan(id);}}><FactoryPlannerIcon/></button>;
}
export function ItemAccess({id,name,children}:{id:number;name?:string;children:ReactNode}){
 const actions=useItemAccess();
 return <span className="item-access" {...actions.dragProps(id)}>{children}<ItemJump id={id} name={name}/></span>;
}

export function ItemLink({id,name,children}:{id:number;name?:string;children:ReactNode}){const actions=useItemAccess();return <button type="button" className="logistics-item-link" aria-label={name} {...actions.dragProps(id)} onClick={()=>actions.navigate(id)}>{children}</button>;}

import { useState, type PointerEvent, type ReactNode } from 'react';
import type { Item } from '../lib/catalog';
import { useItemAccess } from './ItemAccess';
export function CatalogGrid({ items, onSelect, onItemPointerDown, headerAddon }: { items: Item[]; onSelect: (id:number)=>void; headerAddon?: ReactNode; onItemPointerDown?: (event: PointerEvent, id: number) => void }) {
  const [page, setPage] = useState(1);
  const actions = useItemAccess();
  const positions = new Map(items.filter(item => Math.floor((item.grid_index ?? 0)/1000) === page).map(item => [item.grid_index!, item]));
  return <div className="catalog-grid-view"><div className="catalog-grid-tabs" role="tablist" aria-label="Item grid categories">{['Components','Buildings'].map((label,index)=><button key={label} role="tab" aria-selected={page===index+1} onClick={()=>setPage(index+1)}>{label}</button>)}{headerAddon}</div>
    <div className="catalog-grid-scroll"><div className="catalog-icon-grid" role="group" aria-label={page===1?'Components':'Buildings'}>
      {['I','II','III','IV','V','VI','VII','VIII'].map((label,row)=><div className="catalog-grid-row" key={label}><span className="grid-row-number">{label}</span>{Array.from({length:14},(_,col)=>{
        const item=positions.get(page*1000+(row+1)*100+col+1);
        return item ? <button key={col} className="catalog-grid-cell" data-tooltip={item.name} aria-label={item.name} {...(onItemPointerDown ? {draggable:false,onPointerDown:(event:PointerEvent)=>onItemPointerDown(event,item.id)} : actions.dragProps(item.id))} onClick={()=>onSelect(item.id)}>{item.icon?<img draggable={false} src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>:<span className="preview-name">{item.name}</span>}</button>:<span key={col} className="catalog-grid-cell empty"/>;
      })}</div>)}
    </div></div>{!positions.size&&<p className="note">No matching items in this tab.</p>}
  </div>;
}

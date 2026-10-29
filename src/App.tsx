import {NetworkButton,NetworkSearch,type NetworkRequest} from './components/NetworkSearch';
import { useSessionSelection, useSessionExpansion } from './lib/sessionExpansion';
import type { SavedFactory } from './lib/savedFactories';
import { ItemPicker } from './components/ItemPicker';
import { FactoryPlanner, EmbeddedFactoryPlanner } from './components/FactoryPlanner';
import { themeDrag, useDelayedDragCursor } from './lib/dragAppearance';
import { CatalogGrid } from './components/CatalogGrid';
import { ItemOverview, ItemInfo } from './components/ItemOverview';
import { ThemedSelect } from './components/ThemedSelect';
import { ItemAccessContext, ItemJump, useItemAccess } from './components/ItemAccess';
import '@fontsource/orbitron/600.css';
import { Planning } from './components/Planning';
import { undoRemoval, dismissRemoval, initializePersistence, useWorkspace, updateWorkspace, resolveWorkspace, retrySync } from './lib/persistence';
import { CategoryIcon } from './components/CategoryIcon';
import { useEffect, useMemo, useState } from 'react';
import { batchesFor, pairs, recipesFor, isDefenseItem, catalogForDarkFog, type Catalog, type Item } from './lib/catalog';
import snapshot from '../public/data/catalog.json';
import { Design } from './components/Design';
import { openInBrowser, browserUrlForTitle } from './lib/wikiLinks';

function Icon({item,large=false,count}:{item?:Item;large?:boolean;count?:number}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[item?.id]);
  return <span className={`item-icon ${large?'large':''} ${isDefenseItem(item)?'defense-icon':''}`}>{item?.icon&&!failed?<img src={`${import.meta.env.BASE_URL}${item.icon}`} alt="" draggable={false} onError={()=>setFailed(true)}/>:<span>{item?.name.slice(0,2)??'◇'}</span>}{count!==undefined&&<small className="icon-quantity" aria-label={`Quantity ${count.toLocaleString()}`}>{count.toLocaleString()}</small>}</span>;
}
function ExpandableInput({ catalog, itemMap, id, count, path, onItemDrag }: {
  catalog: Catalog; itemMap: Map<number, Item>; id: number; count: number; path: number[]; onItemDrag: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const itemActions=useItemAccess();
  const [chosenRecipe, setChosenRecipe] = useState<number | null>(null);
  const item = itemMap.get(id);
  const options = recipesFor(catalog, id);
  const recipe = options.find(r => r.id === chosenRecipe) ?? options[0];
  const cycle = path.includes(id);
  const batches = recipe ? batchesFor(recipe, id, count) : 0;
  return <div className="inline-input">
    <div className="input-access-row">
    <div className={`ingredient expandable-ingredient ${isDefenseItem(item)?'defense-item':''}`} draggable={!!item} onDragStart={event => { event.stopPropagation(); themeDrag(event); event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-dsp-item', String(id)); onItemDrag(id); }} onDragEnd={() => onItemDrag(null)} >
      <button className="ingredient-name" onClick={()=>itemActions.navigate(id)}><Icon item={item} count={count}/><span>{item?.name ?? `Item ${id}`}</span></button>
      <button className="ingredient-expand" aria-label={`Expand recipe for ${item?.name}`} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span className="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span></button>
    </div><ItemJump id={id} name={item?.name}/></div>
    {open && <div className="inline-recipe">
      {cycle ? <p className="note">This ingredient repeats in the chain. Supply it separately to avoid a circular recipe.</p>
        : !recipe ? <p className="note">{item?.mining_from ?? item?.explicit_produce_from ?? 'Gather / supply directly — no crafting recipe listed.'}</p>
        : <>
          {options.length > 1 && <label className="inline-choice">Recipe for {item?.name}
            <ThemedSelect className={isDefenseItem(item)?'defense-item':''} value={recipe.id} onChange={event => setChosenRecipe(Number(event.target.value))}>
              {options.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </ThemedSelect>
          </label>}
          <p className="note">{batches.toLocaleString()} batch{batches === 1 ? '' : 'es'} · {recipe.seconds}s per batch · {catalog.facilities[recipe.type]?.name ?? recipe.type}
            {recipe.type === 'FRACTIONATE' && ' · Expected statistical yields'}
          </p>
          <div className="section-label">REQUIRES</div>
          <div className="ingredients" key={recipe.id}>
            {pairs(recipe.inputs).map(input => <ExpandableInput key={input.id} catalog={catalog} itemMap={itemMap} id={input.id} count={input.count * batches} path={[...path, id]} onItemDrag={onItemDrag}/>)}
          </div>
        </>}
    </div>}
  </div>;
}

export function App(){
 useDelayedDragCursor();


 const [query,setQuery]=useState('');
 const [favoriteSearch,setFavoriteSearch]=useState('');
 const [,setLocation]=useSessionSelection('logistics-location');const [,setGraph]=useSessionSelection('logistics-graph');const [,setSystemsExpanded]=useSessionExpansion('logistics-systems');
 const [networkRequest,setNetworkRequest]=useState<NetworkRequest|null>(null);const [,setEntriesExpanded]=useSessionExpansion('logistics-entries');const [,setFactoryPlanet]=useSessionSelection('logistics-factory-planet');const [,setFactoryFocus]=useSessionSelection('logistics-factory-focus');const [,setNetworkFocus]=useSessionSelection('logistics-network-focus');
 function openPlanet(id:string,entryId?:string,factoryId?:string){const planet=cloud.view.data.design.sections.find(s=>s.id===id&&s.kind==='planet');if(!planet)return;setLocation(id);setGraph(null);setNetworkFocus(JSON.stringify({entryId,factoryId,nonce:crypto.randomUUID()}));if(entryId)setEntriesExpanded(old=>new Set([...old,entryId]));if(factoryId){setFactoryPlanet(id);setFactoryFocus(factoryId);}if(planet.parentId)setSystemsExpanded(old=>new Set([...old,planet.parentId!]));selectCategory('Logistics Network');}
 const [plannerRequest,setPlannerRequest]=useState<{id:number;sequence:number;saved?:SavedFactory;planetId?:string}>();
 function planItem(id:number,saved?:SavedFactory,planetId?:string){setPlannerRequest(previous=>({id,saved,planetId,sequence:(previous?.sequence??0)+1}));setCategory('Factory Planner');}
 const [draggedItem,setDraggedItem]=useState<number|null>(null);
 const [favoriteDropTarget,setFavoriteDropTarget]=useState<string|null>(null);
 const [favoriteNotice,setFavoriteNotice]=useState('');
 useEffect(()=>{ if(draggedItem===null)setFavoriteDropTarget(null); },[draggedItem]);
 useEffect(()=>{ if(!favoriteNotice)return; const timer=setTimeout(()=>setFavoriteNotice(''),3500); return ()=>clearTimeout(timer); },[favoriteNotice]);
 const [category,setCategory]=useState('All items');
 const [categoriesExpanded,setCategoriesExpanded]=useState(false);
 const [favoriteSelected,setFavoriteSelected]=useState<number|null>(null);
 const cloud=useWorkspace();
 const [viewOverride,setViewOverride]=useState<'list'|'grid'|null>(null);
 const catalogView=viewOverride ?? cloud.view.data.defaultCatalogView ?? 'list';
 const [gridDetail,setGridDetail]=useState(false);
 const gridView=category==='All items' && catalogView==='grid';
 const error=cloud.error;
 useEffect(()=>{void initializePersistence();},[]);
 const darkFog=cloud.view.data.darkFog;
 const favorites=cloud.view.data.favorites;
 function toggleDarkFog(){
  const next=!darkFog;
  if(!next&&['Turrets','Defense','Dark Fog'].includes(category))setCategory('All items');
  updateWorkspace(data=>({...data,darkFog:next}));
 }
 const catalog=useMemo(()=>catalogForDarkFog(cloud.catalog ?? snapshot as unknown as Catalog,darkFog),[cloud.catalog,darkFog]);
 const [selected,setSelected]=useState(1303);
 const [history,setHistory]=useState<{id:number;category:string;detail:boolean;gridOrigin:boolean}[]>([]);
 const [gridOrigin,setGridOrigin]=useState(false);
 const [recipeId,setRecipeId]=useState<number|null>(null);
 const [quantity,setQuantity]=useState(1);
 const [tab,setTab]=useState<'recipe'|'chain'>('recipe');

 const itemMap=useMemo(()=>new Map(catalog?.items.map(i=>[i.id,i])),[catalog]);
 useEffect(()=>{
  if(!itemMap.has(selected)){setSelected(itemMap.has(1303)?1303:catalog.items[0].id);setRecipeId(null);setQuantity(1);}
  setHistory(previous=>previous.filter(entry=>itemMap.has(entry.id)));
 },[itemMap,selected]);
 const item=category==='Favorites' && favoriteSelected===null?undefined:itemMap.get(selected);
 const recipes=catalog?recipesFor(catalog,selected):[];
 const recipe=recipes.find(r=>r.id===recipeId)??recipes[0];
 const batches=recipe?batchesFor(recipe,selected,quantity):0;
 function navigate(id:number){
  if(!itemMap.has(id))return;
  const external=category==='Logistics Network'||category==='Planning'||category==='Factory Planner';
  if(external||id!==selected)setHistory(h=>[...h,{id:selected,category,detail:gridDetail,gridOrigin}]);
  if(external){setCategory('All items');setQuery('');setGridDetail(true);setGridOrigin(false);}
  if(category==='Favorites'){setFavoriteSelected(id);setFavoriteSearch(itemMap.get(id)?.name??'');}
  setSelected(id);setRecipeId(null);setQuantity(1);
 }
 function goBack(){
  const previous=history[history.length-1];if(!previous)return;
  setHistory(h=>h.slice(0,-1));setCategory(previous.category);setGridDetail(previous.detail);setGridOrigin(previous.gridOrigin);setSelected(previous.id);setRecipeId(null);setQuantity(1);
  if(previous.category==='Favorites')setFavoriteSelected(previous.id);
 }
 function returnToGrid(){setCategory('All items');setGridDetail(false);setGridOrigin(false);setHistory([]);setViewOverride('grid');}

 function favorite(){updateWorkspace(data=>({...data,favorites:data.favorites.includes(selected)?data.favorites.filter(id=>id!==selected):[...data.favorites,selected]}));}
 function favoriteDropProps(target:string) {
  return {
   onDragOver:(event:React.DragEvent)=>{ if(draggedItem===null || !itemMap.has(draggedItem) || !event.dataTransfer.types.includes('application/x-dsp-item'))return; event.preventDefault(); event.dataTransfer.dropEffect='copy'; setFavoriteDropTarget(target); },
   onDragLeave:(event:React.DragEvent)=>{ if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFavoriteDropTarget(null); },
   onDrop:(event:React.DragEvent)=>{
    event.preventDefault(); const id=Number(event.dataTransfer.getData('application/x-dsp-item'));
    if(draggedItem!==null && id===draggedItem && itemMap.has(id)) {
     updateWorkspace(data=>data.favorites.includes(id)?data:{...data,favorites:[...data.favorites,id]});
     setFavoriteNotice(`${itemMap.get(id)!.name} ${favorites.includes(id)?'is already in':'added to'} Favorites`);
     if(category==='Favorites')setQuery('');
    }
    setDraggedItem(null); setFavoriteDropTarget(null);
   }
  };
 }
 function itemDragProps(id:number){return {draggable:true,onDragStart:(event:React.DragEvent)=>{event.stopPropagation();themeDrag(event);event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData('application/x-dsp-item',String(id));setDraggedItem(id);},onDragEnd:()=>setDraggedItem(null)};}
 function favoriteReorderProps(target:number){return {
  onDragOver:(event:React.DragEvent)=>{if(draggedItem!==null && favorites.includes(draggedItem)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';setFavoriteDropTarget(`row-${target}`);}},
  onDrop:(event:React.DragEvent)=>{if(draggedItem===null || !favorites.includes(draggedItem))return;event.preventDefault();event.stopPropagation();const source=draggedItem;updateWorkspace(data=>{const order=[...data.favorites];const from=order.indexOf(source),to=order.indexOf(target);if(from<0||to<0)return data;order.splice(from,1);order.splice(to,0,source);return {...data,favorites:order};});setDraggedItem(null);setFavoriteDropTarget(null);}
 };}
 function selectCategory(next:string){setHistory([]);setGridOrigin(false);setGridDetail(false);setViewOverride(null);setQuery('');setCategory(next);if(next==='Favorites'){if(favoriteSelected!==null&&favorites.includes(favoriteSelected))setSelected(favoriteSelected);else setFavoriteSelected(null);setHistory([]);}}
 const categories=['All items','Favorites','Logistics Network','Factory Planner','Planning','Buildings',...Object.values(catalog?.categories??{}).filter(c=>c!=='Unknown Category'&&(darkFog||!['Turrets','Defense','Dark Fog'].includes(c)))];
 const searchPlaceholders:Record<string,string>={
  'All items':'Find an item or building…',
  'Favorites':'Search your favorites…',
  'Buildings':'Find a building…',
  'Natural Resources':'Find a natural resource…',
  'Materials':'Find a material…',
  'Components':'Find a component…',
  'End Products':'Find an end product…',
  'Logistics':'Find a logistics item…',
  'Production Facilities':'Find a production facility…',
  'Decorations':'Find a decoration…',
  'Turrets':'Find a turret…',
  'Defense':'Find a defense item…',
  'Dark Fog':'Find a Dark Fog item…',
  'Science Matrices':'Find a science matrix…',
 };
 const searchPlaceholder=searchPlaceholders[category]??`Search ${category.toLowerCase()}…`;
 const visible=catalog?.items.filter(i=>(category==='All items'||category==='Favorites'&&favorites.includes(i.id)||category==='Buildings'&&i.can_build||catalog.categories[i.type]===category)&&(category==='Favorites'||`${i.name} ${i.description}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>category==='Favorites'?favorites.indexOf(a.id)-favorites.indexOf(b.id):a.name.localeCompare(b.name))??[];
 const uses=catalog?.recipes.filter(r=>pairs(r.inputs).some(p=>p.id===selected))??[];
 function chip(id:number,count?:number,showPlanner=true){const target=itemMap.get(id);return <div className={`ingredient ingredient-chip ${isDefenseItem(target)?'defense-item':''}`} key={id} {...itemDragProps(id)}><button className="ingredient-name" onClick={()=>navigate(id)}><Icon item={target} count={count}/><span>{target?.name??`Item ${id}`}</span></button>{showPlanner&&<ItemJump id={id} name={target?.name}/>}</div>;}
 function tree(id:number,count:number,path:number[],depth=0):React.ReactNode {
  const target=itemMap.get(id);const cycle=path.includes(id);const r=depth===0?recipe:catalog&&recipesFor(catalog,id)[0];
  if(cycle||!r||depth>=8)return <div className="tree-leaf">{chip(id,count)}<small>{cycle?'Cycle — supply this ingredient separately':depth>=8?'Depth limit — open item to continue':target?.mining_from??'Gather / supply directly'}</small></div>;
  const b=batchesFor(r,id,count);
  return <details className="tree-node" open={depth<2} key={`${id}-${depth}`}><summary {...itemDragProps(id)} className={isDefenseItem(target)?'defense-item':''}><button className="ingredient-name" onClick={event=>{event.preventDefault();event.stopPropagation();navigate(id);}}><Icon item={target} count={count}/><strong>{target?.name}</strong></button><small>{b} batch{b!==1?'es':''} · {r.seconds*b}s</small><ItemJump id={id} name={target?.name}/></summary><div>{pairs(r.inputs).map(p=><div key={p.id}>{tree(p.id,p.count*b,[...path,id],depth+1)}</div>)}</div></details>;
 }
 if(!cloud.ready)return <div className="boot"><h1>DSP Toolkit</h1><p>{cloud.error || 'Opening your shared workspace…'}</p>{cloud.error && <button onClick={()=>{void initializePersistence();}}>Retry connection</button>}</div>;
 function sidebarCategory(c:string){return <button className={`${category===c?'nav active':'nav'} ${c==='Favorites' && draggedItem!==null?'favorite-drop-ready':''} ${c==='Favorites' && favoriteDropTarget==='nav'?'favorite-drop-active':''}`} {...(c==='Favorites'?favoriteDropProps('nav'):{})} key={c} onClick={()=>selectCategory(c)}><span>{c==='All items'?'▦':c==='Favorites'?'☆':c==='Buildings'?'▤':<CategoryIcon category={c}/>}</span>{c}<small>{c==='All items'?catalog.items.length:c==='Favorites'?favorites.filter(id=>itemMap.has(id)).length:''}</small></button>;}
 return <ItemAccessContext.Provider value={{navigate,planet:openPlanet,network:(id,consumer)=>setNetworkRequest({id,consumer}),plan:planItem,drag:setDraggedItem}}><div className="app-shell dark-fog-normal">{networkRequest&&<NetworkSearch key={networkRequest.id} request={networkRequest} catalog={catalog} onClose={()=>setNetworkRequest(null)}/>}{cloud.undoLabel&&<div className="removal-undo" role="status">{cloud.undoError??cloud.undoLabel}<button onClick={undoRemoval}>Undo</button><button aria-label="Dismiss undo" onClick={dismissRemoval}>×</button></div>}
 {favoriteNotice && <div className="favorite-drop-notice" role="status">{favoriteNotice}</div>}<aside className="sidebar"><div className="brand"><img className="brand-logo" src={`${import.meta.env.BASE_URL}art/toolkit-logo.png`} alt=""/><div><strong>TOOLKIT</strong><small>DYSON SPHERE PROGRAM</small></div></div><div className="nav-caption">YOUR LIBRARY</div><nav aria-label="Item categories"><div className="all-items-nav-row">{sidebarCategory('All items')}<button className="category-expand" aria-label={categoriesExpanded?'Collapse item categories':'Expand item categories'} aria-expanded={categoriesExpanded} aria-controls="sidebar-item-categories" onClick={()=>setCategoriesExpanded(value=>!value)}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={{transform:categoriesExpanded?'rotate(90deg)':undefined}}><path d="m6 3 5 5-5 5"/></svg></button></div><div id="sidebar-item-categories" className="sidebar-subcategories" hidden={!categoriesExpanded}>{categories.filter(c=>!['All items','Favorites','Logistics Network','Factory Planner','Planning'].includes(c)&&(c==='Buildings'||catalog.items.some(i=>catalog.categories[i.type]===c))).map(sidebarCategory)}</div>{['Favorites','Logistics Network','Factory Planner','Planning'].map(sidebarCategory)}</nav><div className="offline"><span className="status-dot"/> {cloud.view.status==='synced'?'Cloud synced':cloud.view.status==='pending'?'Saving changes…':cloud.view.status==='conflict'?'Sync conflict':'Offline · saved locally'}</div><footer><a key={selected} className="sidebar-wiki" href={browserUrlForTitle(itemMap.get(selected)?.name??'Dyson Sphere Program Wiki')} onClick={e=>{e.preventDefault();openInBrowser(e.currentTarget.href);}}>View wiki ↗</a><a href="https://www.fandom.com/licensing" onClick={e=>{e.preventDefault();openInBrowser(e.currentTarget.href);}}>Content attribution & licensing ↗</a></footer><button type="button" className="dark-fog-toggle" role="switch" aria-checked={darkFog} onClick={toggleDarkFog}><span className="dark-fog-switch" aria-hidden="true"/><span>Dark Fog</span></button><small className="app-version" aria-label={`App version ${__APP_VERSION__}`}>v{__APP_VERSION__}</small></aside>
 <main className="workspace"><header className="topbar"><span>FACTORY REFERENCE <span className="slash">/</span> {category==='Logistics Network'?'LOGISTICS NETWORK':category==='Planning'?'PLANNING':category==='Factory Planner'?'FACTORY PLANNER':'ITEM LIBRARY'}</span></header><section className="sphere-header" aria-label="Dysons Sphere">
   <img className="sphere-galaxy" src={`${import.meta.env.BASE_URL}art/galaxy-header.png`} alt="Panoramic galaxy surrounding a brilliant golden star with orbital collectors for a Dyson sphere"/>
   <div className="sphere-title"><span className="twinkling-star" aria-hidden="true">✦</span><h1>Dysons Sphere</h1></div>
 </section>
 {error&&<div className="error" role="alert">{error}<button onClick={()=>updateWorkspace(data=>data)}>Retry saving</button></div>}
 {cloud.view.message && <div className="sync-banner" role="status">{cloud.view.message}{cloud.view.status==='conflict'?<><button onClick={()=>{void resolveWorkspace('cloud');}}>Use cloud version</button><button onClick={()=>{void resolveWorkspace('local');}}>Keep this device’s version</button></>:<button onClick={()=>{void retrySync();}}>Retry sync</button>}</div>}
 <div className="factory-planner-session" hidden={category!=='Factory Planner'}><FactoryPlanner catalog={catalog} request={plannerRequest}/></div>
 {category==='Logistics Network'?<Design catalog={catalog}/>:category==='Planning'?<Planning/>:category==='Factory Planner'?null:<div className={`browser-layout ${gridView||gridDetail?'grid-browser':''}`}>{!gridDetail&&<section className={`catalog-panel ${category==='Favorites' && draggedItem!==null?'favorite-drop-ready':''} ${favoriteDropTarget==='pane'?'favorite-drop-active':''}`} {...(category==='Favorites'?favoriteDropProps('pane'):{})}><div className="catalog-tools">{category==='Favorites'?<div className="favorites-picker"><ItemPicker items={catalog.items.filter(i=>favorites.includes(i.id))} value={favoriteSearch} onChange={value=>{setFavoriteSearch(value);const chosen=catalog.items.find(i=>favorites.includes(i.id)&&i.name.toLowerCase()===value.trim().toLowerCase());if(chosen)navigate(chosen.id);}} label="Favorite item"/></div>:<label className="search"><span>⌕</span><input type="search" aria-label={`Search ${category.toLowerCase()}`} placeholder={searchPlaceholder} value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌕</kbd></label>}<div className="list-heading"><h2>{category}</h2><span>{visible.length} items</span></div></div>{category==='All items'&&<div className="catalog-view-controls"><div role="group" aria-label="Catalog view"><button aria-pressed={catalogView==='list'} onClick={()=>setViewOverride('list')}>☰ List</button><button aria-pressed={catalogView==='grid'} onClick={()=>setViewOverride('grid')}>▦ Grid</button></div><label><input type="checkbox" checked={(cloud.view.data.defaultCatalogView??'list')==='grid'} onChange={event=>updateWorkspace(data=>({...data,defaultCatalogView:event.target.checked?'grid':'list'}))}/>Default to grid</label></div>}{gridView?<CatalogGrid items={visible} selected={selected} onSelect={id=>{setSelected(id);setRecipeId(null);setQuantity(1);setHistory([]);setGridOrigin(true);setGridDetail(true);}}/>:<div className="item-list">{visible.map(i=>category==='Favorites'?<div key={i.id} className={`item-row favorite-item-row ${favoriteSelected===i.id?'selected':''} ${favoriteDropTarget===`row-${i.id}`?'favorite-drop-active':''}`} {...itemDragProps(i.id)} {...favoriteReorderProps(i.id)}><button className="favorite-item-open" onClick={()=>navigate(i.id)}><Icon item={i}/><span><strong>{i.name}</strong><small>{catalog.categories[i.type]??i.type}</small></span></button><ItemJump id={i.id} name={i.name}/><button className="favorite-remove" aria-label={`Remove ${i.name} from Favorites`} data-tooltip="Remove from Favorites" onClick={()=>{updateWorkspace(data=>({...data,favorites:data.favorites.filter(id=>id!==i.id)}));if(favoriteSelected===i.id)setFavoriteSelected(null);if(favoriteSearch===i.name)setFavoriteSearch('');}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>:<div key={i.id} className={`item-row ${selected===i.id?'selected':''} ${isDefenseItem(i)?'defense-item':''}`} {...itemDragProps(i.id)}><button className="favorite-item-open" onClick={()=>navigate(i.id)}><Icon item={i}/><span><strong>{i.name}</strong><small>{catalog.categories[i.type]??i.type}</small></span></button><ItemJump id={i.id} name={i.name}/><button className={`list-favorite ${favorites.includes(i.id)?'saved':''}`} aria-label={`${favorites.includes(i.id)?'Remove':'Add'} ${i.name} ${favorites.includes(i.id)?'from':'to'} Favorites`} aria-pressed={favorites.includes(i.id)} data-tooltip={favorites.includes(i.id)?'Remove from Favorites':'Add to Favorites'} onClick={()=>updateWorkspace(data=>({...data,favorites:data.favorites.includes(i.id)?data.favorites.filter(id=>id!==i.id):[...data.favorites,i.id]}))}><svg width="18" height="18" viewBox="0 0 24 24" fill={favorites.includes(i.id)?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.7 1.2 6.6-5.9-3.1-5.9 3.1 1.2-6.6L2.5 9.4l6.6-.9Z"/></svg></button></div>)}{!visible.length&&<div className="empty"><h3>No items here yet</h3><p>{category==='Favorites'?'Star an item or drag a required input here.':'Try a different name or category.'}</p><button onClick={()=>{setQuery('');setCategory('All items');}}>Show all items</button></div>}</div>}</section>}
 {category==='Favorites'&&!item&&<section className="detail-panel empty"><h3>Select a favorite</h3><p>Choose an item on the left to see its recipe.</p></section>}
 {item&&(!gridView||gridDetail)&&<section className="detail-panel" key={item.id}><div className="detail-actions">{gridOrigin&&!history.length?<button onClick={returnToGrid}>← Grid</button>:<button disabled={!history.length} onClick={goBack}>← Back</button>}{gridOrigin&&!!history.length&&<button data-tooltip="return to grid" aria-label="return to grid" onClick={returnToGrid}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg></button>}</div><div {...itemDragProps(item.id)} className={`item-title ${isDefenseItem(item)?'defense-item':''}`}><Icon item={item} large/><div><div className="eyebrow">{catalog.categories[item.type]??item.type}</div><h2>{item.name}</h2></div><div className="item-title-actions"><NetworkButton id={item.id} catalog={catalog}/><ItemJump id={item.id} name={item.name}/><button className={`favorite ${favorites.includes(item.id)?'saved':''}`} aria-label={favorites.includes(item.id)?'Remove favorite':'Add favorite'} onClick={favorite}><svg width="24" height="24" viewBox="0 0 24 24" fill={favorites.includes(item.id)?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.7 1.2 6.6-5.9-3.1-5.9 3.1 1.2-6.6L2.5 9.4l6.6-.9Z"/></svg></button><ItemInfo key={item.id} item={item}/></div></div><ItemOverview key={item.id} item={item} items={itemMap}/><div className="facts"><span>STACK SIZE <b>{item.stack_size}</b></span><span>RECIPES <b>{recipes.length}</b></span><span>{item.energy?'FUEL ENERGY':'REPLICATOR'} <b>{item.energy?`${(item.energy/1e6).toLocaleString()} MJ`:recipe?.handcraft?'Available':'Not available'}</b></span></div>
 <div className="tabs"><button className={tab==='recipe'?'active':''} onClick={()=>setTab('recipe')}>Crafting recipe</button><button className={tab==='chain'?'active':''} onClick={()=>setTab('chain')}>Production chain</button></div>
 {recipe?<><div className="recipe-controls">{recipes.length > 1 && <label>RECIPE<ThemedSelect className={isDefenseItem(item)?'defense-item':''} aria-label="Recipe" value={recipe.id} onChange={e=>setRecipeId(Number(e.target.value))}>{recipes.map(r=><option value={r.id} key={r.id}>{r.name.replace(/^ - /,'')}{r.explicit?' · alternate':''}</option>)}</ThemedSelect></label>}<label>TARGET QUANTITY<input type="number" aria-label="Target quantity" min="1" max="1000000" value={quantity} onChange={e=>setQuantity(Math.min(1000000,Math.max(1,Math.floor(Number(e.target.value)||1))))}/></label></div>
 {tab==='recipe'?<><div className="recipe-box"><div className="section-label">REQUIRED INPUTS <span>{batches} crafting batch{batches===1?'':'es'}</span></div><div className="ingredients" key={recipe.id}>{pairs(recipe.inputs).map(p=><ExpandableInput key={p.id} catalog={catalog} itemMap={itemMap} id={p.id} count={p.count*batches} path={[selected]} onItemDrag={setDraggedItem}/>)}</div><div className="conversion"><span>↓</span><span>{recipe.seconds}s per batch · {(recipe.seconds*batches).toLocaleString()}s total base time</span></div><div className="section-label">OUTPUTS <span>{recipe.type==='FRACTIONATE'?'Expected yields · probabilistic':'Includes any byproducts'}</span></div><div className="ingredients outputs">{pairs(recipe.outputs).map(p=>chip(p.id,p.count*batches,false))}</div></div><div className="recipe-meta"><div><span className="section-label">MADE IN</span><div className="facility-links">{(catalog.facilities[recipe.type]?.buildings??[]).map(id=>chip(id))}</div>{!catalog.facilities[recipe.type]?.buildings.length&&<p>{catalog.facilities[recipe.type]?.name??recipe.type}</p>}</div><div><span className="section-label">UNLOCKED BY</span><p>{catalog.techs.filter(t=>t.recipes?.includes(recipe.id)).map(t=>t.name).join(', ')||'Starting recipe / no technology listed'}</p></div></div>{recipe.type==='FRACTIONATE'&&<p className="note">Fractionation has a 1% conversion chance. Quantities and processing times are statistical averages, not guaranteed yields.</p>}</>:<div className="chain"><p className="note">Click a branch to expand. Ingredients use their first listed recipe; alternate choices apply to the selected item only. Byproducts are shown in recipes, but are not reused across branches. Fractionation quantities are expected averages.</p>{tree(item.id,quantity,[])}</div>}</>:<div className="resource-card"><span>◇</span><h3>{!darkFog&&recipesFor(cloud.catalog??snapshot as unknown as Catalog,item.id).length?'Recipe requires Dark Fog materials':'Gathered, not crafted'}</h3>{!darkFog&&recipesFor(cloud.catalog??snapshot as unknown as Catalog,item.id).length?<><p>Enable Dark Fog to view this crafting recipe and its required materials.</p><button className="design-button" onClick={toggleDarkFog}>Show crafting recipe · Enable Dark Fog</button></>:<p>{item.mining_from??item.explicit_produce_from??'No crafting recipe is listed in the wiki snapshot. This item is obtained through gameplay.'}</p>}</div>}
 <EmbeddedFactoryPlanner catalog={catalog} item={item}/><section className="used-in"><div className="section-label">USED TO BUILD <span>{uses.length} recipes</span></div><div className="used-grid">{Array.from(new Set(uses.flatMap(r=>pairs(r.outputs).map(p=>p.id)))).map(id=>chip(id))}</div>{!uses.length&&<p className="note">No further crafting recipes use this item.</p>}</section><div className="snapshot">Local snapshot · {new Date(catalog.downloaded).toLocaleDateString()} · Wiki revision {catalog.revision}</div></section>}
 </div>}</main></div></ItemAccessContext.Provider>;
}

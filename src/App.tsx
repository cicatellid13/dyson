import { ItemAccessContext, ItemAccess, ItemJump } from './components/ItemAccess';
import '@fontsource/orbitron/600.css';
import { Planning } from './components/Planning';
import { initializePersistence, useWorkspace, updateWorkspace, resolveWorkspace, retrySync } from './lib/persistence';
import { CategoryIcon } from './components/CategoryIcon';
import { useEffect, useMemo, useState } from 'react';
import { batchesFor, pairs, recipesFor, isDefenseItem, catalogForDarkFog, type Catalog, type Item } from './lib/catalog';
import snapshot from '../public/data/catalog.json';
import { Design } from './components/Design';
import { openInBrowser, browserUrlForTitle } from './lib/wikiLinks';

function Icon({item,large=false}:{item?:Item;large?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[item?.id]);
  return <span className={`item-icon ${large?'large':''} ${isDefenseItem(item)?'defense-icon':''}`}>{item?.icon&&!failed?<img src={`${import.meta.env.BASE_URL}${item.icon}`} alt="" draggable={false} onError={()=>setFailed(true)}/>:<span>{item?.name.slice(0,2)??'◇'}</span>}</span>;
}
function ExpandableInput({ catalog, itemMap, id, count, path, onItemDrag }: {
  catalog: Catalog; itemMap: Map<number, Item>; id: number; count: number; path: number[]; onItemDrag: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosenRecipe, setChosenRecipe] = useState<number | null>(null);
  const item = itemMap.get(id);
  const options = recipesFor(catalog, id);
  const recipe = options.find(r => r.id === chosenRecipe) ?? options[0];
  const cycle = path.includes(id);
  const batches = recipe ? batchesFor(recipe, id, count) : 0;
  return <div className="inline-input">
    <div className="input-access-row">
    <button className={`ingredient ${isDefenseItem(item)?'defense-item':''}`} draggable={!!item} onDragStart={event => { event.stopPropagation(); event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-dsp-item', String(id)); onItemDrag(id); }} onDragEnd={() => onItemDrag(null)} title="Click to expand · Drag to Favorites" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Icon item={item}/><span>{item?.name ?? `Item ${id}`}</span>
      <b>× {count.toLocaleString()}</b><span className="chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button><ItemJump id={id} name={item?.name}/></div>
    {open && <div className="inline-recipe">
      {cycle ? <p className="note">This ingredient repeats in the chain. Supply it separately to avoid a circular recipe.</p>
        : !recipe ? <p className="note">{item?.mining_from ?? item?.explicit_produce_from ?? 'Gather / supply directly — no crafting recipe listed.'}</p>
        : <>
          {options.length > 1 && <label className="inline-choice">Recipe for {item?.name}
            <select className={isDefenseItem(item)?'defense-item':''} value={recipe.id} onChange={event => setChosenRecipe(Number(event.target.value))}>
              {options.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>}
          <p className="note">{batches.toLocaleString()} batch{batches === 1 ? '' : 'es'} · {recipe.seconds}s per batch · {catalog.facilities[recipe.type]?.name ?? recipe.type}
            {recipe.type === 'FRACTIONATE' && ' · Expected statistical yields'}
          </p>
          <div className="section-label">REQUIRES</div>
          <div className="ingredients" key={recipe.id}>
            {pairs(recipe.inputs).map(input => <ExpandableInput key={input.id} catalog={catalog} itemMap={itemMap} id={input.id} count={input.count * batches} path={[...path, id]} onItemDrag={onItemDrag}/>)}
          </div>
          <p className="note">Produces {pairs(recipe.outputs).map((output, index) => <ItemAccess key={output.id} id={output.id} name={itemMap.get(output.id)?.name}>{index > 0 ? ', ' : ''}{(output.count * batches).toLocaleString()} × {itemMap.get(output.id)?.name ?? output.id}</ItemAccess>)}</p>
        </>}
    </div>}
  </div>;
}

export function App(){


 const [query,setQuery]=useState('');
 const [draggedItem,setDraggedItem]=useState<number|null>(null);
 const [favoriteDropTarget,setFavoriteDropTarget]=useState<string|null>(null);
 const [favoriteNotice,setFavoriteNotice]=useState('');
 useEffect(()=>{ if(draggedItem===null)setFavoriteDropTarget(null); },[draggedItem]);
 useEffect(()=>{ if(!favoriteNotice)return; const timer=setTimeout(()=>setFavoriteNotice(''),3500); return ()=>clearTimeout(timer); },[favoriteNotice]);
 const [category,setCategory]=useState('All items');
 const [favoriteSelected,setFavoriteSelected]=useState<number|null>(null);
 const cloud=useWorkspace();
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
 const [history,setHistory]=useState<number[]>([]);
 const [recipeId,setRecipeId]=useState<number|null>(null);
 const [quantity,setQuantity]=useState(1);
 const [tab,setTab]=useState<'recipe'|'chain'>('recipe');

 const itemMap=useMemo(()=>new Map(catalog?.items.map(i=>[i.id,i])),[catalog]);
 useEffect(()=>{
  if(!itemMap.has(selected)){setSelected(itemMap.has(1303)?1303:catalog.items[0].id);setRecipeId(null);setQuantity(1);}
  setHistory(previous=>previous.filter(id=>itemMap.has(id)));
 },[itemMap,selected]);
 const item=category==='Favorites' && favoriteSelected===null?undefined:itemMap.get(selected);
 const recipes=catalog?recipesFor(catalog,selected):[];
 const recipe=recipes.find(r=>r.id===recipeId)??recipes[0];
 const batches=recipe?batchesFor(recipe,selected,quantity):0;
 function navigate(id:number,back=false){ if(!itemMap.has(id))return; if(category==='Favorites')setFavoriteSelected(id); if(!back&&id!==selected)setHistory(h=>[...h,selected]);setSelected(id);setRecipeId(null);setQuantity(1); }
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
 function itemDragProps(id:number){return {draggable:true,onDragStart:(event:React.DragEvent)=>{event.stopPropagation();event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData('application/x-dsp-item',String(id));setDraggedItem(id);},onDragEnd:()=>setDraggedItem(null)};}
 function favoriteReorderProps(target:number){return {
  onDragOver:(event:React.DragEvent)=>{if(draggedItem!==null && favorites.includes(draggedItem)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';setFavoriteDropTarget(`row-${target}`);}},
  onDrop:(event:React.DragEvent)=>{if(draggedItem===null || !favorites.includes(draggedItem))return;event.preventDefault();event.stopPropagation();const source=draggedItem;updateWorkspace(data=>{const order=[...data.favorites];const from=order.indexOf(source),to=order.indexOf(target);if(from<0||to<0)return data;order.splice(from,1);order.splice(to,0,source);return {...data,favorites:order};});setDraggedItem(null);setFavoriteDropTarget(null);}
 };}
 function selectCategory(next:string){setQuery('');setCategory(next);if(next==='Favorites'){if(favoriteSelected!==null&&favorites.includes(favoriteSelected))setSelected(favoriteSelected);else setFavoriteSelected(null);setHistory([]);}}
 const categories=['All items','Favorites','Logistics Network','Planning','Buildings',...Object.values(catalog?.categories??{}).filter(c=>c!=='Unknown Category'&&(darkFog||!['Turrets','Defense','Dark Fog'].includes(c)))];
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
 const visible=catalog?.items.filter(i=>(category==='All items'||category==='Favorites'&&favorites.includes(i.id)||category==='Buildings'&&i.can_build||catalog.categories[i.type]===category)&&`${i.name} ${i.description}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>category==='Favorites'?favorites.indexOf(a.id)-favorites.indexOf(b.id):a.name.localeCompare(b.name))??[];
 const uses=catalog?.recipes.filter(r=>pairs(r.inputs).some(p=>p.id===selected))??[];
 function chip(id:number,count?:number){const target=itemMap.get(id);return <button className={`ingredient ${isDefenseItem(target)?'defense-item':''}`} key={id} {...itemDragProps(id)} onClick={()=>navigate(id)}><Icon item={target}/><span>{target?.name??`Item ${id}`}</span>{count!==undefined&&<b>× {count.toLocaleString()}</b>}<span className="chevron">↗</span></button>;}
 function tree(id:number,count:number,path:number[],depth=0):React.ReactNode {
  const target=itemMap.get(id);const cycle=path.includes(id);const r=depth===0?recipe:catalog&&recipesFor(catalog,id)[0];
  if(cycle||!r||depth>=8)return <div className="tree-leaf">{chip(id,count)}<small>{cycle?'Cycle — supply this ingredient separately':depth>=8?'Depth limit — open item to continue':target?.mining_from??'Gather / supply directly'}</small></div>;
  const b=batchesFor(r,id,count);
  return <details className="tree-node" open={depth<2} key={`${id}-${depth}`}><summary {...itemDragProps(id)} className={isDefenseItem(target)?'defense-item':''}><Icon item={target}/><strong>{target?.name}</strong><span>× {count.toLocaleString()}</span><small>{b} batch{b!==1?'es':''} · {r.seconds*b}s</small><ItemJump id={id} name={target?.name}/></summary><div>{pairs(r.inputs).map(p=><div key={p.id}>{tree(p.id,p.count*b,[...path,id],depth+1)}</div>)}</div></details>;
 }
 if(!cloud.ready)return <div className="boot"><h1>DSP Fieldguide</h1><p>{cloud.error || 'Opening your shared workspace…'}</p>{cloud.error && <button onClick={()=>{void initializePersistence();}}>Retry connection</button>}</div>;
 return <ItemAccessContext.Provider value={{navigate:(id)=>{if(category==='Logistics Network'||category==='Planning'){setCategory('All items');setQuery('');}navigate(id);},drag:setDraggedItem}}><div className="app-shell dark-fog-normal">
 {favoriteNotice && <div className="favorite-drop-notice" role="status">{favoriteNotice}</div>}<aside className="sidebar"><div className="brand"><span className="brand-orbit">◉</span><div><strong>FIELDGUIDE</strong><small>DYSON SPHERE PROGRAM</small></div></div><div className="nav-caption">YOUR LIBRARY</div><nav aria-label="Item categories">{categories.filter(c=>['All items','Favorites','Logistics Network','Planning','Buildings'].includes(c)||catalog.items.some(i=>catalog.categories[i.type]===c)).map((c,index)=><button className={`${category===c?'nav active':'nav'} ${c==='Favorites' && draggedItem!==null?'favorite-drop-ready':''} ${c==='Favorites' && favoriteDropTarget==='nav'?'favorite-drop-active':''}`} {...(c==='Favorites'?favoriteDropProps('nav'):{})} key={c} onClick={()=>selectCategory(c)}><span>{index===0?'▦':index===1?'☆':c==='Buildings'?'▤':<CategoryIcon category={c}/>}</span>{c}<small>{c==='All items'?catalog.items.length:c==='Favorites'?favorites.filter(id=>itemMap.has(id)).length:''}</small></button>)}</nav><div className="offline"><span className="status-dot"/> {cloud.view.status==='synced'?'Cloud synced':cloud.view.status==='pending'?'Saving changes…':cloud.view.status==='conflict'?'Sync conflict':'Offline · saved locally'}<small>Catalog & images cached on this device</small></div><footer>Data from DSP Wiki contributors.<br/><a href="https://www.fandom.com/licensing" onClick={e=>{e.preventDefault();openInBrowser(e.currentTarget.href);}}>Content attribution & licensing ↗</a></footer><button type="button" className="dark-fog-toggle" role="switch" aria-checked={darkFog} onClick={toggleDarkFog}><span className="dark-fog-switch" aria-hidden="true"/><span>Dark Fog</span></button><small className="app-version" aria-label={`App version ${__APP_VERSION__}`}>v{__APP_VERSION__}</small></aside>
 <main className="workspace"><header className="topbar"><span>FACTORY REFERENCE <span className="slash">/</span> {category==='Logistics Network'?'LOGISTICS NETWORK':category==='Planning'?'PLANNING':'ITEM LIBRARY'}</span></header><section className="sphere-header" aria-label="Dysons Sphere">
   <img className="sphere-galaxy" src={`${import.meta.env.BASE_URL}art/galaxy-header.png`} alt="Panoramic galaxy surrounding a brilliant golden star with orbital collectors for a Dyson sphere"/>
   <div className="sphere-title"><span className="twinkling-star" aria-hidden="true">✦</span><h1>Dysons Sphere</h1></div>
 </section>
 {error&&<div className="error" role="alert">{error}<button onClick={()=>updateWorkspace(data=>data)}>Retry saving</button></div>}
 {cloud.view.message && <div className="sync-banner" role="status">{cloud.view.message}{cloud.view.status==='conflict'?<><button onClick={()=>{void resolveWorkspace('cloud');}}>Use cloud version</button><button onClick={()=>{void resolveWorkspace('local');}}>Keep this device’s version</button></>:<button onClick={()=>{void retrySync();}}>Retry sync</button>}</div>}
 {category==='Logistics Network'?<Design catalog={catalog}/>:category==='Planning'?<Planning/>:<div className="browser-layout"><section className={`catalog-panel ${category==='Favorites' && draggedItem!==null?'favorite-drop-ready':''} ${favoriteDropTarget==='pane'?'favorite-drop-active':''}`} {...(category==='Favorites'?favoriteDropProps('pane'):{})}><div className="catalog-tools"><label className="search"><span>⌕</span><input type="search" aria-label={`Search ${category.toLowerCase()}`} placeholder={searchPlaceholder} value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌕</kbd></label><div className="list-heading"><h2>{category}</h2><span>{visible.length} items</span></div></div><div className="item-list">{visible.map(i=>category==='Favorites'?<div key={i.id} className={`item-row favorite-item-row ${favoriteSelected===i.id?'selected':''} ${favoriteDropTarget===`row-${i.id}`?'favorite-drop-active':''}`} {...itemDragProps(i.id)} {...favoriteReorderProps(i.id)}><button className="favorite-item-open" onClick={()=>navigate(i.id)}><Icon item={i}/><span><strong>{i.name}</strong><small>{catalog.categories[i.type]??i.type}</small></span></button><ItemJump id={i.id} name={i.name}/><button className="favorite-remove" aria-label={`Remove ${i.name} from Favorites`} title="Remove from Favorites" onClick={()=>{updateWorkspace(data=>({...data,favorites:data.favorites.filter(id=>id!==i.id)}));if(favoriteSelected===i.id)setFavoriteSelected(null);}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>:<button key={i.id} className={`item-row ${selected===i.id?'selected':''} ${isDefenseItem(i)?'defense-item':''}`} {...itemDragProps(i.id)} onClick={()=>navigate(i.id)}><Icon item={i}/><span><strong>{i.name}</strong><small>{catalog.categories[i.type]??i.type}</small></span><span className="row-arrow">›</span></button>)}{!visible.length&&<div className="empty"><h3>No items here yet</h3><p>{category==='Favorites'?'Star an item or drag a required input here.':'Try a different name or category.'}</p><button onClick={()=>{setQuery('');setCategory('All items');}}>Show all items</button></div>}</div></section>
 {category==='Favorites'&&!item&&<section className="detail-panel empty"><h3>Select a favorite</h3><p>Choose an item on the left to see its recipe.</p></section>}
 {item&&<section className="detail-panel" key={item.id}><div className="detail-actions"><button disabled={!history.length} onClick={()=>{const prev=history[history.length-1];setHistory(h=>h.slice(0,-1));navigate(prev,true);}}>← Back</button><button onClick={()=>openInBrowser(browserUrlForTitle(item.name))}>View wiki ↗</button></div><div {...itemDragProps(item.id)} className={`item-title ${isDefenseItem(item)?'defense-item':''}`}><Icon item={item} large/><div><div className="eyebrow">{catalog.categories[item.type]??item.type}</div><h2>{item.name}</h2></div><button className={`favorite ${favorites.includes(item.id)?'saved':''}`} aria-label={favorites.includes(item.id)?'Remove favorite':'Add favorite'} onClick={favorite}>{favorites.includes(item.id)?'★':'☆'}</button></div><p className="description">{item.description}</p><div className="facts"><span>STACK SIZE <b>{item.stack_size}</b></span><span>RECIPES <b>{recipes.length}</b></span><span>{item.energy?'FUEL ENERGY':'REPLICATOR'} <b>{item.energy?`${(item.energy/1e6).toLocaleString()} MJ`:recipe?.handcraft?'Available':'Not available'}</b></span></div>
 <div className="tabs"><button className={tab==='recipe'?'active':''} onClick={()=>setTab('recipe')}>Crafting recipe</button><button className={tab==='chain'?'active':''} onClick={()=>setTab('chain')}>Production chain</button></div>
 {recipe?<><div className="recipe-controls">{recipes.length > 1 && <label>RECIPE<select className={isDefenseItem(item)?'defense-item':''} aria-label="Recipe" value={recipe.id} onChange={e=>setRecipeId(Number(e.target.value))}>{recipes.map(r=><option value={r.id} key={r.id}>{r.name.replace(/^ - /,'')}{r.explicit?' · alternate':''}</option>)}</select></label>}<label>TARGET QUANTITY<input type="number" aria-label="Target quantity" min="1" max="1000000" value={quantity} onChange={e=>setQuantity(Math.min(1000000,Math.max(1,Math.floor(Number(e.target.value)||1))))}/></label></div>
 {tab==='recipe'?<><div className="recipe-box"><div className="section-label">REQUIRED INPUTS <span>{batches} crafting batch{batches===1?'':'es'}</span></div><p className="input-hint">Click an input to expand its recipe, or drag it to Favorites.</p><div className="ingredients" key={recipe.id}>{pairs(recipe.inputs).map(p=><ExpandableInput key={p.id} catalog={catalog} itemMap={itemMap} id={p.id} count={p.count*batches} path={[selected]} onItemDrag={setDraggedItem}/>)}</div><div className="conversion"><span>↓</span><span>{recipe.seconds}s per batch · {(recipe.seconds*batches).toLocaleString()}s total base time</span></div><div className="section-label">OUTPUTS <span>{recipe.type==='FRACTIONATE'?'Expected yields · probabilistic':'Includes any byproducts'}</span></div><div className="ingredients outputs">{pairs(recipe.outputs).map(p=>chip(p.id,p.count*batches))}</div></div><div className="recipe-meta"><div><span className="section-label">MADE IN</span><div className="facility-links">{(catalog.facilities[recipe.type]?.buildings??[]).map(id=>chip(id))}</div>{!catalog.facilities[recipe.type]?.buildings.length&&<p>{catalog.facilities[recipe.type]?.name??recipe.type}</p>}</div><div><span className="section-label">UNLOCKED BY</span><p>{catalog.techs.filter(t=>t.recipes?.includes(recipe.id)).map(t=>t.name).join(', ')||'Starting recipe / no technology listed'}</p></div></div><p className="note">{recipe.type==='FRACTIONATE'?'Fractionation has a 1% conversion chance. Quantities and processing times are statistical averages, not guaranteed yields.':'Whole batches are rounded up to meet your target. Times use base recipe speed, before machine speed and proliferator bonuses.'}</p></>:<div className="chain"><p className="note">Click a branch to expand. Ingredients use their first listed recipe; alternate choices apply to the selected item only. Byproducts are shown in recipes, but are not reused across branches. Fractionation quantities are expected averages.</p>{tree(item.id,quantity,[])}</div>}</>:<div className="resource-card"><span>◇</span><h3>Gathered, not crafted</h3><p>{item.mining_from??item.explicit_produce_from??'No crafting recipe is listed in the wiki snapshot. This item is obtained through gameplay.'}</p></div>}
 <section className="used-in"><div className="section-label">USED TO BUILD <span>{uses.length} recipes</span></div><div className="used-grid">{Array.from(new Set(uses.flatMap(r=>pairs(r.outputs).map(p=>p.id)))).map(id=>chip(id))}</div>{!uses.length&&<p className="note">No further crafting recipes use this item.</p>}</section><div className="snapshot">Local snapshot · {new Date(catalog.downloaded).toLocaleDateString()} · Wiki revision {catalog.revision}</div></section>}
 </div>}</main></div></ItemAccessContext.Provider>;
}

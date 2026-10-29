import {NetworkButton} from './NetworkSearch';
import { MultiPlanetPicker } from './MultiPlanetPicker';
import { routePlanets, routeLinks } from '../lib/design';
import { PlanetFactories } from './SavedFactories';
import { EditablePlanetName } from './EditablePlanetName';
import { RemoveRouteIcon } from './RemoveRouteIcon';
import { AdvancedIcon, RouteStatus } from './RouteStatus';
import { themeDrag } from '../lib/dragAppearance';
import { linkRoute, updateTrades, routeReadiness, removeRouteSide } from '../lib/design';
import { PlanetTags, Specializations } from './Specializations';
import { useSessionExpansion, useSessionSelection } from '../lib/sessionExpansion';
import { ThemedSelect } from './ThemedSelect';
import { ItemLink, useItemAccess } from './ItemAccess';
import { SystemGraph, VisualizeIcon } from './SystemGraph';
import { AutoTextarea } from './AutoTextarea';
import { LogisticsArrow } from './LogisticsArrow';
import { useWorkspace, updateWorkspace } from '../lib/persistence';
import { useEffect, useMemo, useState } from 'react';
import { isDefenseItem, type Catalog, type Item } from '../lib/catalog';
import { createSection, removeSection, orderedSections, reorderSections, type DesignData, type DesignSection, type TradeEntry } from '../lib/design';
import '../styles/design.css';
import { ItemPicker } from './ItemPicker';

function TradeList({ direction, entries, items, sections, onChange, collapsible = false, currentPlanetId }: {
  currentPlanetId?: string; collapsible?: boolean; direction: 'imports' | 'exports'; entries: TradeEntry[]; items: Item[]; sections: DesignSection[]; onChange: (entries: TradeEntry[]) => void;
}) {
  const itemActions = useItemAccess();const sourceCatalog=useWorkspace().catalog!;
  const [expandedEntries, setExpandedEntries] = useSessionExpansion('logistics-entries');
  const [advanced,setAdvanced]=useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const label = direction === 'imports' ? 'Imports' : 'Exports';
  const sortedItems = useMemo(() => [...items].sort((a,b) => a.name.localeCompare(b.name)), [items]);
  const lookup = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const orderedEntries = entries.filter(entry => lookup.has(entry.itemId)).sort((a,b) => (lookup.get(a.itemId)?.name ?? '').localeCompare(lookup.get(b.itemId)?.name ?? ''));
      const issues=orderedEntries.map(row=>({id:row.id,item:lookup.get(row.itemId),...routeReadiness(sections,currentPlanetId,direction,row)})).filter(row=>!row.ready);
  function patch(id: string, changes: Partial<TradeEntry>) { onChange(entries.map(entry => entry.id === id ? { ...entry, ...changes } : entry)); }
  function add(event: React.FormEvent) {
    event.preventDefault();
    const item = items.find(i => i.name.toLowerCase() === search.trim().toLowerCase());
    if (!item) { setMessage('Choose an item from the suggestions.'); return; }
    const id = crypto.randomUUID();
    onChange([...entries, { id, itemId: item.id, amount: '', unit: 'items/min', destination: '' }]);
    setExpandedEntries(current => new Set([...current, id]));
    setSearch(''); setMessage('');
  }
  return <section className="trade-panel" aria-label={label}>
    <div className="design-section-heading"><h3><LogisticsArrow direction={direction}/> {label}{orderedEntries.length>0&&<RouteStatus ready={!issues.length} message={issues.length?`${issues.length} ${direction} need matching routes.`:`All ${direction} have matching routes.`} direction={direction} issues={issues}/>}</h3><span>{orderedEntries.length} entries</span></div>
    <form className="trade-add" onSubmit={add}>
      <ItemPicker label={`Add ${direction} item`} items={sortedItems} value={search} onChange={value => { setSearch(value); setMessage(''); }}/>
      <button type="submit" className="design-button" disabled={!search.trim()}>+ Add</button>
    </form>
    {message && <p role="alert" className="design-warning">{message}</p>}
    <div className="trade-entries">{orderedEntries.map(entry => {
      const item = lookup.get(entry.itemId);
      const toggle=()=>setExpandedEntries(current=>{const next=new Set(current);if(next.has(entry.id))next.delete(entry.id);else next.add(entry.id);return next;});
      return <div className="trade-entry" data-network-entry={entry.id} key={entry.id}>
        <div className="input-access-row planet-route-heading" {...itemActions.dragProps(entry.itemId)}>
        <ItemLink id={entry.itemId} name={item?.name}>{item?.icon&&<img className="item-icon" src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>}<strong>{item?.name??`Item ${entry.itemId}`}</strong></ItemLink>
        <button className="route-expand-space" type="button" aria-label={`Expand ${item?.name} ${direction}`} aria-expanded={expandedEntries.has(entry.id)} onClick={toggle}/>

        <button type="button" className="trade-options-toggle" data-tooltip="advanced" aria-label={`Advanced ${item?.name} ${direction}`} aria-expanded={advanced.has(entry.id)} onClick={()=>setAdvanced(current=>{const next=new Set(current);if(next.has(entry.id))next.delete(entry.id);else next.add(entry.id);return next;})}><AdvancedIcon/></button>
        <button type="button" className="trade-options-toggle" data-tooltip={entry.linkId?'Remove linked item from all linked planets':'Remove item'} aria-label={`Remove ${item?.name} from ${direction}`} onClick={()=>onChange(entries.filter(e=>e.id!==entry.id))}>×</button>
        {collapsible&&<button type="button" className="trade-options-toggle" aria-label={`Edit ${item?.name} ${direction} options`} aria-expanded={expandedEntries.has(entry.id)} onClick={toggle}>{expandedEntries.has(entry.id)?'▾':'▸'}</button>}</div>
        {advanced.has(entry.id) && <div className="trade-quantity">{routePlanets(entry).length>1&&<small>Amount applies to each selected planet.</small>}
          <label>Amount<input aria-label={`${item?.name} ${direction} amount`} type="number" min="0" step="any" placeholder="Optional" value={entry.amount} onChange={e => { if (e.target.value === '' || Number(e.target.value) >= 0) patch(entry.id, { amount: e.target.value }); }}/></label>
          <label>Unit<ThemedSelect aria-label={`${item?.name} ${direction} unit`} value={entry.unit} onChange={e => patch(entry.id, { unit: e.target.value as TradeEntry['unit'] })}><option>items/min</option><option>items/s</option><option>items</option></ThemedSelect></label>
        </div>}
        {(!collapsible || expandedEntries.has(entry.id)) && <div className="trade-entry-options">{direction==='imports'&&currentPlanetId&&<NetworkButton id={entry.itemId} catalog={sourceCatalog} consumer={{planetId:currentPlanetId,entryId:entry.id}}/>}<MultiPlanetPicker sections={sections} entry={entry} ownerId={currentPlanetId} onChange={changes=>patch(entry.id,changes)}/>
        {currentPlanetId && routePlanets(entry).some(id=>!routeLinks(entry)[id]&&sections.some(s=>s.kind==='planet'&&s.id===id&&s.id!==currentPlanetId)) && <button type="button" className="create-matching-route" aria-label={`Create ${direction==='exports'?'import':'export'}`} data-tooltip={`Create or link the matching ${direction==='exports'?'import':'export'} on all selected planets`} onClick={()=>updateWorkspace(current=>({...current,design:linkRoute(current.design,currentPlanetId,direction,entry.id)}))}><svg className="matching-route-icon" width="120" height="48" viewBox="0 0 120 48" fill="none" aria-hidden="true"><g stroke="#78dfb8" strokeWidth="2.4"><circle cx="21" cy="24" r="14" fill="#65cba5" fillOpacity=".8"/><ellipse cx="21" cy="24" rx="21" ry="6" transform="rotate(-30 21 24)"/></g><path d="M48 24h19m-6-6 6 6-6 6" stroke="#78dfb8" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/><g stroke="#54d7f1" strokeWidth="2.4"><circle cx="92" cy="21" r="17"/><ellipse cx="92" cy="21" rx="25" ry="7" transform="rotate(-30 92 21)"/></g><circle cx="106" cy="36" r="12" fill="#68ddb2" stroke="#173f34" strokeWidth="2"/><path d="M100 36h12m-6-6v12" stroke="#16483d" strokeWidth="2.5" strokeLinecap="round"/></svg></button>}

        {entry.linkId && currentPlanetId && <div className="linked-route-actions"><button type="button" className="route-action-button" data-tooltip="Remove this item from all linked planets" aria-label={`Remove ${item?.name} from all linked planets`} onClick={()=>onChange(entries.filter(e=>e.id!==entry.id))}><RemoveRouteIcon both/></button><button type="button" className="route-action-button" data-tooltip="Remove only this side; keep the other planets’ items" aria-label={`Remove ${item?.name} only from this planet`} onClick={()=>updateWorkspace(current=>({...current,design:removeRouteSide(current.design,currentPlanetId,direction,entry.id)}))}><RemoveRouteIcon both={false}/></button></div>}

        </div>}
      </div>;
    })}</div>
  </section>;
}

function PlanetTradeSummary({ entries, direction, items }: {
  entries: TradeEntry[]; direction: 'imports' | 'exports'; items: Map<number, Item>;
}) {
  const ordered = entries.filter(entry => items.has(entry.itemId)).sort((a, b) => (items.get(a.itemId)?.name ?? '').localeCompare(items.get(b.itemId)?.name ?? ''));
  return <span className={`planet-trade-summary ${direction}`}>
    <span className="planet-trade-label">{direction === 'imports' ? 'Imports' : 'Exports'}</span>
    {ordered.length ? ordered.map(entry => {
      const item = items.get(entry.itemId);
      return <span key={entry.id} className={`planet-trade-row ${isDefenseItem(item) ? 'defense-item' : ''}`}>
        <ItemLink id={entry.itemId} name={item?.name}>{item?.icon && <img className="item-icon" src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>}<span className="planet-trade-name">{item?.name ?? `Item ${entry.itemId}`}</span></ItemLink>
        <span className="planet-trade-arrow" aria-hidden="true">
          <LogisticsArrow direction={direction}/>
        </span>
      </span>;
    }) : <span className="planet-trade-empty">None</span>}
  </span>;
}

function PlanetCard({ planet, items, onOpen }: { planet: DesignSection; items: Map<number, Item>; onOpen: () => void }) {
  const [direction, setDirection] = useState<'all' | 'imports' | 'exports'>('all');
  const [itemSearch, setItemSearch] = useState('');
  const visibleEntries = direction === 'all' ? [...planet.imports, ...planet.exports] : planet[direction];
  const tradedIds = [...new Set(visibleEntries.filter(entry => items.has(entry.itemId)).map(entry => entry.itemId))];
  const choices = tradedIds.sort((a, b) => (items.get(a)?.name ?? '').localeCompare(items.get(b)?.name ?? ''));
  const choiceItems = choices.map(id => items.get(id)).filter((item): item is Item => !!item);
  const selected = choiceItems.find(item => item.name.toLowerCase() === itemSearch.trim().toLowerCase())?.id;
  function changeDirection(value: 'imports' | 'exports') {
    const next = direction === value ? 'all' : value;
    const nextEntries = next === 'all' ? [...planet.imports, ...planet.exports] : planet[next];
    if (!selected || !nextEntries.some(entry => entry.itemId === selected)) setItemSearch('');
    setDirection(next);
  }
  const imports = planet.imports.filter(entry => items.has(entry.itemId) && (!selected || entry.itemId === selected));
  const exports = planet.exports.filter(entry => items.has(entry.itemId) && (!selected || entry.itemId === selected));
  const visibleCount = (direction !== 'exports' ? imports.length : 0) + (direction !== 'imports' ? exports.length : 0);
  return <article className="planet-card" aria-label={`${planet.name} trade overview`}>
    <button className="planet-card-open" onClick={onOpen} aria-label={`Open ${planet.name}`}><span aria-hidden="true">◉</span><strong>{planet.name || 'Unnamed planet'}</strong>{planet.planetType && <small className="planet-type-label">{planet.planetType}</small>}<PlanetTags tags={planet.specializations}/><span className="planet-open-hint">Open planet ↗</span></button>
    <div className="planet-card-filters">
      <div className="logistics-filter"><span className="logistics-filter-label">Logistics</span><div className="logistics-bubbles" role="group" aria-label={`${planet.name} logistics filter`}>
        {(['imports', 'exports'] as const).map(value => <button key={value} type="button" className={`logistics-bubble ${value}`} aria-label={`${planet.name} ${value} filter`} aria-pressed={direction === value} onClick={() => changeDirection(value)}>
          <LogisticsArrow direction={value}/>
          <span className="logistics-tooltip" role="tooltip">{value === 'imports' ? 'Imports' : 'Exports'}</span>
        </button>)}
      </div></div>
      <div className="planet-item-filter"><span className="logistics-filter-label">Item</span><ItemPicker key={direction} label={`${planet.name} item filter`} items={choiceItems} value={itemSearch} onChange={setItemSearch}/>{itemSearch && <button className="planet-filter-reset" aria-label={`Clear ${planet.name} item filter`} onClick={() => setItemSearch('')}>All items</button>}</div>
    </div>
    {(direction !== 'all' || itemSearch) && <button className="planet-filter-reset" onClick={() => { setDirection('all'); setItemSearch(''); }}>Clear filters</button>}
    {direction !== 'exports' && <PlanetTradeSummary entries={imports} direction="imports" items={items}/>}
    {direction !== 'imports' && <PlanetTradeSummary entries={exports} direction="exports" items={items}/>}
    {!visibleCount && (direction !== 'all' || itemSearch) && <p className="design-empty-small" role="status">No trades match these filters.</p>}
  </article>;
}

export function Design({ catalog }: { catalog: Catalog }) {
  const itemLookup = useMemo(() => new Map(catalog.items.map(item => [item.id, item])), [catalog.items]);
  const cloud = useWorkspace();
  const data = cloud.view.data.design;
  const saveError = cloud.error;
  const initial = { data, error: '' };
  const [graphSystem, setGraphSystem] = useSessionSelection('logistics-graph');
  const [activeId, setActiveId] = useSessionSelection('logistics-location', initial.data.sections[0]?.id ?? null);
  const [creation, setCreation] = useState<{kind: DesignSection['kind']; parentId: string | null; placement: 'sidebar' | 'inline'} | null>(null);
  const [name, setName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedSystems, setExpandedSystems] = useSessionExpansion('logistics-systems');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  function expandSystem(id: string) { setExpandedSystems(current => new Set([...current,id])); }
  const [networkFocus]=useSessionSelection('logistics-network-focus');
  useEffect(()=>{if(!networkFocus)return;const target=JSON.parse(networkFocus) as {entryId?:string;factoryId?:string};const frame=requestAnimationFrame(()=>{const attr=target.entryId?'data-network-entry':'data-network-factory';const id=target.entryId??target.factoryId;if(!id)return;const element=Array.from(document.querySelectorAll<HTMLElement>(`[${attr}]`)).find(el=>el.getAttribute(attr)===id);element?.scrollIntoView({block:'center',behavior:'instant'});});return()=>cancelAnimationFrame(frame);},[networkFocus,activeId]);
  const active = data.sections.find(s => s.id === activeId);
  const parent = data.sections.find(s => s.id === active?.parentId);
  const currentSystem = active?.kind === 'system' ? active : parent;
  const creationSystem = data.sections.find(section => section.id === creation?.parentId);
  const children = orderedSections(data.sections.filter(s => s.parentId === activeId));
  const roots = orderedSections(data.sections.filter(s => s.kind === 'system'));
  const unassigned = orderedSections(data.sections.filter(s => s.kind === 'planet' && s.parentId === null));
  function commit(next: DesignData) {
    updateWorkspace(current => ({...current, design: next}));

  }
  function patch(changes: Partial<DesignSection>) {
    commit({ ...data, sections: data.sections.map(s => s.id === activeId ? { ...s, ...changes } : s) });
  }
  function labelChoices(key:'planetTypes'|'specializationTypes') {
    const values=[...(key==='planetTypes'?['Lava','Ocean','Gas giant']:['Smelting','Science','Dyson components','Mining','Fuel','Manufacturing']),...(data[key]??[]),...data.sections.flatMap(s=>key==='planetTypes'?(s.planetType?[s.planetType]:[]):s.specializations??[])];
    return values.filter((v,i)=>values.findIndex(other=>other.toLowerCase()===v.toLowerCase())===i);
  }
  function rememberLabel(key:'planetTypes'|'specializationTypes',tag:string) {
    updateWorkspace(current=>({...current,design:{...current.design,[key]:[...new Set([...(current.design[key]??[]),...labelChoices(key),tag])]}}));
  }
  function begin(kind: DesignSection['kind'], parentId: string | null = null, placement: 'sidebar' | 'inline' = 'inline') {
    if (kind === 'planet' && !roots.some(system => system.id === parentId)) return;
    setCreation({kind, parentId, placement}); setName('');
  }
  function navigate(id: string) { const target = data.sections.find(s => s.id === id); if (target?.parentId) expandSystem(target.parentId); setActiveId(id); setCreation(null); setName(''); setDeleteId(null); }
  function add(event: React.FormEvent) {
    event.preventDefault(); if (!creation || !name.trim()) return;
    if (creation.kind === 'planet' && !roots.some(system => system.id === creation.parentId)) return;
    const section = createSection(name, creation.kind, creation.parentId);
    const siblings = data.sections.filter(s => s.kind === section.kind && s.parentId === section.parentId);
    section.order = Math.max(-1, ...siblings.map((s,index) => s.order ?? index)) + 1;
    if (section.parentId) expandSystem(section.parentId);
    commit({ ...data, sections: [...data.sections, section] }); setActiveId(section.id); setCreation(null); setName('');
  }
  function confirmRemove() {
    if (!deleteId) return;
    const removed = data.sections.find(s => s.id === deleteId);
    const next = removeSection(data, deleteId);
    commit(next); setActiveId(removed?.parentId ?? next.sections[0]?.id ?? null); setDeleteId(null);
  }
  function sectionButton(section: DesignSection, nested = false) {
    return <button key={section.id} className={`design-location ${nested ? 'nested' : ''} ${activeId === section.id ? 'active' : ''} ${dropTarget === section.id ? 'drop-target' : ''}`} draggable
      aria-expanded={section.kind === 'system' ? expandedSystems.has(section.id) : undefined}
      onDragStart={event => { event.stopPropagation(); themeDrag(event); setDraggingId(section.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',section.id); }}
      onDragOver={event => { const from = data.sections.find(s => s.id === draggingId); if (!from || from.id === section.id || from.kind !== section.kind || from.parentId !== section.parentId) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(section.id); }}
      onDrop={event => { event.preventDefault(); if (draggingId) commit(reorderSections(data,draggingId,section.id)); setDraggingId(null); setDropTarget(null); }}
      onDragEnd={() => { setDraggingId(null); setDropTarget(null); }}
      onClick={() => { navigate(section.id); if (section.kind === 'system') setExpandedSystems(current => { const next = new Set(current); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; }); }}>
      {section.kind === 'system' && <span className="design-disclosure" aria-hidden="true">{expandedSystems.has(section.id) ? '▾' : '▸'}</span>}
      <span>{section.kind === 'system' ? '✧' : '◉'}</span><span><strong>{section.name || 'Unnamed location'}</strong><small>{section.kind === 'system' ? `${data.sections.filter(p => p.parentId === section.id).length} planet${data.sections.filter(p => p.parentId === section.id).length === 1 ? '' : 's'}` : 'Planet'}</small></span>
    </button>;
  }
  return <div className="design-workspace">
    <aside className="design-locations"><div className="design-section-heading"><h2>Logistics Network</h2><span>{roots.length} system{roots.length === 1 ? '' : 's'}</span></div>
      {currentSystem && <div className="design-current-system"><small>Current system</small><strong>✧ {currentSystem.name || 'Unnamed system'}</strong></div>}
      <div className="design-create-buttons">{currentSystem && <button className="design-button" onClick={() => begin('planet', currentSystem.id, 'sidebar')} disabled={!!initial.error}>+ Planet</button>}<button className="design-button" onClick={() => begin('system')} disabled={!!initial.error}>+ System</button></div>
      {creation?.kind === 'planet' && creation.placement === 'sidebar' && creationSystem && <form className="design-create-form" onSubmit={add}><h3>New planet</h3><p className="design-parent-hint">Adding to <strong>{creationSystem.name || 'Unnamed system'}</strong></p><label>Planet name<input autoFocus aria-label="New planet name" value={name} maxLength={120} placeholder="e.g. Homeworld" onChange={event => setName(event.target.value)}/></label><div><button className="design-button" type="submit" disabled={!name.trim()}>Create planet</button><button type="button" onClick={() => setCreation(null)}>Cancel</button></div></form>}
      {creation?.kind === 'system'  && <form className="design-create-form" onSubmit={add}><h3>{creation.parentId ? 'Add planet to system' : `New ${creation.kind}`}</h3><label>Name<input autoFocus aria-label="New section name" value={name} maxLength={120} placeholder="e.g. Alpha Centauri" onChange={e => setName(e.target.value)}/></label><div><button className="design-button" type="submit" disabled={!name.trim()}>Create</button><button type="button" onClick={() => setCreation(null)}>Cancel</button></div></form>}
      <nav aria-label="Logistics Network sections">{roots.map(root => <div key={root.id}><div className="system-nav-row">{sectionButton(root)}<button className="visualize-button" data-tooltip="visualize" aria-label={`Visualize ${root.name}`} aria-pressed={activeId===root.id&&graphSystem===root.id} onClick={()=>{const isOpen=activeId===root.id&&graphSystem===root.id;navigate(root.id);setGraphSystem(isOpen?null:root.id);}}><VisualizeIcon/></button></div>{expandedSystems.has(root.id) && orderedSections(data.sections.filter(s => s.parentId === root.id)).map(child => sectionButton(child, true))}</div>)}</nav>
      {!!unassigned.length && <div className="design-unassigned"><h3>Needs a system</h3><p className="design-empty-small">Assign these existing planets to a system.</p>{unassigned.map(planet => sectionButton(planet))}</div>}
      {!roots.length && <p className="design-empty-small">Create a system first, then add planets inside it.</p>}
    </aside>
    <section className="design-editor">
      {saveError && <div role="alert" className="design-error">{saveError}{!initial.error && <button className="design-button" onClick={() => commit(data)}>Retry saving</button>}</div>}
      {active ? <div key={active.id}>
        <div className="design-editor-top"><div className="eyebrow">{parent ? <><button onClick={() => navigate(parent.id)}>{parent.name || 'Unnamed system'}</button> / {active.name || 'Untitled planet'}</> : active.kind === 'system' ? 'STAR SYSTEM' : 'PLANET'}</div></div>
        <div className="system-name-row">{active.kind==='planet'?<EditablePlanetName key={active.id} name={active.name} onChange={name=>patch({name})}/>:<label className="design-name">Name<input aria-label="Section name" value={active.name} maxLength={120} onChange={e => patch({name: e.target.value})} onBlur={() => { if (!active.name.trim()) patch({name: active.kind === 'planet' ? 'Untitled planet' : 'Untitled system'}); }}/></label>}{active.kind === 'system' && <button className={`visualize-button ${graphSystem===active.id?'active':''}`} data-tooltip="visualize" aria-label={`Visualize ${active.name}`} aria-pressed={graphSystem===active.id} onClick={()=>setGraphSystem(graphSystem===active.id?null:active.id)}><VisualizeIcon/></button>}</div>
        {active.kind==='system' && graphSystem===active.id ? <SystemGraph key={active.id} planets={children} items={itemLookup} onClose={()=>setGraphSystem(null)}/> : <>
        {active.kind === 'planet' && <Specializations label="Planet type" single tags={active.planetType?[active.planetType]:[]} choices={labelChoices('planetTypes')} onChange={tags=>patch({planetType:tags[0]??''})} onRemember={tag=>rememberLabel('planetTypes',tag)}/>}
        {active.kind === 'planet' && <Specializations tags={active.specializations??[]} choices={labelChoices('specializationTypes')} onChange={specializations=>patch({specializations})} onRemember={tag=>rememberLabel('specializationTypes',tag)}/>}
        {active.kind === 'planet' && !parent && <div className="design-assignment"><label>Assign to a system<ThemedSelect aria-label="Assign planet to system" value="" onChange={event => { if (roots.some(system => system.id === event.target.value)) patch({parentId: event.target.value}); }}><option value="">Select a system</option>{roots.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}</ThemedSelect></label>{!roots.length && <p className="design-empty-small">Create a system using + System, then assign this planet here. Your notes and routes are preserved.</p>}</div>}
        <label className="design-notes">Notes<AutoTextarea aria-label="Section notes" placeholder="Resources, production goals, construction plans…" value={active.notes} onChange={e => patch({notes: e.target.value})}/></label>
        {active.kind === 'system' && <section className="design-planets"><div className="design-section-heading"><h3>Planets in this system</h3><button className="design-button" onClick={() => begin('planet', active.id)}>+ Add planet</button></div>{creation?.kind === 'planet' && creation.placement === 'inline' && creation.parentId === active.id && <form className="design-create-form design-inline-create" onSubmit={add}><h3>Add planet to {active.name}</h3><label>Planet name<input autoFocus aria-label="New planet name" value={name} maxLength={120} placeholder="e.g. Homeworld" onChange={event => setName(event.target.value)}/></label><div><button className="design-button" type="submit" disabled={!name.trim()}>Create planet</button><button type="button" onClick={() => setCreation(null)}>Cancel</button></div></form>}<div className="design-planet-cards">{children.map(child => <PlanetCard key={`${child.id}-${catalog.items.length}`} planet={child} items={itemLookup} onOpen={() => navigate(child.id)}/>)}</div>{!children.length && <p className="design-empty-small">Add a planet to start mapping this system.</p>}</section>}
        {active.kind==='planet'&&<PlanetFactories key={active.id} planet={active} catalog={catalog}/>}
        {active.kind==='planet'&&<div className="design-trade-grid"><TradeList currentPlanetId={active.kind==='planet'?active.id:undefined} collapsible={active.kind==='planet'} key={`imports-${catalog.items.length}`} direction="imports" entries={active.imports} items={catalog.items} sections={data.sections} onChange={imports => updateWorkspace(current=>({...current,design:updateTrades(current.design,active.id,'imports',imports)}))}/><TradeList currentPlanetId={active.kind==='planet'?active.id:undefined} collapsible={active.kind==='planet'} key={`exports-${catalog.items.length}`} direction="exports" entries={active.exports} items={catalog.items} sections={data.sections} onChange={exports => updateWorkspace(current=>({...current,design:updateTrades(current.design,active.id,'exports',exports)}))}/></div>}
        <div className="design-delete-area">{deleteId === active.id ? <div role="alert"><p>Delete “{active.name}”{active.kind === 'system' ? ` and its ${children.length} planets` : ''}, including all notes and lists?</p><button className="design-button danger" onClick={confirmRemove}>Delete {active.kind}</button><button onClick={() => setDeleteId(null)}>Cancel</button></div> : <button className="design-remove" onClick={() => setDeleteId(active.id)}>Delete {active.kind}</button>}</div>
        </>}
      </div> : <div className="design-welcome"><span>✧</span><h2>Design your interstellar network.</h2><p>Create a system, add its planets,<br/>and track what comes in and what goes out.</p><button className="design-button" disabled={!!initial.error} onClick={() => begin('system')}>Create your first system</button></div>}
    </section>
  </div>;
}

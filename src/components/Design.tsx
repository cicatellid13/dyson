import { useMemo, useState } from 'react';
import { isDefenseItem, type Catalog, type Item } from '../lib/catalog';
import { DESIGN_KEY, createSection, emptyDesign, parseDesign, removeSection, type DesignData, type DesignSection, type TradeEntry } from '../lib/design';
import '../styles/design.css';
import { PlanetPicker } from './PlanetPicker';
import { ItemPicker } from './ItemPicker';

function loadDesign() {
  try { return { data: parseDesign(localStorage.getItem(DESIGN_KEY)), error: '' }; }
  catch { return { data: emptyDesign(), error: 'Your saved designs could not be read. They have been left untouched. Reopen the app to retry.' }; }
}
function TradeList({ direction, entries, items, sections, onChange }: {
  direction: 'imports' | 'exports'; entries: TradeEntry[]; items: Item[]; sections: DesignSection[]; onChange: (entries: TradeEntry[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const label = direction === 'imports' ? 'Imports' : 'Exports';
  const sortedItems = useMemo(() => [...items].sort((a,b) => a.name.localeCompare(b.name)), [items]);
  const lookup = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const orderedEntries = entries.filter(entry => lookup.has(entry.itemId)).sort((a,b) => (lookup.get(a.itemId)?.name ?? '').localeCompare(lookup.get(b.itemId)?.name ?? ''));
  function patch(id: string, changes: Partial<TradeEntry>) { onChange(entries.map(entry => entry.id === id ? { ...entry, ...changes } : entry)); }
  function add(event: React.FormEvent) {
    event.preventDefault();
    const item = items.find(i => i.name.toLowerCase() === search.trim().toLowerCase());
    if (!item) { setMessage('Choose an item from the suggestions.'); return; }
    onChange([...entries, { id: crypto.randomUUID(), itemId: item.id, amount: '', unit: 'items/min', destination: '' }]);
    setSearch(''); setMessage('');
  }
  return <section className="trade-panel" aria-label={label}>
    <div className="design-section-heading"><h3>{direction === 'imports' ? '↙' : '↗'} {label}</h3><span>{orderedEntries.length} entries</span></div>
    <form className="trade-add" onSubmit={add}>
      <ItemPicker label={`Add ${direction} item`} items={sortedItems} value={search} onChange={value => { setSearch(value); setMessage(''); }}/>
      <button type="submit" className="design-button" disabled={!search.trim()}>+ Add</button>
    </form>
    {message && <p role="alert" className="design-warning">{message}</p>}
    {!orderedEntries.length && <p className="design-empty-small">{direction === 'imports' ? 'What does this location need?' : 'What does this location supply?'} Add items above.</p>}
    <div className="trade-entries">{orderedEntries.map(entry => {
      const item = lookup.get(entry.itemId);
      return <div className="trade-entry" key={entry.id}>
        <div className={`trade-item-heading ${isDefenseItem(item) ? 'defense-item' : ''}`}>
          {item?.icon && <img className="item-icon" src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>}
          <strong>{item?.name ?? `Item ${entry.itemId}`}</strong>
          <button className="design-remove" aria-label={`Remove ${item?.name ?? 'item'} from ${direction}`} onClick={() => onChange(entries.filter(e => e.id !== entry.id))}>×</button>
        </div>
        <div className="trade-quantity">
          <label>Amount<input aria-label={`${item?.name} ${direction} amount`} type="number" min="0" step="any" placeholder="Optional" value={entry.amount} onChange={e => { if (e.target.value === '' || Number(e.target.value) >= 0) patch(entry.id, { amount: e.target.value }); }}/></label>
          <label>Unit<select aria-label={`${item?.name} ${direction} unit`} value={entry.unit} onChange={e => patch(entry.id, { unit: e.target.value as TradeEntry['unit'] })}><option>items/min</option><option>items/s</option><option>items</option></select></label>
        </div>
        <PlanetPicker sections={sections} planetId={entry.planetId} legacyName={entry.destination} label={`${item?.name} ${direction}`} direction={direction === 'imports' ? 'From' : 'To'} onChange={planetId => patch(entry.id, { planetId, destination: '' })}/>
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
        {item?.icon && <img className="item-icon" src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>}
        <span className="planet-trade-name">{item?.name ?? `Item ${entry.itemId}`}</span>
        <span className="planet-trade-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 12h18m-6-6 6 6-6 6"/></svg>
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
    <button className="planet-card-open" onClick={onOpen} aria-label={`Open ${planet.name}`}><span aria-hidden="true">◉</span><strong>{planet.name || 'Unnamed planet'}</strong><span className="planet-open-hint">Open planet ↗</span></button>
    <div className="planet-card-filters">
      <div className="logistics-filter"><span className="logistics-filter-label">Logistics</span><div className="logistics-bubbles" role="group" aria-label={`${planet.name} logistics filter`}>
        {(['imports', 'exports'] as const).map(value => <button key={value} type="button" className={`logistics-bubble ${value}`} aria-label={`${planet.name} ${value} filter`} aria-pressed={direction === value} onClick={() => changeDirection(value)}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h18m-6-6 6 6-6 6"/></svg>
          <span className="logistics-tooltip" role="tooltip">{value === 'imports' ? 'Imports' : 'Exports'}</span>
        </button>)}
      </div></div>
      <div className="planet-item-filter"><span className="logistics-filter-label">Item</span><ItemPicker key={direction} label={`${planet.name} item filter`} items={choiceItems} value={itemSearch} onChange={setItemSearch} placeholder="All items"/>{itemSearch && <button className="planet-filter-reset" aria-label={`Clear ${planet.name} item filter`} onClick={() => setItemSearch('')}>All items</button>}</div>
    </div>
    {(direction !== 'all' || itemSearch) && <button className="planet-filter-reset" onClick={() => { setDirection('all'); setItemSearch(''); }}>Clear filters</button>}
    {direction !== 'exports' && <PlanetTradeSummary entries={imports} direction="imports" items={items}/>}
    {direction !== 'imports' && <PlanetTradeSummary entries={exports} direction="exports" items={items}/>}
    {!visibleCount && (direction !== 'all' || itemSearch) && <p className="design-empty-small" role="status">No trades match these filters.</p>}
  </article>;
}

export function Design({ catalog }: { catalog: Catalog }) {
  const itemLookup = useMemo(() => new Map(catalog.items.map(item => [item.id, item])), [catalog.items]);
  const [initial] = useState(loadDesign);
  const [data, setData] = useState(initial.data);
  const [saveError, setSaveError] = useState(initial.error);
  const [activeId, setActiveId] = useState<string | null>(initial.data.sections[0]?.id ?? null);
  const [creation, setCreation] = useState<{kind: DesignSection['kind']; parentId: string | null; placement: 'sidebar' | 'inline'} | null>(null);
  const [name, setName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{data: DesignData; activeId: string | null} | null>(null);
  const active = data.sections.find(s => s.id === activeId);
  const parent = data.sections.find(s => s.id === active?.parentId);
  const currentSystem = active?.kind === 'system' ? active : parent;
  const creationSystem = data.sections.find(section => section.id === creation?.parentId);
  const children = data.sections.filter(s => s.parentId === activeId);
  const roots = data.sections.filter(s => s.kind === 'system');
  const unassigned = data.sections.filter(s => s.kind === 'planet' && s.parentId === null);
  function commit(next: DesignData) {
    setData(next);
    setUndo(null);
    try { localStorage.setItem(DESIGN_KEY, JSON.stringify(next)); setSaveError(''); }
    catch { setSaveError('Changes are only in memory: this device could not save them. Keep this page open and retry saving.'); }
  }
  function patch(changes: Partial<DesignSection>) {
    commit({ ...data, sections: data.sections.map(s => s.id === activeId ? { ...s, ...changes } : s) });
  }
  function begin(kind: DesignSection['kind'], parentId: string | null = null, placement: 'sidebar' | 'inline' = 'inline') {
    if (kind === 'planet' && !roots.some(system => system.id === parentId)) return;
    setCreation({kind, parentId, placement}); setName('');
  }
  function navigate(id: string) { setActiveId(id); setCreation(null); setName(''); setDeleteId(null); }
  function add(event: React.FormEvent) {
    event.preventDefault(); if (!creation || !name.trim()) return;
    if (creation.kind === 'planet' && !roots.some(system => system.id === creation.parentId)) return;
    const section = createSection(name, creation.kind, creation.parentId);
    commit({ ...data, sections: [...data.sections, section] }); setActiveId(section.id); setCreation(null); setName('');
  }
  function confirmRemove() {
    if (!deleteId) return;
    const removed = data.sections.find(s => s.id === deleteId);
    const previous = { data, activeId };
    const next = removeSection(data, deleteId);
    commit(next); setUndo(previous); setActiveId(removed?.parentId ?? next.sections[0]?.id ?? null); setDeleteId(null);
  }
  function sectionButton(section: DesignSection, nested = false) {
    return <button key={section.id} className={`design-location ${nested ? 'nested' : ''} ${activeId === section.id ? 'active' : ''}`} onClick={() => navigate(section.id)}>
      <span>{section.kind === 'system' ? '✧' : '◉'}</span><span><strong>{section.name || 'Unnamed location'}</strong><small>{section.kind === 'system' ? `${data.sections.filter(p => p.parentId === section.id).length} planet${data.sections.filter(p => p.parentId === section.id).length === 1 ? '' : 's'}` : 'Planet'}</small></span>
    </button>;
  }
  return <div className="design-workspace">
    <aside className="design-locations"><div className="design-section-heading"><h2>Logistics Network</h2><span>{roots.length} system{roots.length === 1 ? '' : 's'}</span></div><p className="design-intro">Plan your corner of the galaxy.</p>
      {currentSystem && <div className="design-current-system"><small>Current system</small><strong>✧ {currentSystem.name || 'Unnamed system'}</strong></div>}
      <div className="design-create-buttons">{currentSystem && <button className="design-button" onClick={() => begin('planet', currentSystem.id, 'sidebar')} disabled={!!initial.error}>+ Planet</button>}<button className="design-button" onClick={() => begin('system')} disabled={!!initial.error}>+ System</button></div>
      {creation?.kind === 'planet' && creation.placement === 'sidebar' && creationSystem && <form className="design-create-form" onSubmit={add}><h3>New planet</h3><p className="design-parent-hint">Adding to <strong>{creationSystem.name || 'Unnamed system'}</strong></p><label>Planet name<input autoFocus aria-label="New planet name" value={name} maxLength={120} placeholder="e.g. Homeworld" onChange={event => setName(event.target.value)}/></label><div><button className="design-button" type="submit" disabled={!name.trim()}>Create planet</button><button type="button" onClick={() => setCreation(null)}>Cancel</button></div></form>}
      {creation?.kind === 'system'  && <form className="design-create-form" onSubmit={add}><h3>{creation.parentId ? 'Add planet to system' : `New ${creation.kind}`}</h3><label>Name<input autoFocus aria-label="New section name" value={name} maxLength={120} placeholder="e.g. Alpha Centauri" onChange={e => setName(e.target.value)}/></label><div><button className="design-button" type="submit" disabled={!name.trim()}>Create</button><button type="button" onClick={() => setCreation(null)}>Cancel</button></div></form>}
      <nav aria-label="Logistics Network sections">{roots.map(root => <div key={root.id}>{sectionButton(root)}{data.sections.filter(s => s.parentId === root.id).map(child => sectionButton(child, true))}</div>)}</nav>
      {!!unassigned.length && <div className="design-unassigned"><h3>Needs a system</h3><p className="design-empty-small">Assign these existing planets to a system.</p>{unassigned.map(planet => sectionButton(planet))}</div>}
      {!roots.length && <p className="design-empty-small">Create a system first, then add planets inside it.</p>}
    </aside>
    <section className="design-editor">
      {saveError && <div role="alert" className="design-error">{saveError}{!initial.error && <button className="design-button" onClick={() => commit(data)}>Retry saving</button>}</div>}
      {undo && <div className="design-undo">Section removed.<button onClick={() => { commit(undo.data); setActiveId(undo.activeId); setUndo(null); }}>Undo</button><button aria-label="Dismiss undo" onClick={() => setUndo(null)}>×</button></div>}
      {active ? <div key={active.id}>
        <div className="design-editor-top"><div className="eyebrow">{parent ? <><button onClick={() => navigate(parent.id)}>{parent.name || 'Unnamed system'}</button> / PLANET</> : active.kind === 'system' ? 'STAR SYSTEM' : 'PLANET'}</div><span className="design-save-status" role="status">{saveError ? 'Not saved' : 'Saved on this device'}</span></div>
        <label className="design-name">Name<input aria-label="Section name" value={active.name} maxLength={120} onChange={e => patch({name: e.target.value})} onBlur={() => { if (!active.name.trim()) patch({name: active.kind === 'planet' ? 'Untitled planet' : 'Untitled system'}); }}/></label>
        {active.kind === 'planet' && !parent && <div className="design-assignment"><label>Assign to a system<select aria-label="Assign planet to system" value="" onChange={event => { if (roots.some(system => system.id === event.target.value)) patch({parentId: event.target.value}); }}><option value="">Select a system</option>{roots.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label>{!roots.length && <p className="design-empty-small">Create a system using + System, then assign this planet here. Your notes and routes are preserved.</p>}</div>}
        {active.kind === 'system' && <section className="design-planets"><div className="design-section-heading"><h3>Planets in this system</h3><button className="design-button" onClick={() => begin('planet', active.id)}>+ Add planet</button></div>{creation?.kind === 'planet' && creation.placement === 'inline' && creation.parentId === active.id && <form className="design-create-form design-inline-create" onSubmit={add}><h3>Add planet to {active.name}</h3><label>Planet name<input autoFocus aria-label="New planet name" value={name} maxLength={120} placeholder="e.g. Homeworld" onChange={event => setName(event.target.value)}/></label><div><button className="design-button" type="submit" disabled={!name.trim()}>Create planet</button><button type="button" onClick={() => setCreation(null)}>Cancel</button></div></form>}<div className="design-planet-cards">{children.map(child => <PlanetCard key={`${child.id}-${catalog.items.length}`} planet={child} items={itemLookup} onOpen={() => navigate(child.id)}/>)}</div>{!children.length && <p className="design-empty-small">Add a planet to start mapping this system.</p>}</section>}
        <label className="design-notes">Notes<textarea aria-label="Section notes" placeholder="Resources, production goals, construction plans…" value={active.notes} onChange={e => patch({notes: e.target.value})}/></label>
        <div className="design-trade-grid"><TradeList key={`imports-${catalog.items.length}`} direction="imports" entries={active.imports} items={catalog.items} sections={data.sections} onChange={imports => patch({imports})}/><TradeList key={`exports-${catalog.items.length}`} direction="exports" entries={active.exports} items={catalog.items} sections={data.sections} onChange={exports => patch({exports})}/></div>
        {active.kind === 'system' && <p className="note">These lists describe this system. Each planet keeps its own notes and trade lists; they are not automatically combined.</p>}
        <div className="design-delete-area">{deleteId === active.id ? <div role="alert"><p>Delete “{active.name}”{active.kind === 'system' ? ` and its ${children.length} planets` : ''}, including all notes and lists?</p><button className="design-button danger" onClick={confirmRemove}>Delete section</button><button onClick={() => setDeleteId(null)}>Cancel</button></div> : <button className="design-remove" onClick={() => setDeleteId(active.id)}>Delete {active.kind}</button>}</div>
      </div> : <div className="design-welcome"><span>✧</span><h2>Design your interstellar network.</h2><p>Create a system, add its planets,<br/>and track what comes in and what goes out.</p><button className="design-button" disabled={!!initial.error} onClick={() => begin('system')}>Create your first system</button></div>}
    </section>
  </div>;
}

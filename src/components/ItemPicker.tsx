import { useEffect, useId, useRef, useState } from 'react';
import { isDefenseItem, type Item } from '../lib/catalog';

/** Searchable local item menu with the same palette as the app. */
export function ItemPicker({ items, value, onChange, label, placeholder = 'Search an item…' }: {
  items: Item[]; value: string; onChange: (value: string) => void; label: string; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const matches = items.filter(item => item.name.toLowerCase().includes(value.trim().toLowerCase()));
  const selected = items.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  function choose(item: Item) { onChange(item.name); setOpen(false); setActive(-1); }
  return <div className="item-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); }
  }}>
    <div className={`item-picker-field ${isDefenseItem(selected) ? 'defense-item' : ''}`}>
      <input ref={input} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open && active >= 0 && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        autoComplete="off" value={value} placeholder={placeholder}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={event => { onChange(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(index => matches.length ? event.key === 'ArrowDown' ? Math.min(index + 1, matches.length - 1) : index < 0 ? matches.length - 1 : Math.max(0, index - 1) : -1);
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            const item = matches[active] ?? selected ?? (matches.length === 1 ? matches[0] : undefined);
            if (item) choose(item);
          } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
        }}/>
      {selected?.icon && <img src={`${import.meta.env.BASE_URL}${selected.icon}`} alt=""/>}
      <button type="button" tabIndex={-1} aria-label={`Show ${label.toLowerCase()} choices`}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { input.current?.focus(); setOpen(true); } }}><span aria-hidden="true">▾</span></button>
    </div>
    {open && <div className="item-picker-menu" ref={list} id={listId} role="listbox" aria-label={`${label} choices`}>
      {matches.map((item, index) => <div key={item.id} id={`${listId}-${item.id}`} role="option"
        aria-selected={active === index}
        className={`item-picker-option ${active === index ? 'highlighted' : ''} ${isDefenseItem(item) ? 'defense-item' : ''}`}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
        <span>{item.name}</span>{item.icon && <img src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>}
      </div>)}
      {!matches.length && <p className="item-picker-empty" role="status">No matching items.</p>}
    </div>}
  </div>;
}

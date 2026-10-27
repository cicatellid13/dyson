import { useItemAccess } from './ItemAccess';
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { isDefenseItem, type Item } from '../lib/catalog';

/** Searchable local item menu with the same palette as the app. */
export function ItemPicker({ items, value, onChange, label, placeholder = 'Search an item...' }: {
  items: Item[]; value: string; onChange: (value: string) => void; label: string; placeholder?: string;
}) {
  const itemActions = useItemAccess();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const listId = useId();
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const matches = items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const selected = items.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
  useEffect(() => {
    if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const field = input.current?.parentElement?.getBoundingClientRect();
      const menu = list.current;
      if (!field || !menu) return;
      const below = window.innerHeight - field.bottom - 12;
      const above = field.top - 12;
      const upwards = below < 160 && above > below;
      const maxHeight = Math.max(60, Math.min(250, upwards ? above : below));
      menu.style.minWidth = `${Math.min(field.width, window.innerWidth - 24)}px`;
      menu.style.maxWidth = `${window.innerWidth - 24}px`;
      const width = menu.getBoundingClientRect().width;
      setMenuStyle({ visibility: 'visible', minWidth: Math.min(field.width, window.innerWidth - 24), maxWidth: window.innerWidth - 24,
        left: Math.max(12, Math.min(field.left, window.innerWidth - width - 12)),
        top: upwards ? Math.max(12, field.top - Math.min(menu.scrollHeight, maxHeight) - 5) : field.bottom + 5, maxHeight });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open, query, items]);
  function openChoices() { setQuery(''); setActive(-1); setOpen(true); input.current?.select(); }
  function choose(item: Item) { onChange(item.name); setQuery(''); setOpen(false); setActive(-1); }
  return <div className="item-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !list.current?.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); }
  }}>
    <div className={`item-picker-field ${isDefenseItem(selected) ? 'defense-item' : ''}`} {...(selected?itemActions.dragProps(selected.id):{})}>
      <input ref={input} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open && active >= 0 && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        autoComplete="off" value={value} placeholder={placeholder}
        onFocus={openChoices} onClick={() => { if (!open) openChoices(); }}
        onChange={event => { setQuery(event.target.value); onChange(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) { openChoices(); setActive(event.key === 'ArrowDown' ? 0 : items.length - 1); return; }
            setActive(index => matches.length ? event.key === 'ArrowDown' ? Math.min(index + 1, matches.length - 1) : index < 0 ? matches.length - 1 : Math.max(0, index - 1) : -1);
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            const item = matches[active] ?? selected ?? (matches.length === 1 ? matches[0] : undefined);
            if (item) choose(item);
          } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
        }}/>
      {selected?.icon && <img src={`${import.meta.env.BASE_URL}${selected.icon}`} alt=""/>}
      <button type="button" tabIndex={-1} aria-label={`Show ${label.toLowerCase()} choices`}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { input.current?.focus(); openChoices(); } }}><span aria-hidden="true">▾</span></button>
    </div>
    {open && createPortal(<div className="item-picker-menu item-picker-floating" style={menuStyle} ref={list} id={listId} role="listbox" aria-label={`${label} choices`}>
      {matches.map((item, index) => <div key={item.id} id={`${listId}-${item.id}`} role="option" tabIndex={-1}
        aria-selected={active === index} {...itemActions.dragProps(item.id)}
        className={`item-picker-option ${active === index ? 'highlighted' : ''} ${isDefenseItem(item) ? 'defense-item' : ''}`}
        onClick={() => choose(item)}>
        <span>{item.name}</span>{item.icon && <img src={`${import.meta.env.BASE_URL}${item.icon}`} alt=""/>}
      </div>)}
      {!matches.length && <p className="item-picker-empty" role="status">No matching items.</p>}
    </div>, document.body)}
  </div>;
}

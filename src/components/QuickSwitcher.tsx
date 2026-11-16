import { useEffect, useId, useRef, useState } from 'react';
import { quickSwitchKindLabel, searchQuickSwitch, type QuickSwitchEntry } from '../lib/quickSwitch';
import './QuickSwitcher.css';

export function QuickSwitcher({ entries, onSelect, onClose }: {
  entries: QuickSwitchEntry[];
  onSelect: (entry: QuickSwitchEntry) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const results = searchQuickSwitch(entries, query);
  const active = Math.min(index, results.length - 1);
  const activeId = active >= 0 ? `${listId}-${active}` : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  return (
    <dialog ref={dialogRef} className="quick-switcher" aria-label="Quick switch"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="quick-switcher-panel">
        <div className="quick-switcher-search">
          <input ref={inputRef} role="combobox" aria-label="Search items, planets, factories, and to-dos"
            aria-expanded={true} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId}
            placeholder="Search items, planets, factories, or to-dos…" value={query}
            onChange={event => { setQuery(event.target.value); setIndex(0); }}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing || active < 0) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                onSelect(results[active]);
              }
            }}/>
          <button type="button" className="design-button" onClick={onClose} aria-label="Close quick switch">Esc</button>
        </div>
        <div className="quick-switcher-results" id={listId} role="listbox" aria-label="Destinations">
          {results.map((entry, position) => (
            <div key={entry.key} id={`${listId}-${position}`} role="option" aria-selected={position === active}
              onMouseDown={event => event.preventDefault()} onClick={() => onSelect(entry)}>
              <span><strong>{entry.name}</strong>{entry.context && <small>{entry.context}</small>}</span>
              <small>{quickSwitchKindLabel(entry)}</small>
            </div>
          ))}
        </div>
        {!results.length && <p role="status">No matches.</p>}
      </div>
    </dialog>
  );
}

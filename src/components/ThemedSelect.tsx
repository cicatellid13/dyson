import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/** Select-only combobox; its popup is rendered by the app on every platform. */
export function ThemedSelect({ children, value, onChange, disabled, className = '', 'aria-label': label }: {
  children: ReactNode; value: string | number; onChange: (event: { target: { value: string } }) => void;
  disabled?: boolean; className?: string; 'aria-label'?: string;
}) {
  const options: { value: string; label: ReactNode }[] = [];
  function collect(nodes: ReactNode) {
    Children.forEach(nodes, child => {
      if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) return;
      if (child.type === 'option') options.push({ value: String(child.props.value ?? child.props.children), label: child.props.children });
      else collect(child.props.children);
    });
  }
  collect(children);
  const selected = options.findIndex(option => option.value === String(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const search = useRef({ text: '', time: 0 });
  function show() { setActive(Math.max(0, selected)); setOpen(true); }
  function choose(index: number) {
    if (options[index]) onChange({ target: { value: options[index].value } });
    setOpen(false); trigger.current?.focus();
  }
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect || !menu.current) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = below < 160 && above > below;
      const height = Math.max(40, Math.min(260, up ? above : below));
      const width = Math.min(Math.max(rect.width, menu.current.scrollWidth), window.innerWidth - 24);
      setStyle({ position: 'fixed', visibility: 'visible', width, maxHeight: height,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: up ? Math.max(12, rect.top - Math.min(menu.current.scrollHeight, height) - 5) : rect.bottom + 5 });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [open, active]);
  return <><button ref={trigger} type="button" role="combobox" className={`themed-select ${className}`} disabled={disabled}
    aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
    aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
    onClick={() => open ? setOpen(false) : show()} onBlur={() => setOpen(false)}
    onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!open) show();
        else setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); if (open) choose(active); else show();
      } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      else if (event.key === 'Tab') setOpen(false);
      else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const now = Date.now();
        search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase(), time: now };
        const index = options.findIndex(option => Children.toArray(option.label).join('').toLowerCase().startsWith(search.current.text));
        if (index >= 0) { setActive(index); setOpen(true); }
      }
    }}><span>{options[selected]?.label ?? 'Select an option'}</span><span aria-hidden="true">▾</span></button>
    {open && createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="themed-select-menu" style={style}
      onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={String(value) === option.value}
        className={`themed-select-option ${active === index ? 'highlighted' : ''}`}
        onMouseMove={() => setActive(index)} onClick={() => choose(index)}><span>{option.label}</span><span aria-hidden="true">{String(value) === option.value ? '✓' : ''}</span></div>)}
    </div>, document.body)}
  </>;
}

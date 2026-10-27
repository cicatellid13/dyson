import { useLayoutEffect, useRef, useState } from 'react';
import type { Item } from '../lib/catalog';
import { useItemAccess } from './ItemAccess';

export function ItemOverview({ item, items }: { item: Item; items: Map<number, Item> }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const actions = useItemAccess();
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setOverflow(node.scrollHeight > parseFloat(getComputedStyle(node).lineHeight) * 3 + 1);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, [item]);
  if (!item.overview?.length) return <p className="description">No overview is available in the wiki for this item.</p>;
  return <section className="item-overview" aria-label="Overview">
    <div ref={content} id={`overview-${item.id}`} className={`overview-copy ${expanded ? 'expanded' : ''}`}>
      {item.overview.map((paragraph, index) => <p key={index}>{paragraph.map((segment, part) => {
        const linked = segment.itemId ? items.get(segment.itemId) : undefined;
        if (linked) return <button key={part} className="overview-item" data-tooltip={`Open ${linked.name}`} onClick={() => actions.navigate(linked.id)} {...actions.dragProps(linked.id)}>
          {linked.icon && <img src={`${import.meta.env.BASE_URL}${linked.icon}`} alt=""/>}{linked.name}</button>;
        return segment.bold ? <strong key={part}>{segment.text}</strong> : <span key={part}>{segment.text}</span>;
      })}</p>)}
    </div>
    {(overflow || expanded) && <button className="overview-expand" aria-expanded={expanded} aria-controls={`overview-${item.id}`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less ▴' : 'Read more ▾'}</button>}
  </section>;
}

export function ItemInfo({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  return <div ref={root} className="item-info" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    <button type="button" className="item-info-button" aria-label={`About ${item.name}`} aria-expanded={open} aria-controls={`item-info-${item.id}`} onClick={() => setOpen(value => !value)}>i</button>
    {open && <div id={`item-info-${item.id}`} role="note" className="item-info-popover"><p>{item.description || 'No in-game description available.'}</p></div>}
  </div>;
}

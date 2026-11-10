import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { overviewParagraphs, type Item } from '../lib/catalog';
import { openInBrowser } from '../lib/wikiLinks';
import { useSessionSelection } from '../lib/sessionExpansion';
import { useItemAccess } from './ItemAccess';

export function ItemOverview({ item, items }: { item: Item; items: Map<number, Item> }) {
  const [expansion,setExpansion] = useSessionSelection(`catalog-overview-${item.id}`);
  const expanded = expansion === 'open';
  const setExpanded = (change:(previous:boolean)=>boolean) => setExpansion(change(expanded)?'open':null);
  const [overflow, setOverflow] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const actions = useItemAccess();
  const paragraphs = overviewParagraphs(item);
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setOverflow(node.scrollHeight > parseFloat(getComputedStyle(node).lineHeight) * 3 + 1);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, [item]);
  if (!paragraphs.length) return <p className="description">No overview has been cached for this item.</p>;
  return <section className="item-overview" aria-label="Overview">
    <div ref={content} id={`overview-${item.id}`} className={`overview-copy ${expanded ? 'expanded' : ''}`}>
      {paragraphs.map((paragraph, index) => <p key={index}>{paragraph.map((segment, part) => {
        const linked = segment.itemId ? items.get(segment.itemId) : undefined;
        if (linked) return <button key={part} className="overview-item" data-preview-id={linked.id} onClick={() => actions.navigate(linked.id)} {...actions.dragProps(linked.id)}>
          {linked.icon && <img src={`${import.meta.env.BASE_URL}${linked.icon}`} alt=""/>}<span className="preview-name">{linked.name}</span></button>;
        return segment.bold ? <strong key={part}>{segment.text}</strong> : <span key={part}>{segment.text}</span>;
      })}</p>)}
    </div>
    {(overflow || expanded) && <button className="overview-expand" aria-expanded={expanded} aria-controls={`overview-${item.id}`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less ▴' : 'Read more ▾'}</button>}
    {(item.overviewSource || item.supplementReference) && <div className="overview-sources">Sources: {item.overviewSource && <button onClick={() => openInBrowser(item.overviewSource!)}>{item.overviewSource.startsWith('https://dsp-wiki.com/') ? 'DSP Wiki' : 'Fandom Wiki'}</button>}{item.supplementReference && item.supplementReference.source !== item.overviewSource && <button onClick={() => openInBrowser(item.supplementReference!.source)}>DSP Wiki additions</button>}</div>}
  </section>;
}

export function BuildingDetails({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  if (!item.can_build || !item.buildingDetails?.fields.length) return null;
  const details = item.buildingDetails;
  return <div ref={root} className="building-details" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } }}>
    <button type="button" className="building-details-button" aria-label={`Building details for ${item.name}`} data-tooltip="Building details" aria-expanded={open} aria-controls={`building-details-${item.id}`} onClick={() => setOpen(value => !value)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v4M2 21h8M8 21v-4h2M8 7h1m4 0h1M8 11h1"/><circle cx="17" cy="17" r="6"/><path d="M17 16.5v3"/><circle cx="17" cy="14" r=".8" fill="currentColor" stroke="none"/></svg>
    </button>
    {open && <div id={`building-details-${item.id}`} role="region" aria-label={`${item.name} building details`} className="building-details-popover">
      <strong>BUILDING DETAILS</strong>
      <dl>{details.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
      <p className="building-details-note">Nominal wiki specifications; upgrades and operating conditions may affect these values.</p>
      <button className="building-details-source" onClick={() => openInBrowser(details.source)}>Source: DSP Wiki ↗</button>
    </div>}
  </div>;
}

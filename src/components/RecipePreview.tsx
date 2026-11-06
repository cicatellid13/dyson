import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pairs, recipesFor, type Catalog } from '../lib/catalog';
import { useItemAccess } from './ItemAccess';

type Preview = { id: number; anchor: HTMLElement; pinned: boolean };

/** A single preview shared by item links, so only one recipe can be pinned. */
export function RecipePreview({ catalog }: { catalog: Catalog }) {
  const actions = useItemAccess();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [recipeId, setRecipeId] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const current = useRef(preview);
  current.current = preview;
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const item = catalog.items.find(entry => entry.id === preview?.id);
  const recipes = item ? recipesFor(catalog, item.id) : [];
  const recipe = recipes.find(entry => entry.id === recipeId) ?? recipes[0];

  useEffect(() => {
    function hit(target: EventTarget | null) {
      if (!(target instanceof Element) || target.closest('.recipe-preview')) return null;
      const host = target.closest<HTMLElement>('[data-preview-id]');
      if (!host) return null;
      const content = target.closest<HTMLElement>('img, .item-icon');
      if (!content || !host.contains(content)) return null;
      return { id: Number(host.dataset.previewId), anchor: host };
    }
    function show(target: { id: number; anchor: HTMLElement }, pinned: boolean) {
      clearTimeout(closeTimer.current);
      clearTimeout(showTimer.current);
      setRecipeId(null);
      setPreview({ ...target, pinned });
    }
    function over(event: MouseEvent) {
      if (panel.current?.contains(event.target as Node)) {
        clearTimeout(closeTimer.current);
        return;
      }
      const target = hit(event.target);
      if (!target || current.current?.pinned) return;
      clearTimeout(closeTimer.current);
      if (current.current?.anchor === target.anchor) return;
      clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => show(target, false), 180);
    }
    function leave(event: MouseEvent) {
      const next = event.relatedTarget;
      if (next instanceof Node && (panel.current?.contains(next) || (hit(next) && hit(next)?.anchor === current.current?.anchor))) return;
      clearTimeout(showTimer.current);
      if (!current.current?.pinned) closeTimer.current = setTimeout(() => setPreview(null), 180);
    }
    function click(event: MouseEvent) {
      if (panel.current?.contains(event.target as Node)) return;
      clearTimeout(showTimer.current);
      const target = hit(event.target);
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        show(target, true);
      } else {
        setPreview(null);
        // Catalog rows allow whole-row navigation; other item surfaces keep icon/name-only interactions.
        if (event.detail !== 0 && event.target instanceof Element && event.target.closest('[data-preview-id]') && !event.target.closest('.item-row') && !event.target.closest('strong, .preview-name')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreview(null);

    }
    function dismiss() { setPreview(null); clearTimeout(showTimer.current); }
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', leave);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('dragstart', dismiss, true);
    window.addEventListener('blur', dismiss);
    return () => {
      clearTimeout(closeTimer.current); clearTimeout(showTimer.current);
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', leave);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('dragstart', dismiss, true);
      window.removeEventListener('blur', dismiss);
    };
  }, []);

  useLayoutEffect(() => {
    if (!preview || !panel.current) return;
    function position() {
      if (!preview!.anchor.isConnected) { setPreview(null); return; }
      const anchor = preview!.anchor.getBoundingClientRect();
      const node = panel.current;
      if (!node) return;
      const gap = 10;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      let left = Math.max(8, Math.min(anchor.left, innerWidth - width - 8));
      let top: number;
      if (innerHeight - anchor.bottom >= height + gap) top = anchor.bottom + gap;
      else if (anchor.top >= height + gap) top = anchor.top - height - gap;
      else if (innerWidth - anchor.right >= width + gap) { left = anchor.right + gap; top = Math.max(8, Math.min(anchor.top, innerHeight - height - 8)); }
      else if (anchor.left >= width + gap) { left = anchor.left - width - gap; top = Math.max(8, Math.min(anchor.top, innerHeight - height - 8)); }
      else {
        const below = innerHeight - anchor.bottom > anchor.top;
        node.style.maxHeight = `${Math.max(40, (below ? innerHeight - anchor.bottom : anchor.top) - gap - 8)}px`;
        top = below ? anchor.bottom + gap : Math.max(8, anchor.top - node.offsetHeight - gap);
      }
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
      node.style.visibility = 'visible';
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel.current);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [preview, recipe]);

  if (!preview || !item) return null;
  const facilityLabels: Record<string, string> = {
    SMELT: 'Smelter', ASSEMBLE: 'Assembler', CHEMICAL: 'Chemical Plant',
    REFINE: 'Oil Refinery', FRACTIONATE: 'Fractionator', RESEARCH: 'Matrix Lab',
  };
  const facility = recipe ? facilityLabels[recipe.type] ?? catalog.facilities[recipe.type]?.name ?? recipe.type : '';

  return createPortal(<div ref={panel} className={`recipe-preview ${preview.pinned ? 'pinned' : ''}`} role="dialog" aria-label={`Materials for ${item.name}`} style={{ visibility: 'hidden' }}>
    <header><span className="preview-facility">{recipe ? `${facility} · ${recipe.seconds}s` : 'Gathered resource'}</span><button aria-label="Close recipe preview" onClick={() => setPreview(null)}>×</button></header>
    {recipes.length > 1 && <div className="preview-recipes" role="group" aria-label="Preview recipe">{recipes.map(option => <button key={option.id} aria-pressed={recipe.id===option.id} onClick={() => setRecipeId(option.id)}>{option.name}</button>)}</div>}
    {recipe ? <><div className="preview-materials">{pairs(recipe.inputs).sort((a, b) => a.count - b.count).map(input => {
      const ingredient = catalog.items.find(entry => entry.id === input.id);
      return <button key={input.id} aria-label={`Open ${ingredient?.name ?? 'item'}`} data-tooltip={ingredient?.name ?? `Item ${input.id}`} onClick={() => { setPreview(null); actions.navigate(input.id); }} {...actions.dragProps(input.id)}><span className="item-icon">{ingredient?.icon ? <img src={`${import.meta.env.BASE_URL}${ingredient.icon}`} alt=""/> : <span>{ingredient?.name.slice(0, 2) ?? '?'}</span>}<small className="icon-quantity">{input.count}</small></span></button>;
    })}</div>{recipe.type === 'FRACTIONATE' && <small className="preview-caption">Fractionation uses probabilistic conversion.</small>}</> : <p>{item.mining_from ?? item.explicit_produce_from ?? 'No crafting recipe is listed. Obtain this item through gameplay.'}</p>}
  </div>, preview.anchor.closest('dialog') ?? document.body);
}

import { useEffect } from 'react';
import cursorUrl from '../assets/nebula.svg';
// A bundled drag image follows native HTML drag operations on every item surface.
const cursor = new Image(24,30);
cursor.src = cursorUrl;
export function themeDrag(event: {dataTransfer: DataTransfer}) {
  if(cursor.complete && cursor.naturalWidth) event.dataTransfer.setDragImage(cursor,3,3);
}

// Keep ordinary clicks on draggable controls visually identical to other clicks.
export function useDelayedDragCursor() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held: Element | null = null;
    function clear() {
      clearTimeout(timer);
      timer = undefined;
      held?.classList.remove('drag-held');
      held = null;
      document.querySelectorAll('.drag-held').forEach(element => element.classList.remove('drag-held'));
    }
    function down(event: PointerEvent) {
      clear();
      if (event.button !== 0 || event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
      const target = event.target.closest('[draggable="true"]');
      if (!target || event.target.closest('input,textarea,[contenteditable="true"]')) return;
      held = target;
      timer = setTimeout(() => { if (held === target && target.isConnected) target.classList.add('drag-held'); }, 250);
    }
    document.addEventListener('pointerdown', down, true);
    // Native dragging can consume pointerup, or remove the source before dragend.
    const events = ['pointerup', 'mouseup', 'pointercancel', 'dragstart', 'dragend', 'drop', 'visibilitychange'];
    function move(event: PointerEvent) { if (!(event.buttons & 1)) clear(); }
    function key(event: KeyboardEvent) { if (event.key === 'Escape') clear(); }
    document.addEventListener('pointermove', move, true);
    document.addEventListener('keydown', key, true);
    events.forEach(type => document.addEventListener(type, clear, true));
    window.addEventListener('blur', clear);
    return () => {
      clear();
      document.removeEventListener('pointerdown', down, true);
      events.forEach(type => document.removeEventListener(type, clear, true));
      window.removeEventListener('blur', clear);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('keydown', key, true);
    };
  }, []);
}

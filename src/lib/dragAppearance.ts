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
      held?.classList.remove('drag-held');
      held = null;
    }
    function down(event: PointerEvent) {
      clear();
      if (event.button !== 0 || event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
      const target = event.target.closest('[draggable="true"]');
      if (!target || event.target.closest('input,textarea,[contenteditable="true"]')) return;
      held = target;
      timer = setTimeout(() => { if (target.isConnected) target.classList.add('drag-held'); }, 250);
    }
    document.addEventListener('pointerdown', down, true);
    const events = ['pointerup', 'pointercancel', 'dragstart', 'dragend'];
    events.forEach(type => document.addEventListener(type, clear, true));
    window.addEventListener('blur', clear);
    return () => {
      clear();
      document.removeEventListener('pointerdown', down, true);
      events.forEach(type => document.removeEventListener(type, clear, true));
      window.removeEventListener('blur', clear);
    };
  }, []);
}

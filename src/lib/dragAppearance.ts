import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createPointerDragSession, type DragPoint } from './pointerDragSession';

// Existing source/target handlers keep their copy, reorder and validation rules.
// Their DragEvents are dispatched inside the app, never handed to the OS.
export function themeDrag(_event: {dataTransfer: DataTransfer}) {
  document.documentElement.classList.add('app-drag-active');
}

export function useDelayedDragCursor(onFinish?: () => void) {
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  useEffect(() => {
    let disposeGesture: (() => void) | undefined;
    let suppressClick = false;
    function down(event: PointerEvent) {
      disposeGesture?.();
      suppressClick = false;
      if (event.button !== 0 || event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
      const candidate = event.target.closest<HTMLElement>('[draggable="true"]');
      if (!candidate || event.target.closest('input,textarea,[contenteditable="true"]')) return;
      const source: HTMLElement = candidate;
      event.preventDefault(); // Prevent Chromium from starting a native drag.
      const transfer = new DataTransfer();
      let latest = {x:event.clientX,y:event.clientY};
      let hovered: Element | null = null;
      let frame = 0;
      let disposed = false;
      const hold = setTimeout(() => { if (source.isConnected) source.classList.add('drag-held'); }, 250);
      function send(target: Element, type: string, point: DragPoint, relatedTarget: Element | null = null) {
        const dragEvent = new DragEvent(type, {bubbles:true,cancelable:true,dataTransfer:transfer,clientX:point.x,clientY:point.y,relatedTarget,buttons:type==='drop'||type==='dragend'?0:1});
        target.dispatchEvent(dragEvent);
        return dragEvent.defaultPrevented;
      }
      function over(point: DragPoint) {
        if (!source.isConnected) return false;
        const target = document.elementFromPoint(point.x, point.y);
        if (target !== hovered) {
          if (hovered) send(hovered, 'dragleave', point, target);
          if (target) send(target, 'dragenter', point, hovered);
          hovered = target;
        }
        transfer.dropEffect = 'none';
        return !!target && send(target, 'dragover', point);
      }
      const session = createPointerDragSession(latest, {
        start() {
          clearTimeout(hold);
          source.classList.remove('drag-held');
          if (!source.isConnected) return false;
          let prevented = false;
          // Publish source data/state before the first target sees a dragover.
          flushSync(() => { prevented = send(source, 'dragstart', latest); });
          if (prevented) return false;
          document.documentElement.classList.add('app-drag-active');
          suppressClick = true;
          return true;
        },
        over,
        drop(point) { if (hovered) flushSync(() => { send(hovered!, 'drop', point); }); },
        end() {
          if (hovered) send(hovered, 'dragleave', latest);
          flushSync(() => { send(source, 'dragend', latest); finishRef.current?.(); });
          document.documentElement.classList.remove('app-drag-active');
        },
      });
      // Scroll only the nearest scrollable ancestor under the pointer, while dragging.
      function autoScroll() {
        let node = document.elementFromPoint(latest.x, latest.y);
        while (node instanceof HTMLElement) {
          const style = getComputedStyle(node);
          if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
            const rect = node.getBoundingClientRect();
            const delta = latest.y < rect.top + 28 ? -10 : latest.y > rect.bottom - 28 ? 10 : 0;
            const before = node.scrollTop;
            if (delta) node.scrollTop += delta;
            return node.scrollTop !== before;
          }
          node = node.parentElement;
        }
        return false;
      }
      function tick() {
        frame = 0;
        if (disposed) return;
        if (!source.isConnected) { cancel(); return; }
        session.move(latest);
        if (session.active && autoScroll()) frame = requestAnimationFrame(tick);
      }
      function move(e: PointerEvent) {
        if (e.pointerId !== event.pointerId) return;
        if (!(e.buttons & 1)) { cancel(); return; }
        latest = {x:e.clientX,y:e.clientY};
        if (!frame) frame = requestAnimationFrame(tick);
      }
      function cleanup() {
        disposed = true;
        clearTimeout(hold); cancelAnimationFrame(frame);
        source.classList.remove('drag-held');
        document.documentElement.classList.remove('app-drag-active');
        window.removeEventListener('pointermove',move,true);
        window.removeEventListener('pointerup',up,true);
        window.removeEventListener('pointercancel',cancel,true);
        window.removeEventListener('blur',cancel);
        document.removeEventListener('keydown',key,true);
        document.removeEventListener('visibilitychange',visibility);
        disposeGesture = undefined;
      }
      function up(e:PointerEvent) {
        if (e.pointerId !== event.pointerId) return;
        latest={x:e.clientX,y:e.clientY};
        cancelAnimationFrame(frame);
        try {
          // Account for a fast gesture whose final move preceded the animation frame.
          session.move(latest);
          if (session.release(latest)) { e.preventDefault(); e.stopPropagation(); }
        } finally { cleanup(); }
      }
      function cancel() { try { session.cancel(); } finally { cleanup(); } }
      function key(e:KeyboardEvent) { if(e.key==='Escape')cancel(); }
      function visibility() { if(document.hidden)cancel(); }
      disposeGesture = cancel;
      window.addEventListener('pointermove',move,true);
      window.addEventListener('pointerup',up,true);
      window.addEventListener('pointercancel',cancel,true);
      window.addEventListener('blur',cancel);
      document.addEventListener('keydown',key,true);
      document.addEventListener('visibilitychange',visibility);
    }
    function click(event: MouseEvent) {
      if (!suppressClick || event.detail===0) return;
      suppressClick=false;event.preventDefault();event.stopImmediatePropagation();
    }
    function nativeDrag(event: DragEvent) {
      if (event.isTrusted) event.preventDefault();
    }
    document.addEventListener('pointerdown',down,true);
    window.addEventListener('click',click,true);
    document.addEventListener('dragstart',nativeDrag,true);
    return () => {
      disposeGesture?.();
      document.removeEventListener('pointerdown',down,true);
      window.removeEventListener('click',click,true);
      document.removeEventListener('dragstart',nativeDrag,true);
    };
  }, []);
}

export type DragPoint = { x: number; y: number };
export type DragCallbacks = {
  start: () => boolean;
  over: (point: DragPoint) => boolean;
  drop: (point: DragPoint) => void;
  end: (dropped: boolean) => void;
};

/** Pointer-only gesture lifecycle. No native OS drag session is started. */
export function createPointerDragSession(origin: DragPoint, callbacks: DragCallbacks) {
  let active = false;
  let finished = false;
  return {
    get active() { return active; },
    move(point: DragPoint) {
      if (finished) return false;
      if (!active) {
        if (Math.hypot(point.x - origin.x, point.y - origin.y) < 6) return false;
        if (!callbacks.start()) { finished = true; callbacks.end(false); return false; }
        active = true;
      }
      callbacks.over(point);
      return true;
    },
    release(point: DragPoint) {
      if (finished) return false;
      finished = true;
      const wasActive = active;
      let dropped = false;
      try {
        if (active && callbacks.over(point)) { callbacks.drop(point); dropped = true; }
      } finally { if (active) callbacks.end(dropped); active = false; }
      return wasActive;
    },
    cancel() {
      if (finished) return;
      finished = true;
      if (active) callbacks.end(false);
      active = false;
    },
  };
}

/** Track one pointer and cancel when the window can no longer deliver its release. */
export function watchDragPointer(
  origin: PointerEvent,
  handlers: { move: (event: PointerEvent) => void; up: (event: PointerEvent) => void; cancel: () => void },
) {
  const controller = new AbortController();
  const capture = { capture: true, signal: controller.signal };
  const stop = () => controller.abort();
  window.addEventListener('pointermove', event => {
    if (event.pointerId !== origin.pointerId) return;
    if (origin.pointerType === 'mouse' && !(event.buttons & 1)) handlers.cancel();
    else handlers.move(event);
  }, capture);
  window.addEventListener('pointerup', event => {
    if (event.pointerId === origin.pointerId) handlers.up(event);
  }, capture);
  window.addEventListener('pointercancel', event => {
    if (event.pointerId === origin.pointerId) handlers.cancel();
  }, capture);
  window.addEventListener('pointerdown', handlers.cancel, capture);
  window.addEventListener('blur', handlers.cancel, { signal: controller.signal });
  window.addEventListener('resize', handlers.cancel, capture);
  document.addEventListener('visibilitychange', () => { if (document.hidden) handlers.cancel(); }, capture);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') handlers.cancel(); }, capture);
  return stop;
}

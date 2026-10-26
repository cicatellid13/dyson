import cursorUrl from '../assets/nebula.svg';
// A bundled drag image follows native HTML drag operations on every item surface.
const cursor = new Image(24,30);
cursor.src = cursorUrl;
export function themeDrag(event: {dataTransfer: DataTransfer}) {
  if(cursor.complete && cursor.naturalWidth) event.dataTransfer.setDragImage(cursor,3,3);
}

let measure: CanvasRenderingContext2D | null | undefined;

/** Measure on hover/focus, so resizing and edits need no per-row observers. */
export function updateTaskTooltip(input: HTMLInputElement) {
  measure ??= document.createElement('canvas').getContext('2d');
  const style = getComputedStyle(input);
  const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  let textWidth = input.scrollWidth;
  if (measure) {
    measure.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing = parseFloat(style.letterSpacing) || 0;
    textWidth = measure.measureText(input.value).width + Math.max(0, input.value.length - 1) * spacing;
  }
  if (input.value && textWidth > available + 1) input.dataset.tooltip = input.value;
  else delete input.dataset.tooltip;
}

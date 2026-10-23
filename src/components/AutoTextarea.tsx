import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Grow with text and reflow when the surrounding panel changes width. */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      element.style.height = 'auto';
      const style = getComputedStyle(element);
      const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      element.style.height = `${element.scrollHeight + borders}px`;
    };
    resize();
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth !== undefined && nextWidth !== width) { width = nextWidth; resize(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} rows={props.rows ?? 2} className={`auto-textarea ${props.className ?? ''}`}/>;
}

import { cloneElement, useCallback, useRef, useState, type FocusEvent, type MouseEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'right' | 'top' | 'bottom';
interface TooltipTriggerProps { onMouseEnter?: (event: MouseEvent<HTMLElement>) => void; onMouseLeave?: (event: MouseEvent<HTMLElement>) => void; onFocus?: (event: FocusEvent<HTMLElement>) => void; onBlur?: (event: FocusEvent<HTMLElement>) => void }
interface TooltipProps { label: string; side?: TooltipSide; disabled?: boolean; children: ReactElement<TooltipTriggerProps> }

const GAP = 8;

// Rendered in a portal so it is never clipped by scrolling containers such as the sidebar navigation.
export function Tooltip({ label, side = 'top', disabled, children }: TooltipProps) {
  const [position, setPosition] = useState<{ top: number; left: number; transform: string } | null>(null);
  const timer = useRef<number>(undefined);

  const show = useCallback((target: HTMLElement) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = target.getBoundingClientRect();
      if (side === 'right') setPosition({ top: rect.top + rect.height / 2, left: rect.right + GAP, transform: 'translateY(-50%)' });
      else if (side === 'bottom') setPosition({ top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' });
      else setPosition({ top: rect.top - GAP, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' });
    }, 120);
  }, [side]);
  const hide = useCallback(() => { window.clearTimeout(timer.current); setPosition(null); }, []);

  const props = children.props;
  const trigger = cloneElement(children, {
    onMouseEnter: (event: MouseEvent<HTMLElement>) => { props.onMouseEnter?.(event); if (!disabled) show(event.currentTarget); },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => { props.onMouseLeave?.(event); hide(); },
    onFocus: (event: FocusEvent<HTMLElement>) => { props.onFocus?.(event); if (!disabled && event.currentTarget.matches(':focus-visible')) show(event.currentTarget); },
    onBlur: (event: FocusEvent<HTMLElement>) => { props.onBlur?.(event); hide(); },
  });

  return <>{trigger}{position && !disabled && createPortal(<div className="tooltip" role="tooltip" style={position}>{label}</div>, document.body)}</>;
}

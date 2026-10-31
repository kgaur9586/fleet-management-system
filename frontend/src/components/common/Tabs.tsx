import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<K extends string> { key: K; label: string; icon?: ReactNode }
interface TabsProps<K extends string> { tabs: TabItem<K>[]; value: K; onChange: (key: K) => void; label: string }

export function Tabs<K extends string>({ tabs, value, onChange, label }: TabsProps<K>) {
  const listRef = useRef<HTMLDivElement>(null);
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === value);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.key);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.key}"]`)?.focus();
  }
  return <div ref={listRef} className="tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>{tabs.map((tab) => <button key={tab.key} type="button" role="tab" data-tab={tab.key} className="tab" aria-selected={tab.key === value} tabIndex={tab.key === value ? 0 : -1} onClick={() => onChange(tab.key)}>{tab.icon}{tab.label}</button>)}</div>;
}

import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
interface BadgeProps { children: ReactNode; tone?: BadgeTone }

export function Badge({ children, tone = 'neutral' }: BadgeProps) { return <span className={`ui-badge badge-${tone}`}>{children}</span>; }
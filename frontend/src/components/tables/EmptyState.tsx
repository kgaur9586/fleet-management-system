import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps { title?: string; description?: string; action?: ReactNode }
export function EmptyState({ title = 'Nothing here yet', description = 'There are no records to display.', action }: EmptyStateProps) { return <div className="empty-state"><Inbox size={24} /><strong>{title}</strong><p>{description}</p>{action}</div>; }
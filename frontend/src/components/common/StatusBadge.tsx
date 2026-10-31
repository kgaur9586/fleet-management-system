import { Badge } from './Badge';

const toneByStatus: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = { active: 'success', available: 'success', completed: 'success', running: 'success', planned: 'info', in_progress: 'warning', on_trip: 'warning', maintenance: 'warning', under_maintenance: 'warning', inactive: 'neutral', cancelled: 'danger', terminated: 'danger', paid: 'success', finalized: 'success', approved: 'info', review: 'info', draft: 'warning', pending: 'warning', expiring_soon: 'warning', expired: 'danger' };
interface StatusBadgeProps { status: string; label?: string }

export function StatusBadge({ status, label }: StatusBadgeProps) { return <Badge tone={toneByStatus[status] || 'neutral'}>{label || status.replaceAll('_', ' ')}</Badge>; }
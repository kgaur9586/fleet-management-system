import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';
interface SortableColumnProps { label: string; active?: boolean; direction?: SortDirection; onSort: () => void }
export function SortableColumn({ label, active, direction, onSort }: SortableColumnProps) { return <button type="button" className="sortable-column" onClick={onSort}>{label}{active ? direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : <ChevronsUpDown size={14} />}</button>; }
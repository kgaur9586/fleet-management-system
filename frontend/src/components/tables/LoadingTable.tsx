import { LoadingSpinner } from '@/components/common';

interface LoadingTableProps { columns?: number; label?: string }
export function LoadingTable({ columns = 4, label = 'Loading records' }: LoadingTableProps) { return <div className="loading-table"><LoadingSpinner label={label} />{Array.from({ length: 3 }, (_, row) => <div className="table-skeleton-row" key={row}>{Array.from({ length: columns }, (_, column) => <span key={column} />)}</div>)}</div>; }
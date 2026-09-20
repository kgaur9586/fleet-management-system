import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { LoadingTable } from './LoadingTable';
import { Pagination } from './Pagination';

export interface DataTableColumn<T> { key: string; header: ReactNode; render: (row: T) => ReactNode; sortable?: boolean }
interface DataTableProps<T> { rows: T[]; columns: DataTableColumn<T>[]; getRowKey: (row: T) => string; loading?: boolean; empty?: ReactNode; page?: number; totalPages?: number; total?: number; onPageChange?: (page: number) => void; sortKey?: string; sortDirection?: 'asc' | 'desc'; onSort?: (key: string) => void }

export function DataTable<T>({ rows, columns, getRowKey, loading, empty, page, totalPages, total, onPageChange, sortKey, sortDirection, onSort }: DataTableProps<T>) { if (loading) return <LoadingTable columns={columns.length} />; if (!rows.length) return <>{empty || <EmptyState />}</>; return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={getRowKey(row)}>{columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody></table>{page !== undefined && totalPages !== undefined && onPageChange && <Pagination page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />}</div>; }
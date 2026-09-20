import type { ReactNode, ThHTMLAttributes } from 'react';

interface TableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> { children: ReactNode }
export function TableHeader({ children, className = '', ...props }: TableHeaderProps) { return <th {...props} className={`table-header-cell ${className}`}>{children}</th>; }
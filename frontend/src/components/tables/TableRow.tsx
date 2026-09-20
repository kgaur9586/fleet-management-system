import type { HTMLAttributes, ReactNode } from 'react';

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> { children: ReactNode }
export function TableRow({ children, className = '', ...props }: TableRowProps) { return <tr {...props} className={`table-row ${className}`}>{children}</tr>; }
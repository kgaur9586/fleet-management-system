import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem { label: string; to?: string }

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><ol>{items.map((item, index) => { const last = index === items.length - 1; return <li key={`${item.label}-${index}`}>{index > 0 && <ChevronRight size={14} aria-hidden="true" />}{last || !item.to ? <span aria-current={last ? 'page' : undefined}>{item.label}</span> : <Link to={item.to}>{item.label}</Link>}</li>; })}</ol></nav>;
}

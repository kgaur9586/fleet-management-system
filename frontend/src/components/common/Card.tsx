import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> { title?: string; description?: string; actions?: ReactNode; children: ReactNode }

export function Card({ title, description, actions, children, className = '', ...props }: CardProps) {
  return <section {...props} className={`ui-card ${className}`}><>{(title || description || actions) && <header className="card-header"><div>{title && <h2>{title}</h2>}{description && <p className="muted">{description}</p>}</div>{actions && <div className="card-actions">{actions}</div>}</header>}{children}</></section>;
}
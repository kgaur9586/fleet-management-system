import { Construction } from 'lucide-react';

interface PagePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PagePlaceholder({ eyebrow, title, description }: PagePlaceholderProps) {
  return (
    <section className="placeholder-panel">
      <div className="placeholder-icon"><Construction size={20} strokeWidth={1.8} /></div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="placeholder-copy">{description}</p>
    </section>
  );
}
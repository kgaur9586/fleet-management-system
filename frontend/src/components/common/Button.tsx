import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; loading?: boolean; icon?: ReactNode }

export function Button({ variant = 'primary', loading, icon, children, disabled, className = '', ...props }: ButtonProps) {
  return <button {...props} disabled={disabled || loading} className={`ui-button ui-button-${variant} ${className}`}>{loading ? <LoaderCircle size={16} className="spin" /> : icon}{children}</button>;
}
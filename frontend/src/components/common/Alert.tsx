import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

type AlertTone = 'info' | 'success' | 'warning' | 'error';
interface AlertProps { tone?: AlertTone; title?: string; children: ReactNode; onDismiss?: () => void }
const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };

export function Alert({ tone = 'info', title, children, onDismiss }: AlertProps) { const Icon = icons[tone]; return <div className={`ui-alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={18} /><div>{title && <strong>{title}</strong>}<div>{children}</div></div>{onDismiss && <button className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>}</div>; }
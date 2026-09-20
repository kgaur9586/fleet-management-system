import { LoaderCircle } from 'lucide-react';

interface LoadingSpinnerProps { label?: string; size?: number }
export function LoadingSpinner({ label = 'Loading', size = 20 }: LoadingSpinnerProps) { return <span className="loading-spinner" role="status"><LoaderCircle size={size} className="spin" /><span>{label}</span></span>; }
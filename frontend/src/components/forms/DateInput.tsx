import type { InputHTMLAttributes } from 'react';
import { FormField } from './FormField';

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> { label: string; hint?: string; error?: string }

export function DateInput({ label, hint, error, id, required, ...props }: DateInputProps) {
  return <FormField label={label} htmlFor={id} required={required} hint={hint} error={error}><input {...props} id={id} type="date" className={`form-control ${error ? 'has-error' : ''} ${props.className || ''}`} required={required} /></FormField>;
}
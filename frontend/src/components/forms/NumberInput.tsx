import type { InputHTMLAttributes } from 'react';
import { FormField } from './FormField';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> { label: string; hint?: string; error?: string }

export function NumberInput({ label, hint, error, id, required, ...props }: NumberInputProps) {
  return <FormField label={label} htmlFor={id} required={required} hint={hint} error={error}><input {...props} id={id} type="number" className={`form-control ${error ? 'has-error' : ''} ${props.className || ''}`} required={required} /></FormField>;
}
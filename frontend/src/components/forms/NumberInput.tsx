import type { InputHTMLAttributes } from 'react';
import { FormField } from './FormField';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> { label: string; hint?: string; error?: string; hideLabel?: boolean }

export function NumberInput({ label, hint, error, id, required, hideLabel, ...props }: NumberInputProps) {
  return <FormField label={label} htmlFor={id} required={required} hint={hint} error={error} hideLabel={hideLabel}><input {...props} id={id} type="number" className={`form-control ${error ? 'has-error' : ''} ${props.className || ''}`} required={required} /></FormField>;
}
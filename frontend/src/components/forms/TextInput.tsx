import type { InputHTMLAttributes } from 'react';
import { FormField } from './FormField';

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextInput({ label, hint, error, id, required, ...props }: TextInputProps) {
  return <FormField label={label} htmlFor={id} required={required} hint={hint} error={error}><input {...props} id={id} className={`form-control ${error ? 'has-error' : ''} ${props.className || ''}`} required={required} /></FormField>;
}
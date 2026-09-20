import type { TextareaHTMLAttributes } from 'react';
import { FormField } from './FormField';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; hint?: string; error?: string }

export function Textarea({ label, hint, error, id, required, ...props }: TextareaProps) {
  return <FormField label={label} htmlFor={id} required={required} hint={hint} error={error}><textarea {...props} id={id} className={`form-control form-textarea ${error ? 'has-error' : ''} ${props.className || ''}`} required={required} /></FormField>;
}
import type { SelectHTMLAttributes } from 'react';
import { FormField } from './FormField';

export interface SelectOption { value: string; label: string; disabled?: boolean }
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> { label: string; options: SelectOption[]; placeholder?: string; hint?: string; error?: string; hideLabel?: boolean }

export function Select({ label, options, placeholder, hint, error, hideLabel, id, required, ...props }: SelectProps) {
  return <FormField label={label} htmlFor={id} required={required} hint={hint} error={error} hideLabel={hideLabel}><select {...props} id={id} className={`form-control form-select ${error ? 'has-error' : ''} ${props.className || ''}`} required={required}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select></FormField>;
}
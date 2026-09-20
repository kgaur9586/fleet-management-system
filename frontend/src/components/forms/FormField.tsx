import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  children: ReactNode;
}

export function FormField({ label, htmlFor, required, hint, error, hideLabel, children }: FormFieldProps) {
  return <div className="form-field"><label className={`form-label ${hideLabel ? 'sr-only' : ''}`} htmlFor={htmlFor}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{hint && !error && <p className="form-hint">{hint}</p>}{error && <FormError message={error} />}</div>;
}

import { FormError } from './FormError';
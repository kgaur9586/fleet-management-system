interface FormErrorProps { message?: string }

export function FormError({ message }: FormErrorProps) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}
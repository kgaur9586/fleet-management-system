import { Select, type SelectOption } from './Select';

interface EntitySelectorProps { label: string; value?: string; options: SelectOption[]; onChange: (value: string) => void; placeholder?: string; error?: string; disabled?: boolean }
export function EntitySelector({ label, value, options, onChange, placeholder = 'Select an option', error, disabled }: EntitySelectorProps) { return <Select label={label} value={value || ''} options={options} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} error={error} disabled={disabled} />; }
import { EntitySelector } from '@/components/forms/EntitySelector';
import type { SelectOption } from '@/components/forms/Select';
interface ContractSelectorProps { value?: string; options: SelectOption[]; onChange: (value: string) => void; error?: string; disabled?: boolean }
export function ContractSelector(props: ContractSelectorProps) { return <EntitySelector {...props} label="Contract" placeholder={props.disabled ? 'Select a firm first' : 'Select contract'} />; }

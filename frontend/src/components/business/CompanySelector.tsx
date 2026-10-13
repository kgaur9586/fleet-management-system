import { EntitySelector } from '@/components/forms/EntitySelector';
import type { SelectOption } from '@/components/forms/Select';
interface CompanySelectorProps { value?: string; options: SelectOption[]; onChange: (value: string) => void; error?: string; disabled?: boolean }
export function CompanySelector(props: CompanySelectorProps) { return <EntitySelector {...props} label="Company" placeholder="Select company (optional)" />; }

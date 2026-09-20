import { EntitySelector } from '@/components/forms/EntitySelector';
import type { SelectOption } from '@/components/forms/Select';
interface FirmSelectorProps { value?: string; options: SelectOption[]; onChange: (value: string) => void; error?: string; disabled?: boolean }
export function FirmSelector(props: FirmSelectorProps) { return <EntitySelector {...props} label="Firm" placeholder="Select firm" />; }
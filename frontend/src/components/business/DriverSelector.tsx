import { EntitySelector } from '@/components/forms/EntitySelector';
import type { SelectOption } from '@/components/forms/Select';
interface DriverSelectorProps { value?: string; options: SelectOption[]; onChange: (value: string) => void; error?: string; disabled?: boolean }
export function DriverSelector(props: DriverSelectorProps) { return <EntitySelector {...props} label="Driver" placeholder="Select driver" />; }
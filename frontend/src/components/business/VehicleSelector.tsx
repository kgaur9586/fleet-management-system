import { EntitySelector } from '@/components/forms/EntitySelector';
import type { SelectOption } from '@/components/forms/Select';
interface VehicleSelectorProps { value?: string; options: SelectOption[]; onChange: (value: string) => void; error?: string; disabled?: boolean }
export function VehicleSelector(props: VehicleSelectorProps) { return <EntitySelector {...props} label="Vehicle" placeholder="Select vehicle" />; }
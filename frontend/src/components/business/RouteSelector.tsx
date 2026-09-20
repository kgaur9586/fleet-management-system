import { EntitySelector } from '@/components/forms/EntitySelector';
import type { SelectOption } from '@/components/forms/Select';
interface RouteSelectorProps { value?: string; options: SelectOption[]; onChange: (value: string) => void; error?: string; disabled?: boolean }
export function RouteSelector(props: RouteSelectorProps) { return <EntitySelector {...props} label="Route" placeholder="Select route" />; }
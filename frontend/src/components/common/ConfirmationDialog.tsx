import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmationDialogProps { open: boolean; title?: string; message: string; confirmLabel?: string; cancelLabel?: string; loading?: boolean; onConfirm: () => void; onCancel: () => void }

export function ConfirmationDialog({ open, title = 'Confirm action', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading, onConfirm, onCancel }: ConfirmationDialogProps) { return <Modal open={open} title={title} onClose={onCancel} width="small" footer={<><Button variant="secondary" onClick={onCancel}> {cancelLabel}</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}><div className="confirmation-copy"><AlertTriangle size={22} /><p>{message}</p></div></Modal>; }
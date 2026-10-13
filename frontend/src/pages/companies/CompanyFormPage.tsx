import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/common';
import { TextInput, Textarea } from '@/components/forms';
import { companiesApi } from '@/services/companiesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { CompanyPayload } from '@/types';

export function CompanyFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const editing = Boolean(id);
  const [form, setForm] = useState<CompanyPayload>({ name: '', legalName: '', gstNumber: '', address: { street: '', city: '', state: '', pinCode: '' }, contactDetails: { name: '', email: '', mobile: '' }, notes: '', isActive: true });
  const [loading, setLoading] = useState(editing); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!editing || !id) return; companiesApi.get(id).then((company) => setForm({ name: company.name, legalName: company.legalName || '', gstNumber: company.gstNumber || '', address: company.address || {}, contactDetails: company.contactDetails || {}, notes: company.notes || '', isActive: company.isActive })).catch((caught) => setError(getApiErrorMessage(caught))).finally(() => setLoading(false)); }, [editing, id]);
  const update = (field: keyof CompanyPayload, value: unknown) => setForm((current) => ({ ...current, [field]: value }));
  const updateNested = (group: 'address' | 'contactDetails', field: string, value: string) => setForm((current) => ({ ...current, [group]: { ...(current[group] || {}), [field]: value } }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!form.name.trim()) { setError('Company name is required.'); return; }
    setSaving(true);
    try {
      if (editing && id) await companiesApi.update(id, form); else await companiesApi.create(form);
      notify.success(editing ? 'Company updated.' : 'Company added.');
      navigate('/companies');
    } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); }
  }
  if (loading) return <div className="route-loading">Loading company...</div>;
  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/companies"><ArrowLeft size={15} /> Companies</Link><p className="eyebrow">Commercial setup</p><h1>{editing ? 'Edit company' : 'Add company'}</h1><p className="muted">The factory that receives bills from your firms.</p></div></div>
    {error && <Alert tone="error" title="Unable to save company">{error}</Alert>}
    <form onSubmit={submit} className="vehicle-form-grid">
      <Card title="Company identity" description="Names used on the bill header."><div className="form-grid">
        <TextInput id="name" label="Company name" required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Enter company name" />
        <TextInput id="legalName" label="Legal name" value={form.legalName || ''} onChange={(event) => update('legalName', event.target.value)} placeholder="Full legal name printed on bills" />
        <TextInput id="gstNumber" label="GST / tax number" value={form.gstNumber || ''} onChange={(event) => update('gstNumber', event.target.value)} placeholder="Optional tax identifier" />
      </div></Card>
      <Card title="Contact details"><div className="form-grid">
        <TextInput id="contactName" label="Contact name" value={form.contactDetails?.name || ''} onChange={(event) => updateNested('contactDetails', 'name', event.target.value)} />
        <TextInput id="contactEmail" label="Email" type="email" value={form.contactDetails?.email || ''} onChange={(event) => updateNested('contactDetails', 'email', event.target.value)} />
        <TextInput id="contactMobile" label="Mobile" value={form.contactDetails?.mobile || ''} onChange={(event) => updateNested('contactDetails', 'mobile', event.target.value)} />
      </div></Card>
      <Card title="Address"><div className="form-grid">
        <TextInput id="street" label="Street" value={form.address?.street || ''} onChange={(event) => updateNested('address', 'street', event.target.value)} />
        <TextInput id="city" label="City" value={form.address?.city || ''} onChange={(event) => updateNested('address', 'city', event.target.value)} />
        <TextInput id="state" label="State" value={form.address?.state || ''} onChange={(event) => updateNested('address', 'state', event.target.value)} />
        <TextInput id="pinCode" label="PIN code" value={form.address?.pinCode || ''} onChange={(event) => updateNested('address', 'pinCode', event.target.value)} />
      </div></Card>
      <Card title="Notes"><Textarea id="notes" label="Internal notes" value={form.notes || ''} onChange={(event) => update('notes', event.target.value)} /></Card>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/companies')}>Cancel</Button><Button type="submit" loading={saving} icon={<Save size={16} />}>{editing ? 'Save changes' : 'Add company'}</Button></div>
    </form>
  </div>;
}

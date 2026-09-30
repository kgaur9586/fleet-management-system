import { ArrowLeft, Edit3, Mail, MapPin, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, LoadingSpinner, StatusBadge } from '@/components/common';
import { companiesApi } from '@/services/companiesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Company } from '@/types';

export function CompanyDetailsPage() {
  const { id } = useParams(); const navigate = useNavigate(); const [company, setCompany] = useState<Company | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { if (!id) return; companiesApi.get(id).then(setCompany).catch((caught) => setError(getApiErrorMessage(caught))).finally(() => setLoading(false)); }, [id]);
  async function toggleStatus() { if (!company) return; try { await companiesApi.update(company._id, { isActive: !company.isActive }); setCompany({ ...company, isActive: !company.isActive }); notify.success(company.isActive ? 'Company deactivated.' : 'Company activated.'); } catch (caught) { notify.error(caught); } }
  if (loading) return <div className="route-loading"><LoadingSpinner label="Loading company details" /></div>;
  if (error || !company) return <div className="vehicle-page"><Alert tone="error" title="Company unavailable">{error || 'This company could not be found.'}</Alert><Button variant="secondary" onClick={() => navigate('/companies')}>Back to companies</Button></div>;
  const address = [company.address?.street, company.address?.city, company.address?.state, company.address?.pinCode].filter(Boolean).join(', ');
  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/companies"><ArrowLeft size={15} /> Companies</Link><p className="eyebrow">Company record</p><h1>{company.name}</h1><p className="muted">{company.legalName || 'No legal name configured'}</p></div><div className="heading-actions"><Button variant="secondary" icon={<Edit3 size={16} />} onClick={() => navigate(`/companies/${company._id}/edit`)}>Edit company</Button><Button variant={company.isActive ? 'danger' : 'primary'} onClick={() => void toggleStatus()}>{company.isActive ? 'Deactivate' : 'Activate'}</Button></div></div>
    <div className="detail-grid">
      <Card title="Company identity"><div className="detail-list"><div><span>Name</span><strong>{company.name}</strong></div><div><span>Legal name</span><strong>{company.legalName || 'Not set'}</strong></div><div><span>GST / tax</span><strong>{company.gstNumber || 'Not set'}</strong></div><div><span>Status</span><StatusBadge status={company.isActive ? 'active' : 'inactive'} /></div></div></Card>
      <Card title="Contact"><div className="detail-list"><div><span><Phone size={13} /> Mobile</span><strong>{company.contactDetails?.mobile || 'Not set'}</strong></div><div><span><Mail size={13} /> Email</span><strong>{company.contactDetails?.email || 'Not set'}</strong></div><div><span>Contact person</span><strong>{company.contactDetails?.name || 'Not set'}</strong></div></div></Card>
      <Card title="Address"><div className="detail-placeholder"><MapPin size={20} /><p>{address || 'No address added.'}</p></div></Card>
    </div>
  </div>;
}

import { AlertCircle, ClipboardList, Eye, EyeOff, FileText, LoaderCircle, Lock, Mail, ShieldCheck, Truck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';

const highlights = [
  { icon: Truck, label: 'Vehicles, drivers & trips in one place' },
  { icon: FileText, label: 'Contract-accurate billing, every time' },
  { icon: ShieldCheck, label: 'Audit trail on every bill and payout' },
];

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if (!email.trim() || !email.includes('@')) return setFormError('Enter a valid email address.');
    if (password.length < 6) return setFormError('Password must be at least 6 characters.');
    try {
      await login({ email: email.trim(), password });
      notify.success('Welcome back.');
      navigate(from, { replace: true });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setFormError(message);
      notify.error(error);
    }
  }

  return <main className="auth-page">
    <div className="auth-art">
      <div className="auth-art-content">
        <p className="eyebrow">Fleet operations</p>
        <h1>Make every kilometre count.</h1>
        <p>One calm workspace for the people, vehicles, routes, and daily movement behind the business.</p>
        <ul className="auth-highlights">
          {highlights.map(({ icon: Icon, label }) => <li key={label}><span className="auth-highlight-icon"><Icon size={16} /></span>{label}</li>)}
        </ul>
      </div>
      <div className="auth-art-stamp"><ClipboardList size={18} /> Built for the road ahead</div>
    </div>
    <section className="auth-form">
      <div className="auth-form-inner">
        <div className="brand-mark large"><ClipboardList size={21} /></div>
        <p className="eyebrow">Welcome back</p>
        <h2>Sign in to your desk</h2>
        <p className="muted">Use your Fleet Ledger administrator account.</p>
        <form onSubmit={handleSubmit} noValidate>
          <label>
            Email address
            <div className="auth-input">
              <Mail size={16} className="auth-input-icon" />
              <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" disabled={isLoading} aria-invalid={Boolean(formError)} />
            </div>
          </label>
          <label>
            Password
            <div className="auth-input">
              <Lock size={16} className="auth-input-icon" />
              <input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" disabled={isLoading} aria-invalid={Boolean(formError)} />
              <button type="button" className="auth-input-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {formError && <p className="form-error auth-form-error" role="alert"><AlertCircle size={14} />{formError}</p>}
          <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? <><LoaderCircle size={16} className="spin" /> Signing in...</> : 'Continue'}</button>
        </form>
      </div>
    </section>
  </main>;
}
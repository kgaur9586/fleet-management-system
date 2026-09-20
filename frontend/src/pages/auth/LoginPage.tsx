import { ClipboardList, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return <main className="auth-page"><div className="auth-art"><div className="auth-art-content"><p className="eyebrow">Fleet operations</p><h1>Make every kilometre count.</h1><p>One calm workspace for the people, vehicles, routes, and daily movement behind the business.</p></div><div className="auth-art-stamp"><ClipboardList size={18} /> Built for the road ahead</div></div><section className="auth-form"><div className="auth-form-inner"><div className="brand-mark large"><ClipboardList size={21} /></div><p className="eyebrow">Welcome back</p><h2>Sign in to your desk</h2><p className="muted">Use your Fleet Ledger administrator account.</p><form onSubmit={handleSubmit} noValidate><label>Email address<input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" disabled={isLoading} aria-invalid={Boolean(formError)} /></label><label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" disabled={isLoading} aria-invalid={Boolean(formError)} /></label>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? <><LoaderCircle size={16} className="spin" /> Signing in...</> : 'Continue'}</button></form></div></section></main>;
}
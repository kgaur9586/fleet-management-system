import { AlertCircle, ArrowRight, ClipboardList, Eye, EyeOff, FileText, LoaderCircle, Lock, Mail, ShieldCheck, Truck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { BrandMark } from '@/components/layout/BrandMark';
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
  const year = new Date().getFullYear();

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
      <div className="auth-art-glow auth-art-glow-gold" aria-hidden="true" />
      <div className="auth-art-glow auth-art-glow-teal" aria-hidden="true" />
      <div className="auth-art-grid" aria-hidden="true" />
      <svg className="auth-art-route" viewBox="0 0 520 420" fill="none" aria-hidden="true">
        <path d="M-10 340 C 90 340, 120 220, 220 215 S 330 120, 420 115 S 520 40, 560 10" stroke="rgba(143,176,255,.35)" strokeWidth="2" strokeDasharray="1 11" strokeLinecap="round" />
        <circle cx="220" cy="215" r="4.5" fill="#8fb0ff" opacity=".85" />
        <circle cx="420" cy="115" r="4.5" fill="#8fb0ff" opacity=".6" />
        <circle cx="-10" cy="340" r="5.5" fill="#fff" opacity=".9" />
      </svg>
      <div className="auth-art-top">
        <div className="auth-art-brand">
          <BrandMark />
          <div><strong>Fleet Ledger</strong><span>Operations &amp; billing</span></div>
        </div>
      </div>
      <div className="auth-art-content">
        <p className="eyebrow">Fleet operations platform</p>
        <h1>Your fleet. Your operations.<br />One platform.</h1>
        <p>Manage vehicles, drivers, trips, expenses, and billing with complete visibility and control, in one calm workspace.</p>
        <ul className="auth-highlights">
          {highlights.map(({ icon: Icon, label }, index) => <li key={label} style={{ animationDelay: `${0.12 + index * 0.07}s` }}><span className="auth-highlight-icon"><Icon size={16} /></span>{label}</li>)}
        </ul>
      </div>
      <div className="auth-art-footer">
        <div className="auth-art-stamp"><ClipboardList size={14} /> Built for the road ahead</div>
        <p className="auth-art-copyright">© {year} Fleet Ledger. All rights reserved.</p>
      </div>
    </div>
    <section className="auth-form">
      <div className="auth-form-inner">
        <BrandMark large />
        <p className="eyebrow">Sign in</p>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to access your fleet management workspace.</p>
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
          <button className="primary-button auth-submit" type="submit" disabled={isLoading}>
            {isLoading ? <><LoaderCircle size={16} className="spin" /> Signing in...</> : <>Sign In <ArrowRight size={15} className="auth-submit-arrow" /></>}
          </button>
        </form>
      </div>
    </section>
  </main>;
}

import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { api } from '@/lib/api';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<null | { emailEnabled: boolean }>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api<{ ok: boolean; emailEnabled: boolean }>('/auth/forgot', { body: { email: email.trim() } });
      setSent({ emailEnabled: data.emailEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <div className="auth-panel">
        <Link className="brand" href="/" data-testid="link-forgot-brand"><img src={`${basePath}/assets/hustla-mark.png`} alt="" /> HUSTLA</Link>
        <p className="auth-caption">Discover. Hustle. Earn.</p>
        <div className="auth-card">
          {sent ? (
            <>
              <h1 className="display auth-title">Request received</h1>
              {sent.emailEnabled ? (
                <p className="auth-text">If <strong>{email.trim()}</strong> has a HUSTLA account, a reset link is on its way. It works once and expires in 24 hours. Check your spam folder too.</p>
              ) : (
                <p className="auth-text">The HUSTLA admin has been notified. They will send you a reset link, usually within a day, so keep an eye on the contact you gave us. The link works once and expires in 24 hours.</p>
              )}
              <Link className="btn btn-primary auth-wide" href="/sign-in" data-testid="link-forgot-back-to-sign-in">Back to sign in</Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="display auth-title">Forgot your password?</h1>
              <p className="auth-text">Enter the email you signed up with and we will help you get back in.</p>
              <label htmlFor="forgot-email" className="auth-label">Email</label>
              <input id="forgot-email" className="field" data-testid="input-forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              {error && <div className="notice" role="alert" style={{ marginTop: 14 }}>{error}</div>}
              <button type="submit" className="btn btn-primary auth-wide" data-testid="button-forgot-submit" disabled={busy}>{busy ? 'Please wait…' : 'Request a reset'}</button>
              <p className="auth-caption auth-center"><Link href="/sign-in" data-testid="link-forgot-to-sign-in">Back to sign in</Link></p>
              <p className="auth-caption auth-center">Are you the HUSTLA admin? <Link href="/reset-password?admin=1" data-testid="link-forgot-admin">Reset with your setup code</Link></p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

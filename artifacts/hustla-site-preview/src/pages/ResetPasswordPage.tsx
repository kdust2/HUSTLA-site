import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { api } from '@/lib/api';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function ResetPasswordPage() {
  // Read the link once, then take the token out of the address bar.
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const token = params.get('token') ?? '';
  const adminMode = params.get('admin') === '1';
  const [email, setEmail] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await api('/auth/reset', { body: token ? { token, password } : { email: email.trim(), adminCode: adminCode.trim(), password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const incomplete = !token && !adminMode;

  return (
    <main className="auth-wrap">
      <div className="auth-panel">
        <Link className="brand" href="/" data-testid="link-reset-brand"><img src={`${basePath}/assets/hustla-mark.png`} alt="" /> HUSTLA</Link>
        <p className="auth-caption">Discover. Hustle. Earn.</p>
        <div className="auth-card">
          {done ? (
            <>
              <h1 className="display auth-title">Password updated</h1>
              <p className="auth-text">You can now sign in with your new password. Any older sign-ins on other devices have been signed out.</p>
              <Link className="btn btn-primary auth-wide" href="/sign-in" data-testid="link-reset-sign-in">Sign in</Link>
            </>
          ) : incomplete ? (
            <>
              <h1 className="display auth-title">This link is incomplete</h1>
              <p className="auth-text">Open the full reset link you were sent, or request a new one.</p>
              <Link className="btn btn-primary auth-wide" href="/forgot-password" data-testid="link-reset-request-new">Request a new link</Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="display auth-title">{adminMode ? 'Admin password reset' : 'Choose a new password'}</h1>
              <p className="auth-text">{adminMode ? 'Enter the admin email, your admin setup code and a new password.' : 'Pick something at least 8 characters long.'}</p>
              {adminMode && <>
                <label htmlFor="reset-email" className="auth-label">Admin email</label>
                <input id="reset-email" className="field" data-testid="input-reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <label htmlFor="reset-code" className="auth-label">Admin setup code</label>
                <input id="reset-code" className="field" data-testid="input-reset-code" type="password" autoComplete="off" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} required />
              </>}
              <label htmlFor="reset-password" className="auth-label">New password</label>
              <input id="reset-password" className="field" data-testid="input-reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <label htmlFor="reset-confirm" className="auth-label">Confirm new password</label>
              <input id="reset-confirm" className="field" data-testid="input-reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
              {error && <div className="notice" role="alert" style={{ marginTop: 14 }}>{error}</div>}
              <button type="submit" className="btn btn-primary auth-wide" data-testid="button-reset-submit" disabled={busy}>{busy ? 'Please wait…' : 'Update password'}</button>
              <p className="auth-caption auth-center"><Link href="/sign-in" data-testid="link-reset-to-sign-in">Back to sign in</Link></p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

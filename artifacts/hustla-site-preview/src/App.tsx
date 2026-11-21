import { useState, type FormEvent, type ReactNode } from 'react';
import { Route, Switch, Redirect, Router as WouterRouter, useLocation, Link } from 'wouter';
import { HomePage } from '@/pages/HomePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { NewCampaignPage } from '@/pages/NewCampaignPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { HowItWorksPage } from '@/pages/HowItWorksPage';
import { PricingPage } from '@/pages/PricingPage';
import { HelpPage } from '@/pages/HelpPage';
import { AdminPage } from '@/pages/AdminPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function Loading() {
  return <div className="auth-wrap"><div className="auth-panel"><p className="auth-caption" role="status">Loading…</p></div></div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isSignedIn, loading } = useAuth();
  if (loading) return <Loading />;
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in" />;
}

function HomeRedirect() {
  const { isSignedIn, loading } = useAuth();
  if (loading) return <Loading />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <HomePage />;
}

function AuthScreen({ mode }: { mode: 'in' | 'up' }) {
  const { signIn, signUp, isSignedIn, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [needsAdminCode, setNeedsAdminCode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isSignedIn) return <Redirect to="/dashboard" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await signUp({ name: name.trim() || email.split('@')[0], email: email.trim(), password, adminCode: needsAdminCode ? adminCode : undefined });
      setLocation('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'admin_code_required' || err.code === 'admin_code_invalid')) setNeedsAdminCode(true);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <div className="auth-panel">
        <Link className="brand" href="/" data-testid="link-auth-brand"><img src={`${basePath}/assets/hustla-mark.png`} alt="" /> HUSTLA</Link>
        <p className="auth-caption">Discover. Hustle. Earn.</p>
        <form onSubmit={submit} style={{ background: '#fffefa', borderRadius: 16, padding: 24, textAlign: 'left', boxShadow: '0 12px 40px #22314d1f' }}>
          <h1 className="display" style={{ fontSize: 28, margin: '0 0 4px' }}>{mode === 'in' ? 'Welcome back' : 'Make your next move'}</h1>
          <p className="auth-caption" style={{ marginTop: 0 }}>{mode === 'in' ? 'Sign in with your email and password.' : 'Create your HUSTLA account. It takes under a minute.'}</p>
          {mode === 'up' && <>
            <label htmlFor="auth-name" style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '12px 0 5px' }}>Your name</label>
            <input id="auth-name" className="field" data-testid="input-auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Mensah" required minLength={2} />
          </>}
          <label htmlFor="auth-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '12px 0 5px' }}>Email</label>
          <input id="auth-email" className="field" data-testid="input-auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <label htmlFor="auth-password" style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '12px 0 5px' }}>Password</label>
          <input id="auth-password" className="field" data-testid="input-auth-password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'up' ? 'At least 8 characters' : 'Your password'} required minLength={mode === 'up' ? 8 : 1} />
          {mode === 'in' && <p style={{ margin: '10px 0 0', fontSize: 13, textAlign: 'right' }}><Link href="/forgot-password" data-testid="link-forgot-password">Forgot password?</Link></p>}
          {mode === 'up' && needsAdminCode && <>
            <label htmlFor="auth-admin-code" style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '12px 0 5px' }}>Admin setup code</label>
            <input id="auth-admin-code" className="field" data-testid="input-auth-admin-code" type="password" autoComplete="off" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} />
          </>}
          {error && <div className="notice" role="alert" style={{ marginTop: 14 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" data-testid="button-auth-submit" disabled={busy} style={{ width: '100%', marginTop: 18 }}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <p className="auth-caption" style={{ textAlign: 'center', marginBottom: 0 }}>
            {mode === 'in'
              ? <>New here? <Link href="/sign-up" data-testid="link-to-sign-up">Create an account</Link></>
              : <>Already have an account? <Link href="/sign-in" data-testid="link-to-sign-in">Sign in</Link></>}
          </p>
        </form>
      </div>
    </main>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={() => <AuthScreen mode="in" />} />
      <Route path="/sign-up/*?" component={() => <AuthScreen mode="up" />} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/dashboard">{() => <Protected><DashboardPage /></Protected>}</Route>
      <Route path="/new-campaign">{() => <Protected><NewCampaignPage /></Protected>}</Route>
      <Route path="/explore">{() => <Protected><ExplorePage /></Protected>}</Route>
      <Route path="/campaigns">{() => <Protected><CampaignsPage /></Protected>}</Route>
      <Route path="/businesses"><Redirect to="/campaigns" /></Route>
      <Route path="/admin">{() => <Protected><AdminPage /></Protected>}</Route>
      <Route path="/leaderboard">{() => <Protected><LeaderboardPage /></Protected>}</Route>
      <Route path="/creators"><Redirect to="/leaderboard" /></Route>
      <Route path="/how-it-works">{() => <Protected><HowItWorksPage /></Protected>}</Route>
      <Route path="/pricing">{() => <Protected><PricingPage /></Protected>}</Route>
      <Route path="/help">{() => <Protected><HelpPage /></Protected>}</Route>
      <Route><div className="auth-wrap"><div className="auth-panel"><h1 className="display">Page not found</h1><a className="btn btn-primary" href={basePath || '/'} data-testid="link-home-fallback">Back to HUSTLA</a></div></div></Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;

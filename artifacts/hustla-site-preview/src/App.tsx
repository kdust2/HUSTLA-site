import { useState, type FormEvent, type ReactNode } from 'react';
import { Route, Switch, Redirect, Router as WouterRouter, useLocation, Link } from 'wouter';
import { HomePage } from '@/pages/HomePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { NewCampaignPage } from '@/pages/NewCampaignPage';
import { BusinessesPage } from '@/pages/BusinessesPage';
import { CreatorsPage } from '@/pages/CreatorsPage';
import { HowItWorksPage } from '@/pages/HowItWorksPage';
import { PricingPage } from '@/pages/PricingPage';
import { HelpPage } from '@/pages/HelpPage';
import { DemoAuthProvider, useDemoAuth } from '@/lib/demoAuth';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function Protected({ children }: { children: ReactNode }) {
  const { isSignedIn } = useDemoAuth();
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in" />;
}

function HomeRedirect() {
  const { isSignedIn } = useDemoAuth();
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <HomePage />;
}

function AuthScreen({ mode }: { mode: 'in' | 'up' }) {
  const { signIn } = useDemoAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    signIn(name || email.split('@')[0] || 'Demo User', email);
    setLocation('/dashboard');
  };

  return (
    <main className="auth-wrap">
      <div className="auth-panel">
        <Link className="brand" href="/" data-testid="link-auth-brand"><img src={`${basePath}/assets/hustla-mark.png`} alt="" /> HUSTLA</Link>
        <p className="auth-caption">Discover. Hustle. Earn.</p>
        <form onSubmit={submit} style={{ background: '#fffefa', borderRadius: 16, padding: 24, textAlign: 'left', boxShadow: '0 12px 40px #22314d1f' }}>
          <h1 className="display" style={{ fontSize: 28, margin: '0 0 4px' }}>{mode === 'in' ? 'Welcome back' : 'Make your next move'}</h1>
          <p className="auth-caption" style={{ marginTop: 0 }}>Demo mode: type any name and email to look around. No real account is created.</p>
          <label htmlFor="demo-name" style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '12px 0 5px' }}>Your name</label>
          <input id="demo-name" className="field" data-testid="input-demo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Mensah" />
          <label htmlFor="demo-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '12px 0 5px' }}>Email</label>
          <input id="demo-email" className="field" data-testid="input-demo-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button type="submit" className="btn btn-primary" data-testid="button-demo-continue" style={{ width: '100%', marginTop: 18 }}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
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
      <Route path="/dashboard">{() => <Protected><DashboardPage /></Protected>}</Route>
      <Route path="/new-campaign">{() => <Protected><NewCampaignPage /></Protected>}</Route>
      <Route path="/explore">{() => <Protected><ExplorePage /></Protected>}</Route>
      <Route path="/businesses">{() => <Protected><BusinessesPage /></Protected>}</Route>
      <Route path="/creators">{() => <Protected><CreatorsPage /></Protected>}</Route>
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
      <DemoAuthProvider>
        <AppRoutes />
      </DemoAuthProvider>
    </WouterRouter>
  );
}

export default App;

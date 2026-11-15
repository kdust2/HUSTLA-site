import { type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Route, Switch, Redirect, Router as WouterRouter, useLocation, Link } from 'wouter';
import { HomePage, ProductPage, DashboardPage, ExplorePage } from '@/pages/SitePages';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'bottom' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#2455d6',
    colorForeground: '#1d293c',
    colorMutedForeground: '#697689',
    colorDanger: '#c84d40',
    colorBackground: '#fffefa',
    colorInput: '#fffefa',
    colorInputForeground: '#1d293c',
    colorNeutral: '#1d293c',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-bold text-[#1d293c]',
    headerSubtitle: 'text-[#697689]',
    socialButtonsBlockButtonText: 'font-semibold text-[#1d293c]',
    formFieldLabel: 'font-semibold text-[#1d293c]',
    footerActionLink: 'font-semibold text-[#2455d6]',
    footerActionText: 'text-[#697689]',
    dividerText: 'text-[#697689]',
    identityPreviewEditButton: 'text-[#2455d6]',
    formFieldSuccessText: 'text-[#317b5c]',
    alertText: 'text-[#9f3429]',
    logoBox: 'rounded-xl',
    logoImage: 'h-9',
    socialButtonsBlockButton: 'rounded-xl border-[#dedbd2]',
    formButtonPrimary: 'rounded-full font-bold !text-white',
    formFieldInput: 'rounded-xl border-[#dedbd2]',
    footerAction: 'text-[#697689]',
    dividerLine: 'bg-[#dedbd2]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-xl',
    formFieldRow: 'text-left',
    main: 'gap-4',
  },
};

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-wrap"><div className="auth-caption">Getting your HUSTLA space ready…</div></div>;
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in" />;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <HomePage />;
}

function AuthScreen({ mode }: { mode: 'in' | 'up' }) {
  return (
    <main className="auth-wrap">
      <div className="auth-panel">
        <Link className="brand" href="/" data-testid="link-auth-brand"><img src={`${basePath}/assets/hustla-mark.png`} alt="" /> HUSTLA</Link>
        <p className="auth-caption">Discover. Hustle. Earn.</p>
        {mode === 'in' ? (
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        ) : (
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        )}
      </div>
    </main>
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in and get moving.' } },
        signUp: { start: { title: 'Make your next move', subtitle: 'One account. Two ways to earn.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={() => <AuthScreen mode="in" />} />
        <Route path="/sign-up/*?" component={() => <AuthScreen mode="up" />} />
        <Route path="/dashboard">{() => <Protected><DashboardPage /></Protected>}</Route>
        <Route path="/explore">{() => <Protected><ExplorePage /></Protected>}</Route>
        <Route path="/businesses">{() => <Protected><ProductPage page="businesses" /></Protected>}</Route>
        <Route path="/creators">{() => <Protected><ProductPage page="creators" /></Protected>}</Route>
        <Route path="/how-it-works">{() => <Protected><ProductPage page="how-it-works" /></Protected>}</Route>
        <Route path="/pricing">{() => <Protected><ProductPage page="pricing" /></Protected>}</Route>
        <Route path="/help">{() => <Protected><ProductPage page="help" /></Protected>}</Route>
        <Route><div className="auth-wrap"><div className="auth-panel"><h1 className="display">Page not found</h1><a className="btn btn-primary" href={basePath || '/'} data-testid="link-home-fallback">Back to HUSTLA</a></div></div></Route>
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}

export default App;

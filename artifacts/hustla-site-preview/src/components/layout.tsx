import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { CircleHelp, Compass, CreditCard, Home, LogOut, Megaphone, Menu, ShieldCheck, Trophy, X, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useScrollReveal } from '@/lib/motion';

export function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand-home"><img src={`${import.meta.env.BASE_URL}assets/hustla-mark.png`} alt="" /> HUSTLA</Link>;
}

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/explore', label: 'Explore tasks', icon: Compass },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/how-it-works', label: 'How it works', icon: Zap },
  { href: '/pricing', label: 'Pricing', icon: CreditCard },
  { href: '/help', label: 'Help', icon: CircleHelp },
];

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  useScrollReveal();
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const items = user?.isAdmin ? [...navItems.slice(0, 3), { href: '/admin', label: 'Admin review', icon: ShieldCheck }, ...navItems.slice(3)] : navItems;
  const [menuOpen, setMenuOpen] = useState(false);
  const name = user?.name || 'HUSTLA member';
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => { setMenuOpen(false); }, [location]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      {menuOpen && <div className="drawer-backdrop" data-testid="drawer-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside id="app-drawer" className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main menu">
        <div className="drawer-head">
          <Brand />
          <button className="icon-btn" aria-label="Close menu" data-testid="button-close-menu" onClick={() => setMenuOpen(false)}><X /></button>
        </div>
        <p className="side-kicker">Your workspace</p>
        <nav aria-label="Workspace navigation">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`side-link ${location === href ? 'active' : ''}`} aria-current={location === href ? 'page' : undefined} data-testid={`link-nav-${href.slice(1)}`}>
              <Icon /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile"><div className="avatar">{initials}</div><div className="profile-copy">{name}<small>{user?.isAdmin ? 'HUSTLA admin' : 'HUSTLA member'}</small></div></div>
          <button className="btn btn-small drawer-signout" data-testid="button-sign-out" onClick={() => signOut()}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>
      <div className="main-area">
        <header className="app-topbar">
          <div className="topbar-left">
            <button className="menu-btn" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="app-drawer" data-testid="button-menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
            <span className="crumb">Workspace <span aria-hidden="true">/</span> {title}</span>
          </div>
          <div className="top-actions">
            <span className="welcome">Good work starts here, {name.split(' ')[0]}.</span>
            <div className="avatar" aria-hidden="true">{initials}</div>
          </div>
        </header>
        <main className="content page-in" key={location}>{children}</main>
      </div>
    </div>
  );
}

export function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

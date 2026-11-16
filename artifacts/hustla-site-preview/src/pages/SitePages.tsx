import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useDemoAuth } from '@/lib/demoAuth';
import {
  ArrowDownRight, ArrowRight, BadgeCheck, BriefcaseBusiness, Check, CircleHelp,
  Compass, CreditCard, Home, LogOut, Menu, Plus, Search, ShieldCheck, Sparkles, X, Zap,
} from 'lucide-react';

const categories = [
  'Business & Product Promotion', 'Social Media Growth', 'Music & Entertainment',
  'Content Creation & UGC', 'Design & Branding', 'Video & Photo Services',
  'Digital & Tech Services', 'Events & Experiences', 'Writing & Marketing',
  'Fashion & Lifestyle', 'Education & Learning', 'Other Tasks & Opportunities',
];

type Task = { id: number; title: string; category: string; reward: number; days: number; spots: number; description: string };
const initialTasks: Task[] = [
  { id: 1, title: 'Unboxing video for a Kumasi shea butter brand', category: categories[3], reward: 40, days: 3, spots: 3, description: 'Phone video, 30 seconds, honest first impressions.' },
  { id: 2, title: 'Usability test of a school fees portal', category: categories[6], reward: 60, days: 5, spots: 2, description: 'Complete five tasks and report what confused you.' },
  { id: 3, title: 'Cover art for an Afrobeats single', category: categories[2], reward: 120, days: 7, spots: 1, description: 'Original artwork, 3000 × 3000 px, two revision rounds.' },
  { id: 4, title: 'Thumbnail set for a cooking channel', category: categories[4], reward: 35, days: 2, spots: 4, description: 'Three thumbnails, 1280 × 720, brand colours provided.' },
  { id: 5, title: 'Event photos for a Takoradi pop-up market', category: categories[7], reward: 150, days: 9, spots: 2, description: '30 edited photos within 48 hours of the event.' },
  { id: 6, title: 'Caption writing for a fashion label', category: categories[8], reward: 25, days: 1, spots: 6, description: 'Ten captions in English, friendly tone, no fake claims.' },
  { id: 7, title: 'Product demo reel for a phone accessories shop', category: categories[0], reward: 80, days: 6, spots: 2, description: 'Vertical video, 20 to 40 seconds, shows the product in use.' },
  { id: 8, title: 'Survey on how students pay for data', category: categories[11], reward: 15, days: 4, spots: 20, description: 'Ten minutes. Honest answers only.' },
];
const gh = (value: number) => `GH₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand-home"><img src={`${import.meta.env.BASE_URL}assets/hustla-mark.png`} alt="" /> HUSTLA</Link>;
}

function useScrollReveal() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const nodes = document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [location]);
}

export function HomePage() {
  useScrollReveal();
  return (
    <div className="site home">
      <header className="public-header">
        <Brand />
        <div className="public-actions">
          <Link className="btn" href="/sign-in" data-testid="link-public-sign-in">Sign in</Link>
          <Link className="btn btn-primary" href="/sign-up" data-testid="link-public-sign-up">Create account <ArrowRight size={15} /></Link>
        </div>
      </header>
      <main className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">The Ghana work marketplace</p>
          <h1>Make your next move <em>count.</em></h1>
          <p className="home-lead">HUSTLA connects Ghanaian businesses and creators with people ready to make, promote and get things done — paid in cedis.</p>
          <div className="public-actions">
            <Link className="btn btn-primary" href="/sign-up" data-testid="link-hero-sign-up">Create your account <ArrowRight size={16} /></Link>
            <Link className="btn" href="/sign-in" data-testid="link-hero-sign-in">Sign in</Link>
          </div>
          <p className="home-footnote">One account for campaign publishers and task workers.</p>
        </div>
        <div className="hero-art" aria-label="HUSTLA marketplace illustration">
          <div className="orbit-card">
            <img src={`${import.meta.env.BASE_URL}assets/hustla-mark.png`} alt="" />
            <span className="mini-label">Discover · Hustle · Earn</span>
            <h2>Good work moves both ways.</h2>
            <p>Find people. Find paid work. Build something real.</p>
          </div>
          <div className="float-pill float-one"><strong>GH₵40</strong> for your next idea</div>
          <div className="float-pill float-two"><BadgeCheck size={16} /> Approved work only</div>
        </div>
      </main>
      <footer className="public-footer"><Brand /><span>Built around real work in Ghana. All times are Ghana time (GMT).</span></footer>
    </div>
  );
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/explore', label: 'Explore tasks', icon: Compass },
  { href: '/businesses', label: 'Businesses', icon: BriefcaseBusiness },
  { href: '/creators', label: 'Creators', icon: Sparkles },
  { href: '/how-it-works', label: 'How it works', icon: Zap },
  { href: '/pricing', label: 'Pricing', icon: CreditCard },
  { href: '/help', label: 'Help', icon: CircleHelp },
];

function AppShell({ children, title }: { children: ReactNode; title: string }) {
  useScrollReveal();
  const [location] = useLocation();
  const { user, signOut } = useDemoAuth();
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
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`side-link ${location === href ? 'active' : ''}`} aria-current={location === href ? 'page' : undefined} data-testid={`link-nav-${href.slice(1)}`}>
              <Icon /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile"><div className="avatar">{initials}</div><div className="profile-copy">{name}<small>HUSTLA member</small></div></div>
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
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><span className="section-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function TaskCard({ task, action }: { task: Task; action?: React.ReactNode }) {
  return (
    <article className="task-card">
      <div>
        <span className="category">{task.category}</span>
        <h3>{task.title}</h3>
        <p>{task.description}</p>
        <div className="task-meta"><span>{task.days} days left</span><span>{task.spots} open spots</span><span>Reviewed campaign</span></div>
      </div>
      <div className="task-side"><div className="reward">{gh(task.reward)}<small>worker receives</small></div>{action}</div>
    </article>
  );
}

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('reward');
  const [applied, setApplied] = useState<number[]>([]);
  const tasks = useMemo(() => initialTasks.filter((task) =>
    (!category || task.category === category) &&
    `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a, b) => sort === 'deadline' ? a.days - b.days : b.reward - a.reward), [search, category, sort]);
  return (
    <AppShell title="Explore">
      <Header eyebrow="Open opportunities" title="Find work that fits." description="Every campaign is reviewed and funded before it appears. Rewards shown are what the worker receives." />
      <div className="filter-row">
        <label className="sr-only" htmlFor="task-search">Search tasks</label><input id="task-search" className="field" data-testid="input-task-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search video, logo, survey…" />
        <label className="sr-only" htmlFor="task-category">Category</label><select id="task-category" className="field" data-testid="select-task-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="sr-only" htmlFor="task-sort">Sort tasks</label><select id="task-sort" className="field" data-testid="select-task-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="reward">Highest reward</option><option value="deadline">Soonest deadline</option></select>
      </div>
      <div className="task-list">
        {tasks.map((task) => <TaskCard key={task.id} task={task} action={<button className={`btn btn-small ${applied.includes(task.id) ? '' : 'btn-primary'}`} data-testid={`button-apply-task-${task.id}`} onClick={() => setApplied((prev) => prev.includes(task.id) ? prev : [...prev, task.id])}>{applied.includes(task.id) ? <><Check size={14} /> Applied</> : 'Apply'}</button>} />)}
        {tasks.length === 0 && <div className="empty-state"><Search size={26} /><h2>No matches yet</h2><p>Try another phrase or clear the category filter.</p><button className="btn" data-testid="button-clear-task-filters" onClick={() => { setSearch(''); setCategory(''); }}>Clear filters</button></div>}
      </div>
    </AppShell>
  );
}

type Campaign = { id: number; title: string; category: string; status: string; quantity: number; reward: number };

const CAMPAIGN_KEY = 'hustla-demo-campaigns';
const FLASH_KEY = 'hustla-flash';
function loadSavedCampaigns(): Campaign[] {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    return raw ? (JSON.parse(raw) as Campaign[]) : [];
  } catch {
    return [];
  }
}
function saveCampaign(campaign: Campaign) {
  try { window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify([campaign, ...loadSavedCampaigns()])); } catch { /* storage can be unavailable */ }
}

export function DashboardPage() {
  const [mode, setMode] = useState<'worker' | 'publisher'>(() => (window.location.hash === '#publisher' ? 'publisher' : 'worker'));
  const [campaigns] = useState<Campaign[]>(() => [
    ...loadSavedCampaigns(),
    { id: 1, title: 'Unboxing video for a Kumasi shea butter brand', category: categories[3], status: 'Live', quantity: 3, reward: 40 },
    { id: 2, title: 'Usability test of a school fees portal', category: categories[6], status: 'Live', quantity: 2, reward: 60 },
    { id: 3, title: 'Buy followers for my music page', category: categories[1], status: 'Needs review', quantity: 5, reward: 10 },
  ]);
  const [applied, setApplied] = useState<number[]>([2]);
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  useEffect(() => {
    try {
      const flash = window.sessionStorage.getItem(FLASH_KEY);
      if (flash) { window.sessionStorage.removeItem(FLASH_KEY); notify(flash); }
    } catch { /* storage can be unavailable */ }
  }, []);

  const workerTasks = initialTasks.filter((task) => task.id !== 2);
  return (
    <AppShell title="Dashboard">
      <Header eyebrow="Your HUSTLA" title="Good work, in motion." description="A quick look at the work you’re publishing, the tasks you’re taking on and your cedi balance." action={<Link className="btn btn-primary" href="/new-campaign" data-testid="button-new-campaign"><Plus size={16} /> New campaign</Link>} />
      <div className="stats-grid">
        {(mode === 'worker' ? [
          ['Withdrawable', 'GH₵186.00', 'Next payout · Friday'],
          ['Tasks completed', '08', '+2 this month'],
          ['In review', '02', 'Both submitted'],
          ['Quality rating', '4.9', 'From approved work'],
        ] : [
          ['Available balance', 'GH₵200.00', 'Ready for a campaign'],
          ['Reserved', 'GH₵264.00', 'Held for live tasks'],
          ['Active campaigns', '02', '5 workers in progress'],
          ['Awaiting review', '01', 'Respond within 48 hours'],
        ]).map(([label, value, sub]) => <div key={label} className="stat-card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}
      </div>
      <div className="dash-grid">
        <section className="surface">
          <div className="surface-head"><h2>{mode === 'worker' ? 'Suggested tasks' : 'Your campaigns'}</h2><div className="public-actions"><button className="btn btn-small" data-testid="button-mode-worker" aria-pressed={mode === 'worker'} onClick={() => setMode('worker')}>Worker</button><button className="btn btn-small" data-testid="button-mode-publisher" aria-pressed={mode === 'publisher'} onClick={() => setMode('publisher')}>Publisher</button></div></div>
          {mode === 'worker' ? workerTasks.slice(0, 4).map((task) => <div className="task-row" key={task.id}><div className="task-info"><span className="category">{task.category}</span><h3>{task.title}</h3><p>{task.days} days left · {task.spots} spots</p></div><div className="reward">{gh(task.reward)}<small>worker receives</small><button className={`btn btn-small ${applied.includes(task.id) ? '' : 'btn-primary'}`} data-testid={`button-dashboard-apply-${task.id}`} onClick={() => { setApplied((prev) => prev.includes(task.id) ? prev : [...prev, task.id]); notify('Application sent. The publisher has 24 hours to respond.'); }}>{applied.includes(task.id) ? 'Applied' : 'Apply'}</button></div></div>) : campaigns.map((campaign) => <div className="task-row" key={campaign.id}><div className="task-info"><span className="category">{campaign.category}</span><h3>{campaign.title}</h3><p>{campaign.quantity} tasks · {gh(campaign.reward)} each · budget held until approval</p></div><span className="category">{campaign.status}</span></div>)}
          {mode === 'worker' && <div className="surface-head"><Link href="/explore" className="btn btn-small" data-testid="link-dashboard-explore">Browse all tasks <ArrowRight size={14} /></Link></div>}
        </section>
        <aside>
          <section className="business-hero"><h2>Real work. Fair terms.</h2><p>Campaigns are checked by a person. Worker rewards are held safely and never reduced by platform fees.</p><Link className="btn btn-warm btn-small" href="/how-it-works" data-testid="link-dashboard-how-it-works">How HUSTLA works <ArrowRight size={14} /></Link></section>
          <section className="surface" style={{ marginTop: 16 }}><div className="surface-head"><h2>Recent activity</h2><ArrowDownRight size={17} /></div><div className="activity">
            <div className="activity-item"><span className="activity-dot" /><div>Work approved · product demo reel<small>GH₵80.00 added · Today</small></div></div>
            <div className="activity-item"><span className="activity-dot" /><div>Application accepted · cover art<small>Reward locked at GH₵120.00 · Yesterday</small></div></div>
            <div className="activity-item"><span className="activity-dot" /><div>MoMo payout received<small>GH₵64.00 · Tuesday</small></div></div>
          </div></section>
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

export function NewCampaignPage() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[3]);
  const [quantity, setQuantity] = useState(3);
  const [reward, setReward] = useState(40);
  const [error, setError] = useState('');
  const rewardTotal = quantity * reward;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 8 || description.trim().length < 10 || quantity < 1 || reward < 1) {
      setError('Add a clear title, brief, quantity and reward to continue.');
      return;
    }
    saveCampaign({ id: Date.now(), title: title.trim(), category, status: 'Pending review', quantity, reward });
    try { window.sessionStorage.setItem(FLASH_KEY, 'Submitted. HUSTLA reviews new campaigns within 24 hours.'); } catch { /* storage can be unavailable */ }
    setLocation('/dashboard#publisher');
  };

  return (
    <AppShell title="New campaign">
      <Header eyebrow="Publisher" title="Start a campaign." description="Tell workers exactly what to make. New campaigns are reviewed within 24 hours." action={<Link className="btn" href="/dashboard" data-testid="link-cancel-campaign">Back to dashboard</Link>} />
      <form className="surface campaign-form form-page" onSubmit={submit}>
        <label htmlFor="campaign-name">Campaign title</label>
        <input id="campaign-name" className="field" data-testid="input-campaign-name" value={title} onChange={(event) => setTitle(event.target.value)} minLength={8} required placeholder="e.g. Create a product demo reel" />
        <label htmlFor="campaign-category">Category</label>
        <select id="campaign-category" className="field" data-testid="select-campaign-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <label htmlFor="campaign-brief">What should the worker deliver?</label>
        <textarea id="campaign-brief" className="field" data-testid="textarea-campaign-brief" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} required placeholder="Describe the deliverable, requirements and acceptance criteria." />
        <div className="calc-row">
          <div><label htmlFor="campaign-quantity">Number of tasks</label><input id="campaign-quantity" className="field" data-testid="input-campaign-quantity" type="number" min="1" max="100" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
          <div><label htmlFor="campaign-reward">Reward per task (GH₵)</label><input id="campaign-reward" className="field" data-testid="input-campaign-reward" type="number" min="1" step=".5" value={reward} onChange={(event) => setReward(Number(event.target.value))} /></div>
        </div>
        <div className="fee-calculator">
          <div className="calc-result"><span>Workers receive</span><strong>{gh(rewardTotal)}</strong></div>
          <div className="calc-result"><span>HUSTLA fee (10%)</span><strong>{gh(rewardTotal * 0.1)}</strong></div>
          <div className="calc-result"><b>Total to fund</b><strong>{gh(rewardTotal * 1.1)}</strong></div>
        </div>
        <p className="auth-caption">The worker always receives the full reward shown. The 10% fee is added on top.</p>
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="form-actions">
          <Link className="btn" href="/dashboard" data-testid="button-cancel-campaign">Cancel</Link>
          <button type="submit" className="btn btn-primary" data-testid="button-submit-campaign">Submit for review</button>
        </div>
      </form>
    </AppShell>
  );
}

const businessSteps = [
  ['Write the brief', 'Set the deliverable, quantity, reward, deadline and acceptance criteria.'],
  ['We review it', 'A person checks your campaign within 24 hours against marketplace rules.'],
  ['Reserve the budget', 'Reward plus the 10% fee is set aside for each task before it goes live.'],
  ['Choose your workers', 'Accept or decline each application within 24 hours.'],
  ['Approve the work', 'Review within 48 hours, approve or request one correction with a specific reason.'],
];
const workerSteps = [
  ['Browse and apply', 'Filter reviewed campaigns by category, reward and deadline.'],
  ['Get accepted', 'Scope, reward and deadline are locked once the publisher accepts.'],
  ['Deliver the work', 'Share a link, text, images, video or files to meet the brief.'],
  ['Fix once if needed', 'You have 48 hours to correct the issue described in the review.'],
  ['Withdraw', 'Cleared earnings are paid every Tuesday and Friday.'],
];
const faqs = [
  ['How do I get paid?', 'Approved and cleared work becomes withdrawable. Payouts run every Tuesday and Friday. You need a verified mobile money or bank payout account; the minimum withdrawal is GH₵20.'],
  ['What does HUSTLA cost?', 'Task workers pay GH₵20 a month and advertisers pay GH₵30 a month. There is no free plan or yearly package. The advertiser pays 10% on top of the worker reward.'],
  ['What if a publisher never reviews my work?', 'They have 48 hours and receive a reminder. If nobody acts and there is no dispute or policy hold, the work is approved automatically.'],
  ['How do corrections work?', 'There is one correction round. The publisher must request it within 48 hours and describe a specific issue within the original brief. You then have 48 hours to resubmit.'],
  ['How do disputes work?', 'Either side can open a dispute with a reason and evidence. Funds stay held while HUSTLA reviews the brief and submission, aiming to decide within 3 business days.'],
  ['Which campaigns are not allowed?', 'Fake followers, likes, comments, views or streams, incentivised reviews, scams, gambling, crypto, financial offers, health claims, alcohol, giveaways, recruitment, political campaigns and anything targeting children are prohibited.'],
  ['Can I publish campaigns and do tasks with one account?', 'Yes. One registration gives you both modes: Campaign Publisher and Task Worker. Each mode has its own monthly membership.'],
  ['How is my money protected?', 'Campaign budgets are reserved before tasks are offered. Deposits are confirmed by the payment provider, never by a screenshot. Money movements are recorded in your wallet ledger.'],
];

export function ProductPage({ page }: { page: 'businesses' | 'creators' | 'how-it-works' | 'pricing' | 'help' }) {
  useScrollReveal();
  const [quantity, setQuantity] = useState(5);
  const [reward, setReward] = useState(100);
  const titles = {
    businesses: ['FOR BUSINESSES', 'Find your people. Make good work.', 'UGC, demos, graphics, testing and research — delivered by real people, with your budget held until approval.'],
    creators: ['FOR CREATORS', 'Promote your work. Earn from others.', 'Musicians, creators and freelancers can run campaigns for their own work and complete tasks for others — from one account.'],
    'how-it-works': ['THE FLOW', 'Two journeys. One marketplace.', 'Clear deadlines on both sides, so good work does not get stuck waiting.'],
    pricing: ['PRICING & FEES', 'Simple, in cedis.', 'One monthly membership, one transparent fee, nothing hidden in the reward.'],
    help: ['HELP CENTRE', 'Answers, without the runaround.', 'The details on payouts, corrections, disputes and keeping the marketplace fair.'],
  } as const;
  const [eyebrow, heading, desc] = titles[page];
  return (
    <AppShell title={page === 'how-it-works' ? 'How it works' : page[0].toUpperCase() + page.slice(1)}>
      <Header eyebrow={eyebrow} title={heading} description={desc} />
      {page === 'businesses' && <>
        <section className="business-hero reveal"><h2>Campaigns that pay for actual work.</h2><p>Choose who applies, review every deliverable and keep your brief and budget in control at each step.</p><Link className="btn btn-warm" href="/new-campaign" data-testid="button-publish-campaign-info">Publish a campaign <ArrowRight size={15} /></Link></section>
        <section className="sec reveal"><h2 className="display">What can you put to work?</h2><p className="auth-caption">Twelve campaign categories, from the first product impression to the final edit.</p><div className="simple-grid">{[['You stay in control', 'Choose applicants, approve the work or request one correction with a clear reason. Scope and reward lock when a worker is accepted.'], ['Your money stays accounted for', 'Budget is reserved before tasks go live. It is released only on approval or a dispute decision. Unused balance stays in your wallet.']].map(([title, copy]) => <div className="info-panel" key={title}><ShieldCheck color="#2455d6" /><h3>{title}</h3><p>{copy}</p></div>)}</div></section>
        <section className="sec reveal"><h2 className="display">From brief to approved work</h2><NumberedSteps items={businessSteps} /><CampaignIntegrity /></section>
      </>}
      {page === 'creators' && <>
        <div className="simple-grid reveal">{[['Promote your own work', 'Put real outreach and original promotional content behind your profile, channel, release or show. Nothing bought, nothing faked.'], ['Earn through your skills', 'Edit, design, shoot, write or test for businesses and fellow creators — and build a track record people can see.']].map(([title, copy]) => <div className="info-panel" key={title}><Sparkles color="#2455d6" /><h3>{title}</h3><p>{copy}</p></div>)}</div>
        <section className="sec reveal"><h2 className="display">Good work gets noticed.</h2><p className="auth-caption">Performance is measured on approved work, on-time delivery and quality — never follower counts. You decide what appears on your profile.</p><div className="task-list" style={{ marginTop: 18 }}>{[['Efua Mensah','Video editor','48 approved jobs · 4.9 rating','Top Performer'],['Kwame Asante','Photographer','41 approved jobs · 4.9 rating','Reliable Partner'],['Abena Owusu','Graphic designer','33 approved jobs · 4.8 rating','Creative Pro']].map(([name, role, details, badge], index) => <div className="task-card" key={name}><div className="avatar">{name.split(' ').map((word) => word[0]).join('')}</div><div className="task-info"><h3>{index + 1}. {name}</h3><p>{role} · {details}</p></div><span className="category">{badge}</span></div>)}</div><CampaignIntegrity /></section>
      </>}
      {page === 'how-it-works' && <div className="simple-grid reveal"><section><h2 className="display">If you publish</h2><NumberedSteps items={businessSteps} /></section><section><h2 className="display">If you earn</h2><NumberedSteps items={workerSteps} /></section></div>}
      {page === 'pricing' && <>
        <div className="pricing-grid reveal"><div className="price-card"><span className="section-label">Task workers</span><div className="price-value">GH₵20<small> / month</small></div><p>Access and apply for available tasks.</p><Link className="btn" href="/creators" data-testid="link-pricing-creators">For creators <ArrowRight size={14} /></Link></div><div className="price-card featured"><span className="section-label" style={{ color: '#f4c449' }}>Advertisers</span><div className="price-value">GH₵30<small> / month</small></div><p>Create and manage reviewed campaigns.</p><Link className="btn btn-warm" href="/businesses" data-testid="link-pricing-businesses">For businesses <ArrowRight size={14} /></Link></div></div>
        <section className="fee-calculator reveal"><h2 className="display">The 10% fee, worked out</h2><p className="auth-caption">HUSTLA charges the advertiser 10% on top. The worker always receives the full agreed reward.</p><div className="calc-row"><div><label htmlFor="calc-quantity">Number of tasks</label><input id="calc-quantity" className="field" data-testid="input-pricing-quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></div><div><label htmlFor="calc-reward">Reward per task (GH₵)</label><input id="calc-reward" className="field" data-testid="input-pricing-reward" type="number" min="1" step=".5" value={reward} onChange={(event) => setReward(Math.max(1, Number(event.target.value)))} /></div></div><div className="calc-result"><span>Total workers receive</span><strong>{gh(quantity * reward)}</strong></div><div className="calc-result"><span>HUSTLA fee (10%)</span><strong>{gh(quantity * reward * .1)}</strong></div><div className="calc-result"><b>Campaign funding required</b><strong>{gh(quantity * reward * 1.1)}</strong></div></section>
        <section className="sec reveal"><h2 className="display">Deposits and withdrawals</h2><div className="simple-grid">{[['Minimum campaign deposit','GH₵50'],['Minimum withdrawal','GH₵20'],['Payout days','Tuesday and Friday'],['Membership billing','Monthly only']].map(([label, amount]) => <div className="info-panel" key={label}><span className="auth-caption">{label}</span><h3>{amount}</h3></div>)}</div><p className="auth-caption">Any payment-provider charge is shown before you confirm, and never reduces a worker’s agreed reward.</p></section>
      </>}
        {page === 'help' && <><div className="faq-list reveal">{faqs.map(([question, answer], index) => <details key={question}><summary data-testid={`summary-help-${index}`}>{question}</summary><p>{answer}</p></details>)}</div><div className="notice reveal"><strong>Still stuck?</strong> Open a support request from your dashboard, or use the report action on any campaign. <Link href="/dashboard" data-testid="link-help-dashboard">Go to dashboard <ArrowRight size={13} /></Link></div></>}
    </AppShell>
  );
}

function NumberedSteps({ items }: { items: string[][] }) {
  return <ol className="number-list">{items.map(([title, description], index) => <li key={title}><span className="number">{index + 1}</span><div><b>{title}</b><span>{description}</span></div></li>)}</ol>;
}

function CampaignIntegrity() {
  return <div className="notice"><strong>No fake engagement. Ever.</strong> HUSTLA does not sell followers, likes, comments, views, artificial streams or paid reviews. Every campaign is reviewed by a person before anyone can see it.</div>;
}

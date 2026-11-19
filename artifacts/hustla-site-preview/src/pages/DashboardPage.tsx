import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Plus } from 'lucide-react';
import { gh } from '@/lib/data';
import { FLASH_KEY } from '@/lib/campaigns';
import { api, statusLabel, type ApiCampaign } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';
import { useAuth } from '@/lib/auth';

type MyApplication = { campaignId: number; status: 'pending' | 'accepted' | 'declined' };

export function DashboardPage() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'there').split(' ')[0];
  const [mode, setMode] = useState<'worker' | 'publisher'>(() => (window.location.hash === '#publisher' ? 'publisher' : 'worker'));
  const [mine, setMine] = useState<ApiCampaign[]>([]);
  const [live, setLive] = useState<ApiCampaign[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const load = useCallback(async () => {
    try {
      const [m, l, a] = await Promise.all([
        api<{ campaigns: ApiCampaign[] }>('/campaigns/mine'),
        api<{ campaigns: ApiCampaign[] }>('/campaigns/live'),
        api<{ applications: MyApplication[] }>('/applications/mine'),
      ]);
      setMine(m.campaigns);
      setLive(l.campaigns);
      setApplications(a.applications);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    try {
      const flash = window.sessionStorage.getItem(FLASH_KEY);
      if (flash) { window.sessionStorage.removeItem(FLASH_KEY); notify(flash); }
    } catch { /* storage can be unavailable */ }
  }, []);

  const apply = async (id: number) => {
    try {
      await api(`/campaigns/${id}/apply`, { method: 'POST', body: {} });
      notify('Application sent. The publisher has 24 hours to respond.');
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send your application.');
    }
  };

  const workerTasks = live.filter((task) => !task.isOwn);
  const count = (status: string) => mine.filter((campaign) => campaign.status === status).length;
  const pad = (n: number) => String(n).padStart(2, '0');
  const stats: string[][] = mode === 'worker' ? [
    ['Open tasks', pad(workerTasks.length), 'Live right now'],
    ['Applications sent', pad(applications.length), 'Across all campaigns'],
    ['Waiting for reply', pad(applications.filter((a) => a.status === 'pending').length), 'Publishers respond in 24 hours'],
    ['Accepted', pad(applications.filter((a) => a.status === 'accepted').length), 'Reward locked in'],
  ] : [
    ['Live campaigns', pad(count('live')), 'Visible to workers'],
    ['Awaiting review', pad(count('pending_review')), 'Reviewed within 24 hours'],
    ['Applicants', pad(mine.reduce((sum, campaign) => sum + (campaign.applicantCount ?? 0), 0)), 'Across your campaigns'],
    ['Declined', pad(count('declined')), 'Not approved by HUSTLA'],
  ];

  return (
    <AppShell title="Dashboard">
      <Header eyebrow="Your HUSTLA" title={`${greeting}, ${firstName}.`} description="Here’s a quick look at the work you’re publishing and the tasks you’re taking on." action={<Link className="btn btn-primary" href="/new-campaign" data-testid="button-new-campaign"><Plus size={16} /> New campaign</Link>} />
      <div className="stats-grid">
        {stats.map(([label, value, sub]) => <div key={label} className="stat-card reveal"><span>{label}</span><strong>{loading ? '–' : value}</strong><small>{sub}</small></div>)}
      </div>
      <div className="dash-grid">
        <section className="surface">
          <div className="surface-head"><h2>{mode === 'worker' ? 'Suggested tasks' : 'Your campaigns'}</h2><div className="public-actions"><button className="btn btn-small" data-testid="button-mode-worker" aria-pressed={mode === 'worker'} onClick={() => setMode('worker')}>Worker</button><button className="btn btn-small" data-testid="button-mode-publisher" aria-pressed={mode === 'publisher'} onClick={() => setMode('publisher')}>Publisher</button></div></div>
          {loadError && <div className="notice" role="alert">{loadError}</div>}
          {!loading && !loadError && mode === 'worker' && workerTasks.length === 0 && <div className="task-row"><div className="task-info"><h3>No open tasks yet</h3><p>New campaigns appear here as soon as HUSTLA approves them.</p></div></div>}
          {!loading && !loadError && mode === 'publisher' && mine.length === 0 && <div className="task-row"><div className="task-info"><h3>You have not published a campaign yet</h3><p>Start one and HUSTLA will review it within 24 hours.</p></div></div>}
          {mode === 'worker' ? workerTasks.slice(0, 4).map((task) => <div className="task-row explore-row" key={task.id}><div className="task-info"><span className="category">{task.category}</span><h3>{task.title}</h3><p className="task-meta"><span className={task.daysLeft <= 2 ? 'urgent' : ''}>{task.daysLeft} {task.daysLeft === 1 ? 'day' : 'days'} left</span><span>{task.spotsOpen} {task.spotsOpen === 1 ? 'spot' : 'spots'} open</span></p></div><div className="task-pay"><div className="pay-amount"><strong>{gh(task.reward)}</strong><small>Worker receives</small></div><button className={`btn btn-small ${task.applied ? '' : 'btn-primary'}`} data-testid={`button-dashboard-apply-${task.id}`} disabled={task.applied} onClick={() => void apply(task.id)}>{task.applied ? 'Applied' : 'Apply'}</button></div></div>) : mine.map((campaign) => <div className="task-row" key={campaign.id}><div className="task-info"><span className="category">{campaign.category}</span><h3>{campaign.title}</h3><p>{campaign.quantity} tasks · {gh(campaign.reward)} each · {campaign.applicantCount ?? 0} {campaign.applicantCount === 1 ? 'applicant' : 'applicants'}</p></div><span className="category">{statusLabel[campaign.status]}</span></div>)}
          {mode === 'worker' && <div className="surface-head"><Link href="/explore" className="btn btn-small" data-testid="link-dashboard-explore">Browse all tasks <ArrowRight size={14} /></Link></div>}
        </section>
        <aside>
          <section className="business-hero"><h2>Real work. Fair terms.</h2><p>Campaigns are checked by a person. Worker rewards are held safely and never reduced by platform fees.</p><Link className="btn btn-warm btn-small" href="/how-it-works" data-testid="link-dashboard-how-it-works">How HUSTLA works <ArrowRight size={14} /></Link></section>
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

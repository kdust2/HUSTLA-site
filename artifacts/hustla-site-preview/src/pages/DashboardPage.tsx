import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Plus } from 'lucide-react';
import { gh } from '@/lib/data';
import { FLASH_KEY } from '@/lib/campaigns';
import { api, statusLabel, taskStatusLabel, timeLeft, type ApiCampaign, type MyTask } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { useMode } from '@/lib/mode';

export function DashboardPage() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'there').split(' ')[0];
  const { mode } = useMode();
  const [mine, setMine] = useState<ApiCampaign[]>([]);
  const [live, setLive] = useState<ApiCampaign[]>([]);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const load = useCallback(async () => {
    try {
      const [m, l, t] = await Promise.all([
        api<{ campaigns: ApiCampaign[] }>('/campaigns/mine'),
        api<{ campaigns: ApiCampaign[] }>('/campaigns/live'),
        api<{ assignments: MyTask[] }>('/assignments/mine'),
      ]);
      setMine(m.campaigns);
      setLive(l.campaigns);
      setTasks(t.assignments);
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
      notify('Application sent. The publisher has 24 hours to reply.');
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send your application.');
    }
  };

  const workerTasks = live.filter((task) => !task.isOwn && !task.applied);
  const sum = (key: 'pendingApps' | 'toReview') => mine.reduce((total, campaign) => total + (campaign[key] ?? 0), 0);
  const count = (status: string) => mine.filter((campaign) => campaign.status === status).length;
  const active = tasks.filter((t) => t.status === 'assigned' || t.status === 'correction_requested');
  const waiting = tasks.filter((t) => t.status === 'submitted' || t.status === 'resubmitted' || t.status === 'under_dispute');
  const pad = (n: number) => String(n).padStart(2, '0');
  const stats: string[][] = mode === 'worker' ? [
    ['Open tasks', pad(workerTasks.length), 'You can apply to these'],
    ['Active tasks', pad(active.length), 'Waiting for your work'],
    ['With the publisher', pad(waiting.length), 'Waiting for review'],
    ['Completed', pad(tasks.filter((t) => t.status === 'completed').length), 'Paid to your wallet'],
  ] : [
    ['Live campaigns', pad(count('live')), 'Visible to workers'],
    ['Applications to answer', pad(sum('pendingApps')), 'Reply within 24 hours'],
    ['Work to review', pad(sum('toReview')), 'Approve within 48 hours'],
    ['Awaiting HUSTLA', pad(count('pending_review')), 'Reviewed within 24 hours'],
  ];
  const taskHint = (t: MyTask) => t.status === 'assigned' ? `Due ${timeLeft(t.dueAt)}` : t.status === 'correction_requested' ? `Correction ${timeLeft(t.correctionDueAt)}` : t.status === 'submitted' || t.status === 'resubmitted' ? `Publisher reviews ${timeLeft(t.reviewDueAt)}` : taskStatusLabel[t.status];

  return (
    <AppShell title="Dashboard">
      <Header eyebrow={mode === 'worker' ? 'Worker dashboard' : 'Publisher dashboard'} title={`${greeting}, ${firstName}.`} description={mode === 'worker' ? 'Here’s a quick look at your tasks and the work you can pick up.' : 'Here’s a quick look at your campaigns and what needs your attention.'} action={<Link className="btn btn-primary" href="/new-campaign" data-testid="button-new-campaign"><Plus size={16} /> New campaign</Link>} />
      <div className="stats-grid">
        {stats.map(([label, value, sub]) => <div key={label} className="stat-card reveal"><span>{label}</span><strong>{loading ? '–' : value}</strong><small>{sub}</small></div>)}
      </div>
      {loadError && <div className="notice" role="alert">{loadError}</div>}
      <div className="dash-grid">
        <div>
          {mode === 'worker' ? (<>
            <section className="surface" data-testid="my-tasks">
              <div className="surface-head"><h2>My tasks</h2></div>
              {!loading && !loadError && tasks.length === 0 && <div className="task-row"><div className="task-info"><h3>No tasks yet</h3><p>Apply to a campaign below. When a publisher accepts you, the task appears here.</p></div></div>}
              {tasks.slice(0, 8).map((t) => (
                <div className="task-row explore-row" key={t.id} data-testid={`dashboard-task-${t.id}`}>
                  <div className="task-info"><span className="category">{t.publisherName}</span><h3>{t.title}</h3><p className="task-meta"><span className={t.status === 'assigned' && timeLeft(t.dueAt) === 'overdue' ? 'urgent' : ''}>{taskHint(t)}</span></p></div>
                  <div className="task-pay"><div className="pay-amount"><strong>{gh(t.reward)}</strong><small>{taskStatusLabel[t.status]}</small></div><Link className={`btn btn-small ${t.status === 'assigned' || t.status === 'correction_requested' ? 'btn-primary' : ''}`} href={`/tasks/${t.id}`} data-testid={`link-open-task-${t.id}`}>Open</Link></div>
                </div>
              ))}
            </section>
            <section className="surface" style={{ marginTop: 16 }}>
              <div className="surface-head"><h2>Suggested tasks</h2></div>
              {!loading && !loadError && workerTasks.length === 0 && <div className="task-row"><div className="task-info"><h3>No open tasks right now</h3><p>New campaigns appear here as soon as HUSTLA approves them.</p></div></div>}
              {workerTasks.slice(0, 4).map((task) => <div className="task-row explore-row" key={task.id}><div className="task-info"><span className="category">{task.category}</span><h3>{task.title}</h3><p className="task-meta"><span>{task.days} {task.days === 1 ? 'day' : 'days'} to finish</span><span>{task.spotsOpen} {task.spotsOpen === 1 ? 'spot' : 'spots'} open</span></p></div><div className="task-pay"><div className="pay-amount"><strong>{gh(task.reward)}</strong><small>Worker receives</small></div><button className="btn btn-small btn-primary" data-testid={`button-dashboard-apply-${task.id}`} onClick={() => void apply(task.id)}>Apply</button></div></div>)}
              <div className="surface-head"><Link href="/explore" className="btn btn-small" data-testid="link-dashboard-explore">Browse all tasks <ArrowRight size={14} /></Link></div>
            </section>
          </>) : (
            <section className="surface" data-testid="my-campaigns">
              <div className="surface-head"><h2>Your campaigns</h2></div>
              {!loading && !loadError && mine.length === 0 && <div className="task-row"><div className="task-info"><h3>You have not published a campaign yet</h3><p>Start one and HUSTLA will review it within 24 hours.</p></div></div>}
              {mine.map((campaign) => (
                <div className="task-row" key={campaign.id} data-testid={`dashboard-campaign-${campaign.id}`}>
                  <div className="task-info">
                    <span className="category">{campaign.category}</span>
                    <h3>{campaign.title}</h3>
                    <p>{campaign.slotsTaken}/{campaign.quantity} spots taken · {gh(campaign.reward)} each{campaign.pendingApps ? ` · ${campaign.pendingApps} to answer` : ''}{campaign.toReview ? ` · ${campaign.toReview} to review` : ''}</p>
                  </div>
                  <span className={`pill pill-${campaign.status}`}>{statusLabel[campaign.status]}</span>
                  <Link className={`btn btn-small${campaign.pendingApps || campaign.toReview ? ' btn-primary' : ''}`} href={`/campaigns/${campaign.id}`} data-testid={`link-manage-${campaign.id}`}>Manage</Link>
                </div>
              ))}
            </section>
          )}
        </div>
        <aside>
          <section className="business-hero"><h2>Real work. Fair terms.</h2><p>Campaigns are checked by a person. Rewards are reserved up front and workers always receive the full reward.</p><Link className="btn btn-warm btn-small" href="/how-it-works" data-testid="link-dashboard-how-it-works">How HUSTLA works <ArrowRight size={14} /></Link></section>
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowDownRight, ArrowRight, Plus } from 'lucide-react';
import { categories, initialTasks, gh } from '@/lib/data';
import { FLASH_KEY, type Campaign, loadSavedCampaigns } from '@/lib/campaigns';
import { AppShell, Header } from '@/components/layout';

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
        ]).map(([label, value, sub]) => <div key={label} className="stat-card reveal"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>)}
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

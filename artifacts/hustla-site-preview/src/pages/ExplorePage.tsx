import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { categories, gh } from '@/lib/data';
import { delay } from '@/lib/motion';
import { api, type ApiCampaign } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async () => {
    try {
      const data = await api<{ campaigns: ApiCampaign[] }>('/campaigns/live');
      setCampaigns(data.campaigns);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const tasks = useMemo(() => campaigns.filter((task) =>
    (category === 'All' || task.category === category) &&
    `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(search.toLowerCase()),
  ), [campaigns, search, category]);

  const apply = async (id: number) => {
    try {
      await api(`/campaigns/${id}/apply`, { method: 'POST', body: {} });
      setCampaigns((prev) => prev.map((task) => (task.id === id ? { ...task, applied: true } : task)));
      notify('Application sent. The publisher has 24 hours to respond.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send your application.');
    }
  };

  return (
    <AppShell title="Explore">
      <Header eyebrow="Open opportunities" title="Find work that fits." description="Every campaign is reviewed and funded before it appears. Rewards shown are what the worker receives." />
      <label className="sr-only" htmlFor="task-search">Search tasks</label>
      <input id="task-search" className="field explore-search" data-testid="input-task-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search video, logo, survey…" />
      <div className="chips" role="group" aria-label="Categories">
        {['All', ...categories.filter((name) => campaigns.some((task) => task.category === name))].map((item) => (
          <button key={item} type="button" className={`chip ${category === item ? 'on' : ''}`} aria-pressed={category === item} data-testid={`chip-${item.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {loadError && <div className="notice" role="alert">{loadError}</div>}
      {loading ? <p className="auth-caption" role="status">Loading tasks…</p> : tasks.length > 0 ? (
        <section className="surface" key={category}>
          {tasks.map((task, index) => (
            <div className="task-row explore-row pop" style={delay(index * 55)} key={task.id}>
              <div className="task-info">
                <span className="category">{task.category}</span>
                <h3>{task.title}</h3>
                <p className="task-desc">{task.description}</p>
                <p className="task-meta">
                  <span className={(task.daysLeft ?? 0) <= 2 ? 'urgent' : ''}>{task.daysLeft} {task.daysLeft === 1 ? 'day' : 'days'} left</span>
                  <span>{task.spotsOpen} {task.spotsOpen === 1 ? 'spot' : 'spots'} open</span>
                </p>
              </div>
              <div className="task-pay">
                <div className="pay-amount"><strong>{gh(task.reward)}</strong><small>Worker receives</small></div>
                <button type="button" className={`btn btn-small ${task.applied || task.isOwn ? '' : 'btn-primary'}`} data-testid={`button-apply-task-${task.id}`} disabled={task.applied || task.isOwn} onClick={() => void apply(task.id)}>{task.isOwn ? 'Your campaign' : task.applied ? <><Check size={14} /> Applied</> : 'Apply'}</button>
              </div>
            </div>
          ))}
        </section>
      ) : campaigns.length === 0 && !loadError ? (
        <div className="empty-state pop"><Search size={26} /><h2>No open tasks yet</h2><p>New campaigns show up here once HUSTLA approves them.</p></div>
      ) : !loadError ? (
        <div className="empty-state pop"><Search size={26} /><h2>No matches yet</h2><p>Try another word or pick All.</p><button type="button" className="btn" data-testid="button-clear-task-filters" onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</button></div>
      ) : null}
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

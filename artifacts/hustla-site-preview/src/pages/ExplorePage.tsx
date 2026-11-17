import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { categories, initialTasks, gh } from '@/lib/data';
import { delay } from '@/lib/motion';
import { AppShell, Header } from '@/components/layout';

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [applied, setApplied] = useState<number[]>([]);
  const [toast, setToast] = useState('');
  const tasks = useMemo(() => initialTasks.filter((task) =>
    (category === 'All' || task.category === category) &&
    `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(search.toLowerCase()),
  ), [search, category]);
  const toggle = (id: number) => {
    const adding = !applied.includes(id);
    setApplied((prev) => (adding ? [...prev, id] : prev.filter((item) => item !== id)));
    if (adding) {
      setToast('Application sent. The publisher has 24 hours to respond.');
      window.setTimeout(() => setToast(''), 2600);
    }
  };
  return (
    <AppShell title="Explore">
      <Header eyebrow="Open opportunities" title="Find work that fits." description="Every campaign is reviewed and funded before it appears. Rewards shown are what the worker receives." />
      <label className="sr-only" htmlFor="task-search">Search tasks</label>
      <input id="task-search" className="field explore-search" data-testid="input-task-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search video, logo, survey…" />
      <div className="chips" role="group" aria-label="Categories">
        {['All', ...categories.filter((name) => initialTasks.some((task) => task.category === name))].map((item) => (
          <button key={item} type="button" className={`chip ${category === item ? 'on' : ''}`} aria-pressed={category === item} data-testid={`chip-${item.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {tasks.length > 0 ? (
        <section className="surface" key={category}>
          {tasks.map((task, index) => (
            <div className="task-row explore-row pop" style={delay(index * 55)} key={task.id}>
              <div className="task-info">
                <span className="category">{task.category}</span>
                <h3>{task.title}</h3>
                <p className="task-desc">{task.description}</p>
                <p className="task-meta">
                  <span className={task.days <= 2 ? 'urgent' : ''}>{task.days} {task.days === 1 ? 'day' : 'days'} left</span>
                  <span>{task.spots} {task.spots === 1 ? 'spot' : 'spots'} open</span>
                </p>
              </div>
              <div className="task-pay">
                <div className="pay-amount"><strong>{gh(task.reward)}</strong><small>Worker receives</small></div>
                <button type="button" className={`btn btn-small ${applied.includes(task.id) ? '' : 'btn-primary'}`} data-testid={`button-apply-task-${task.id}`} onClick={() => toggle(task.id)}>{applied.includes(task.id) ? <><Check size={14} /> Applied</> : 'Apply'}</button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="empty-state pop"><Search size={26} /><h2>No matches yet</h2><p>Try another word or pick All.</p><button type="button" className="btn" data-testid="button-clear-task-filters" onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</button></div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Redirect } from 'wouter';
import { gh } from '@/lib/data';
import { api, statusLabel, type ApiCampaign, type CampaignStatus } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';
import { useAuth } from '@/lib/auth';

type Filter = CampaignStatus | 'all';
const filters: { value: Filter; label: string }[] = [
  { value: 'pending_review', label: 'Awaiting review' },
  { value: 'live', label: 'Live' },
  { value: 'declined', label: 'Declined' },
  { value: 'all', label: 'All' },
];

export function AdminPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('pending_review');
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async (status: Filter) => {
    setLoading(true);
    try {
      const data = await api<{ campaigns: ApiCampaign[] }>(`/admin/campaigns?status=${status}`);
      setCampaigns(data.campaigns);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.isAdmin) void load(filter); }, [filter, load, user?.isAdmin]);

  if (!user?.isAdmin) return <Redirect to="/dashboard" />;

  const review = async (id: number, decision: 'approve' | 'decline') => {
    setBusyId(id);
    try {
      await api(`/admin/campaigns/${id}/review`, { body: { decision } });
      notify(decision === 'approve' ? 'Campaign approved. It is live now.' : 'Campaign declined.');
      await load(filter);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save that decision.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell title="Admin review">
      <Header eyebrow="Admin" title="Review campaigns." description="Check each brief before it goes live. Approved campaigns appear in Explore straight away." />
      <div className="chips" role="group" aria-label="Filter campaigns">
        {filters.map((item) => <button key={item.value} type="button" className={`chip ${filter === item.value ? 'on' : ''}`} aria-pressed={filter === item.value} data-testid={`chip-admin-${item.value}`} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      {loading ? <p className="auth-caption" role="status">Loading…</p> : campaigns.length === 0 && !error ? (
        <div className="empty-state"><h2>Nothing here</h2><p>{filter === 'pending_review' ? 'No campaigns are waiting for review.' : 'No campaigns match this filter.'}</p></div>
      ) : (
        <section className="surface">
          {campaigns.map((campaign) => (
            <div className="task-row" key={campaign.id}>
              <div className="task-info">
                <span className="category">{campaign.category}</span>
                <h3>{campaign.title}</h3>
                <p className="task-desc">{campaign.description}</p>
                <p className="task-meta"><span>{campaign.quantity} tasks · {gh(campaign.reward)} each</span><span>By {campaign.ownerName} ({campaign.ownerEmail})</span><span>{campaign.applicantCount ?? 0} applicants</span></p>
              </div>
              <div className="task-pay">
                {campaign.status === 'pending_review' ? <>
                  <button type="button" className="btn btn-small" data-testid={`button-decline-${campaign.id}`} disabled={busyId === campaign.id} onClick={() => void review(campaign.id, 'decline')}>Decline</button>
                  <button type="button" className="btn btn-small btn-primary" data-testid={`button-approve-${campaign.id}`} disabled={busyId === campaign.id} onClick={() => void review(campaign.id, 'approve')}>Approve</button>
                </> : <span className="category">{statusLabel[campaign.status]}</span>}
              </div>
            </div>
          ))}
        </section>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { Check, X } from 'lucide-react';
import { gh } from '@/lib/data';
import { api, formatWhen, statusLabel, taskStatusLabel, timeLeft, type CampaignDetail } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';

export function CampaignDetailPage() {
  const [, params] = useRoute('/campaigns/:id');
  const id = Number(params?.id);
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };

  const load = useCallback(async () => {
    try { setData(await api<CampaignDetail>(`/campaigns/${id}`)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load this campaign.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const decide = async (appId: number, decision: 'accept' | 'decline') => {
    setBusy(appId);
    try {
      await api(`/applications/${appId}/decide`, { body: { decision } });
      notify(decision === 'accept' ? 'Accepted. The worker has been told and the clock is running.' : 'Declined.');
    } catch (err) { notify(err instanceof Error ? err.message : 'Could not save that.'); }
    finally { setBusy(null); await load(); }
  };
  const closeCampaign = async () => {
    try {
      const r = await api<{ refundedSlots: number }>(`/campaigns/${id}/close`, { method: 'POST', body: {} });
      notify(`Campaign closed. ${r.refundedSlots} unassigned ${r.refundedSlots === 1 ? 'spot was' : 'spots were'} refunded to your wallet.`);
      setConfirmClose(false);
    } catch (err) { notify(err instanceof Error ? err.message : 'Could not close the campaign.'); }
    await load();
  };

  if (!data) {
    return <AppShell title="Campaign"><Header eyebrow="Campaign" title="Campaign." description="" />{error ? <div className="notice" role="alert">{error}</div> : <p className="auth-caption" role="status">Loading…</p>}</AppShell>;
  }
  const c = data.campaign;
  const pending = data.applications.filter((a) => a.status === 'pending');
  const others = data.applications.filter((a) => a.status !== 'pending');
  const open = c.quantity - c.slotsTaken;
  const closable = c.status === 'live' || c.status === 'pending_review';

  return (
    <AppShell title="Campaign">
      <Header eyebrow="Campaign" title={c.title} description={`${c.category} · ${c.quantity} tasks at ${gh(c.reward)} each`} action={<Link className="btn" href="/dashboard#publisher" data-testid="link-back-dashboard">Back</Link>} />
      <div className="stats-grid">
        <div className="stat-card"><span>Status</span><strong style={{ fontSize: 18 }}>{statusLabel[c.status]}</strong><small>{c.status === 'pending_review' ? 'HUSTLA reviews within 24 hours' : c.status === 'live' ? 'Open for applications' : ''}</small></div>
        <div className="stat-card"><span>Spots</span><strong>{c.slotsTaken}/{c.quantity}</strong><small>{open} still open</small></div>
        <div className="stat-card"><span>Applications</span><strong data-testid="stat-pending">{c.pendingApps ?? 0}</strong><small>waiting for you</small></div>
        <div className="stat-card"><span>Completed</span><strong>{c.completed ?? 0}</strong><small>{c.toReview ? `${c.toReview} to review` : 'tasks paid'}</small></div>
      </div>
      {c.status === 'declined' && <div className="notice" role="alert">This campaign was declined{c.reviewNote ? `: ${c.reviewNote}` : '.'} Your reserved money is back in your wallet.</div>}
      <section className="surface wallet-panel">
        <div className="surface-head"><h2>The brief</h2></div>
        <p className="wallet-help" style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
        <p className="wallet-help"><strong>Deliverable:</strong> {c.deliverable}</p>
        <p className="wallet-help"><strong>Judged on:</strong> {c.criteria}</p>
        <p className="wallet-help"><strong>Funded:</strong> {gh(c.budget)} reserved for this campaign ({gh(c.fee)} of it is HUSTLA's fee per task)</p>
      </section>

      {pending.length > 0 && (
        <section className="surface" data-testid="pending-applications">
          <div className="surface-head"><h2>Applications waiting for you</h2></div>
          {pending.map((a) => (
            <div className="wallet-row" key={a.id} data-testid={`application-${a.id}`}>
              <div className="wallet-row-main"><strong>{a.workerName}</strong><small>Applied {formatWhen(a.createdAt)} · reply within {timeLeft(a.expiresAt).replace(' left', '')}</small></div>
              <div className="admin-actions">
                <button type="button" className="btn btn-small" data-testid={`button-decline-app-${a.id}`} disabled={busy === a.id} onClick={() => void decide(a.id, 'decline')}><X size={14} /> Decline</button>
                <button type="button" className="btn btn-small btn-primary" data-testid={`button-accept-app-${a.id}`} disabled={busy === a.id || open <= 0 || c.status !== 'live'} onClick={() => void decide(a.id, 'accept')}><Check size={14} /> Accept</button>
              </div>
            </div>
          ))}
          <p className="wallet-footnote" style={{ margin: '10px 20px 14px' }}>If you do not reply within 24 hours the application expires.</p>
        </section>
      )}

      <section className="surface wallet-list" data-testid="campaign-tasks">
        <div className="surface-head"><h2>Tasks</h2></div>
        {data.assignments.length === 0 ? <p className="wallet-empty">No one has been accepted yet.</p> : data.assignments.map((t) => (
          <div className="wallet-row" key={t.id} data-testid={`task-${t.id}`}>
            <div className="wallet-row-main">
              <strong>{t.workerName}</strong>
              <small>{t.status === 'assigned' ? `Due ${timeLeft(t.dueAt)}` : t.status === 'submitted' || t.status === 'resubmitted' ? `Review ${timeLeft(t.reviewDueAt)}` : t.status === 'correction_requested' ? `Correction ${timeLeft(t.correctionDueAt)}` : taskStatusLabel[t.status]}</small>
            </div>
            <span className={`pill pill-task-${t.status}`}>{taskStatusLabel[t.status]}</span>
            <Link className={`btn btn-small${t.status === 'submitted' || t.status === 'resubmitted' ? ' btn-primary' : ''}`} href={`/tasks/${t.id}`} data-testid={`link-task-${t.id}`}>{t.status === 'submitted' || t.status === 'resubmitted' ? 'Review work' : 'Open'}</Link>
          </div>
        ))}
      </section>

      {others.length > 0 && (
        <section className="surface wallet-list">
          <div className="surface-head"><h2>Earlier applications</h2></div>
          {others.map((a) => <div className="wallet-row" key={a.id}><div className="wallet-row-main"><strong>{a.workerName}</strong><small>{formatWhen(a.createdAt)}</small></div><span className="pill">{a.status}</span></div>)}
        </section>
      )}

      {closable && (
        <section className="surface wallet-panel" style={{ marginTop: 16 }}>
          <div className="surface-head"><h2>Close this campaign</h2></div>
          {confirmClose ? (
            <div>
              <p className="wallet-help">Close it? The {open} unassigned {open === 1 ? 'spot is' : 'spots are'} refunded to your wallet ({gh(open * (c.reward + c.fee))}). Tasks already in progress carry on and get paid when you approve them.</p>
              <div className="wallet-actions"><button type="button" className="btn btn-danger" data-testid="button-confirm-close" onClick={() => void closeCampaign()}>Yes, close it</button><button type="button" className="btn" onClick={() => setConfirmClose(false)}>Keep it open</button></div>
            </div>
          ) : (
            <div><p className="wallet-help">Stop taking applications and get your money back for every spot nobody is working on.</p><button type="button" className="btn" data-testid="button-close-campaign" onClick={() => setConfirmClose(true)}>Close campaign</button></div>
          )}
        </section>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useRoute } from 'wouter';
import { gh } from '@/lib/data';
import { api, formatWhen, taskStatusLabel, timeLeft, type TaskDetail } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';

const eventLabel: Record<string, string> = {
  assigned: 'Application accepted', submitted: 'Work submitted', resubmitted: 'Corrected work submitted', approved: 'Work approved',
  auto_approved: 'Approved automatically', correction_requested: 'Correction requested', expired: 'Deadline missed',
  dispute_opened: 'Dispute opened', dispute_resolved: 'Dispute decided',
};

export function TaskPage() {
  const [, params] = useRoute('/tasks/:id');
  const id = Number(params?.id);
  const [data, setData] = useState<TaskDetail | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'none' | 'correction' | 'dispute'>('none');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 3200); };

  const load = useCallback(async () => {
    try { setData(await api<TaskDetail>(`/assignments/${id}`)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load this task.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!data) {
    return <AppShell title="Task"><Header eyebrow="Task" title="Task." description="" />{error ? <div className="notice" role="alert">{error}</div> : <p className="auth-caption" role="status">Loading…</p>}</AppShell>;
  }
  const { assignment: a, role, submissions, events, dispute } = data;
  const isWorker = role === 'worker';
  const canSubmit = isWorker && (a.status === 'assigned' || a.status === 'correction_requested');
  const canReview = !isWorker && (a.status === 'submitted' || a.status === 'resubmitted');
  const canDispute = !dispute && (a.status === 'submitted' || a.status === 'resubmitted' || a.status === 'correction_requested');
  const refreshed = async (text: string) => { notify(text); setMode('none'); setReason(''); setLink(''); setNote(''); setFormError(''); window.dispatchEvent(new Event('hustla-notifications')); await load(); };

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true); setFormError('');
    try { await fn(); await refreshed(okText); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Something went wrong.'); await load(); }
    finally { setBusy(false); }
  };
  const submitWork = (e: FormEvent) => { e.preventDefault(); void run(() => api(`/assignments/${id}/submit`, { body: { link, note } }), 'Work sent. The publisher has been told.'); };
  const approve = () => void run(() => api(`/assignments/${id}/review`, { body: { action: 'approve' } }), 'Approved. The worker has been paid.');
  const askCorrection = (e: FormEvent) => { e.preventDefault(); void run(() => api(`/assignments/${id}/review`, { body: { action: 'correction', reason } }), 'Correction requested. The worker has 48 hours.'); };
  const openDispute = (e: FormEvent) => { e.preventDefault(); void run(() => api(`/assignments/${id}/dispute`, { body: { reason } }), 'Dispute opened. The money is on hold while HUSTLA reviews it.'); };
  const sendMessage = (e: FormEvent) => { e.preventDefault(); if (!dispute) return; void run(async () => { await api(`/disputes/${dispute.id}/messages`, { body: { body: message } }); setMessage(''); }, 'Message added.'); };

  const deadlineLine = a.status === 'assigned' ? `Deliver ${timeLeft(a.dueAt)} (by ${formatWhen(a.dueAt)})`
    : a.status === 'correction_requested' ? `Resubmit ${timeLeft(a.correctionDueAt)}`
    : (a.status === 'submitted' || a.status === 'resubmitted') ? `Review ${timeLeft(a.reviewDueAt)}. After that it is approved automatically.`
    : '';

  return (
    <AppShell title="Task">
      <Header eyebrow={isWorker ? 'Your task' : `Worker: ${a.workerName}`} title={a.title} description={`${a.category} · ${gh(a.reward)} reward`} action={<Link className="btn" href={isWorker ? '/dashboard' : `/campaigns/${a.campaignId}`} data-testid="link-task-back">Back</Link>} />
      <div className="task-status-bar" data-testid="task-status">
        <span className={`pill pill-task-${a.status}`}>{taskStatusLabel[a.status]}</span>
        {deadlineLine && <span className="task-deadline" data-testid="task-deadline">{deadlineLine}</span>}
        {a.status === 'completed' && <span className="task-deadline">{a.settled === 'split' ? 'Settled by HUSTLA with a split' : isWorker ? `${gh(a.reward)} was added to your wallet` : 'The worker has been paid'}</span>}
        {a.status === 'cancelled' && <span className="task-deadline">The money went back to the publisher</span>}
      </div>

      <section className="surface wallet-panel">
        <div className="surface-head"><h2>The brief</h2></div>
        <p className="wallet-help" style={{ whiteSpace: 'pre-wrap' }}>{a.description}</p>
        <p className="wallet-help"><strong>Deliver:</strong> {a.deliverable}</p>
        <p className="wallet-help"><strong>Judged on:</strong> {a.criteria}</p>
        <p className="wallet-help">The scope, reward and deadline are fixed now that the task is accepted.</p>
      </section>

      {a.status === 'correction_requested' && a.correctionReason && (
        <div className="notice" role="alert" data-testid="correction-reason"><strong>Correction requested:</strong> {a.correctionReason}</div>
      )}

      {submissions.length > 0 && (
        <section className="surface wallet-list" data-testid="submissions">
          <div className="surface-head"><h2>Submitted work</h2></div>
          {submissions.map((s) => (
            <div className="wallet-row" key={s.round}>
              <div className="wallet-row-main">
                <strong>{s.round === 1 ? 'First submission' : 'Corrected submission'}</strong>
                {s.link && <small><a href={s.link} target="_blank" rel="noopener noreferrer nofollow" data-testid={`submission-link-${s.round}`}>{s.link}</a></small>}
                {s.note && <small style={{ whiteSpace: 'pre-wrap' }}>{s.note}</small>}
                <small>{formatWhen(s.createdAt)}</small>
              </div>
            </div>
          ))}
        </section>
      )}

      {canSubmit && (
        <section className="surface wallet-panel" data-testid="submit-panel">
          <div className="surface-head"><h2>{a.status === 'correction_requested' ? 'Send the corrected work' : 'Submit your work'}</h2></div>
          <form onSubmit={submitWork} className="wallet-form">
            <label htmlFor="task-link" className="auth-label">Link to your work</label>
            <input id="task-link" className="field" data-testid="input-task-link" type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} />
            <label htmlFor="task-note" className="auth-label">Note (optional if you added a link)</label>
            <textarea id="task-note" className="field" data-testid="input-task-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Anything the publisher should know. You can paste text here too." />
            <p className="wallet-help">Only send genuine, original work with truthful proof. {a.status === 'assigned' ? 'The publisher then has 48 hours to review it.' : 'This is the one correction round, so the publisher has 24 hours to approve it or open a dispute.'}</p>
            {formError && <div className="notice" role="alert">{formError}</div>}
            <button type="submit" className="btn btn-primary" data-testid="button-submit-work" disabled={busy}>{busy ? 'Sending…' : 'Send work'}</button>
          </form>
        </section>
      )}

      {canReview && (
        <section className="surface wallet-panel" data-testid="review-panel">
          <div className="surface-head"><h2>Your decision</h2></div>
          <p className="wallet-help">Approve it to pay {gh(a.reward)} to the worker. {a.correctionUsed ? 'The one correction round has been used, so you can approve it or open a dispute.' : 'If it misses something in the brief, you can ask for one correction.'}</p>
          {mode === 'correction' ? (
            <form onSubmit={askCorrection} className="wallet-form">
              <label htmlFor="task-correction" className="auth-label">What exactly needs to change?</label>
              <textarea id="task-correction" className="field" data-testid="input-correction-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Point to what the brief asked for and what is missing. Do not add new requirements." maxLength={1000} />
              {formError && <div className="notice" role="alert">{formError}</div>}
              <div className="wallet-actions"><button type="submit" className="btn btn-primary" data-testid="button-send-correction" disabled={busy}>Send correction request</button><button type="button" className="btn" onClick={() => setMode('none')}>Back</button></div>
            </form>
          ) : (
            <>
              {formError && mode === 'none' && <div className="notice" role="alert">{formError}</div>}
              <div className="wallet-actions">
                <button type="button" className="btn btn-primary" data-testid="button-approve-work" disabled={busy} onClick={approve}>Approve and pay</button>
                {!a.correctionUsed && a.status === 'submitted' && <button type="button" className="btn" data-testid="button-ask-correction" onClick={() => { setMode('correction'); setFormError(''); }}>Ask for a correction</button>}
                {canDispute && <button type="button" className="btn" data-testid="button-open-dispute" onClick={() => { setMode('dispute'); setFormError(''); }}>Open a dispute</button>}
              </div>
            </>
          )}
        </section>
      )}

      {canDispute && !canReview && (
        <section className="surface wallet-panel">
          <div className="surface-head"><h2>Something wrong?</h2></div>
          <p className="wallet-help">If you cannot agree, open a dispute. The money for this task is held and HUSTLA decides, aiming for 3 business days.</p>
          {mode !== 'dispute' && <button type="button" className="btn" data-testid="button-open-dispute" onClick={() => { setMode('dispute'); setFormError(''); }}>Open a dispute</button>}
        </section>
      )}
      {mode === 'dispute' && canDispute && (
        <section className="surface wallet-panel" data-testid="dispute-form">
          <div className="surface-head"><h2>Open a dispute</h2></div>
          <form onSubmit={openDispute} className="wallet-form">
            <label htmlFor="task-dispute" className="auth-label">What went wrong?</label>
            <textarea id="task-dispute" className="field" data-testid="input-dispute-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain clearly. You can add evidence and replies on the next screen." maxLength={1000} />
            {formError && <div className="notice" role="alert">{formError}</div>}
            <div className="wallet-actions"><button type="submit" className="btn btn-danger" data-testid="button-submit-dispute" disabled={busy}>Open dispute</button><button type="button" className="btn" onClick={() => setMode('none')}>Cancel</button></div>
          </form>
        </section>
      )}

      {dispute && (
        <section className="surface wallet-panel" data-testid="dispute-panel">
          <div className="surface-head"><h2>Dispute</h2><span className={`pill ${dispute.status === 'open' ? 'pill-pending_review' : 'pill-live'}`}>{dispute.status === 'open' ? 'Open: money on hold' : 'Decided'}</span></div>
          <p className="wallet-help"><strong>{dispute.openedByName}</strong> opened it: {dispute.reason}</p>
          {dispute.messages.length > 0 && (
            <div className="dispute-thread" data-testid="dispute-messages">
              {dispute.messages.map((m) => <div key={m.id} className={`bubble${m.mine ? ' mine' : ''}`}><strong>{m.mine ? 'You' : m.name}</strong><p>{m.body}</p><small>{formatWhen(m.createdAt)}</small></div>)}
            </div>
          )}
          {dispute.status === 'open' ? (
            <form onSubmit={sendMessage} className="wallet-form">
              <label htmlFor="dispute-message" className="auth-label">Add your side or evidence</label>
              <textarea id="dispute-message" className="field" data-testid="input-dispute-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} />
              {formError && mode === 'none' && <div className="notice" role="alert">{formError}</div>}
              <button type="submit" className="btn btn-small btn-primary" data-testid="button-send-message" disabled={busy || message.trim().length < 2}>Send</button>
            </form>
          ) : (
            <div className="admin-note" data-testid="dispute-decision">
              <p><strong>HUSTLA's decision:</strong> {dispute.decision === 'release' ? 'The full reward was released to the worker.' : dispute.decision === 'refund' ? 'The money was returned to the publisher.' : `The worker received ${gh(dispute.workerAmount ?? 0)} and the rest went back to the publisher.`} {dispute.adminNote}</p>
            </div>
          )}
        </section>
      )}

      <section className="surface wallet-list" data-testid="timeline">
        <div className="surface-head"><h2>History</h2></div>
        {events.length === 0 ? <p className="wallet-empty">Nothing yet.</p> : events.map((e, i) => (
          <div className="wallet-row" key={i}>
            <div className="wallet-row-main"><strong>{eventLabel[e.event] ?? e.event}</strong><small>{e.actorName} · {formatWhen(e.createdAt)}{e.note ? ` · ${e.note}` : ''}</small></div>
          </div>
        ))}
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

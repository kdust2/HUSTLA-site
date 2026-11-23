import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Redirect } from 'wouter';
import { Check, Copy, KeyRound, Landmark, MessageCircle, Scale, Search, Users, X } from 'lucide-react';
import { gh } from '@/lib/data';
import {
  api, formatDay, formatMomo, networkLabel, statusLabel, timeAgo,
  formatWhen, type AdminDeposit, type AdminDispute, type AdminDisputeDetail, type AdminPayoutMethod, type AdminSummary, type AdminUser, type AdminWithdrawal, type ApiCampaign, type CampaignStatus,
  type ResetRequest, type ResetStatus, type WithdrawalStatus,
} from '@/lib/api';
import { AppShell, Header } from '@/components/layout';
import { useAuth } from '@/lib/auth';

type Tab = 'campaigns' | 'members' | 'resets' | 'payouts' | 'disputes';
const withdrawalFilters: { value: WithdrawalStatus; label: string }[] = [
  { value: 'requested', label: 'To pay' }, { value: 'paid', label: 'Paid' }, { value: 'rejected', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' },
];
const creditKinds = [
  { value: 'deposit', label: 'Deposit (available funds)' },
  { value: 'earning', label: 'Earnings (withdrawable)' },
  { value: 'pending', label: 'Pending earnings' },
  { value: 'release', label: 'Release pending → withdrawable' },
];
type Filter = CampaignStatus | 'all';

const campaignFilters: { value: Filter; label: string }[] = [
  { value: 'pending_review', label: 'Awaiting review' },
  { value: 'live', label: 'Live' },
  { value: 'declined', label: 'Declined' },
  { value: 'all', label: 'All' },
];
const resetLabel: Record<ResetStatus, string> = {
  waiting: 'Needs a link', link_ready: 'Link sent', expired: 'Link expired', done: 'Reset done', dismissed: 'Dismissed',
};
const initials = (name: string) => name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [filter, setFilter] = useState<Filter>('pending_review');
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [resets, setResets] = useState<ResetRequest[]>([]);
  const [wdFilter, setWdFilter] = useState<WithdrawalStatus>('requested');
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [methods, setMethods] = useState<AdminPayoutMethod[]>([]);
  const [panel, setPanel] = useState<{ id: number; mode: 'pay' | 'reject' } | null>(null);
  const [panelText, setPanelText] = useState('');
  const [credit, setCredit] = useState({ email: '', kind: 'earning', amount: '', note: '' });
  const [crediting, setCrediting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<number | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [depPanel, setDepPanel] = useState<{ id: number; mode: 'reject' } | null>(null);
  const [depNote, setDepNote] = useState('');
  const [instructions, setInstructions] = useState('');
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [disputeFilter, setDisputeFilter] = useState<'open' | 'resolved'>('open');
  const [openDispute, setOpenDispute] = useState<number | null>(null);
  const [disputeDetail, setDisputeDetail] = useState<AdminDisputeDetail | null>(null);
  const [resolve, setResolve] = useState({ decision: 'release', amount: '', note: '' });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [links, setLinks] = useState<Record<number, { link: string; name: string; expiresAt: string }>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const isAdmin = !!user?.isAdmin;
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const loadSummary = useCallback(async () => {
    try { setSummary(await api<AdminSummary>('/admin/summary')); } catch { /* the tab below shows any real error */ }
  }, []);

  const loadTab = useCallback(async (which: Tab, status: Filter, wd: WithdrawalStatus = 'requested') => {
    setLoading(true);
    try {
      if (which === 'campaigns') setCampaigns((await api<{ campaigns: ApiCampaign[] }>(`/admin/campaigns?status=${status}`)).campaigns);
      if (which === 'members') setMembers((await api<{ users: AdminUser[] }>('/admin/users')).users);
      if (which === 'resets') setResets((await api<{ requests: ResetRequest[] }>('/admin/resets')).requests);
      if (which === 'payouts') {
        const [w, m] = await Promise.all([
          api<{ withdrawals: AdminWithdrawal[] }>(`/admin/withdrawals?status=${wd}`),
          api<{ methods: AdminPayoutMethod[] }>('/admin/payout-methods'),
        ]);
        setWithdrawals(w.withdrawals);
        setMethods(m.methods);
        const [dep, set] = await Promise.all([
          api<{ deposits: AdminDeposit[] }>('/admin/deposits?status=requested'),
          api<{ depositInstructions: string }>('/admin/settings'),
        ]);
        setDeposits(dep.deposits);
        setInstructions(set.depositInstructions);
      }
      if (which === 'disputes') setDisputes((await api<{ disputes: AdminDispute[] }>(`/admin/disputes?status=${disputeFilter}`)).disputes);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this section.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) void loadSummary(); }, [isAdmin, loadSummary]);
  useEffect(() => { if (isAdmin) void loadTab(tab, filter, wdFilter); }, [isAdmin, tab, filter, wdFilter, disputeFilter, loadTab]);

  const needle = query.trim().toLowerCase();
  const shownCampaigns = useMemo(() => campaigns.filter((c) =>
    !needle || `${c.title} ${c.category} ${c.ownerName ?? ''} ${c.ownerEmail ?? ''}`.toLowerCase().includes(needle)), [campaigns, needle]);
  const shownMembers = useMemo(() => members.filter((m) =>
    !needle || `${m.name} ${m.email}`.toLowerCase().includes(needle)), [members, needle]);

  if (!isAdmin) return <Redirect to="/dashboard" />;

  const openTab = (next: Tab, nextFilter?: Filter) => {
    setQuery('');
    setTab(next);
    if (nextFilter) setFilter(nextFilter);
  };

  const review = async (id: number, decision: 'approve' | 'decline', note?: string) => {
    if (decision === 'decline' && (note ?? '').trim().length < 3) { notify('Give the publisher a reason (at least 3 characters).'); return; }
    setBusyId(id);
    try {
      await api(`/admin/campaigns/${id}/review`, { body: { decision, note } });
      notify(decision === 'approve' ? 'Approved. The campaign is live now.' : 'Campaign declined. The publisher has their money back.');
      setConfirmDecline(null);
      setDeclineNote('');
      await Promise.all([loadTab('campaigns', filter), loadSummary()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save that decision.');
    } finally {
      setBusyId(null);
    }
  };

  const createLink = async (request: ResetRequest) => {
    setBusyId(request.id);
    try {
      const data = await api<{ link: string; expiresAt: string }>(`/admin/resets/${request.id}/link`, { method: 'POST', body: {} });
      setLinks((prev) => ({ ...prev, [request.id]: { link: data.link, name: request.name, expiresAt: data.expiresAt } }));
      await Promise.all([loadTab('resets', filter), loadSummary()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create a reset link.');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (request: ResetRequest) => {
    setBusyId(request.id);
    try {
      await api(`/admin/resets/${request.id}/dismiss`, { method: 'POST', body: {} });
      setLinks((prev) => { const next = { ...prev }; delete next[request.id]; return next; });
      notify('Request dismissed.');
      await Promise.all([loadTab('resets', filter), loadSummary()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not dismiss that request.');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (id: number, link: string) => {
    try { await navigator.clipboard.writeText(link); setCopied(id); window.setTimeout(() => setCopied(null), 2000); }
    catch { notify('Could not copy. Select the link and copy it by hand.'); }
  };

  const refreshPayouts = async () => { await Promise.all([loadTab('payouts', filter, wdFilter), loadSummary()]); };

  const settleWithdrawal = async (w: AdminWithdrawal, mode: 'pay' | 'reject') => {
    if (mode === 'reject' && panelText.trim().length < 3) { notify('Give the member a reason (at least 3 characters).'); return; }
    setBusyId(w.id);
    try {
      await api(`/admin/withdrawals/${w.id}/${mode === 'pay' ? 'paid' : 'reject'}`, { body: mode === 'pay' ? { reference: panelText.trim() } : { reason: panelText.trim() } });
      notify(mode === 'pay' ? 'Marked as paid.' : 'Rejected. The money is back in their wallet.');
      setPanel(null);
      setPanelText('');
      await refreshPayouts();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save that.');
      await refreshPayouts();
    } finally {
      setBusyId(null);
    }
  };

  const verifyMethod = async (m: AdminPayoutMethod) => {
    setBusyId(m.userId);
    try {
      await api(`/admin/payout-methods/${m.userId}/verify`, { method: 'POST', body: {} });
      notify(`${m.name}'s number is verified.`);
      await refreshPayouts();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not verify that number.');
    } finally {
      setBusyId(null);
    }
  };

  const submitCredit = async (event: FormEvent) => {
    event.preventDefault();
    setCrediting(true);
    try {
      const data = await api<{ name: string }>('/admin/wallet/credit', { body: { email: credit.email.trim(), kind: credit.kind, amount: Number(credit.amount), note: credit.note.trim() } });
      notify(`Done. ${data.name}'s wallet is updated.`);
      setCredit({ ...credit, amount: '', note: '' });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update that wallet.');
    } finally {
      setCrediting(false);
    }
  };

  const settleDeposit = async (d: AdminDeposit, mode: 'confirm' | 'reject') => {
    if (mode === 'reject' && depNote.trim().length < 3) { notify('Give the member a reason (at least 3 characters).'); return; }
    setBusyId(d.id);
    try {
      await api(`/admin/deposits/${d.id}/${mode}`, { body: mode === 'reject' ? { note: depNote.trim() } : {} });
      notify(mode === 'confirm' ? `Confirmed. ${gh(d.amount)} added to ${d.name}'s available funds.` : 'Deposit rejected.');
      setDepPanel(null);
      setDepNote('');
      await refreshPayouts();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save that.');
      await refreshPayouts();
    } finally {
      setBusyId(null);
    }
  };

  const saveInstructions = async () => {
    try {
      await api('/admin/settings', { method: 'PUT', body: { depositInstructions: instructions } });
      notify('Payment instructions saved. Members see them in their wallet.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save the instructions.');
    }
  };

  const showDispute = async (id: number) => {
    if (openDispute === id) { setOpenDispute(null); setDisputeDetail(null); return; }
    setOpenDispute(id);
    setDisputeDetail(null);
    setResolve({ decision: 'release', amount: '', note: '' });
    try { setDisputeDetail(await api<AdminDisputeDetail>(`/admin/disputes/${id}`)); }
    catch (err) { notify(err instanceof Error ? err.message : 'Could not load that dispute.'); }
  };

  const decideDispute = async (d: AdminDispute) => {
    setBusyId(d.id);
    try {
      await api(`/admin/disputes/${d.id}/resolve`, { body: { decision: resolve.decision, workerAmount: resolve.decision === 'split' ? Number(resolve.amount) : undefined, note: resolve.note.trim() } });
      notify('Decision saved. Both sides have been told and the money has moved.');
      setOpenDispute(null);
      setDisputeDetail(null);
      await Promise.all([loadTab('disputes', filter), loadSummary()]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save that decision.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBrief = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const stat = (label: string, value: number | undefined, hint: string, onClick: () => void, attention = false) => (
    <button type="button" className={`admin-stat${attention ? ' attn' : ''}`} onClick={onClick} data-testid={`admin-stat-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <span>{label}</span>
      <strong>{value === undefined ? '–' : value}</strong>
      <small>{hint}</small>
    </button>
  );

  return (
    <AppShell title="Admin" showMode={false}>
      <Header eyebrow="Admin" title="Run HUSTLA." description="Review campaigns, look after your members and help people back into their accounts." />

      <div className="admin-stats">
        {stat('Awaiting review', summary?.pending, summary?.pending ? 'Needs your decision' : 'All caught up', () => openTab('campaigns', 'pending_review'), !!summary?.pending)}
        {stat('Live campaigns', summary?.live, 'Visible to workers', () => openTab('campaigns', 'live'))}
        {stat('Members', summary?.users, 'Signed-up accounts', () => openTab('members'))}
        {stat('Disputes', summary?.disputes, summary?.disputes ? 'Money is on hold' : 'None open', () => openTab('disputes'), !!summary?.disputes)}
        {stat('Payouts', summary?.withdrawals, summary?.unverified ? `${summary.unverified} ${summary.unverified === 1 ? 'number' : 'numbers'} to verify` : summary?.withdrawals ? 'Waiting to be paid' : 'Nothing to pay', () => openTab('payouts'), !!(summary?.withdrawals || summary?.unverified))}
        {stat('Password resets', summary?.resets, summary?.resets ? 'People waiting for help' : 'None open', () => openTab('resets'), !!summary?.resets)}
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button type="button" role="tab" aria-selected={tab === 'campaigns'} className={tab === 'campaigns' ? 'on' : ''} data-testid="admin-tab-campaigns" onClick={() => openTab('campaigns')}>Campaigns</button>
        <button type="button" role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'on' : ''} data-testid="admin-tab-members" onClick={() => openTab('members')}>Members</button>
        <button type="button" role="tab" aria-selected={tab === 'payouts'} className={tab === 'payouts' ? 'on' : ''} data-testid="admin-tab-payouts" onClick={() => openTab('payouts')}>
          Payouts{summary && summary.withdrawals + summary.unverified + summary.deposits > 0 ? <em className="admin-badge">{summary.withdrawals + summary.unverified + summary.deposits}</em> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'disputes'} className={tab === 'disputes' ? 'on' : ''} data-testid="admin-tab-disputes" onClick={() => openTab('disputes')}>
          Disputes{summary?.disputes ? <em className="admin-badge">{summary.disputes}</em> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'resets'} className={tab === 'resets' ? 'on' : ''} data-testid="admin-tab-resets" onClick={() => openTab('resets')}>
          Password resets{summary?.resets ? <em className="admin-badge">{summary.resets}</em> : null}
        </button>
      </div>

      {(tab === 'campaigns' || tab === 'members') && (
        <div className="admin-toolbar">
          {tab === 'campaigns' && (
            <div className="chips admin-filter" role="group" aria-label="Filter campaigns">
              {campaignFilters.map((item) => (
                <button key={item.value} type="button" className={`chip ${filter === item.value ? 'on' : ''}`} aria-pressed={filter === item.value} data-testid={`chip-admin-${item.value}`} onClick={() => setFilter(item.value)}>
                  {item.label}{item.value === 'pending_review' && summary?.pending ? ` (${summary.pending})` : ''}
                </button>
              ))}
            </div>
          )}
          <label className="admin-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search</span>
            <input className="field" data-testid="input-admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === 'campaigns' ? 'Search title, category or publisher' : 'Search name or email'} />
          </label>
        </div>
      )}

      {error && <div className="notice" role="alert">{error}</div>}
      {loading && <p className="auth-caption" role="status">Loading…</p>}

      {!loading && !error && tab === 'campaigns' && (
        shownCampaigns.length === 0 ? (
          <div className="empty-state"><h2>Nothing here</h2><p>{needle ? 'No campaigns match your search.' : filter === 'pending_review' ? 'No campaigns are waiting for review.' : 'No campaigns in this view yet.'}</p></div>
        ) : (
          <div className="admin-cards">
            {shownCampaigns.map((c) => {
              const open = expanded.has(c.id);
              const long = c.description.length > 180;
              return (
                <article className="admin-card" key={c.id} data-testid={`admin-campaign-${c.id}`}>
                  <div className="admin-card-top">
                    <span className="category">{c.category}</span>
                    <span className={`pill pill-${c.status}`}>{statusLabel[c.status]}</span>
                    <span className="admin-when">{timeAgo(c.createdAt)}</span>
                  </div>
                  <h3>{c.title}</h3>
                  <p className={`admin-brief${open || !long ? '' : ' clamp'}`}>{c.description}</p>
                  {long && <button type="button" className="admin-link" onClick={() => toggleBrief(c.id)}>{open ? 'Show less' : 'Read full brief'}</button>}
                  {c.deliverable && <p className="admin-brief"><strong>Deliverable:</strong> {c.deliverable}</p>}
                  {c.criteria && <p className="admin-brief"><strong>Judged on:</strong> {c.criteria}</p>}
                  <dl className="admin-facts">
                    <div><dt>Tasks</dt><dd>{c.quantity}</dd></div>
                    <div><dt>Reward each</dt><dd>{gh(c.reward)}</dd></div>
                    <div><dt>{c.funded ? 'Funded (with fee)' : 'Budget'}</dt><dd data-testid={`admin-budget-${c.id}`}>{gh(c.budget)}</dd></div>
                    <div><dt>Days to finish</dt><dd>{c.days}</dd></div>
                  </dl>
                  {!c.funded && <p className="admin-hint warn" style={{ paddingLeft: 0 }}>This campaign was created before funding was required, so no money is reserved for it.</p>}
                  {!!c.reportCount && <p className="admin-hint warn" style={{ paddingLeft: 0 }} data-testid={`admin-reports-${c.id}`}>Reported by {c.reportCount} {c.reportCount === 1 ? 'member' : 'members'}</p>}
                  <div className="admin-card-foot">
                    <div className="admin-person">
                      <span className="avatar" aria-hidden="true">{initials(c.ownerName ?? '')}</span>
                      <span><strong>{c.ownerName}</strong><small>{c.ownerEmail}</small></span>
                    </div>
                    {c.status === 'pending_review' && (confirmDecline === c.id ? (
                      <div className="admin-actions admin-decline" role="group" aria-label="Confirm decline">
                        <input className="field" data-testid={`input-decline-note-${c.id}`} placeholder="Reason for the publisher (required)" value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} maxLength={300} />
                        <button type="button" className="btn btn-small" data-testid={`button-cancel-decline-${c.id}`} disabled={busyId === c.id} onClick={() => { setConfirmDecline(null); setDeclineNote(''); }}>Keep</button>
                        <button type="button" className="btn btn-small btn-danger" data-testid={`button-confirm-decline-${c.id}`} disabled={busyId === c.id} onClick={() => void review(c.id, 'decline', declineNote)}>Yes, decline</button>
                      </div>
                    ) : (
                      <div className="admin-actions">
                        <button type="button" className="btn btn-small" data-testid={`button-decline-${c.id}`} disabled={busyId === c.id} onClick={() => { setConfirmDecline(c.id); setDeclineNote(''); }}><X size={14} /> Decline</button>
                        <button type="button" className="btn btn-small btn-primary" data-testid={`button-approve-${c.id}`} disabled={busyId === c.id} onClick={() => void review(c.id, 'approve')}><Check size={14} /> Approve</button>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {!loading && !error && tab === 'members' && (
        shownMembers.length === 0 ? (
          <div className="empty-state"><Users size={26} /><h2>{needle ? 'No members match' : 'No members yet'}</h2><p>{needle ? 'Try a different name or email.' : 'Accounts show up here as people sign up.'}</p></div>
        ) : (
          <section className="surface">
            {shownMembers.map((m) => (
              <div className="admin-row" key={m.id} data-testid={`admin-member-${m.id}`}>
                <div className="admin-person">
                  <span className="avatar" aria-hidden="true">{initials(m.name)}</span>
                  <span><strong>{m.name}{m.isAdmin && <em className="admin-tag">Admin</em>}</strong><small>{m.email}</small></span>
                </div>
                <div className="admin-row-meta">
                  <span>{m.campaigns} {m.campaigns === 1 ? 'campaign' : 'campaigns'}</span>
                  <span>{m.applications} {m.applications === 1 ? 'application' : 'applications'}</span>
                  <span>Joined {timeAgo(m.createdAt)}</span>
                </div>
              </div>
            ))}
          </section>
        )
      )}

      {!loading && !error && tab === 'resets' && (
        <>
          <div className="admin-note">
            <KeyRound size={18} aria-hidden="true" />
            <p>{summary?.emailEnabled
              ? 'Reset emails are sent automatically. People who did not get one will appear here so you can send a link yourself.'
              : 'Email is not set up yet, so you send the reset links. Make sure it really is the person before you share a link, then send it to them by WhatsApp or text. Links work once and expire after 24 hours.'}</p>
          </div>
          {resets.length === 0 ? (
            <div className="empty-state"><KeyRound size={26} /><h2>No reset requests</h2><p>When someone taps “Forgot password?”, they show up here.</p></div>
          ) : (
            <section className="surface">
              {resets.map((r) => {
                const isOpen = r.status === 'waiting' || r.status === 'link_ready' || r.status === 'expired';
                const created = links[r.id];
                return (
                  <div className="admin-reset" key={r.id} data-testid={`admin-reset-${r.id}`}>
                    <div className="admin-row">
                      <div className="admin-person">
                        <span className="avatar" aria-hidden="true">{initials(r.name)}</span>
                        <span><strong>{r.name}{r.isAdmin && <em className="admin-tag">Admin</em>}</strong><small>{r.email} · asked {timeAgo(r.createdAt)}</small></span>
                      </div>
                      <div className="admin-actions">
                        <span className={`pill pill-reset-${r.status}`}>{resetLabel[r.status]}</span>
                        {isOpen && !r.isAdmin && <button type="button" className="btn btn-small btn-primary" data-testid={`button-reset-link-${r.id}`} disabled={busyId === r.id} onClick={() => void createLink(r)}>{r.status === 'waiting' ? 'Create reset link' : 'New link'}</button>}
                        {isOpen && <button type="button" className="btn btn-small" data-testid={`button-reset-dismiss-${r.id}`} disabled={busyId === r.id} onClick={() => void dismiss(r)}>Dismiss</button>}
                      </div>
                    </div>
                    {isOpen && r.isAdmin && <p className="admin-hint">Admin accounts do not use links. Reset at <strong>/reset-password?admin=1</strong> with your admin setup code.</p>}
                    {created && (
                      <div className="admin-linkbox">
                        <label htmlFor={`reset-link-${r.id}`}>Reset link for {created.name}</label>
                        <div className="admin-linkrow">
                          <input id={`reset-link-${r.id}`} className="field" readOnly value={created.link} onFocus={(e) => e.currentTarget.select()} data-testid={`input-reset-link-${r.id}`} />
                          <button type="button" className="btn btn-small" data-testid={`button-copy-link-${r.id}`} onClick={() => void copyLink(r.id, created.link)}>{copied === r.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
                          <a className="btn btn-small btn-warm" target="_blank" rel="noopener noreferrer" data-testid={`link-whatsapp-${r.id}`}
                            href={`https://wa.me/?text=${encodeURIComponent(`Hi ${created.name}, here is your HUSTLA password reset link. It works once and expires in 24 hours: ${created.link}`)}`}><MessageCircle size={14} /> WhatsApp</a>
                        </div>
                        <small>Only send this to {created.name}. It expires {new Date(created.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</small>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {!loading && !error && tab === 'disputes' && (
        <>
          <div className="admin-note">
            <Scale size={18} aria-hidden="true" />
            <p>The money for a disputed task is already on hold. Read both sides, then decide: release it to the worker, refund the publisher, or split it. Aim to decide within 3 business days.</p>
          </div>
          <div className="chips admin-filter" role="group" aria-label="Filter disputes">
            {(['open', 'resolved'] as const).map((f) => <button key={f} type="button" className={`chip ${disputeFilter === f ? 'on' : ''}`} aria-pressed={disputeFilter === f} data-testid={`chip-dispute-${f}`} onClick={() => { setOpenDispute(null); setDisputeFilter(f); }}>{f === 'open' ? 'Open' : 'Decided'}</button>)}
          </div>
          {disputes.length === 0 ? (
            <div className="empty-state"><Scale size={26} /><h2>Nothing here</h2><p>{disputeFilter === 'open' ? 'No disputes are waiting for a decision.' : 'No disputes have been decided yet.'}</p></div>
          ) : (
            <section className="surface">
              {disputes.map((d) => (
                <div className="admin-reset" key={d.id} data-testid={`admin-dispute-${d.id}`}>
                  <div className="admin-row">
                    <div className="admin-person"><span className="avatar" aria-hidden="true">{initials(d.title)}</span><span><strong>{d.title}</strong><small>{d.workerName} (worker) vs {d.publisherName} (publisher) · {gh(d.reward)}</small></span></div>
                    <div className="admin-row-meta"><span>Opened by {d.openedByName}</span><span>{d.messages} {d.messages === 1 ? 'message' : 'messages'}</span><span>{timeAgo(d.createdAt)}</span></div>
                    <div className="admin-actions"><button type="button" className="btn btn-small btn-primary" data-testid={`button-view-dispute-${d.id}`} onClick={() => void showDispute(d.id)}>{openDispute === d.id ? 'Close' : d.status === 'open' ? 'Review' : 'View'}</button></div>
                  </div>
                  {openDispute === d.id && (
                    <div className="admin-linkbox" data-testid={`dispute-detail-${d.id}`}>
                      {!disputeDetail ? <p className="wallet-help">Loading…</p> : (
                        <>
                          <p className="wallet-help" style={{ marginTop: 0 }}><strong>Reason:</strong> {disputeDetail.dispute.reason}</p>
                          <p className="wallet-help"><strong>The brief:</strong> {disputeDetail.dispute.description}</p>
                          <p className="wallet-help"><strong>Deliverable:</strong> {disputeDetail.dispute.deliverable} · <strong>Judged on:</strong> {disputeDetail.dispute.criteria}</p>
                          {disputeDetail.dispute.correctionReason && <p className="wallet-help"><strong>Correction asked for:</strong> {disputeDetail.dispute.correctionReason}</p>}
                          {disputeDetail.submissions.map((x) => <p className="wallet-help" key={x.round}><strong>{x.round === 1 ? 'Submission' : 'Corrected submission'}:</strong> {x.link ? <a href={x.link} target="_blank" rel="noopener noreferrer nofollow">{x.link}</a> : null} {x.note}</p>)}
                          {disputeDetail.messages.length > 0 && <div className="dispute-thread">{disputeDetail.messages.map((m, i) => <div key={i} className="bubble"><strong>{m.name}</strong><p>{m.body}</p><small>{formatWhen(m.createdAt)}</small></div>)}</div>}
                          {d.status === 'open' ? (
                            <div className="admin-resolve">
                              <div className="network-pick" role="radiogroup" aria-label="Decision">
                                {[['release', 'Pay the worker'], ['refund', 'Refund the publisher'], ['split', 'Split']].map(([value, label]) => (
                                  <button key={value} type="button" role="radio" aria-checked={resolve.decision === value} className={`network${resolve.decision === value ? ' on mtn' : ''}`} data-testid={`decision-${value}`} onClick={() => setResolve({ ...resolve, decision: value })}>{label}</button>
                                ))}
                              </div>
                              {resolve.decision === 'split' && <><label htmlFor="split-amount" className="auth-label">Worker's share (GH₵), less than {gh(d.reward)}</label><input id="split-amount" className="field" data-testid="input-split-amount" inputMode="decimal" value={resolve.amount} onChange={(e) => setResolve({ ...resolve, amount: e.target.value })} /></>}
                              <label htmlFor="resolve-note" className="auth-label">Explanation for both sides (required)</label>
                              <textarea id="resolve-note" className="field" data-testid="input-resolve-note" rows={3} value={resolve.note} onChange={(e) => setResolve({ ...resolve, note: e.target.value })} maxLength={500} />
                              <button type="button" className="btn btn-primary" data-testid="button-resolve-dispute" style={{ marginTop: 12 }} disabled={busyId === d.id || resolve.note.trim().length < 3} onClick={() => void decideDispute(d)}>Save decision</button>
                            </div>
                          ) : <p className="wallet-help"><strong>Decision:</strong> {disputeDetail.dispute.decision} · {disputeDetail.dispute.adminNote}</p>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {!loading && !error && tab === 'payouts' && (
        <>
          <div className="admin-note">
            <Landmark size={18} aria-hidden="true" />
            <p>Withdrawals are paid on Tuesdays and Fridays. Send each one by mobile money, then mark it paid. A rejected withdrawal goes straight back to the member’s wallet.</p>
          </div>

          <h2 className="admin-h">Deposits to confirm</h2>
          {deposits.length === 0 ? (
            <p className="wallet-empty">No deposits are waiting. Check your mobile money account, then confirm each one here.</p>
          ) : (
            <section className="surface" data-testid="admin-deposits">
              {deposits.map((d) => (
                <div className="admin-reset" key={d.id} data-testid={`admin-deposit-${d.id}`}>
                  <div className="admin-row">
                    <div className="admin-person">
                      <span className="avatar" aria-hidden="true">{initials(d.name)}</span>
                      <span><strong>{gh(d.amount)} · {d.name}</strong><small>{d.email}</small></span>
                    </div>
                    <div className="admin-row-meta"><span>Reference: {d.reference}</span><span>{timeAgo(d.createdAt)}</span></div>
                    <div className="admin-actions">
                      <button type="button" className="btn btn-small" data-testid={`button-dep-reject-${d.id}`} disabled={busyId === d.id} onClick={() => { setDepPanel({ id: d.id, mode: 'reject' }); setDepNote(''); }}>Reject</button>
                      <button type="button" className="btn btn-small btn-primary" data-testid={`button-dep-confirm-${d.id}`} disabled={busyId === d.id} onClick={() => void settleDeposit(d, 'confirm')}>Confirm {gh(d.amount)} received</button>
                    </div>
                  </div>
                  {depPanel?.id === d.id && (
                    <div className="admin-linkbox">
                      <label htmlFor={`dep-note-${d.id}`}>Reason for the member (required)</label>
                      <div className="admin-linkrow">
                        <input id={`dep-note-${d.id}`} className="field" data-testid={`input-dep-note-${d.id}`} value={depNote} onChange={(e) => setDepNote(e.target.value)} placeholder="e.g. We did not receive this payment" />
                        <button type="button" className="btn btn-small btn-danger" data-testid={`button-dep-confirm-reject-${d.id}`} disabled={busyId === d.id} onClick={() => void settleDeposit(d, 'reject')}>Confirm reject</button>
                        <button type="button" className="btn btn-small" onClick={() => setDepPanel(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <h2 className="admin-h">Payment instructions for members</h2>
          <div className="surface admin-credit">
            <p className="wallet-help">This text is shown to members in their wallet under “Add funds”. Include your mobile money number and what to use as the reference.</p>
            <textarea className="field" data-testid="input-deposit-instructions" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={800} placeholder="e.g. Send to MoMo 0244 000 000 (HUSTLA). Use your email as the reference." />
            <button type="button" className="btn btn-primary" data-testid="button-save-instructions" style={{ marginTop: 12 }} onClick={() => void saveInstructions()}>Save instructions</button>
            {summary && <p className="wallet-help" style={{ marginTop: 14 }} data-testid="admin-fees">HUSTLA fees earned so far: <strong>{gh(summary.fees)}</strong></p>}
          </div>

          <h2 className="admin-h">Withdrawal requests</h2>
          <div className="chips admin-filter" role="group" aria-label="Filter withdrawals">
            {withdrawalFilters.map((item) => (
              <button key={item.value} type="button" className={`chip ${wdFilter === item.value ? 'on' : ''}`} aria-pressed={wdFilter === item.value} data-testid={`chip-wd-${item.value}`} onClick={() => { setPanel(null); setWdFilter(item.value); }}>{item.label}</button>
            ))}
          </div>
          {wdFilter === 'requested' && withdrawals.length > 0 && (
            <p className="admin-total" data-testid="admin-wd-total">{withdrawals.length} {withdrawals.length === 1 ? 'request' : 'requests'} to pay, {gh(withdrawals.reduce((sum, w) => sum + w.amount, 0))} in total.</p>
          )}
          {withdrawals.length === 0 ? (
            <div className="empty-state"><Landmark size={26} /><h2>Nothing here</h2><p>{wdFilter === 'requested' ? 'No withdrawals are waiting to be paid.' : 'No withdrawals in this view.'}</p></div>
          ) : (
            <section className="surface">
              {withdrawals.map((w) => (
                <div className="admin-reset" key={w.id} data-testid={`admin-withdrawal-${w.id}`}>
                  <div className="admin-row">
                    <div className="admin-person">
                      <span className="avatar" aria-hidden="true">{initials(w.name)}</span>
                      <span><strong>{gh(w.amount)} · {w.name}</strong><small>{w.email}</small></span>
                    </div>
                    <div className="admin-row-meta">
                      <span>{networkLabel[w.network]} {formatMomo(w.number)}</span>
                      <span>{w.accountName}</span>
                      <span>{w.status === 'requested' ? `Pay ${formatDay(w.payoutDate)}` : w.status === 'rejected' && w.reason ? w.reason : w.reference ? `Ref ${w.reference}` : timeAgo(w.processedAt ?? w.createdAt)}</span>
                    </div>
                    {w.status === 'requested' ? (
                      <div className="admin-actions">
                        <button type="button" className="btn btn-small" data-testid={`button-wd-reject-${w.id}`} disabled={busyId === w.id} onClick={() => { setPanel({ id: w.id, mode: 'reject' }); setPanelText(''); }}>Reject</button>
                        <button type="button" className="btn btn-small btn-primary" data-testid={`button-wd-pay-${w.id}`} disabled={busyId === w.id} onClick={() => { setPanel({ id: w.id, mode: 'pay' }); setPanelText(''); }}>Mark paid</button>
                      </div>
                    ) : <span className={`pill pill-wd-${w.status}`}>{w.status === 'paid' ? 'Paid' : w.status === 'rejected' ? 'Rejected' : 'Cancelled'}</span>}
                  </div>
                  {w.status === 'requested' && !w.verified && <p className="admin-hint warn">This number was changed after it was verified. Check it before you pay.</p>}
                  {panel?.id === w.id && (
                    <div className="admin-linkbox">
                      <label htmlFor={`wd-text-${w.id}`}>{panel.mode === 'pay' ? 'Mobile money reference (optional)' : 'Reason for the member (required)'}</label>
                      <div className="admin-linkrow">
                        <input id={`wd-text-${w.id}`} className="field" data-testid={`input-wd-text-${w.id}`} value={panelText} onChange={(e) => setPanelText(e.target.value)} placeholder={panel.mode === 'pay' ? 'e.g. the transaction ID' : 'e.g. The name on the number does not match'} />
                        <button type="button" className={`btn btn-small ${panel.mode === 'pay' ? 'btn-primary' : 'btn-danger'}`} data-testid={`button-wd-confirm-${w.id}`} disabled={busyId === w.id} onClick={() => void settleWithdrawal(w, panel.mode)}>{panel.mode === 'pay' ? `Confirm: I sent ${gh(w.amount)}` : 'Confirm reject'}</button>
                        <button type="button" className="btn btn-small" onClick={() => setPanel(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <h2 className="admin-h">Numbers to verify</h2>
          {methods.length === 0 ? (
            <p className="wallet-empty">Every saved mobile money number is verified.</p>
          ) : (
            <section className="surface">
              {methods.map((m) => (
                <div className="admin-row" key={m.userId} data-testid={`admin-method-${m.userId}`}>
                  <div className="admin-person">
                    <span className="avatar" aria-hidden="true">{initials(m.name)}</span>
                    <span><strong>{m.name}</strong><small>{m.email}</small></span>
                  </div>
                  <div className="admin-row-meta">
                    <span>{networkLabel[m.network]} {formatMomo(m.number)}</span>
                    <span>Name on number: {m.accountName}</span>
                    <span>Added {timeAgo(m.updatedAt)}</span>
                  </div>
                  <div className="admin-actions"><button type="button" className="btn btn-small btn-primary" data-testid={`button-verify-${m.userId}`} disabled={busyId === m.userId} onClick={() => void verifyMethod(m)}><Check size={14} /> Verify</button></div>
                </div>
              ))}
              <p className="admin-hint">Make sure the name on the number matches the member before you verify it.</p>
            </section>
          )}

          <h2 className="admin-h">Add money to a wallet</h2>
          <form className="surface admin-credit" onSubmit={submitCredit}>
            <p className="wallet-help">Use this to record a deposit you have confirmed, or earnings you have approved, until online payments are connected. Every entry is saved in the member’s history.</p>
            <div className="admin-credit-grid">
              <div><label htmlFor="credit-email" className="auth-label">Member’s email</label><input id="credit-email" className="field" data-testid="input-credit-email" type="email" value={credit.email} onChange={(e) => setCredit({ ...credit, email: e.target.value })} required /></div>
              <div><label htmlFor="credit-kind" className="auth-label">What is this?</label>
                <select id="credit-kind" className="field" data-testid="select-credit-kind" value={credit.kind} onChange={(e) => setCredit({ ...credit, kind: e.target.value })}>
                  {creditKinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select></div>
              <div><label htmlFor="credit-amount" className="auth-label">Amount (GH₵)</label><input id="credit-amount" className="field" data-testid="input-credit-amount" inputMode="decimal" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} required /></div>
              <div><label htmlFor="credit-note" className="auth-label">Note</label><input id="credit-note" className="field" data-testid="input-credit-note" placeholder="e.g. Deposit confirmed, MoMo ref 123" value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} required minLength={3} /></div>
            </div>
            <button type="submit" className="btn btn-primary" data-testid="button-credit-submit" disabled={crediting} style={{ marginTop: 16 }}>{crediting ? 'Saving…' : 'Update wallet'}</button>
          </form>
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

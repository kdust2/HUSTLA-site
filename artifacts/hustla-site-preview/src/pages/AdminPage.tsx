import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect } from 'wouter';
import { Check, Copy, KeyRound, MessageCircle, Search, Users, X } from 'lucide-react';
import { gh } from '@/lib/data';
import {
  api, statusLabel, timeAgo,
  type AdminSummary, type AdminUser, type ApiCampaign, type CampaignStatus, type ResetRequest, type ResetStatus,
} from '@/lib/api';
import { AppShell, Header } from '@/components/layout';
import { useAuth } from '@/lib/auth';

type Tab = 'campaigns' | 'members' | 'resets';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [links, setLinks] = useState<Record<number, { link: string; name: string; expiresAt: string }>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const isAdmin = !!user?.isAdmin;
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const loadSummary = useCallback(async () => {
    try { setSummary(await api<AdminSummary>('/admin/summary')); } catch { /* the tab below shows any real error */ }
  }, []);

  const loadTab = useCallback(async (which: Tab, status: Filter) => {
    setLoading(true);
    try {
      if (which === 'campaigns') setCampaigns((await api<{ campaigns: ApiCampaign[] }>(`/admin/campaigns?status=${status}`)).campaigns);
      if (which === 'members') setMembers((await api<{ users: AdminUser[] }>('/admin/users')).users);
      if (which === 'resets') setResets((await api<{ requests: ResetRequest[] }>('/admin/resets')).requests);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this section.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) void loadSummary(); }, [isAdmin, loadSummary]);
  useEffect(() => { if (isAdmin) void loadTab(tab, filter); }, [isAdmin, tab, filter, loadTab]);

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

  const review = async (id: number, decision: 'approve' | 'decline') => {
    setBusyId(id);
    try {
      await api(`/admin/campaigns/${id}/review`, { body: { decision } });
      notify(decision === 'approve' ? 'Approved. The campaign is live now.' : 'Campaign declined.');
      setConfirmDecline(null);
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
        {stat('Password resets', summary?.resets, summary?.resets ? 'People waiting for help' : 'None open', () => openTab('resets'), !!summary?.resets)}
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button type="button" role="tab" aria-selected={tab === 'campaigns'} className={tab === 'campaigns' ? 'on' : ''} data-testid="admin-tab-campaigns" onClick={() => openTab('campaigns')}>Campaigns</button>
        <button type="button" role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'on' : ''} data-testid="admin-tab-members" onClick={() => openTab('members')}>Members</button>
        <button type="button" role="tab" aria-selected={tab === 'resets'} className={tab === 'resets' ? 'on' : ''} data-testid="admin-tab-resets" onClick={() => openTab('resets')}>
          Password resets{summary?.resets ? <em className="admin-badge">{summary.resets}</em> : null}
        </button>
      </div>

      {tab !== 'resets' && (
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
                  <dl className="admin-facts">
                    <div><dt>Tasks</dt><dd>{c.quantity}</dd></div>
                    <div><dt>Reward each</dt><dd>{gh(c.reward)}</dd></div>
                    <div><dt>Total budget</dt><dd>{gh(c.quantity * c.reward)}</dd></div>
                    <div><dt>Applicants</dt><dd>{c.applicantCount ?? 0}</dd></div>
                  </dl>
                  <div className="admin-card-foot">
                    <div className="admin-person">
                      <span className="avatar" aria-hidden="true">{initials(c.ownerName ?? '')}</span>
                      <span><strong>{c.ownerName}</strong><small>{c.ownerEmail}</small></span>
                    </div>
                    {c.status === 'pending_review' && (confirmDecline === c.id ? (
                      <div className="admin-actions" role="group" aria-label="Confirm decline">
                        <span className="admin-confirm">Decline this campaign?</span>
                        <button type="button" className="btn btn-small" data-testid={`button-cancel-decline-${c.id}`} disabled={busyId === c.id} onClick={() => setConfirmDecline(null)}>Keep</button>
                        <button type="button" className="btn btn-small btn-danger" data-testid={`button-confirm-decline-${c.id}`} disabled={busyId === c.id} onClick={() => void review(c.id, 'decline')}>Yes, decline</button>
                      </div>
                    ) : (
                      <div className="admin-actions">
                        <button type="button" className="btn btn-small" data-testid={`button-decline-${c.id}`} disabled={busyId === c.id} onClick={() => setConfirmDecline(c.id)}><X size={14} /> Decline</button>
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

      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  );
}

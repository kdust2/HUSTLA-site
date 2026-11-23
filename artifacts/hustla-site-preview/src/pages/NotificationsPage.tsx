import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Bell } from 'lucide-react';
import { api, timeAgo, type AppNotification } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';

export function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api<{ unread: number; items: AppNotification[] }>('/notifications');
      setItems(data.items);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your notifications.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (n: AppNotification) => {
    if (!n.read) {
      try { await api('/notifications/read', { body: { id: n.id } }); } catch { /* the link still works */ }
      window.dispatchEvent(new Event('hustla-notifications'));
    }
    if (n.href) setLocation(n.href); else await load();
  };
  const markAll = async () => {
    try { await api('/notifications/read', { body: { all: true } }); } catch { /* ignore */ }
    window.dispatchEvent(new Event('hustla-notifications'));
    await load();
  };

  return (
    <AppShell title="Notifications">
      <Header eyebrow="Updates" title="Notifications." description="Applications, submissions, decisions and reminders show up here."
        action={items && items.some((n) => !n.read) ? <button type="button" className="btn" data-testid="button-mark-all-read" onClick={() => void markAll()}>Mark all as read</button> : undefined} />
      {error && <div className="notice" role="alert">{error}</div>}
      {!items && !error && <p className="auth-caption" role="status">Loading…</p>}
      {items && items.length === 0 && <div className="empty-state"><Bell size={26} /><h2>Nothing yet</h2><p>You will see updates here as things happen.</p></div>}
      {items && items.length > 0 && (
        <section className="surface">
          {items.map((n) => (
            <button type="button" key={n.id} className={`note-row${n.read ? '' : ' unread'}`} data-testid={`notification-${n.id}`} onClick={() => void open(n)}>
              <span className="note-dot" aria-hidden="true" />
              <span className="note-main"><strong>{n.title}</strong>{n.body && <small>{n.body}</small>}</span>
              <span className="note-time">{timeAgo(n.createdAt)}</span>
            </button>
          ))}
        </section>
      )}
    </AppShell>
  );
}

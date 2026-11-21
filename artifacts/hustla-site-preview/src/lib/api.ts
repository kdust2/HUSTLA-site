export type ApiUser = { id: number; name: string; email: string; isAdmin: boolean };

export type CampaignStatus = 'pending_review' | 'live' | 'declined' | 'closed';
export type ApiCampaign = {
  id: number;
  title: string;
  description: string;
  category: string;
  quantity: number;
  reward: number;
  days: number;
  daysLeft: number;
  status: CampaignStatus;
  createdAt: string;
  spotsOpen?: number;
  applicantCount?: number;
  applied?: boolean;
  isOwn?: boolean;
  ownerName?: string;
  ownerEmail?: string;
};

export const statusLabel: Record<CampaignStatus, string> = {
  pending_review: 'Pending review',
  live: 'Live',
  declined: 'Declined',
  closed: 'Closed',
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach HUSTLA. Check your connection and try again.');
  }
  let data: any = null;
  try { data = await response.json(); } catch { /* empty or non-JSON body */ }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? 'error', data?.message ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

export type AdminSummary = { pending: number; live: number; declined: number; users: number; resets: number; emailEnabled: boolean };
export type AdminUser = { id: number; name: string; email: string; createdAt: string; campaigns: number; applications: number; isAdmin: boolean };
export type ResetStatus = 'waiting' | 'link_ready' | 'expired' | 'done' | 'dismissed';
export type ResetRequest = { id: number; name: string; email: string; createdAt: string; isAdmin: boolean; status: ResetStatus };

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
